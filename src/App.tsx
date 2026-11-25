import { useEffect, useState } from 'react';
import type {
  AgeBracket,
  ComputedSessionResult,
  DomainKey,
  GameSlug,
  OnboardingProfileData,
  SessionMode,
  ThemeMode,
} from './types/cognitive';
import {
  clearLocalState,
  loadLocalState,
  loadRemoteState,
  recordSessionResult,
  saveLocalState,
  skipCalibrationToLowestLevel,
  updateProfilePreferences,
  type AppDataState,
} from './lib/dataService';
import {
  ADMIN_USER_ID,
  createLocalTestUser,
  ensureLocalUserDb,
  getActiveLocalUserId,
  getLocalUserState,
  listLocalUsers,
  resetLocalUserDb,
  setActiveLocalUserId,
} from './lib/localUserDb';
import {
  advanceSimulatedDay,
  formatShortDateBr,
  getAppTodayIso,
  getSimulatedDayOffset,
  resetSimulatedDayOffset,
} from './lib/appClock';
import { checkBackendOnline, supabase } from './lib/supabase';
import {
  generateDailyProtocol,
  pickNextFlowGame,
  getCalibrationDomains,
  getWeakestDomains,
  scoreToPercent,
} from './engine/psychometricEngine';
import { DOMAIN_MAP, GAME_MAP, GAMES_BY_DOMAIN } from './engine/gameRegistry';
import {
  computeWeeklyEvolution,
  type PreviousExerciseReference,
} from './engine/cognitiveProfiler';
import { sound } from './lib/audio';
import { Layout, type TabKey } from './components/Layout';
import {
  GameShell,
  type CalibrationBannerInfo,
  type DailyWorkoutProgressInfo,
} from './components/GameShell';
import { AuthScreen } from './screens/AuthScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AdminUsersScreen } from './screens/AdminUsersScreen';

type FlowView = 'auth' | 'onboarding' | 'calibration' | 'app' | 'playing' | 'settings' | 'admin';

function resolveNextView(state: AppDataState): FlowView {
  const hasOnboarding = (state.profile.selected_domains?.length ?? 0) > 0;
  if (!hasOnboarding) return 'onboarding';
  if (!state.profile.calibrated) return 'calibration';
  return 'app';
}

function capturePreviousReference(
  state: AppDataState,
  slug: GameSlug
): PreviousExerciseReference {
  const game = GAME_MAP[slug];
  const prog = state.progress[slug];
  const lastSameSession = state.sessions.find((s) => s.game_slug === slug);
  return {
    previousIndexPct: lastSameSession ? scoreToPercent(lastSameSession.score) : null,
    previousRtMs: lastSameSession && lastSameSession.rt_mean_ms > 0 ? lastSameSession.rt_mean_ms : null,
    bestIndexPct: prog?.highest_score ? scoreToPercent(prog.highest_score) : 0,
    totalPlaysBefore: prog?.total_plays ?? 0,
    domainScoreBeforePct: scoreToPercent(state.scores[game.domain] ?? 0),
  };
}

function loadInitialSession(): AppDataState | null {
  const saved = loadLocalState();
  if (!saved) return null;
  if (saved.profile.isLocalGuest) {
    ensureLocalUserDb();
    const activeId = saved.profile.id === 'local-guest' ? ADMIN_USER_ID : getActiveLocalUserId();
    const localAccount = getLocalUserState(activeId) ?? getLocalUserState(ADMIN_USER_ID);
    if (localAccount) {
      saveLocalState(localAccount);
      return localAccount;
    }
  }
  return saved;
}

export default function App() {
  const [data, setData] = useState<AppDataState | null>(() => loadInitialSession());
  const [view, setView] = useState<FlowView>(() => {
    const saved = loadInitialSession();
    return saved ? resolveNextView(saved) : 'auth';
  });
  const [tab, setTab] = useState<TabKey>('home');
  const [theme, setTheme] = useState<ThemeMode>(() => loadInitialSession()?.profile.theme_preference ?? 'light');
  const [backendOnline, setBackendOnline] = useState(false);
  const [justCalibrated, setJustCalibrated] = useState(false);
  const [simDayOffset, setSimDayOffset] = useState<number>(() => getSimulatedDayOffset());

  const [activePlay, setActivePlay] = useState<{
    slug: GameSlug;
    stage: number;
    easeBoost: boolean;
    mode: SessionMode;
    returnView: FlowView;
    previousRef: PreviousExerciseReference;
    calibrationInfo?: CalibrationBannerInfo;
    guidedQueue?: GameSlug[];
    domainFocusQueue?: { domain: DomainKey; slugs: GameSlug[] };
    flowMode?: boolean;
    sandboxMode?: boolean;
  } | null>(null);

  // Apenas conta ADM exibe o painel de perfis de teste
  const isAdminSession = Boolean(data?.profile.isAdmin);
  const impersonatingUserName =
    isAdminSession && data && data.profile.id !== ADMIN_USER_ID ? data.profile.name : null;

  // Quando em conta local (isLocalGuest), mantém effectiveBackendOnline = false para garantir ZERO chamadas ao Supabase
  const effectiveBackendOnline = data?.profile.isLocalGuest ? false : backendOnline;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0D121E' : '#F3F6FA');
    }
    sound.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    // Se já estiver em modo local (0 consumo Supabase), não faz polling nem auth no Supabase
    if (data?.profile.isLocalGuest) return;
    void (async () => {
      const online = await checkBackendOnline();
      setBackendOnline(online);
      if (online) {
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session?.user) {
          const metaName =
            typeof sess.session.user.user_metadata?.username === 'string'
              ? sess.session.user.user_metadata.username
              : undefined;
          const remote = await loadRemoteState(sess.session.user.id, sess.session.user.email, metaName);
          setData(remote);
          setTheme(remote.profile.theme_preference);
          setView(resolveNextView(remote));
        }
      }
    })();
  }, [data?.profile.isLocalGuest]);

  const handleThemeChange = async (next: ThemeMode) => {
    setTheme(next);
    sound.tap();
    if (data) {
      const updated = await updateProfilePreferences(data, { theme_preference: next });
      setData(updated);
    }
  };

  const handleToggleTheme = () => {
    void handleThemeChange(theme === 'dark' ? 'light' : 'dark');
  };

  /**
   * Entra direto como Teste ADM na base local (0 consumo Supabase) com 8 perfis prontos.
   */
  const handleGuestLogin = () => {
    ensureLocalUserDb();
    const admState = setActiveLocalUserId(ADMIN_USER_ID) ?? getLocalUserState(ADMIN_USER_ID);
    if (!admState) return;
    admState.profile.theme_preference = theme;
    saveLocalState(admState);
    setData(admState);
    setTab('home');
    setView(resolveNextView(admState));
  };

  const handleLocalAccountLogin = (accountState: AppDataState) => {
    accountState.profile.theme_preference = theme;
    saveLocalState(accountState);
    setData(accountState);
    setJustCalibrated(false);
    setTab('home');
    setView(resolveNextView(accountState));
  };

  const handleRemoteLogin = async (userId: string, email?: string, displayName?: string) => {
    const remote = await loadRemoteState(userId, email, displayName);
    setData(remote);
    setTheme(remote.profile.theme_preference);
    setView(resolveNextView(remote));
  };

  const handleSelectLocalUser = (userId: string) => {
    sound.tap();
    const target = setActiveLocalUserId(userId);
    if (!target) return;
    target.profile.theme_preference = theme;
    saveLocalState(target);
    setData(target);
    setJustCalibrated(false);
    setTab('home');
    setView(resolveNextView(target));
  };

  const handleReturnToAdmin = () => {
    handleSelectLocalUser(ADMIN_USER_ID);
  };

  const handleCreateLocalUser = (name: string, ageBracket: AgeBracket) => {
    sound.hit(2);
    const created = createLocalTestUser(name, ageBracket);
    created.profile.theme_preference = theme;
    saveLocalState(created);
    setData(created);
    setJustCalibrated(false);
    setTab('home');
    setView(resolveNextView(created));
  };

  const handleResetLocalDb = () => {
    sound.tap();
    const freshAdm = resetLocalUserDb();
    setSimDayOffset(0);
    freshAdm.profile.theme_preference = theme;
    saveLocalState(freshAdm);
    setData(freshAdm);
    setTab('home');
    setView('admin');
  };

  /**
   * Botão ADM "+1 dia": avança o relógio local em +1 dia e gera o novo Treino Diário do dia seguinte.
   */
  const handleAdvanceDay = () => {
    if (!data) return;
    sound.hit(2);
    const nextOffset = advanceSimulatedDay(1);
    setSimDayOffset(nextOffset);
    const newToday = getAppTodayIso();
    const refreshed: AppDataState = {
      ...data,
      dailyProtocol: generateDailyProtocol(
        data.scores,
        newToday,
        data.profile.selected_domains,
        data.profile.daily_goal_minutes
      ),
    };
    saveLocalState(refreshed);
    setData(refreshed);
  };

  const handleResetDay = () => {
    if (!data) return;
    sound.tap();
    resetSimulatedDayOffset();
    setSimDayOffset(0);
    const realToday = getAppTodayIso();
    const refreshed: AppDataState = {
      ...data,
      dailyProtocol: generateDailyProtocol(
        data.scores,
        realToday,
        data.profile.selected_domains,
        data.profile.daily_goal_minutes
      ),
    };
    saveLocalState(refreshed);
    setData(refreshed);
  };

  const simulatedDateLabel = formatShortDateBr(getAppTodayIso());

  const handleOnboardingComplete = async (ob: OnboardingProfileData) => {
    if (!data) return;
    const updated = await updateProfilePreferences(data, {
      selected_domains: ob.selected_domains,
      daily_goal_minutes: ob.daily_goal_minutes,
      peak_time: ob.peak_time,
      cognitive_bottlenecks: ob.bottlenecks,
      mental_stamina_baseline: ob.mental_stamina_baseline,
      application_context: ob.application_context,
      application_contexts: ob.application_contexts,
      age_bracket: ob.age_bracket,
      onboarding_answers: {
        goals: ob.goals,
        bottlenecks: ob.bottlenecks,
        bottleneck_domains: ob.bottleneck_domains,
        mental_stamina_baseline: ob.mental_stamina_baseline,
        application_context: ob.application_context,
        application_contexts: ob.application_contexts,
        age_bracket: ob.age_bracket,
      },
    });
    setData(updated);

    if (updated.profile.calibrated) {
      setView('app');
      return;
    }

    if (ob.startCalibrationNow) {
      const calDomains = getCalibrationDomains(updated.profile.selected_domains);
      const firstDom = DOMAIN_MAP[calDomains[0]];
      if (firstDom) {
        setActivePlay({
          slug: firstDom.calibrationGame,
          stage: 1,
          easeBoost: false,
          mode: 'calibration',
          returnView: 'calibration',
          previousRef: capturePreviousReference(updated, firstDom.calibrationGame),
          calibrationInfo: {
            currentIndex: 1,
            total: calDomains.length,
            domainName: firstDom.shortName,
          },
        });
        setView('playing');
        return;
      }
    }

    setView('calibration');
  };

  const startGame = (
    slug: GameSlug,
    mode: SessionMode,
    returnView: FlowView = 'app',
    calibrationInfo?: CalibrationBannerInfo,
    guidedQueue?: GameSlug[],
    domainFocusQueue?: { domain: DomainKey; slugs: GameSlug[] },
    flowMode = false
  ) => {
    if (!data) return;
    const prog = data.progress[slug];
    const stage = mode === 'calibration' ? 1 : Math.max(1, prog?.current_stage ?? 1);
    const easeBoost = mode === 'calibration' ? false : Boolean(prog?.ease_mode && stage === 1);
    setActivePlay({
      slug,
      stage,
      easeBoost,
      mode,
      returnView,
      previousRef: capturePreviousReference(data, slug),
      calibrationInfo,
      guidedQueue,
      domainFocusQueue,
      flowMode,
    });
    setView('playing');
  };

  const handleStartFlow = (justPlayedSlug?: GameSlug) => {
    if (!data) return;
    const pick = pickNextFlowGame(data.progress, data.scores, justPlayedSlug);
    startGame(pick.slug, 'free', 'app', undefined, undefined, undefined, true);
  };

  const handleImproveDomain = (domain: DomainKey) => {
    if (!data) return;
    const domainGames = [...GAMES_BY_DOMAIN[domain]].sort((a, b) => {
      const pa = data.progress[a.slug];
      const pb = data.progress[b.slug];
      const stageDiff = (pa?.current_stage ?? 0) - (pb?.current_stage ?? 0);
      if (stageDiff !== 0) return stageDiff;
      return (pa?.total_plays ?? 0) - (pb?.total_plays ?? 0);
    });
    const slugs = domainGames.map((g) => g.slug);
    if (slugs.length === 0) return;
    startGame(slugs[0], 'free', 'app', undefined, undefined, { domain, slugs });
  };

  const handleSessionComplete = async (result: ComputedSessionResult) => {
    if (!data) return;
    const wasCalibrated = data.profile.calibrated;
    const updated = await recordSessionResult(data, result);
    setData(updated);

    if (result.mode === 'calibration' && !wasCalibrated && updated.profile.calibrated) {
      setJustCalibrated(true);
      setActivePlay(null);
      setTab('stats');
      setView('app');
    }
  };

  const handleLogout = async () => {
    if (effectiveBackendOnline) {
      await supabase.auth.signOut().catch(() => {});
    }
    clearLocalState();
    setData(null);
    setView('auth');
  };

  if (view === 'auth' || !data) {
    return (
      <AuthScreen
        backendOnline={backendOnline}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onGuestLogin={handleGuestLogin}
        onLocalAccountLogin={handleLocalAccountLogin}
        onRemoteLogin={handleRemoteLogin}
      />
    );
  }

  if (view === 'playing' && activePlay) {
    const weakest2 = getWeakestDomains(data.scores, 2);

    let nextChallengeLabel: string | undefined;
    let onNextChallenge: (() => void) | undefined;
    let workoutProgress: DailyWorkoutProgressInfo | undefined;

    if (activePlay.mode === 'calibration') {
      const calDomains = getCalibrationDomains(data.profile.selected_domains);
      const pendingIdx = calDomains.findIndex((d) => !data.scores.baseline_scores?.[d]);
      if (pendingIdx !== -1) {
        const nextDom = DOMAIN_MAP[calDomains[pendingIdx]];
        nextChallengeLabel = `Próxima avaliação (${pendingIdx + 1}/${calDomains.length})`;
        onNextChallenge = () =>
          startGame(nextDom.calibrationGame, 'calibration', 'calibration', {
            currentIndex: pendingIdx + 1,
            total: calDomains.length,
            domainName: nextDom.shortName,
          });
      } else {
        nextChallengeLabel = 'Abrir Dossiê Cognitivo';
        onNextChallenge = () => {
          setActivePlay(null);
          setTab('stats');
          setView('app');
        };
      }
    } else if (activePlay.mode === 'guided') {
      const done = new Set(data.dailyProtocol.completed_games);
      const list = activePlay.guidedQueue ?? data.dailyProtocol.recommended_games.map((g) => g.slug);
      const nextSlug = list.find((s) => !done.has(s) && s !== activePlay.slug);
      const completedCount = list.filter((s) => done.has(s)).length;
      const weekly = computeWeeklyEvolution(
        data.sessions,
        data.snapshots,
        data.profile.global_cognitive_index
      );

      workoutProgress = {
        completedAfter: completedCount,
        total: list.length,
        isLastOfWorkout: !nextSlug && list.length > 0,
        streakDays: Math.max(1, data.profile.current_streak),
        weekDays: weekly.days,
      };

      if (nextSlug) {
        const nextStepNum = Math.min(list.length, completedCount + 1);
        nextChallengeLabel = `Próximo do Treino (${nextStepNum}/${list.length})`;
        onNextChallenge = () => startGame(nextSlug, 'guided', 'app', undefined, list);
      }
    } else if (activePlay.flowMode) {
      const nextPick = pickNextFlowGame(data.progress, data.scores, activePlay.slug);
      const nextGameMeta = GAME_MAP[nextPick.slug];
      nextChallengeLabel = `Próximo exercício · ${nextGameMeta.name}`;
      onNextChallenge = () =>
        startGame(nextPick.slug, 'free', 'app', undefined, undefined, undefined, true);
    } else if (activePlay.guidedQueue && activePlay.guidedQueue.length > 0) {
      const queue = activePlay.guidedQueue.filter((s) => Boolean(GAME_MAP[s]));
      const curIdx = queue.indexOf(activePlay.slug);
      const nextSlug = curIdx >= 0 && curIdx + 1 < queue.length ? queue[curIdx + 1] : undefined;
      if (nextSlug) {
        const nextNum = curIdx + 2;
        nextChallengeLabel = `Próximo (${nextNum}/${queue.length}) · ${GAME_MAP[nextSlug].name}`;
        onNextChallenge = () =>
          startGame(nextSlug, 'free', 'app', undefined, queue);
      }
    } else if (activePlay.domainFocusQueue) {
      const { domain, slugs } = activePlay.domainFocusQueue;
      const curIdx = slugs.indexOf(activePlay.slug);
      const nextSlug = curIdx >= 0 && curIdx + 1 < slugs.length ? slugs[curIdx + 1] : undefined;
      if (nextSlug) {
        nextChallengeLabel = `Próximo de ${DOMAIN_MAP[domain].shortName}: ${GAME_MAP[nextSlug].name}`;
        onNextChallenge = () =>
          startGame(nextSlug, 'free', 'app', undefined, undefined, activePlay.domainFocusQueue);
      }
    }

    return (
      <GameShell
        slug={activePlay.slug}
        stage={activePlay.stage}
        easeBoost={activePlay.easeBoost}
        mode={activePlay.mode}
        theme={theme}
        ageBracket={data.profile.age_bracket}
        userId={data.profile.id}
        sendRemoteTelemetry={effectiveBackendOnline && !data.profile.isLocalGuest}
        isAdminSession={isAdminSession}
        sandboxMode={Boolean(activePlay.sandboxMode)}
        weakestTwo={weakest2}
        previousRef={activePlay.previousRef}
        gameSessions={data.sessions.filter((s) => s.game_slug === activePlay.slug)}
        calibrationInfo={activePlay.calibrationInfo}
        workoutProgress={workoutProgress}
        nextChallengeLabel={nextChallengeLabel}
        onNextChallenge={onNextChallenge}
        onComplete={handleSessionComplete}
        onPlayNext={(nextStage, nextEase) =>
          setActivePlay((prev) =>
            prev
              ? {
                  ...prev,
                  stage: nextStage,
                  easeBoost: nextEase,
                  previousRef: capturePreviousReference(data, prev.slug),
                }
              : null
          )
        }
        onExit={() => {
          const target =
            activePlay.mode === 'calibration' && data.profile.calibrated
              ? 'app'
              : activePlay.returnView;
          setActivePlay(null);
          setView(target);
        }}
      />
    );
  }

  const adminLayoutProps = {
    isAdminSession,
    impersonatingUserName,
    simulatedDayOffset: simDayOffset,
    simulatedDateLabel,
    onNextDay: handleAdvanceDay,
    onResetDay: handleResetDay,
    onOpenAdmin: () => {
      sound.tap();
      setView('admin');
    },
    onReturnToAdmin: handleReturnToAdmin,
  };

  if (view === 'onboarding') {
    const prevAnswers = data.profile.onboarding_answers as { goals?: string[]; bottlenecks?: string[] } | undefined;
    return (
      <Layout
        activeTab={tab}
        onTab={setTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        {...adminLayoutProps}
        showNav={false}
      >
        <OnboardingScreen
          initialGoals={prevAnswers?.goals ?? []}
          initialMinutes={data.profile.daily_goal_minutes}
          initialPeak={data.profile.peak_time}
          initialBottlenecks={
            data.profile.cognitive_bottlenecks?.length
              ? data.profile.cognitive_bottlenecks
              : (prevAnswers?.bottlenecks ?? [])
          }
          initialStamina={data.profile.mental_stamina_baseline ?? 3}
          initialContext={data.profile.application_context ?? null}
          initialContexts={data.profile.application_contexts ?? []}
          initialAgeBracket={data.profile.age_bracket ?? '25-34'}
          onComplete={(ob) => void handleOnboardingComplete(ob)}
        />
      </Layout>
    );
  }

  if (view === 'calibration') {
    return (
      <Layout
        activeTab={tab}
        onTab={setTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        {...adminLayoutProps}
        showNav={false}
      >
        <CalibrationScreen
          selectedDomains={data.profile.selected_domains}
          scores={data.scores}
          onStartGame={(slug, idx, total, domainName) =>
            startGame(slug, 'calibration', 'calibration', {
              currentIndex: idx,
              total,
              domainName,
            })
          }
          onSkipCalibration={async () => {
            const updated = await skipCalibrationToLowestLevel(data);
            setData(updated);
            setView('app');
          }}
          onFinishCalibration={async () => {
            const updated = await updateProfilePreferences(data, {
              calibrated: true,
              calibration_skipped: false,
            });
            setData(updated);
            setJustCalibrated(true);
            setTab('stats');
            setView('app');
          }}
        />
      </Layout>
    );
  }

  if (view === 'admin') {
    return (
      <Layout
        activeTab={tab}
        onTab={(t) => {
          sound.tap();
          setTab(t);
          setView('app');
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        {...adminLayoutProps}
        onOpenAdmin={undefined}
        showNav={true}
      >
        <AdminUsersScreen
          users={listLocalUsers()}
          activeUserId={data.profile.id}
          backendOnline={effectiveBackendOnline}
          onSelectUser={handleSelectLocalUser}
          onCreateUser={handleCreateLocalUser}
          onResetDb={handleResetLocalDb}
          onClose={() => setView('app')}
        />
      </Layout>
    );
  }

  if (view === 'settings') {
    return (
      <Layout
        activeTab={tab}
        onTab={(t) => {
          sound.tap();
          setTab(t);
          setView('app');
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        {...adminLayoutProps}
        showNav={true}
      >
        <ProfileScreen
          data={data}
          backendOnline={effectiveBackendOnline}
          isAdminSession={isAdminSession}
          onOpenAdmin={() => setView('admin')}
          onChangeTheme={(t) => void handleThemeChange(t)}
          onRedoOnboarding={() => setView('onboarding')}
          onOpenCalibration={() => setView('calibration')}
          onClose={() => setView('app')}
          onLogout={() => void handleLogout()}
        />
      </Layout>
    );
  }

  return (
    <Layout
      activeTab={tab}
      onTab={(t) => {
        sound.tap();
        setTab(t);
      }}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      {...adminLayoutProps}
      onOpenSettings={() => {
        sound.tap();
        setView('settings');
      }}
    >
      {tab === 'home' && (
        <HomeScreen
          data={data}
          onStartGame={(slug, mode, queue) => startGame(slug, mode, 'app', undefined, queue)}
          onStartFlow={() => handleStartFlow()}
          onOpenCalibration={() => setView('calibration')}
        />
      )}
      {tab === 'catalog' && (
        <CatalogScreen
          data={data}
          backendOnline={effectiveBackendOnline}
          onStartGame={(slug, mode) => startGame(slug, mode, 'app')}
        />
      )}
      {tab === 'stats' && (
        <StatsScreen
          data={data}
          backendOnline={effectiveBackendOnline}
          justCalibrated={justCalibrated}
          onDismissCalibratedBanner={() => setJustCalibrated(false)}
          onStartGame={(slug, mode) => startGame(slug, mode, 'app')}
          onImproveDomain={handleImproveDomain}
        />
      )}
    </Layout>
  );
}

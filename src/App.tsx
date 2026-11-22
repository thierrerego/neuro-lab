import { useEffect, useState } from 'react';
import type {
  ComputedSessionResult,
  GameSlug,
  OnboardingProfileData,
  SessionMode,
  ThemeMode,
} from './types/cognitive';
import {
  clearLocalState,
  createDefaultState,
  loadLocalState,
  loadRemoteState,
  recordSessionResult,
  saveLocalState,
  skipCalibrationToLowestLevel,
  updateProfilePreferences,
  type AppDataState,
} from './lib/dataService';
import { checkBackendOnline, supabase } from './lib/supabase';
import { getCalibrationDomains, getWeakestDomains } from './engine/psychometricEngine';
import { DOMAIN_MAP } from './engine/gameRegistry';
import { sound } from './lib/audio';
import { Layout, type TabKey } from './components/Layout';
import { GameShell, type CalibrationBannerInfo } from './components/GameShell';
import { AuthScreen } from './screens/AuthScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ProfileScreen } from './screens/ProfileScreen';

type FlowView = 'auth' | 'onboarding' | 'calibration' | 'app' | 'playing' | 'settings';

function resolveNextView(state: AppDataState): FlowView {
  const hasOnboarding = (state.profile.selected_domains?.length ?? 0) > 0;
  if (!hasOnboarding) return 'onboarding';
  if (!state.profile.calibrated) return 'calibration';
  return 'app';
}

export default function App() {
  const [data, setData] = useState<AppDataState | null>(() => loadLocalState());
  const [view, setView] = useState<FlowView>(() => {
    const saved = loadLocalState();
    return saved ? resolveNextView(saved) : 'auth';
  });
  const [tab, setTab] = useState<TabKey>('home');
  const [theme, setTheme] = useState<ThemeMode>(() => loadLocalState()?.profile.theme_preference ?? 'dark');
  const [backendOnline, setBackendOnline] = useState(false);
  const [justCalibrated, setJustCalibrated] = useState(false);

  const [activePlay, setActivePlay] = useState<{
    slug: GameSlug;
    stage: number;
    easeBoost: boolean;
    mode: SessionMode;
    returnView: FlowView;
    calibrationInfo?: CalibrationBannerInfo;
    guidedQueue?: GameSlug[];
  } | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    sound.setTheme(theme);
  }, [theme]);

  useEffect(() => {
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
  }, []);

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

  const handleGuestLogin = () => {
    const existing = loadLocalState();
    const state = existing ?? createDefaultState('local-guest', 'Participante Local', true);
    state.profile.theme_preference = theme;
    saveLocalState(state);
    setData(state);
    setView(resolveNextView(state));
  };

  const handleRemoteLogin = async (userId: string, email?: string, displayName?: string) => {
    const remote = await loadRemoteState(userId, email, displayName);
    setData(remote);
    setTheme(remote.profile.theme_preference);
    setView(resolveNextView(remote));
  };

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
          stage: 0,
          easeBoost: false,
          mode: 'calibration',
          returnView: 'calibration',
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
    guidedQueue?: GameSlug[]
  ) => {
    if (!data) return;
    const prog = data.progress[slug];
    const stage = mode === 'calibration' ? 0 : (prog?.current_stage ?? 0);
    const easeBoost = mode === 'calibration' ? false : Boolean(prog?.ease_mode && stage === 0);
    setActivePlay({ slug, stage, easeBoost, mode, returnView, calibrationInfo, guidedQueue });
    setView('playing');
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
    if (backendOnline) {
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
        onRemoteLogin={handleRemoteLogin}
      />
    );
  }

  if (view === 'playing' && activePlay) {
    const weakest2 = getWeakestDomains(data.scores, 2);

    let nextChallengeLabel: string | undefined;
    let onNextChallenge: (() => void) | undefined;

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
      if (nextSlug) {
        nextChallengeLabel = 'Próximo exercício da sessão';
        onNextChallenge = () => startGame(nextSlug, 'guided', 'app', undefined, list);
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
        weakestTwo={weakest2}
        calibrationInfo={activePlay.calibrationInfo}
        nextChallengeLabel={nextChallengeLabel}
        onNextChallenge={onNextChallenge}
        onComplete={handleSessionComplete}
        onPlayNext={(nextStage, nextEase) =>
          setActivePlay((prev) => (prev ? { ...prev, stage: nextStage, easeBoost: nextEase } : null))
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

  if (view === 'onboarding') {
    const prevAnswers = data.profile.onboarding_answers as { goals?: string[]; bottlenecks?: string[] } | undefined;
    return (
      <Layout
        activeTab={tab}
        onTab={setTab}
        theme={theme}
        onToggleTheme={handleToggleTheme}
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
        showNav={true}
      >
        <ProfileScreen
          data={data}
          backendOnline={backendOnline}
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
      onOpenSettings={() => {
        sound.tap();
        setView('settings');
      }}
    >
      {tab === 'home' && (
        <HomeScreen
          data={data}
          onStartGame={(slug, mode, queue) => startGame(slug, mode, 'app', undefined, queue)}
          onOpenCalibration={() => setView('calibration')}
        />
      )}
      {tab === 'catalog' && (
        <CatalogScreen
          data={data}
          backendOnline={backendOnline}
          onStartGame={(slug, mode) => startGame(slug, mode, 'app')}
        />
      )}
      {tab === 'stats' && (
        <StatsScreen
          data={data}
          backendOnline={backendOnline}
          justCalibrated={justCalibrated}
          onDismissCalibratedBanner={() => setJustCalibrated(false)}
          onStartGame={(slug, mode) => startGame(slug, mode, 'app')}
        />
      )}
    </Layout>
  );
}

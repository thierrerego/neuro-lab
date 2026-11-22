import { useEffect, useState } from 'react';
import type {
  ComputedSessionResult,
  GameSlug,
  OnboardingProfileData,
  PlanTier,
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

type FlowView = 'auth' | 'onboarding' | 'calibration' | 'app' | 'playing';

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
  const [theme, setTheme] = useState<ThemeMode>(() => loadLocalState()?.profile.theme_preference ?? 'gamified');
  const [backendOnline, setBackendOnline] = useState(false);

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
          const remote = await loadRemoteState(sess.session.user.id, sess.session.user.email);
          setData(remote);
          setTheme(remote.profile.theme_preference);
          setView(resolveNextView(remote));
        }
      }
    })();
  }, []);

  const handleThemeChange = async (next: ThemeMode) => {
    setTheme(next);
    if (next === 'gamified') sound.hit(2);
    if (data) {
      const updated = await updateProfilePreferences(data, { theme_preference: next });
      setData(updated);
    }
  };

  const handleToggleTheme = () => {
    void handleThemeChange(theme === 'gamified' ? 'minimal' : 'gamified');
  };

  const handleGuestLogin = () => {
    const existing = loadLocalState();
    const state = existing ?? createDefaultState('local-guest', 'Jogador Local', true);
    state.profile.theme_preference = theme;
    saveLocalState(state);
    setData(state);
    setView(resolveNextView(state));
  };

  const handleRemoteLogin = async (userId: string, email?: string) => {
    const remote = await loadRemoteState(userId, email);
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
      onboarding_answers: {
        goals: ob.goals,
        bottlenecks: ob.bottlenecks,
      },
    });
    setData(updated);
    setView(updated.profile.calibrated ? 'app' : 'calibration');
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
    const stage = mode === 'calibration' ? 1 : (prog?.current_stage ?? 1);
    const easeBoost = mode === 'calibration' ? false : Boolean(prog?.ease_mode && stage === 1);
    setActivePlay({ slug, stage, easeBoost, mode, returnView, calibrationInfo, guidedQueue });
    setView('playing');
  };

  const handleSessionComplete = async (result: ComputedSessionResult) => {
    if (!data) return;
    const updated = await recordSessionResult(data, result);
    setData(updated);
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
        nextChallengeLabel = `Próximo Teste (${pendingIdx + 1}/${calDomains.length})`;
        onNextChallenge = () =>
          startGame(nextDom.calibrationGame, 'calibration', 'calibration', {
            currentIndex: pendingIdx + 1,
            total: calDomains.length,
            domainName: nextDom.shortName,
          });
      } else {
        nextChallengeLabel = 'Ver Perfil Inicial';
        onNextChallenge = () => {
          setActivePlay(null);
          setView('app');
        };
      }
    } else if (activePlay.mode === 'guided') {
      const done = new Set(data.dailyProtocol.completed_games);
      const list = activePlay.guidedQueue ?? data.dailyProtocol.recommended_games.map((g) => g.slug);
      const nextSlug = list.find((s) => !done.has(s) && s !== activePlay.slug);
      if (nextSlug) {
        nextChallengeLabel = 'Próximo Desafio';
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
        streak={data.profile.current_streak}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        showNav={false}
      >
        <OnboardingScreen
          initialGoals={prevAnswers?.goals ?? []}
          initialMinutes={data.profile.daily_goal_minutes}
          initialPeak={data.profile.peak_time}
          initialBottlenecks={prevAnswers?.bottlenecks ?? []}
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
        streak={data.profile.current_streak}
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
            setView('app');
          }}
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
      streak={data.profile.current_streak}
      theme={theme}
      onToggleTheme={handleToggleTheme}
    >
      {tab === 'home' && (
        <HomeScreen
          data={data}
          onStartGame={(slug, mode, queue) => startGame(slug, mode, 'app', undefined, queue)}
          onGoStats={() => setTab('stats')}
          onOpenCalibration={() => setView('calibration')}
        />
      )}
      {tab === 'catalog' && (
        <CatalogScreen
          data={data}
          onStartGame={(slug, mode) => startGame(slug, mode, 'app')}
        />
      )}
      {tab === 'stats' && <StatsScreen data={data} />}
      {tab === 'profile' && (
        <ProfileScreen
          data={data}
          backendOnline={backendOnline}
          onChangeTheme={(t) => void handleThemeChange(t)}
          onChangePlan={async (plan: PlanTier) => {
            const updated = await updateProfilePreferences(data, { plan_tier: plan });
            setData(updated);
          }}
          onRedoOnboarding={() => setView('onboarding')}
          onOpenCalibration={() => setView('calibration')}
          onLogout={() => void handleLogout()}
        />
      )}
    </Layout>
  );
}

import { useEffect, useState } from 'react';
import type { ComputedSessionResult, GameSlug, PlanTier, SessionMode, ThemeMode } from './types/cognitive';
import {
  clearLocalState,
  createDefaultState,
  loadLocalState,
  loadRemoteState,
  recordSessionResult,
  saveLocalState,
  updateProfilePreferences,
  type AppDataState,
} from './lib/dataService';
import { checkBackendOnline, supabase } from './lib/supabase';
import { getWeakestDomains } from './engine/psychometricEngine';
import { sound } from './lib/audio';
import { Layout, type TabKey } from './components/Layout';
import { GameShell } from './components/GameShell';
import { AuthScreen } from './screens/AuthScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ProfileScreen } from './screens/ProfileScreen';

type FlowView = 'auth' | 'onboarding' | 'calibration' | 'app' | 'playing';

export default function App() {
  const [data, setData] = useState<AppDataState | null>(() => loadLocalState());
  const [view, setView] = useState<FlowView>(() => {
    const saved = loadLocalState();
    if (!saved) return 'auth';
    return saved.profile.calibrated ? 'app' : 'calibration';
  });
  const [tab, setTab] = useState<TabKey>('home');
  const [theme, setTheme] = useState<ThemeMode>(() => loadLocalState()?.profile.theme_preference ?? 'gamified');
  const [backendOnline, setBackendOnline] = useState(false);

  const [activePlay, setActivePlay] = useState<{
    slug: GameSlug;
    stage: number;
    mode: SessionMode;
    returnView: FlowView;
  } | null>(null);

  // Sincroniza tema com <html data-theme="..."> e sintetizador Web Audio
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    sound.setTheme(theme);
  }, [theme]);

  // Verifica Docker/Supabase local e restaura sessão remota se houver
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
          setView(remote.profile.calibrated ? 'app' : 'calibration');
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
    const hasOnboarding = Object.keys(state.profile.onboarding_answers || {}).length > 0;
    if (!hasOnboarding) setView('onboarding');
    else if (!state.profile.calibrated) setView('calibration');
    else setView('app');
  };

  const handleRemoteLogin = async (userId: string, email?: string) => {
    const remote = await loadRemoteState(userId, email);
    setData(remote);
    setTheme(remote.profile.theme_preference);
    const hasOnboarding = Object.keys(remote.profile.onboarding_answers || {}).length > 0;
    if (!hasOnboarding) setView('onboarding');
    else if (!remote.profile.calibrated) setView('calibration');
    else setView('app');
  };

  const handleOnboardingComplete = async (answers: Record<string, string>) => {
    if (!data) return;
    const updated = await updateProfilePreferences(data, {
      onboarding_answers: answers,
      theme_preference: theme,
    });
    setData(updated);
    setView(updated.profile.calibrated ? 'app' : 'calibration');
  };

  const startGame = (slug: GameSlug, mode: SessionMode, returnView: FlowView = 'app') => {
    if (!data) return;
    const stage = mode === 'calibration' ? 1 : (data.progress[slug]?.current_stage ?? 1);
    setActivePlay({ slug, stage, mode, returnView });
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
    return (
      <GameShell
        slug={activePlay.slug}
        stage={activePlay.stage}
        mode={activePlay.mode}
        theme={theme}
        weakestTwo={weakest2}
        onComplete={handleSessionComplete}
        onPlayNext={(nextStage) =>
          setActivePlay((prev) => (prev ? { ...prev, stage: nextStage } : null))
        }
        onExit={() => {
          const target = activePlay.returnView;
          setActivePlay(null);
          setView(target);
        }}
      />
    );
  }

  if (view === 'onboarding') {
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
          onThemePreview={(t) => void handleThemeChange(t)}
          onComplete={(ans) => void handleOnboardingComplete(ans)}
          onSkip={() => setView('calibration')}
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
          scores={data.scores}
          onStartGame={(slug) => startGame(slug, 'calibration', 'calibration')}
          onFinishCalibration={async () => {
            const updated = await updateProfilePreferences(data, { calibrated: true });
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
          onStartGame={(slug, mode) => startGame(slug, mode, 'app')}
          onGoStats={() => setTab('stats')}
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

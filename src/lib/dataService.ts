import type {
  CognitiveSessionRecord,
  ComputedSessionResult,
  DailyProtocolRecord,
  DomainKey,
  DomainScoresRecord,
  GameProgressRecord,
  GameSlug,
  PlanTier,
  ThemeMode,
  UserProfile,
} from '../types/cognitive';
import {
  calculateGlobalCognitiveIndex,
  calibrationScoreToDomainValue,
  generateDailyProtocol,
} from '../engine/psychometricEngine';
import { GAME_REGISTRY } from '../engine/gameRegistry';
import { supabase } from './supabase';

const STORAGE_KEY = 'neurolab_local_state_v1';

export interface AppDataState {
  profile: UserProfile;
  scores: DomainScoresRecord;
  progress: Record<GameSlug, GameProgressRecord>;
  sessions: CognitiveSessionRecord[];
  dailyProtocol: DailyProtocolRecord;
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createInitialProgress(): Record<GameSlug, GameProgressRecord> {
  const now = new Date().toISOString();
  return GAME_REGISTRY.reduce((acc, g) => {
    acc[g.slug] = {
      game_slug: g.slug,
      domain: g.domain,
      current_stage: 1,
      highest_score: 0,
      total_plays: 0,
      updated_at: now,
    };
    return acc;
  }, {} as Record<GameSlug, GameProgressRecord>);
}

export function createDefaultState(userId: string, name = 'Jogador', isLocalGuest = true, email?: string): AppDataState {
  const now = new Date().toISOString();
  const scores: DomainScoresRecord = {
    user_id: userId,
    selective_attention: 500,
    working_memory: 500,
    fluid_reasoning: 500,
    processing_speed: 500,
    numerical_cognition: 500,
    inhibitory_control: 500,
    baseline_scores: {},
    updated_at: now,
  };
  return {
    profile: {
      id: userId,
      name,
      email,
      theme_preference: 'gamified',
      plan_tier: 'free',
      global_cognitive_index: 500,
      current_streak: 0,
      best_streak: 0,
      xp: 0,
      calibrated: false,
      onboarding_answers: {},
      last_played_date: null,
      isLocalGuest,
    },
    scores,
    progress: createInitialProgress(),
    sessions: [],
    dailyProtocol: generateDailyProtocol(scores, todayIso()),
  };
}

export function loadLocalState(): AppDataState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppDataState;
    if (!parsed?.profile?.id) return null;
    // Garante protocolo atualizado pro dia atual
    const today = todayIso();
    if (!parsed.dailyProtocol || parsed.dailyProtocol.protocol_date !== today) {
      parsed.dailyProtocol = generateDailyProtocol(parsed.scores, today);
    }
    // Garante que todos os 12 jogos existam no mapa de progresso
    const defaults = createInitialProgress();
    parsed.progress = { ...defaults, ...parsed.progress };
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalState(state: AppDataState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignora quota
  }
}

export function clearLocalState() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Carrega dados do usuário logado via Supabase (Docker local ou Cloud).
 * Se for primeira vez, inicializa profile + domain_scores automaticamente.
 */
export async function loadRemoteState(userId: string, email?: string): Promise<AppDataState> {
  const fallbackName = email ? email.split('@')[0] : 'Jogador';
  const base = createDefaultState(userId, fallbackName, false, email);

  const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!prof) {
    await supabase.from('profiles').upsert({
      id: userId,
      name: base.profile.name,
      theme_preference: base.profile.theme_preference,
      plan_tier: base.profile.plan_tier,
      global_cognitive_index: 500,
      current_streak: 0,
      best_streak: 0,
      xp: 0,
      calibrated: false,
      onboarding_answers: {},
    });
  } else {
    base.profile = { ...base.profile, ...prof, email, isLocalGuest: false };
  }

  const { data: sc } = await supabase.from('domain_scores').select('*').eq('user_id', userId).maybeSingle();
  if (!sc) {
    await supabase.from('domain_scores').upsert({
      user_id: userId,
      selective_attention: 500,
      working_memory: 500,
      fluid_reasoning: 500,
      processing_speed: 500,
      numerical_cognition: 500,
      inhibitory_control: 500,
      baseline_scores: {},
    });
  } else {
    base.scores = { ...base.scores, ...sc };
  }

  const { data: progRows } = await supabase.from('game_progress').select('*').eq('user_id', userId);
  if (progRows) {
    for (const row of progRows) {
      const slug = row.game_slug as GameSlug;
      if (base.progress[slug]) {
        base.progress[slug] = {
          game_slug: slug,
          domain: row.domain as DomainKey,
          current_stage: row.current_stage,
          highest_score: row.highest_score,
          total_plays: row.total_plays,
          updated_at: row.updated_at,
        };
      }
    }
  }

  const { data: sessRows } = await supabase
    .from('cognitive_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (sessRows) {
    base.sessions = sessRows as CognitiveSessionRecord[];
  }

  const today = todayIso();
  const { data: dailyRow } = await supabase
    .from('daily_protocols')
    .select('*')
    .eq('user_id', userId)
    .eq('protocol_date', today)
    .maybeSingle();

  if (dailyRow) {
    base.dailyProtocol = {
      protocol_date: dailyRow.protocol_date,
      recommended_games: dailyRow.recommended_games,
      completed_games: dailyRow.completed_games || [],
    };
  } else {
    base.dailyProtocol = generateDailyProtocol(base.scores, today);
    await supabase.from('daily_protocols').upsert({
      user_id: userId,
      protocol_date: today,
      recommended_games: base.dailyProtocol.recommended_games,
      completed_games: [],
    });
  }

  saveLocalState(base);
  return base;
}

/** Aplica o resultado de uma partida ao estado (local + sync no Supabase se não for guest) */
export async function recordSessionResult(
  state: AppDataState,
  result: ComputedSessionResult
): Promise<AppDataState> {
  const now = new Date().toISOString();
  const today = todayIso();

  // 1. Atualiza progresso do minigame (sobe +1/+2/+3 quando vai bem OU desce -1 / ativa modo leve quando vai mal!)
  const prevProg = state.progress[result.gameSlug];
  const updatedProg: GameProgressRecord = {
    game_slug: result.gameSlug,
    domain: result.domain,
    current_stage: result.nextStage,
    highest_score: Math.max(prevProg.highest_score, result.score),
    total_plays: prevProg.total_plays + 1,
    ease_mode: result.adaptiveStatus === 'ease_mode',
    updated_at: now,
  };

  // 2. Atualiza pontuação do domínio e baseline (se calibração)
  const nextScores: DomainScoresRecord = {
    ...state.scores,
    baseline_scores: { ...state.scores.baseline_scores },
    updated_at: now,
  };

  if (result.mode === 'calibration') {
    const calVal = calibrationScoreToDomainValue(result.accuracyPct, result.rtMeanMs);
    nextScores[result.domain] = calVal;
    nextScores.baseline_scores[result.domain] = calVal;
  } else {
    const curVal = nextScores[result.domain] ?? 500;
    nextScores[result.domain] = Math.max(200, Math.min(999, curVal + result.domainDelta));
    if (!nextScores.baseline_scores[result.domain]) {
      nextScores.baseline_scores[result.domain] = curVal;
    }
  }

  const icg = calculateGlobalCognitiveIndex(nextScores);

  // 3. Atualiza streak diário
  let currentStreak = state.profile.current_streak;
  if (state.profile.last_played_date !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    currentStreak = state.profile.last_played_date === yStr ? currentStreak + 1 : 1;
  }
  const bestStreak = Math.max(state.profile.best_streak, currentStreak);

  // 4. Verifica se os 6 domínios foram calibrados
  const calibratedCount = Object.keys(nextScores.baseline_scores).length;
  const calibrated = state.profile.calibrated || calibratedCount >= 6;

  // 5. Atualiza protocolo diário
  const completedSet = new Set<GameSlug>(state.dailyProtocol.completed_games);
  if (
    state.dailyProtocol.recommended_games.some((g) => g.slug === result.gameSlug) &&
    result.mode !== 'calibration'
  ) {
    completedSet.add(result.gameSlug);
  }
  const nextDaily: DailyProtocolRecord =
    result.mode === 'calibration' && calibrated && !state.profile.calibrated
      ? generateDailyProtocol(nextScores, today)
      : {
          ...state.dailyProtocol,
          completed_games: Array.from(completedSet),
        };

  // 6. Cria registro de sessão
  const newSession: CognitiveSessionRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`,
    domain: result.domain,
    game_slug: result.gameSlug,
    mode: result.mode,
    stage_played: result.stagePlayed,
    stage_cleared: result.stageCleared,
    score: result.score,
    accuracy_pct: result.accuracyPct,
    commission_errors: result.commissionErrors,
    omission_errors: result.omissionErrors,
    rt_mean_ms: result.rtMeanMs,
    rt_sd_ms: result.rtSdMs,
    created_at: now,
  };

  const nextState: AppDataState = {
    profile: {
      ...state.profile,
      global_cognitive_index: icg,
      current_streak: currentStreak,
      best_streak: bestStreak,
      xp: state.profile.xp + result.xpEarned,
      calibrated,
      last_played_date: today,
    },
    scores: nextScores,
    progress: {
      ...state.progress,
      [result.gameSlug]: updatedProg,
    },
    sessions: [newSession, ...state.sessions].slice(0, 60),
    dailyProtocol: nextDaily,
  };

  saveLocalState(nextState);

  // Sync assíncrono com Supabase (se logado no Docker/Nuvem)
  if (!state.profile.isLocalGuest) {
    const uid = state.profile.id;
    void Promise.allSettled([
      supabase.from('profiles').update({
        global_cognitive_index: icg,
        current_streak: currentStreak,
        best_streak: bestStreak,
        xp: nextState.profile.xp,
        calibrated,
        last_played_date: today,
      }).eq('id', uid),
      supabase.from('domain_scores').upsert({
        user_id: uid,
        selective_attention: nextScores.selective_attention,
        working_memory: nextScores.working_memory,
        fluid_reasoning: nextScores.fluid_reasoning,
        processing_speed: nextScores.processing_speed,
        numerical_cognition: nextScores.numerical_cognition,
        inhibitory_control: nextScores.inhibitory_control,
        baseline_scores: nextScores.baseline_scores,
        updated_at: now,
      }),
      supabase.from('game_progress').upsert(
        {
          user_id: uid,
          game_slug: updatedProg.game_slug,
          domain: updatedProg.domain,
          current_stage: updatedProg.current_stage,
          highest_score: updatedProg.highest_score,
          total_plays: updatedProg.total_plays,
          updated_at: now,
        },
        { onConflict: 'user_id,game_slug' }
      ),
      supabase.from('cognitive_sessions').insert({
        user_id: uid,
        domain: newSession.domain,
        game_slug: newSession.game_slug,
        mode: newSession.mode,
        stage_played: newSession.stage_played,
        stage_cleared: newSession.stage_cleared,
        score: newSession.score,
        accuracy_pct: newSession.accuracy_pct,
        commission_errors: newSession.commission_errors,
        omission_errors: newSession.omission_errors,
        rt_mean_ms: newSession.rt_mean_ms,
        rt_sd_ms: newSession.rt_sd_ms,
      }),
      supabase.from('daily_protocols').upsert(
        {
          user_id: uid,
          protocol_date: nextDaily.protocol_date,
          recommended_games: nextDaily.recommended_games,
          completed_games: nextDaily.completed_games,
        },
        { onConflict: 'user_id,protocol_date' }
      ),
    ]);
  }

  return nextState;
}

export async function updateProfilePreferences(
  state: AppDataState,
  patch: Partial<{
    theme_preference: ThemeMode;
    plan_tier: PlanTier;
    calibrated: boolean;
    onboarding_answers: Record<string, string>;
    name: string;
  }>
): Promise<AppDataState> {
  const nextState: AppDataState = {
    ...state,
    profile: { ...state.profile, ...patch },
  };
  saveLocalState(nextState);
  if (!state.profile.isLocalGuest) {
    void supabase.from('profiles').update(patch).eq('id', state.profile.id);
  }
  return nextState;
}

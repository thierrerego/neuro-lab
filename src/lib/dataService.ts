import type {
  AgeBracket,
  CognitiveSessionRecord,
  CognitiveSnapshotRecord,
  ComputedSessionResult,
  DailyProtocolRecord,
  DomainKey,
  DomainScoresRecord,
  GameProgressRecord,
  GameSlug,
  PlanTier,
  PopulationBenchmarks,
  ThemeMode,
  UserProfile,
} from '../types/cognitive';
import {
  calculateGlobalCognitiveIndex,
  generateDailyProtocol,
  getCalibrationDomains,
  getCognitiveTier,
} from '../engine/psychometricEngine';
import { NORMATIVE_BENCHMARKS, resolveArchetype } from '../engine/cognitiveProfiler';
import { DOMAIN_LIST, GAME_REGISTRY } from '../engine/gameRegistry';
import { saveLocalUserState } from './localUserDb';
import { getAppNowIso, getAppTodayIso, getAppYesterdayIso } from './appClock';
import { supabase } from './supabase';

const STORAGE_KEY = 'neurolab_local_state_v3';

export interface AppDataState {
  profile: UserProfile;
  scores: DomainScoresRecord;
  progress: Record<GameSlug, GameProgressRecord>;
  sessions: CognitiveSessionRecord[];
  snapshots: CognitiveSnapshotRecord[];
  dailyProtocol: DailyProtocolRecord;
}

export function todayIso(): string {
  return getAppTodayIso();
}

export function normalizeTheme(raw: unknown): ThemeMode {
  if (raw === 'dark') return 'dark';
  return 'light';
}

export function createInitialProgress(easeMode = false): Record<GameSlug, GameProgressRecord> {
  const now = new Date().toISOString();
  return GAME_REGISTRY.reduce((acc, g) => {
    acc[g.slug] = {
      game_slug: g.slug,
      domain: g.domain,
      current_stage: 1,
      highest_score: 0,
      total_plays: 0,
      ease_mode: easeMode,
      updated_at: now,
    };
    return acc;
  }, {} as Record<GameSlug, GameProgressRecord>);
}

export function createDefaultState(
  userId: string,
  name = 'Participante',
  isLocalGuest = true,
  email?: string
): AppDataState {
  const now = new Date().toISOString();
  const scores: DomainScoresRecord = {
    user_id: userId,
    selective_attention: 0,
    working_memory: 0,
    fluid_reasoning: 0,
    processing_speed: 0,
    numerical_cognition: 0,
    inhibitory_control: 0,
    baseline_scores: {},
    updated_at: now,
  };
  return {
    profile: {
      id: userId,
      name,
      email,
      theme_preference: 'light',
      plan_tier: 'free',
      global_cognitive_index: 0,
      current_streak: 0,
      best_streak: 0,
      calibrated: false,
      calibration_skipped: false,
      selected_domains: [],
      daily_goal_minutes: 10,
      peak_time: null,
      cognitive_bottlenecks: [],
      mental_stamina_baseline: 3,
      application_context: null,
      application_contexts: [],
      age_bracket: '25-34',
      current_title: 'Sem avaliação',
      onboarding_answers: {},
      last_played_date: null,
      isLocalGuest,
    },
    scores,
    progress: createInitialProgress(false),
    sessions: [],
    snapshots: [],
    dailyProtocol: generateDailyProtocol(scores, todayIso(), [], 10),
  };
}

export function loadLocalState(): AppDataState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppDataState & {
      profile: UserProfile & Record<string, unknown>;
      battleLogs?: unknown;
    };
    if (!parsed?.profile?.id) return null;

    const cleanProfile: UserProfile = {
      id: parsed.profile.id,
      name: parsed.profile.name || 'Participante',
      email: parsed.profile.email,
      theme_preference: normalizeTheme(parsed.profile.theme_preference),
      plan_tier: parsed.profile.plan_tier ?? 'free',
      global_cognitive_index: parsed.profile.global_cognitive_index ?? 0,
      current_streak: parsed.profile.current_streak ?? 0,
      best_streak: parsed.profile.best_streak ?? 0,
      calibrated: Boolean(parsed.profile.calibrated),
      calibration_skipped: Boolean(parsed.profile.calibration_skipped),
      selected_domains: Array.isArray(parsed.profile.selected_domains) ? parsed.profile.selected_domains : [],
      daily_goal_minutes: parsed.profile.daily_goal_minutes ?? 10,
      peak_time: parsed.profile.peak_time ?? null,
      cognitive_bottlenecks: Array.isArray(parsed.profile.cognitive_bottlenecks)
        ? parsed.profile.cognitive_bottlenecks
        : [],
      mental_stamina_baseline: parsed.profile.mental_stamina_baseline ?? 3,
      application_context: parsed.profile.application_context ?? null,
      application_contexts: Array.isArray(parsed.profile.application_contexts)
        ? parsed.profile.application_contexts
        : parsed.profile.application_context
          ? parsed.profile.application_context.split(' • ').map((s) => s.trim()).filter(Boolean)
          : [],
      age_bracket: (parsed.profile.age_bracket as AgeBracket) || '25-34',
      current_title:
        parsed.profile.current_title ??
        ((parsed.profile.global_cognitive_index ?? 0) > 0
          ? getCognitiveTier(parsed.profile.global_cognitive_index ?? 0).title
          : 'Sem avaliação'),
      onboarding_answers: parsed.profile.onboarding_answers ?? {},
      last_played_date: parsed.profile.last_played_date ?? null,
      isLocalGuest: parsed.profile.isLocalGuest,
    };

    const today = todayIso();
    const dailyProtocol =
      !parsed.dailyProtocol || parsed.dailyProtocol.protocol_date !== today
        ? generateDailyProtocol(
            parsed.scores,
            today,
            cleanProfile.selected_domains,
            cleanProfile.daily_goal_minutes
          )
        : parsed.dailyProtocol;

    const defaults = createInitialProgress();
    const mergedProgress = { ...defaults, ...parsed.progress };
    for (const g of GAME_REGISTRY) {
      if (mergedProgress[g.slug]) {
        mergedProgress[g.slug] = {
          ...mergedProgress[g.slug],
          current_stage: Math.max(1, mergedProgress[g.slug].current_stage || 1),
        };
      }
    }
    return {
      profile: cleanProfile,
      scores: parsed.scores,
      progress: mergedProgress,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      dailyProtocol,
    };
  } catch {
    return null;
  }
}

export function saveLocalState(state: AppDataState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (state.profile.isLocalGuest) {
      saveLocalUserState(state);
    }
  } catch {
    // ignora limite de armazenamento
  }
}

export function clearLocalState() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function loadRemoteState(
  userId: string,
  email?: string,
  displayName?: string
): Promise<AppDataState> {
  const fallbackName = displayName?.trim() || (email ? email.split('@')[0] : 'Participante');
  const base = createDefaultState(userId, fallbackName, false, email);

  const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!prof) {
    await supabase.from('profiles').upsert({
      id: userId,
      name: base.profile.name,
      theme_preference: base.profile.theme_preference,
      plan_tier: base.profile.plan_tier,
      global_cognitive_index: 0,
      current_streak: 0,
      best_streak: 0,
      calibrated: false,
      selected_domains: [],
      daily_goal_minutes: 10,
      peak_time: null,
      cognitive_bottlenecks: [],
      mental_stamina_baseline: 3,
      application_context: null,
      application_contexts: [],
      age_bracket: '25-34',
      current_title: 'Sem avaliação',
      onboarding_answers: {},
    });
  } else {
    base.profile = {
      ...base.profile,
      id: prof.id,
      name: prof.name || fallbackName,
      theme_preference: normalizeTheme(prof.theme_preference),
      plan_tier: (prof.plan_tier as PlanTier) ?? 'free',
      global_cognitive_index: prof.global_cognitive_index ?? 0,
      current_streak: prof.current_streak ?? 0,
      best_streak: prof.best_streak ?? 0,
      calibrated: Boolean(prof.calibrated),
      selected_domains: Array.isArray(prof.selected_domains) ? prof.selected_domains : [],
      daily_goal_minutes: prof.daily_goal_minutes ?? 10,
      peak_time: prof.peak_time ?? null,
      cognitive_bottlenecks: Array.isArray(prof.cognitive_bottlenecks) ? prof.cognitive_bottlenecks : [],
      mental_stamina_baseline: prof.mental_stamina_baseline ?? 3,
      application_context: prof.application_context ?? null,
      application_contexts: Array.isArray(prof.application_contexts)
        ? prof.application_contexts
        : typeof prof.application_context === 'string' && prof.application_context
          ? prof.application_context.split(' • ').map((s: string) => s.trim()).filter(Boolean)
          : [],
      age_bracket: (prof.age_bracket as AgeBracket) || '25-34',
      current_title: prof.current_title ?? 'Sem avaliação',
      onboarding_answers: prof.onboarding_answers ?? {},
      last_played_date: prof.last_played_date ?? null,
      email,
      isLocalGuest: false,
    };
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
    .limit(150);
  if (sessRows) {
    base.sessions = sessRows as CognitiveSessionRecord[];
  }

  const { data: snapRows } = await supabase
    .from('cognitive_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: true })
    .limit(90);
  if (snapRows) {
    base.snapshots = snapRows as CognitiveSnapshotRecord[];
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
    base.dailyProtocol = generateDailyProtocol(
      base.scores,
      today,
      base.profile.selected_domains,
      base.profile.daily_goal_minutes
    );
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

/**
 * Se o usuário optar por pular a Avaliação Inicial, mantém tudo zerado (0%)
 * e vai construindo cada domínio e sua linha de base conforme for jogando.
 */
export async function skipCalibrationToLowestLevel(state: AppDataState): Promise<AppDataState> {
  const now = new Date().toISOString();
  const zeroScores: DomainScoresRecord = {
    user_id: state.profile.id,
    selective_attention: state.scores.selective_attention || 0,
    working_memory: state.scores.working_memory || 0,
    fluid_reasoning: state.scores.fluid_reasoning || 0,
    processing_speed: state.scores.processing_speed || 0,
    numerical_cognition: state.scores.numerical_cognition || 0,
    inhibitory_control: state.scores.inhibitory_control || 0,
    baseline_scores: { ...state.scores.baseline_scores },
    updated_at: now,
  };

  const easyProgress = createInitialProgress(true);
  const icg = calculateGlobalCognitiveIndex(zeroScores);
  const title = icg > 0 ? getCognitiveTier(icg).title : 'Sem avaliação';
  const nextDaily = generateDailyProtocol(
    zeroScores,
    todayIso(),
    state.profile.selected_domains,
    state.profile.daily_goal_minutes
  );

  const nextState: AppDataState = {
    ...state,
    profile: {
      ...state.profile,
      calibrated: true,
      calibration_skipped: true,
      global_cognitive_index: icg,
      current_title: title,
    },
    scores: zeroScores,
    progress: easyProgress,
    dailyProtocol: nextDaily,
  };

  saveLocalState(nextState);

  if (!state.profile.isLocalGuest) {
    const uid = state.profile.id;
    void Promise.allSettled([
      supabase
        .from('profiles')
        .update({ calibrated: true, global_cognitive_index: icg, current_title: title })
        .eq('id', uid),
      supabase.from('domain_scores').upsert(zeroScores),
    ]);
  }

  return nextState;
}

export async function recordSessionResult(
  state: AppDataState,
  result: ComputedSessionResult
): Promise<AppDataState> {
  const now = getAppNowIso();
  const today = todayIso();

  const prevProg = state.progress[result.gameSlug] ?? {
    game_slug: result.gameSlug,
    domain: result.domain,
    current_stage: 1,
    highest_score: 0,
    total_plays: 0,
    ease_mode: false,
    updated_at: now,
  };
  const updatedProg: GameProgressRecord = {
    game_slug: result.gameSlug,
    domain: result.domain,
    current_stage: result.nextStage,
    highest_score: Math.max(prevProg.highest_score ?? 0, result.score),
    total_plays: (prevProg.total_plays ?? 0) + 1,
    ease_mode: result.adaptiveStatus === 'ease_mode',
    updated_at: now,
  };

  const nextScores: DomainScoresRecord = {
    ...state.scores,
    baseline_scores: { ...state.scores.baseline_scores },
    updated_at: now,
  };

  const curVal = nextScores[result.domain] ?? 0;
  // Pontuação alvo real da sessão na escala 0..990 baseada no percentil TRI frente à idade
  const triTargetScore = Math.max(80, Math.min(990, Math.round(result.percentile * 10)));

  if (result.mode === 'calibration' || curVal === 0) {
    // 1ª medição real do domínio: registra diretamente o desempenho TRI como estado atual e linha de base
    nextScores[result.domain] = triTargetScore;
    if (!nextScores.baseline_scores[result.domain]) {
      nextScores.baseline_scores[result.domain] = triTargetScore;
    }
  } else {
    // Média móvel suave rumo ao desempenho real (TRI): sobe quando evolui, sem travar em 100% por repetição
    const blended = Math.round(curVal * 0.72 + triTargetScore * 0.28);
    const boundedDelta = Math.max(-25, Math.min(35, blended - curVal));
    nextScores[result.domain] = Math.max(80, Math.min(990, curVal + boundedDelta));
    if (!nextScores.baseline_scores[result.domain]) {
      nextScores.baseline_scores[result.domain] = curVal;
    }
  }

  const requiredCalDomains = getCalibrationDomains(state.profile.selected_domains);
  const allCalibratedNow = requiredCalDomains.every((d) =>
    Boolean(nextScores.baseline_scores[d])
  );
  const calibrated = state.profile.calibrated || allCalibratedNow;

  const icg = calculateGlobalCognitiveIndex(nextScores);
  const currentTitle = icg > 0 ? getCognitiveTier(icg).title : 'Sem avaliação';

  let currentStreak = state.profile.current_streak;
  if (state.profile.last_played_date !== today) {
    const yStr = getAppYesterdayIso();
    currentStreak = state.profile.last_played_date === yStr ? currentStreak + 1 : 1;
  }
  const bestStreak = Math.max(state.profile.best_streak, currentStreak);

  const completedSet = new Set<GameSlug>(state.dailyProtocol.completed_games);
  if (result.mode === 'guided' || state.dailyProtocol.recommended_games.some((g) => g.slug === result.gameSlug)) {
    completedSet.add(result.gameSlug);
  }
  const nextDaily: DailyProtocolRecord =
    result.mode === 'calibration' && calibrated
      ? generateDailyProtocol(
          nextScores,
          today,
          state.profile.selected_domains,
          state.profile.daily_goal_minutes
        )
      : {
          ...state.dailyProtocol,
          completed_games: Array.from(completedSet),
        };

  const newSession: CognitiveSessionRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`,
    domain: result.domain,
    game_slug: result.gameSlug,
    mode: result.mode,
    stage_played: result.stagePlayed,
    stage_cleared: result.stageCleared,
    score: result.score,
    accuracy_pct: result.accuracyPct,
    accuracy_points: result.accuracyPoints,
    speed_points: result.speedPoints,
    percentile: result.percentile,
    earned_title: result.earnedTitle,
    waves_completed: result.wavesCompleted,
    completed_early: result.completedEarly,
    time_remaining_ms: result.timeRemainingMs,
    commission_errors: result.commissionErrors,
    omission_errors: result.omissionErrors,
    rt_mean_ms: result.rtMeanMs,
    rt_sd_ms: result.rtSdMs,
    created_at: now,
  };

  const updatedSessions = [newSession, ...state.sessions].slice(0, 150);

  const todaySessions = updatedSessions.filter((s) => (s.created_at || '').slice(0, 10) === today);
  const todayValidRt = todaySessions.filter((s) => s.rt_mean_ms > 0);
  const todayAvgRt = todayValidRt.length
    ? Math.round(todayValidRt.reduce((acc, s) => acc + s.rt_mean_ms, 0) / todayValidRt.length)
    : newSession.rt_mean_ms;
  const todayAvgAcc = todaySessions.length
    ? Number(
        (
          todaySessions.reduce((acc, s) => acc + Number(s.accuracy_pct || 0), 0) /
          todaySessions.length
        ).toFixed(2)
      )
    : newSession.accuracy_pct;
  const archetypeTitle = resolveArchetype(nextScores).def.title;
  const domainScoresJson: Record<DomainKey, number> = {
    selective_attention: nextScores.selective_attention,
    working_memory: nextScores.working_memory,
    fluid_reasoning: nextScores.fluid_reasoning,
    processing_speed: nextScores.processing_speed,
    numerical_cognition: nextScores.numerical_cognition,
    inhibitory_control: nextScores.inhibitory_control,
  };

  const todaySnapshot: CognitiveSnapshotRecord = {
    id: `snap-${today}`,
    snapshot_date: today,
    global_index: icg,
    domain_scores_json: domainScoresJson,
    avg_rt_ms: todayAvgRt,
    avg_accuracy: todayAvgAcc,
    archetype_title: archetypeTitle,
    created_at: now,
  };

  const prevSnaps = Array.isArray(state.snapshots) ? state.snapshots : [];
  const nextSnapshots = [
    ...prevSnaps.filter((s) => s.snapshot_date !== today),
    todaySnapshot,
  ]
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .slice(-90);

  const nextState: AppDataState = {
    profile: {
      ...state.profile,
      global_cognitive_index: icg,
      current_title: currentTitle,
      current_streak: currentStreak,
      best_streak: bestStreak,
      calibrated,
      calibration_skipped:
        result.mode === 'calibration' && allCalibratedNow ? false : state.profile.calibration_skipped,
      last_played_date: today,
    },
    scores: nextScores,
    progress: {
      ...state.progress,
      [result.gameSlug]: updatedProg,
    },
    sessions: updatedSessions,
    snapshots: nextSnapshots,
    dailyProtocol: nextDaily,
  };

  saveLocalState(nextState);

  if (!state.profile.isLocalGuest) {
    const uid = state.profile.id;
    await Promise.allSettled([
      supabase
        .from('profiles')
        .update({
          global_cognitive_index: icg,
          current_title: currentTitle,
          current_streak: currentStreak,
          best_streak: bestStreak,
          calibrated,
          last_played_date: today,
        })
        .eq('id', uid),
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
        accuracy_points: newSession.accuracy_points,
        speed_points: newSession.speed_points,
        percentile: newSession.percentile,
        earned_title: newSession.earned_title,
        waves_completed: newSession.waves_completed,
        completed_early: newSession.completed_early,
        time_remaining_ms: newSession.time_remaining_ms,
        commission_errors: newSession.commission_errors,
        omission_errors: newSession.omission_errors,
        rt_mean_ms: newSession.rt_mean_ms,
        rt_sd_ms: newSession.rt_sd_ms,
      }),
      supabase.from('cognitive_snapshots').upsert(
        {
          user_id: uid,
          snapshot_date: today,
          global_index: icg,
          domain_scores_json: domainScoresJson,
          avg_rt_ms: todayAvgRt,
          avg_accuracy: todayAvgAcc,
          archetype_title: archetypeTitle,
        },
        { onConflict: 'user_id,snapshot_date' }
      ),
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

/**
 * Busca benchmarks globais.
 * Em modo local (sem consumo Supabase), usa exclusivamente a calibração científica normativa
 * da literatura (nunca mistura os perfis fictícios locais como se fossem base populacional real).
 */
export async function fetchPopulationBenchmarks(backendOnline: boolean): Promise<PopulationBenchmarks> {
  if (!backendOnline) return NORMATIVE_BENCHMARKS;
  try {
    const { data, error } = await supabase.rpc('get_global_benchmarks');
    if (error || !data || typeof data !== 'object') {
      return NORMATIVE_BENCHMARKS;
    }
    const raw = data as Partial<PopulationBenchmarks>;
    return {
      source: raw.source === 'population' ? 'population' : 'normative',
      sample_sessions: Number(raw.sample_sessions ?? 0),
      distinct_users: Number(raw.distinct_users ?? 0),
      global: raw.global ?? NORMATIVE_BENCHMARKS.global,
      domains: { ...NORMATIVE_BENCHMARKS.domains, ...(raw.domains ?? {}) },
      games: { ...NORMATIVE_BENCHMARKS.games, ...(raw.games ?? {}) },
    };
  } catch {
    return NORMATIVE_BENCHMARKS;
  }
}

export async function updateProfilePreferences(
  state: AppDataState,
  patch: Partial<{
    theme_preference: ThemeMode;
    plan_tier: PlanTier;
    calibrated: boolean;
    calibration_skipped: boolean;
    selected_domains: DomainKey[];
    daily_goal_minutes: number;
    peak_time: string | null;
    cognitive_bottlenecks: string[];
    mental_stamina_baseline: number;
    application_context: string | null;
    application_contexts: string[];
    age_bracket: AgeBracket;
    current_title: string;
    onboarding_answers: Record<string, unknown>;
    name: string;
  }>
): Promise<AppDataState> {
  const nextProfile = { ...state.profile, ...patch };
  const nextScores = state.scores;
  const nextProgress = state.progress;

  let nextDaily = state.dailyProtocol;

  if (patch.selected_domains || patch.daily_goal_minutes || patch.onboarding_answers) {
    const regenerated = generateDailyProtocol(
      nextScores,
      todayIso(),
      nextProfile.selected_domains,
      nextProfile.daily_goal_minutes
    );
    nextDaily = {
      ...regenerated,
      completed_games: state.dailyProtocol.completed_games,
    };
  }

  const nextState: AppDataState = {
    ...state,
    profile: nextProfile,
    scores: nextScores,
    progress: nextProgress,
    dailyProtocol: nextDaily,
  };
  saveLocalState(nextState);

  if (!state.profile.isLocalGuest) {
    const uid = state.profile.id;
    const remotePatch = { ...patch };
    delete remotePatch.calibration_skipped;
    const ops: PromiseLike<unknown>[] = [
      supabase.from('profiles').update(remotePatch).eq('id', uid),
    ];
    if (nextDaily !== state.dailyProtocol) {
      ops.push(
        supabase.from('daily_protocols').upsert(
          {
            user_id: uid,
            protocol_date: nextDaily.protocol_date,
            recommended_games: nextDaily.recommended_games,
            completed_games: nextDaily.completed_games,
          },
          { onConflict: 'user_id,protocol_date' }
        )
      );
    }
    await Promise.allSettled(ops);
  }

  return nextState;
}

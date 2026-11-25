import type {
  AgeBracket,
  BenchmarkDistribution,
  CognitiveSessionRecord,
  CognitiveSnapshotRecord,
  DomainKey,
  DomainScoresRecord,
  GameProgressRecord,
  GameSlug,
  PopulationBenchmarks,
} from '../types/cognitive';
import type { AppDataState } from './dataService';
import { DOMAIN_LIST, GAME_REGISTRY, GAMES_BY_DOMAIN } from '../engine/gameRegistry';
import {
  calculateGlobalCognitiveIndex,
  generateDailyProtocol,
  getCognitiveTier,
  scoreToPercentile,
  scoreToPercent,
} from '../engine/psychometricEngine';
import { NORMATIVE_BENCHMARKS, resolveArchetype } from '../engine/cognitiveProfiler';
import { getAppTodayIso, resetSimulatedDayOffset } from './appClock';
import { migrateStateToNormV2, needsNormMigration } from './normMigration';

const LOCAL_DB_KEY = 'neurolab_local_db_v1';
const LOCAL_AUTH_KEY = 'neurolab_local_auth_v1';
export const ADMIN_USER_ID = 'adm-001';

interface LocalCredential {
  userId: string;
  username: string;
  passwordHash: string;
}

function normalizeUsernameSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function hashPasswordLocal(slug: string, password: string): string {
  const str = `neurolab::${slug}::${password}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function readLocalCredentials(): Record<string, LocalCredential> {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, LocalCredential>) : {};
  } catch {
    return {};
  }
}

function writeLocalCredentials(creds: Record<string, LocalCredential>) {
  try {
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(creds));
  } catch {
    // ignora
  }
}

export function signUpLocalAccount(username: string, password: string): AppDataState {
  const cleanName = username.trim();
  const slug = normalizeUsernameSlug(cleanName);
  if (slug.length < 2) {
    throw new Error('Digite um usuário com pelo menos 2 letras ou números.');
  }
  if (password.length < 4) {
    throw new Error('A senha precisa ter pelo menos 4 caracteres.');
  }

  const creds = readLocalCredentials();
  if (creds[slug]) {
    throw new Error('Esse usuário já existe. Troque para "Entrar" para acessar sua conta.');
  }

  const created = createLocalTestUser(cleanName, '25-34', 10);
  creds[slug] = {
    userId: created.profile.id,
    username: cleanName,
    passwordHash: hashPasswordLocal(slug, password),
  };
  writeLocalCredentials(creds);
  return created;
}

export function signInLocalAccount(username: string, password: string): AppDataState {
  const slug = normalizeUsernameSlug(username);
  if (slug.length < 2) {
    throw new Error('Digite seu usuário.');
  }
  const creds = readLocalCredentials();
  const cred = creds[slug];
  if (!cred || cred.passwordHash !== hashPasswordLocal(slug, password)) {
    throw new Error('Usuário ou senha incorretos.');
  }

  const state = setActiveLocalUserId(cred.userId) ?? getLocalUserState(cred.userId);
  if (!state) {
    throw new Error('Conta não encontrada neste aparelho. Crie novamente.');
  }
  return state;
}

export interface LocalUserDb {
  version: number;
  activeUserId: string;
  users: Record<string, AppDataState>;
}

export interface LocalUserSummary {
  id: string;
  name: string;
  isAdmin: boolean;
  ageBracket: AgeBracket;
  globalPct: number;
  streak: number;
  totalSessions: number;
  avgAccuracyPct: number;
  archetypeTitle: string;
  lastPlayedDate: string | null;
  domainPcts: Record<DomainKey, number>;
}

interface SeedBlueprint {
  id: string;
  name: string;
  isAdmin?: boolean;
  ageBracket: AgeBracket;
  dailyGoalMinutes: 5 | 10 | 15 | 20;
  peakTime: string;
  stamina: number;
  streak: number;
  bestStreak: number;
  bottlenecks: string[];
  contexts: string[];
  baseScores: Record<DomainKey, number>;
  currentScores: Record<DomainKey, number>;
  avgRtMs: number;
  avgAccuracy: number;
  daysAgoActive: number[]; // dias atrás com sessões (0 = hoje, 1 = ontem...)
  sessionsPerActiveDay: number;
  completedTodayCount: number;
  seedNum: number;
}

function localDateIsoOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SEED_BLUEPRINTS: SeedBlueprint[] = [
  {
    id: ADMIN_USER_ID,
    name: 'Teste ADM',
    isAdmin: true,
    ageBracket: '25-34',
    dailyGoalMinutes: 10,
    peakTime: 'Manhã (06h–12h)',
    stamina: 4,
    streak: 5,
    bestStreak: 8,
    bottlenecks: ['wm_reread'],
    contexts: ['Alta performance profissional e tomada de decisão'],
    baseScores: {
      selective_attention: 560,
      working_memory: 470,
      fluid_reasoning: 610,
      processing_speed: 580,
      numerical_cognition: 550,
      inhibitory_control: 600,
    },
    currentScores: {
      selective_attention: 640,
      working_memory: 540,
      fluid_reasoning: 710,
      processing_speed: 650,
      numerical_cognition: 620,
      inhibitory_control: 690,
    },
    avgRtMs: 820,
    avgAccuracy: 87,
    daysAgoActive: [0, 1, 2, 3, 4, 7, 9, 11],
    sessionsPerActiveDay: 2,
    completedTodayCount: 1,
    seedNum: 101,
  },
  {
    id: 'usr-marina',
    name: 'Marina Silva',
    ageBracket: '25-34',
    dailyGoalMinutes: 15,
    peakTime: 'Manhã (06h–12h)',
    stamina: 5,
    streak: 6,
    bestStreak: 12,
    bottlenecks: ['spd_num_slow'],
    contexts: ['Alta performance profissional e tomada de decisão', 'Estudos complexos, provas e absorção de conteúdo'],
    baseScores: {
      selective_attention: 680,
      working_memory: 640,
      fluid_reasoning: 670,
      processing_speed: 700,
      numerical_cognition: 580,
      inhibitory_control: 660,
    },
    currentScores: {
      selective_attention: 820,
      working_memory: 760,
      fluid_reasoning: 790,
      processing_speed: 840,
      numerical_cognition: 700,
      inhibitory_control: 770,
    },
    avgRtMs: 685,
    avgAccuracy: 92,
    daysAgoActive: [0, 1, 2, 3, 4, 5, 8, 10, 12],
    sessionsPerActiveDay: 2,
    completedTodayCount: 3,
    seedNum: 202,
  },
  {
    id: 'usr-lucas',
    name: 'Lucas Ferreira',
    ageBracket: '18-24',
    dailyGoalMinutes: 10,
    peakTime: 'Noite (18h–00h)',
    stamina: 3,
    streak: 3,
    bestStreak: 5,
    bottlenecks: ['inh_impulse', 'att_tabs'],
    contexts: ['Agilidade mental, reflexos e longevidade cognitiva'],
    baseScores: {
      selective_attention: 500,
      working_memory: 540,
      fluid_reasoning: 590,
      processing_speed: 680,
      numerical_cognition: 530,
      inhibitory_control: 410,
    },
    currentScores: {
      selective_attention: 550,
      working_memory: 590,
      fluid_reasoning: 630,
      processing_speed: 740,
      numerical_cognition: 580,
      inhibitory_control: 460,
    },
    avgRtMs: 640,
    avgAccuracy: 74,
    daysAgoActive: [0, 1, 2, 6, 9, 13],
    sessionsPerActiveDay: 2,
    completedTodayCount: 1,
    seedNum: 303,
  },
  {
    id: 'usr-carla',
    name: 'Carla Mendes',
    ageBracket: '35-44',
    dailyGoalMinutes: 10,
    peakTime: 'Tarde (12h–18h)',
    stamina: 4,
    streak: 4,
    bestStreak: 9,
    bottlenecks: ['spd_num_slow'],
    contexts: ['Estudos complexos, provas e absorção de conteúdo'],
    baseScores: {
      selective_attention: 610,
      working_memory: 670,
      fluid_reasoning: 650,
      processing_speed: 520,
      numerical_cognition: 680,
      inhibitory_control: 640,
    },
    currentScores: {
      selective_attention: 680,
      working_memory: 770,
      fluid_reasoning: 730,
      processing_speed: 610,
      numerical_cognition: 780,
      inhibitory_control: 710,
    },
    avgRtMs: 910,
    avgAccuracy: 93,
    daysAgoActive: [0, 1, 2, 3, 6, 8, 11],
    sessionsPerActiveDay: 2,
    completedTodayCount: 2,
    seedNum: 404,
  },
  {
    id: 'usr-rafael',
    name: 'Rafael Costa',
    ageBracket: '45-54',
    dailyGoalMinutes: 5,
    peakTime: 'Manhã (06h–12h)',
    stamina: 2,
    streak: 2,
    bestStreak: 4,
    bottlenecks: ['wm_reread', 'fld_stuck'],
    contexts: ['Autoconhecimento e mensuração objetiva da minha mente'],
    baseScores: {
      selective_attention: 430,
      working_memory: 390,
      fluid_reasoning: 400,
      processing_speed: 440,
      numerical_cognition: 460,
      inhibitory_control: 450,
    },
    currentScores: {
      selective_attention: 500,
      working_memory: 460,
      fluid_reasoning: 470,
      processing_speed: 510,
      numerical_cognition: 530,
      inhibitory_control: 520,
    },
    avgRtMs: 1180,
    avgAccuracy: 81,
    daysAgoActive: [0, 1, 5, 8, 12],
    sessionsPerActiveDay: 2,
    completedTodayCount: 0,
    seedNum: 505,
  },
  {
    id: 'usr-juliana',
    name: 'Juliana Oliveira',
    ageBracket: '25-34',
    dailyGoalMinutes: 20,
    peakTime: 'Manhã (06h–12h)',
    stamina: 5,
    streak: 7,
    bestStreak: 15,
    bottlenecks: [],
    contexts: ['Alta performance profissional e tomada de decisão', 'Autoconhecimento e mensuração objetiva da minha mente'],
    baseScores: {
      selective_attention: 730,
      working_memory: 740,
      fluid_reasoning: 760,
      processing_speed: 720,
      numerical_cognition: 710,
      inhibitory_control: 750,
    },
    currentScores: {
      selective_attention: 840,
      working_memory: 850,
      fluid_reasoning: 870,
      processing_speed: 820,
      numerical_cognition: 810,
      inhibitory_control: 860,
    },
    avgRtMs: 635,
    avgAccuracy: 95,
    daysAgoActive: [0, 1, 2, 3, 4, 5, 6, 8, 10, 13],
    sessionsPerActiveDay: 2,
    completedTodayCount: 5,
    seedNum: 606,
  },
  {
    id: 'usr-bruno',
    name: 'Bruno Almeida',
    ageBracket: '35-44',
    dailyGoalMinutes: 10,
    peakTime: 'Tarde (12h–18h)',
    stamina: 3,
    streak: 1,
    bestStreak: 3,
    bottlenecks: ['att_tabs', 'fld_stuck'],
    contexts: ['Alta performance profissional e tomada de decisão'],
    baseScores: {
      selective_attention: 440,
      working_memory: 510,
      fluid_reasoning: 460,
      processing_speed: 550,
      numerical_cognition: 640,
      inhibitory_control: 520,
    },
    currentScores: {
      selective_attention: 470,
      working_memory: 540,
      fluid_reasoning: 490,
      processing_speed: 590,
      numerical_cognition: 690,
      inhibitory_control: 550,
    },
    avgRtMs: 995,
    avgAccuracy: 80,
    daysAgoActive: [0, 4, 7, 10],
    sessionsPerActiveDay: 2,
    completedTodayCount: 0,
    seedNum: 707,
  },
  {
    id: 'usr-helena',
    name: 'Helena Santos',
    ageBracket: '55+',
    dailyGoalMinutes: 10,
    peakTime: 'Manhã (06h–12h)',
    stamina: 4,
    streak: 5,
    bestStreak: 11,
    bottlenecks: ['spd_num_slow'],
    contexts: ['Agilidade mental, reflexos e longevidade cognitiva'],
    baseScores: {
      selective_attention: 580,
      working_memory: 590,
      fluid_reasoning: 600,
      processing_speed: 500,
      numerical_cognition: 620,
      inhibitory_control: 650,
    },
    currentScores: {
      selective_attention: 660,
      working_memory: 680,
      fluid_reasoning: 690,
      processing_speed: 590,
      numerical_cognition: 700,
      inhibitory_control: 740,
    },
    avgRtMs: 960,
    avgAccuracy: 94,
    daysAgoActive: [0, 1, 2, 3, 4, 7, 10],
    sessionsPerActiveDay: 2,
    completedTodayCount: 2,
    seedNum: 808,
  },
];

function buildSeededUserState(bp: SeedBlueprint): AppDataState {
  const rand = seededRand(bp.seedNum);
  const nowIso = new Date().toISOString();
  const todayStr = localDateIsoOffset(0);

  const scores: DomainScoresRecord = {
    user_id: bp.id,
    ...bp.currentScores,
    baseline_scores: { ...bp.baseScores },
    updated_at: nowIso,
  };

  const icg = calculateGlobalCognitiveIndex(scores);
  const tier = getCognitiveTier(icg);

  // Inicializa progresso dos 48 exercícios (todos começam a partir do Nível 1)
  const progress = GAME_REGISTRY.reduce((acc, g) => {
    const domScore = bp.currentScores[g.domain];
    const stage = Math.max(1, Math.min(6, 1 + Math.floor((domScore - 420) / 95)));
    acc[g.slug] = {
      game_slug: g.slug,
      domain: g.domain,
      current_stage: stage,
      highest_score: 0,
      total_plays: 0,
      ease_mode: false,
      updated_at: nowIso,
    };
    return acc;
  }, {} as Record<GameSlug, GameProgressRecord>);

  // Gera sessões realistas ao longo dos últimos 14 dias (do mais antigo pro mais recente)
  const sortedDaysAgo = [...bp.daysAgoActive].sort((a, b) => b - a);
  const sessions: CognitiveSessionRecord[] = [];
  const snapshots: CognitiveSnapshotRecord[] = [];
  const domainKeys = DOMAIN_LIST.map((d) => d.key);
  let seq = 0;

  for (let dIdx = 0; dIdx < sortedDaysAgo.length; dIdx++) {
    const daysAgo = sortedDaysAgo[dIdx];
    const progressFactor =
      sortedDaysAgo.length <= 1 ? 1 : dIdx / (sortedDaysAgo.length - 1);
    const dateStr = localDateIsoOffset(daysAgo);

    const dayDomScores = {} as Record<DomainKey, number>;
    for (const dk of domainKeys) {
      const b = bp.baseScores[dk];
      const c = bp.currentScores[dk];
      dayDomScores[dk] = Math.round(b + (c - b) * progressFactor);
    }
    const dayIcg = Math.round(
      domainKeys.reduce((acc, dk) => acc + dayDomScores[dk], 0) / domainKeys.length
    );

    let dayRtSum = 0;
    let dayAccSum = 0;

    for (let sIdx = 0; sIdx < bp.sessionsPerActiveDay; sIdx++) {
      seq++;
      const dk = domainKeys[(seq + bp.seedNum) % domainKeys.length];
      const domGames = GAMES_BY_DOMAIN[dk];
      const game = domGames[(seq + sIdx) % domGames.length];
      const targetScore = dayDomScores[dk];
      const jitter = Math.round((rand() - 0.45) * 90);
      const score = Math.max(240, Math.min(970, targetScore + jitter));
      const acc = Number(
        Math.max(54, Math.min(100, bp.avgAccuracy + (rand() - 0.45) * 14)).toFixed(1)
      );
      const rtImprove = Math.round((1 - progressFactor) * 85);
      const rtMean = Math.max(410, Math.round(bp.avgRtMs + rtImprove + (rand() - 0.5) * 120));
      const rtSd = Math.max(70, Math.round(rtMean * (0.16 + rand() * 0.1)));
      const cleared = score >= 540 && acc >= 80;
      const stagePlayed = Math.max(0, Math.min(4, Math.floor((score - 440) / 105)));
      const accuracyPoints = Math.min(600, Math.round((acc / 100) * 580));
      const speedPoints = Math.max(0, Math.min(400, score - accuracyPoints));
      const percentile = scoreToPercentile(score, stagePlayed, acc, 12, bp.ageBracket);

      const dt = new Date();
      dt.setDate(dt.getDate() - daysAgo);
      dt.setHours(8 + ((sIdx * 3 + (bp.seedNum % 5)) % 12), Math.floor(rand() * 55), 0, 0);

      sessions.push({
        id: `${bp.id}-sess-${seq}`,
        domain: dk,
        game_slug: game.slug,
        mode: sIdx === 0 ? 'guided' : 'free',
        stage_played: stagePlayed,
        stage_cleared: cleared,
        score,
        accuracy_pct: acc,
        accuracy_points: accuracyPoints,
        speed_points: speedPoints,
        percentile,
        earned_title: getCognitiveTier(score).title,
        waves_completed: cleared ? 5 : Math.max(2, Math.min(4, Math.round((score / 700) * 4))),
        completed_early: cleared,
        time_remaining_ms: cleared ? Math.round(3500 + rand() * 9000) : 0,
        commission_errors: Math.max(0, Math.round(((100 - acc) / 100) * 16)),
        omission_errors: 0,
        rt_mean_ms: rtMean,
        rt_sd_ms: rtSd,
        created_at: dt.toISOString(),
      });

      const p = progress[game.slug];
      p.total_plays += 1;
      p.highest_score = Math.max(p.highest_score, score);
      p.current_stage = Math.max(p.current_stage, cleared ? stagePlayed + 1 : stagePlayed);
      p.updated_at = dt.toISOString();

      dayRtSum += rtMean;
      dayAccSum += acc;
    }

    snapshots.push({
      id: `${bp.id}-snap-${dateStr}`,
      snapshot_date: dateStr,
      global_index: dayIcg,
      domain_scores_json: dayDomScores,
      avg_rt_ms: Math.round(dayRtSum / bp.sessionsPerActiveDay),
      avg_accuracy: Number((dayAccSum / bp.sessionsPerActiveDay).toFixed(1)),
      archetype_title: resolveArchetype({
        user_id: bp.id,
        ...dayDomScores,
        baseline_scores: bp.baseScores,
        updated_at: nowIso,
      }).def.title,
      created_at: `${dateStr}T18:00:00.000Z`,
    });
  }

  // Sessões mais recentes primeiro
  sessions.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const dailyProtocol = generateDailyProtocol(
    scores,
    todayStr,
    DOMAIN_LIST.map((d) => d.key),
    bp.dailyGoalMinutes
  );
  if (bp.completedTodayCount > 0) {
    dailyProtocol.completed_games = dailyProtocol.recommended_games
      .slice(0, bp.completedTodayCount)
      .map((g) => g.slug);
  }

  return {
    profile: {
      id: bp.id,
      name: bp.name,
      email: `${bp.id}@local.neurolab`,
      theme_preference: 'light',
      plan_tier: 'free',
      global_cognitive_index: icg,
      current_streak: bp.streak,
      best_streak: bp.bestStreak,
      calibrated: true,
      calibration_skipped: false,
      selected_domains: DOMAIN_LIST.map((d) => d.key),
      daily_goal_minutes: bp.dailyGoalMinutes,
      peak_time: bp.peakTime,
      cognitive_bottlenecks: bp.bottlenecks,
      mental_stamina_baseline: bp.stamina,
      application_context: bp.contexts.join(' • '),
      application_contexts: bp.contexts,
      age_bracket: bp.ageBracket,
      current_title: tier.title,
      onboarding_answers: {
        goals: ['full_stack'],
        bottlenecks: bp.bottlenecks,
        age_bracket: bp.ageBracket,
      },
      last_played_date: bp.daysAgoActive.includes(0) ? todayStr : localDateIsoOffset(bp.daysAgoActive[0] ?? 1),
      isLocalGuest: true,
      isAdmin: Boolean(bp.isAdmin),
    },
    scores,
    progress,
    sessions,
    snapshots,
    dailyProtocol,
  };
}

function buildFreshSeedDb(): LocalUserDb {
  const users: Record<string, AppDataState> = {};
  for (const bp of SEED_BLUEPRINTS) {
    users[bp.id] = buildSeededUserState(bp);
  }
  return {
    version: 3,
    activeUserId: ADMIN_USER_ID,
    users,
  };
}

function writeDb(db: LocalUserDb) {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch {
    // ignora cota do navegador
  }
}

/**
 * Garante a existência da base local com Teste ADM + 7 usuários fictícios (0 chamadas ao Supabase).
 */
export function ensureLocalUserDb(): LocalUserDb {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalUserDb;
      if (parsed?.users && parsed.users[ADMIN_USER_ID]) {
        // Migração suave v1/v2 -> v3: tema Claro Suave, 24 exercícios e piso Nível 1 preservando sessões
        if ((parsed.version ?? 1) < 3) {
          const prevVer = parsed.version ?? 1;
          parsed.version = 3;
          const nowIso = new Date().toISOString();
          for (const u of Object.values(parsed.users)) {
            if (u?.profile && prevVer < 2) {
              u.profile.theme_preference = 'light';
            }
            if (u) {
              const nextProg = { ...(u.progress ?? {}) } as Record<GameSlug, GameProgressRecord>;
              for (const g of GAME_REGISTRY) {
                const existing = nextProg[g.slug];
                nextProg[g.slug] = existing
                  ? { ...existing, current_stage: Math.max(1, existing.current_stage || 1) }
                  : {
                      game_slug: g.slug,
                      domain: g.domain,
                      current_stage: 1,
                      highest_score: 0,
                      total_plays: 0,
                      ease_mode: false,
                      updated_at: nowIso,
                    };
              }
              u.progress = nextProg;
            }
          }
          writeDb(parsed);
        }
        return parsed;
      }
    }
  } catch {
    // recria se corrompido
  }
  const fresh = buildFreshSeedDb();
  writeDb(fresh);
  return fresh;
}

export function getLocalUserState(userId: string): AppDataState | null {
  const db = ensureLocalUserDb();
  const state = db.users[userId];
  if (!state) return null;

  let dirty = false;
  const nowIso = new Date().toISOString();
  const nextProg = { ...(state.progress ?? {}) } as Record<GameSlug, GameProgressRecord>;
  for (const g of GAME_REGISTRY) {
    if (!nextProg[g.slug]) {
      nextProg[g.slug] = {
        game_slug: g.slug,
        domain: g.domain,
        current_stage: 1,
        highest_score: 0,
        total_plays: 0,
        ease_mode: false,
        updated_at: nowIso,
      };
      dirty = true;
    }
  }
  if (dirty) {
    state.progress = nextProg;
  }

  // Régua científica nova: quem já jogava tem as notas recalculadas uma vez pelo histórico
  let current = state;
  if (needsNormMigration(current)) {
    current = migrateStateToNormV2(current, { recomputeScores: true });
    dirty = true;
  }
  const finalState = current;
  if (finalState !== state) {
    db.users[userId] = finalState;
  }

  const today = getAppTodayIso();
  if (!finalState.dailyProtocol || finalState.dailyProtocol.protocol_date !== today) {
    finalState.dailyProtocol = generateDailyProtocol(
      finalState.scores,
      today,
      finalState.profile.selected_domains,
      finalState.profile.daily_goal_minutes
    );
    dirty = true;
  }

  if (dirty) {
    db.users[userId] = finalState;
    writeDb(db);
  }
  return finalState;
}

export function getActiveLocalUserId(): string {
  const db = ensureLocalUserDb();
  return db.users[db.activeUserId] ? db.activeUserId : ADMIN_USER_ID;
}

export function setActiveLocalUserId(userId: string): AppDataState | null {
  const db = ensureLocalUserDb();
  if (!db.users[userId]) return null;
  db.activeUserId = userId;
  writeDb(db);
  return getLocalUserState(userId);
}

/**
 * Salva qualquer alteração (jogada, calibração, preferência) diretamente no usuário ativo da base local.
 */
export function saveLocalUserState(state: AppDataState) {
  if (!state?.profile?.id) return;
  const db = ensureLocalUserDb();
  const targetId = state.profile.id === 'local-guest' ? ADMIN_USER_ID : state.profile.id;
  if (db.users[targetId] || state.profile.isLocalGuest) {
    db.users[targetId] = {
      ...state,
      profile: {
        ...state.profile,
        id: targetId,
        isLocalGuest: true,
        isAdmin: targetId === ADMIN_USER_ID ? true : state.profile.isAdmin,
      },
    };
    writeDb(db);
  }
}

export function listLocalUsers(): LocalUserSummary[] {
  const db = ensureLocalUserDb();
  return Object.values(db.users)
    .map((u) => {
      const totalSessions = u.sessions.length;
      const avgAccuracyPct = totalSessions
        ? Math.round(
            u.sessions.reduce((acc, s) => acc + Number(s.accuracy_pct || 0), 0) / totalSessions
          )
        : 0;
      const domainPcts = DOMAIN_LIST.reduce((acc, d) => {
        acc[d.key] = scoreToPercent(u.scores[d.key] ?? 0);
        return acc;
      }, {} as Record<DomainKey, number>);

      const isBrandNew = totalSessions === 0 && u.profile.global_cognitive_index === 0;

      return {
        id: u.profile.id,
        name: u.profile.name,
        isAdmin: Boolean(u.profile.isAdmin || u.profile.id === ADMIN_USER_ID),
        ageBracket: u.profile.age_bracket ?? '25-34',
        globalPct: scoreToPercent(u.profile.global_cognitive_index),
        streak: u.profile.current_streak,
        totalSessions,
        avgAccuracyPct,
        archetypeTitle: isBrandNew
          ? 'Novo · Aguardando avaliação'
          : resolveArchetype(u.scores).def.title,
        lastPlayedDate: u.profile.last_played_date,
        domainPcts,
      };
    })
    .sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return b.globalPct - a.globalPct;
    });
}

/**
 * Cria um novo usuário real 100% zerado (0% em todos os domínios) pronto para iniciar a conversa de Anamnese.
 */
export function createLocalTestUser(
  name: string,
  ageBracket: AgeBracket,
  dailyGoalMinutes: 5 | 10 | 15 | 20 = 10
): AppDataState {
  const db = ensureLocalUserDb();
  const cleanName = name.trim() || 'Novo Usuário';
  const id = `usr-${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();
  const today = getAppTodayIso();

  const scores: DomainScoresRecord = {
    user_id: id,
    selective_attention: 0,
    working_memory: 0,
    fluid_reasoning: 0,
    processing_speed: 0,
    numerical_cognition: 0,
    inhibitory_control: 0,
    baseline_scores: {},
    updated_at: nowIso,
  };

  const progress = GAME_REGISTRY.reduce((acc, g) => {
    acc[g.slug] = {
      game_slug: g.slug,
      domain: g.domain,
      current_stage: 1,
      highest_score: 0,
      total_plays: 0,
      ease_mode: false,
      updated_at: nowIso,
    };
    return acc;
  }, {} as Record<GameSlug, GameProgressRecord>);

  const newState: AppDataState = {
    profile: {
      id,
      name: cleanName,
      email: `${id}@local.neurolab`,
      theme_preference: 'light',
      plan_tier: 'free',
      global_cognitive_index: 0,
      current_streak: 0,
      best_streak: 0,
      calibrated: false,
      calibration_skipped: false,
      selected_domains: [],
      daily_goal_minutes: dailyGoalMinutes,
      peak_time: 'Manhã (06h–12h)',
      cognitive_bottlenecks: [],
      mental_stamina_baseline: 3,
      application_context: '',
      application_contexts: [],
      age_bracket: ageBracket,
      current_title: 'Sem avaliação',
      onboarding_answers: {},
      last_played_date: null,
      isLocalGuest: true,
      isAdmin: false,
    },
    scores,
    progress,
    sessions: [],
    snapshots: [],
    dailyProtocol: generateDailyProtocol(scores, today, DOMAIN_LIST.map((d) => d.key), dailyGoalMinutes),
  };

  db.users[id] = newState;
  db.activeUserId = id;
  writeDb(db);
  return newState;
}

export function resetLocalUserDb(): AppDataState {
  resetSimulatedDayOffset();
  const fresh = buildFreshSeedDb();
  writeDb(fresh);
  return fresh.users[ADMIN_USER_ID];
}

function calcDist(values: number[], fallback: BenchmarkDistribution): BenchmarkDistribution {
  if (values.length < 6) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sorted.length;
  const sd = Math.max(60, Math.round(Math.sqrt(variance)));
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  return {
    ...fallback,
    mean,
    sd,
    p50: pct(0.5),
    p75: pct(0.75),
    p90: pct(0.9),
    p99: pct(0.99),
  };
}

/**
 * Calcula benchmarks populacionais reais direto dos usuários locais (0 consumo do Supabase!).
 */
export function computeLocalPopulationBenchmarks(): PopulationBenchmarks {
  const db = ensureLocalUserDb();
  const userList = Object.values(db.users);
  const allSessions = userList.flatMap((u) => u.sessions);

  if (allSessions.length < 20 || userList.length < 2) {
    return NORMATIVE_BENCHMARKS;
  }

  const domains = { ...NORMATIVE_BENCHMARKS.domains };
  for (const d of DOMAIN_LIST) {
    const vals = allSessions.filter((s) => s.domain === d.key).map((s) => s.score);
    domains[d.key] = calcDist(vals, NORMATIVE_BENCHMARKS.domains[d.key]);
  }

  const games = { ...NORMATIVE_BENCHMARKS.games };
  for (const g of GAME_REGISTRY) {
    const vals = allSessions.filter((s) => s.game_slug === g.slug).map((s) => s.score);
    games[g.slug] = calcDist(vals, NORMATIVE_BENCHMARKS.games[g.slug]);
  }

  return {
    source: 'population',
    sample_sessions: allSessions.length,
    distinct_users: userList.length,
    global: calcDist(
      allSessions.map((s) => s.score),
      NORMATIVE_BENCHMARKS.global
    ),
    domains,
    games,
  };
}

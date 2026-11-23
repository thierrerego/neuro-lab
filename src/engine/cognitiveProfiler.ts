import type {
  AgeBracket,
  BenchmarkDistribution,
  ClinicalMetricsSummary,
  CognitiveDossier,
  CognitiveSessionRecord,
  CognitiveSnapshotRecord,
  DomainKey,
  DomainScoresRecord,
  GameMasterySummary,
  GameProgressRecord,
  GameSlug,
  PopulationBenchmarks,
  UserProfile,
} from '../types/cognitive';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_REGISTRY, GAMES_BY_DOMAIN } from './gameRegistry';
import { getAgeBracketMeta, normalCDF, scoreToPercent } from './psychometricEngine';
import { getAppNow } from '../lib/appClock';

export interface WeeklyDayItem {
  dateIso: string;
  shortLabel: string;
  isToday: boolean;
  isFuture: boolean;
  sessionsCount: number;
  trained: boolean;
}

export interface WeeklyEvolutionSummary {
  days: WeeklyDayItem[];
  activeDaysThisWeek: number;
  sessionsThisWeek: number;
  sessionsPrevWeek: number;
  sessionsDelta: number;
  avgAccuracyThisWeek: number;
  accuracyDeltaVsPrevWeek: number | null;
  avgRtThisWeek: number;
  rtDeltaVsPrevWeek: number | null;
  indexDelta7dPct: number | null;
  bestDomainThisWeek: DomainKey | null;
}

export interface ExerciseHistoryEntry {
  id: string;
  dateIso: string;
  dayLabel: string;
  timeLabel: string;
  slug: GameSlug;
  domain: DomainKey;
  stagePlayed: number;
  indexPct: number;
  accuracyPct: number;
  rtMeanMs: number;
  deltaVsPrevPct: number | null;
  rtDeltaVsPrevMs: number | null;
  isRecord: boolean;
}

export interface PreviousExerciseReference {
  previousIndexPct: number | null;
  previousRtMs: number | null;
  bestIndexPct: number;
  totalPlaysBefore: number;
  domainScoreBeforePct: number;
}

/**
 * Parâmetros normativos recalibrados (mediana real = 500, σ = 235):
 * - 500 = 50% | < 200 < 10% | 750 ≈ 85% | 900+ = elite/ápice
 */
export const NORMATIVE_BENCHMARKS: PopulationBenchmarks = {
  source: 'normative',
  sample_sessions: 0,
  distinct_users: 0,
  global: { mean: 500, sd: 235, p50: 500, p75: 658, p90: 801, p99: 960 },
  domains: {
    selective_attention: { mean: 505, sd: 230, p50: 505, p75: 660, p90: 800, p99: 958, avg_rt_ms: 1180 },
    working_memory: { mean: 495, sd: 235, p50: 495, p75: 653, p90: 796, p99: 955, avg_rt_ms: 1280 },
    fluid_reasoning: { mean: 490, sd: 240, p50: 490, p75: 652, p90: 798, p99: 958, avg_rt_ms: 1980 },
    processing_speed: { mean: 510, sd: 228, p50: 510, p75: 664, p90: 802, p99: 960, avg_rt_ms: 930 },
    numerical_cognition: { mean: 498, sd: 235, p50: 498, p75: 656, p90: 799, p99: 958, avg_rt_ms: 1520 },
    inhibitory_control: { mean: 502, sd: 232, p50: 502, p75: 658, p90: 799, p99: 958, avg_rt_ms: 790 },
  },
  games: {
    'visual-search': { mean: 508, sd: 230, p50: 508, p75: 663, p90: 803, p99: 960, avg_rt_ms: 1150, early_rate_pct: 34 },
    'sustained-tracking': { mean: 496, sd: 235, p50: 496, p75: 654, p90: 797, p99: 955, avg_rt_ms: 1350, early_rate_pct: 28 },
    'odd-one-out': { mean: 512, sd: 228, p50: 512, p75: 666, p90: 804, p99: 960, avg_rt_ms: 1080, early_rate_pct: 38 },
    'flanker-focus': { mean: 510, sd: 230, p50: 510, p75: 665, p90: 803, p99: 960, avg_rt_ms: 780, early_rate_pct: 38 },
    'memory-pairs': { mean: 505, sd: 232, p50: 505, p75: 661, p90: 801, p99: 958, avg_rt_ms: 1650, early_rate_pct: 35 },
    'photo-recall': { mean: 500, sd: 234, p50: 500, p75: 658, p90: 800, p99: 958, avg_rt_ms: 1420, early_rate_pct: 32 },
    'spatial-span': { mean: 498, sd: 235, p50: 498, p75: 656, p90: 799, p99: 958, avg_rt_ms: 1260, early_rate_pct: 30 },
    'dual-n-back': { mean: 490, sd: 238, p50: 490, p75: 650, p90: 795, p99: 955, avg_rt_ms: 1220, early_rate_pct: 26 },
    'number-sequence': { mean: 502, sd: 234, p50: 502, p75: 659, p90: 800, p99: 958, avg_rt_ms: 1750, early_rate_pct: 32 },
    'logic-intruder': { mean: 504, sd: 232, p50: 504, p75: 660, p90: 801, p99: 958, avg_rt_ms: 1580, early_rate_pct: 34 },
    'raven-matrices': { mean: 488, sd: 240, p50: 488, p75: 650, p90: 796, p99: 956, avg_rt_ms: 2380, early_rate_pct: 24 },
    'path-logic': { mean: 502, sd: 232, p50: 502, p75: 658, p90: 799, p99: 958, avg_rt_ms: 1300, early_rate_pct: 34 },
    'speed-match': { mean: 515, sd: 225, p50: 515, p75: 667, p90: 803, p99: 960, avg_rt_ms: 770, early_rate_pct: 40 },
    'symbol-digit': { mean: 506, sd: 230, p50: 506, p75: 661, p90: 801, p99: 958, avg_rt_ms: 1060, early_rate_pct: 36 },
    'schulte-order': { mean: 512, sd: 228, p50: 512, p75: 666, p90: 804, p99: 960, avg_rt_ms: 1050, early_rate_pct: 38 },
    'flash-match': { mean: 510, sd: 229, p50: 510, p75: 664, p90: 802, p99: 960, avg_rt_ms: 1120, early_rate_pct: 37 },
    'chain-arithmetic': { mean: 496, sd: 236, p50: 496, p75: 655, p90: 798, p99: 958, avg_rt_ms: 1620, early_rate_pct: 30 },
    'number-comparison': { mean: 504, sd: 232, p50: 504, p75: 660, p90: 801, p99: 958, avg_rt_ms: 1360, early_rate_pct: 36 },
    'target-sum': { mean: 500, sd: 234, p50: 500, p75: 658, p90: 800, p99: 958, avg_rt_ms: 1480, early_rate_pct: 33 },
    'missing-operator': { mean: 506, sd: 231, p50: 506, p75: 662, p90: 801, p99: 958, avg_rt_ms: 1240, early_rate_pct: 36 },
    'stroop-conflict': { mean: 504, sd: 232, p50: 504, p75: 660, p90: 801, p99: 958, avg_rt_ms: 910, early_rate_pct: 34 },
    'go-nogo-reflex': { mean: 500, sd: 234, p50: 500, p75: 658, p90: 800, p99: 958, avg_rt_ms: 630, early_rate_pct: 32 },
    'opposite-arrow': { mean: 508, sd: 230, p50: 508, p75: 663, p90: 802, p99: 960, avg_rt_ms: 820, early_rate_pct: 36 },
    'rule-switch': { mean: 502, sd: 232, p50: 502, p75: 659, p90: 800, p99: 958, avg_rt_ms: 960, early_rate_pct: 33 },
    'conjunction-search': { mean: 504, sd: 232, p50: 504, p75: 660, p90: 801, p99: 958, avg_rt_ms: 1250, early_rate_pct: 32 },
    'reverse-digits': { mean: 492, sd: 238, p50: 492, p75: 652, p90: 797, p99: 956, avg_rt_ms: 2100, early_rate_pct: 28 },
    'logic-balance': { mean: 494, sd: 238, p50: 494, p75: 654, p90: 798, p99: 957, avg_rt_ms: 2300, early_rate_pct: 27 },
    'quick-pair': { mean: 508, sd: 229, p50: 508, p75: 663, p90: 802, p99: 960, avg_rt_ms: 1400, early_rate_pct: 35 },
    'quick-estimate': { mean: 502, sd: 233, p50: 502, p75: 659, p90: 800, p99: 958, avg_rt_ms: 1550, early_rate_pct: 33 },
    'inverted-signal': { mean: 504, sd: 231, p50: 504, p75: 660, p90: 801, p99: 958, avg_rt_ms: 1050, early_rate_pct: 34 },
  },
};

export function adjustDistributionForAge(
  dist: BenchmarkDistribution,
  ageBracket?: AgeBracket | string | null
): BenchmarkDistribution {
  const offset = getAgeBracketMeta(ageBracket).meanOffset;
  if (offset === 0) return dist;
  return {
    ...dist,
    mean: Math.max(300, Math.min(700, dist.mean + offset)),
    p50: Math.max(300, Math.min(700, dist.p50 + offset)),
    p75: Math.max(420, Math.min(820, dist.p75 + offset)),
    p90: Math.max(550, Math.min(910, dist.p90 + offset)),
    p99: Math.max(720, Math.min(990, dist.p99 + offset)),
  };
}

interface ArchetypeDef {
  title: string;
  subtitle: string;
  color: string;
  trait: string;
}

const ARCHETYPE_PAIRS: Record<string, ArchetypeDef> = {
  'inhibitory_control+processing_speed': {
    title: 'Perfil Executivo Preciso',
    subtitle: 'Alta velocidade de resposta com baixo índice de impulsividade',
    color: '#38bdf8',
    trait: 'responde rápido mantendo o freio decisório contra erros por impulso',
  },
  'fluid_reasoning+working_memory': {
    title: 'Perfil Analítico Estrutural',
    subtitle: 'Elevada retenção ativa combinada à detecção de padrões complexos',
    color: '#818cf8',
    trait: 'sustenta múltiplas variáveis na memória operacional enquanto infere regras novas',
  },
  'numerical_cognition+selective_attention': {
    title: 'Perfil Quantitativo Focado',
    subtitle: 'Foco sustentado aliado à precisão em cálculo mental',
    color: '#10b981',
    trait: 'filtra distratores enquanto manipula relações numéricas com clareza',
  },
  'processing_speed+selective_attention': {
    title: 'Perfil de Varredura Ágil',
    subtitle: 'Rápida triagem visual e resposta imediata sob estímulos competitivos',
    color: '#38bdf8',
    trait: 'localiza estímulos relevantes em ambientes densos com baixa latência',
  },
  'selective_attention+working_memory': {
    title: 'Perfil de Vigilância Operacional',
    subtitle: 'Acompanhamento contínuo com retenção sequencial preservada',
    color: '#818cf8',
    trait: 'monitora múltiplos elementos simultâneos sem perder a ordem de referência',
  },
  'fluid_reasoning+selective_attention': {
    title: 'Perfil Decodificador Visual',
    subtitle: 'Captação de detalhes sutis e inferência rápida de regras ocultas',
    color: '#a78bfa',
    trait: 'isola sinais relevantes entre distratores e identifica padrões estruturais',
  },
  'inhibitory_control+selective_attention': {
    title: 'Perfil de Foco Blindado',
    subtitle: 'Alta resistência a distratores e estímulos conflitantes',
    color: '#38bdf8',
    trait: 'mantém o alvo cognitivo estável mesmo sob interferência direta',
  },
  'processing_speed+working_memory': {
    title: 'Perfil de Atualização Rápida',
    subtitle: 'Alta taxa de renovação da memória de trabalho sob pressão temporal',
    color: '#f59e0b',
    trait: 'acompanha e atualiza sequências dinâmicas com fluidez acima da média',
  },
  'numerical_cognition+working_memory': {
    title: 'Perfil de Cálculo Operacional',
    subtitle: 'Manipulação numérica mental sustentada sem perda de etapas',
    color: '#10b981',
    trait: 'retém resultados intermediários e encadeia operações com autonomia',
  },
  'inhibitory_control+working_memory': {
    title: 'Perfil de Controle Executivo',
    subtitle: 'Proteção ativa da memória operacional contra interferências',
    color: '#818cf8',
    trait: 'mantém o plano mental íntegro sem ceder a respostas precipitadas',
  },
  'fluid_reasoning+processing_speed': {
    title: 'Perfil Estratégico Ágil',
    subtitle: 'Resolução acelerada de problemas inéditos sob restrição de tempo',
    color: '#a78bfa',
    trait: 'assimila regras novas rapidamente mantendo ritmo consistente',
  },
  'fluid_reasoning+numerical_cognition': {
    title: 'Perfil Lógico-Quantitativo',
    subtitle: 'Sinergia entre abstração estrutural e fluidez numérica',
    color: '#10b981',
    trait: 'traduz cenários complexos em relações lógicas e quantitativas claras',
  },
  'fluid_reasoning+inhibitory_control': {
    title: 'Perfil Deliberativo',
    subtitle: 'Avaliação criteriosa que evita atalhos impulsivos',
    color: '#a78bfa',
    trait: 'bloqueia respostas óbvias incorretas para selecionar a solução válida',
  },
  'numerical_cognition+processing_speed': {
    title: 'Perfil Quantitativo Veloz',
    subtitle: 'Estimativa rápida de grandezas e agilidade aritmética',
    color: '#f59e0b',
    trait: 'compara magnitudes e conclui cálculos mentais com alta eficiência',
  },
  'inhibitory_control+numerical_cognition': {
    title: 'Perfil Analítico Criterioso',
    subtitle: 'Avaliação numérica precisa com elevado autocontrole',
    color: '#10b981',
    trait: 'verifica grandezas e operações com baixa taxa de erro por precipitação',
  },
};

const BALANCED_ARCHETYPE: ArchetypeDef = {
  title: 'Perfil Cognitivo Equilibrado',
  subtitle: 'Distribuição homogênea entre os seis domínios avaliados',
  color: '#38bdf8',
  trait: 'mantém desempenho simétrico entre atenção, memória, lógica, velocidade, cálculo e inibição',
};

const UNMEASURED_ARCHETYPE: ArchetypeDef = {
  title: 'Perfil em Formação',
  subtitle: 'Aguardando primeiras sessões de 30s para traçar métricas reais',
  color: '#64748b',
  trait: 'está iniciando o mapeamento da sua linha de base cognitiva',
};

const PARTIAL_ARCHETYPE: ArchetypeDef = {
  title: 'Mapeamento em Andamento',
  subtitle: 'Primeiras medições registradas — avalie mais domínios para consolidar o perfil',
  color: '#4F6EF7',
  trait: 'já iniciou sua curva pessoal e está ampliando a leitura dos 6 domínios',
};

const BOTTLENECK_HUMAN_LABELS: Record<string, { short: string; domains: DomainKey[] }> = {
  wm_reread: { short: 'precisar reler ou reconfirmar instruções recentes', domains: ['working_memory'] },
  att_tabs: { short: 'fragmentação de foco ao alternar tarefas', domains: ['selective_attention'] },
  inh_impulse: { short: 'respostas precipitadas sob pressão de tempo', domains: ['inhibitory_control'] },
  spd_num_slow: { short: 'maior lentidão em conexões rápidas e cálculo mental', domains: ['processing_speed', 'numerical_cognition'] },
  fld_stuck: { short: 'dificuldade inicial diante de problemas sem roteiro prévio', domains: ['fluid_reasoning'] },
};

export function percentileFromBenchmark(
  score: number,
  dist: BenchmarkDistribution,
  ageBracket?: AgeBracket | string | null
): number {
  if (score <= 0) return 1.0;
  const adjusted = adjustDistributionForAge(dist, ageBracket);
  const safeSd = Math.max(55, adjusted.sd || 235);
  const pct = normalCDF(score, adjusted.mean, safeSd) * 100;
  return Number(Math.max(1.0, Math.min(99.9, pct)).toFixed(1));
}

export function percentileToTopPercent(percentile: number): number {
  return Math.max(1, Math.min(99, Math.round(100 - percentile)));
}

export function getPopulationBand(percentile: number): CognitiveDossier['populationBand'] {
  if (percentile >= 99) return 'Ápice (Top 1%)';
  if (percentile >= 90) return 'Elite (Top 10%)';
  if (percentile >= 75) return 'Acima da Média (Top 25%)';
  if (percentile >= 45) return 'Média Geral (50%)';
  return 'Em Evolução';
}

export function resolveArchetype(
  scores: DomainScoresRecord
): { def: ArchetypeDef; topDomains: [DomainKey, DomainKey]; ranked: DomainKey[] } {
  const ranked = [...DOMAIN_LIST]
    .sort((a, b) => (scores[b.key] ?? 0) - (scores[a.key] ?? 0))
    .map((d) => d.key);

  const measured = ranked.filter((k) => (scores[k] ?? 0) > 0);
  const top1 = ranked[0];
  const top2 = ranked[1];

  if (measured.length === 0) {
    return { def: UNMEASURED_ARCHETYPE, topDomains: [top1, top2], ranked };
  }

  if (measured.length === 1) {
    return { def: PARTIAL_ARCHETYPE, topDomains: [top1, top2], ranked };
  }

  const highest = scores[measured[0]] ?? 0;
  const lowestMeasured = scores[measured[measured.length - 1]] ?? 0;

  if (highest - lowestMeasured < 14) {
    return { def: BALANCED_ARCHETYPE, topDomains: [measured[0], measured[1]], ranked };
  }

  const pairKey = [measured[0], measured[1]].sort().join('+');
  return {
    def: ARCHETYPE_PAIRS[pairKey] ?? BALANCED_ARCHETYPE,
    topDomains: [measured[0], measured[1]],
    ranked,
  };
}

export function computeClinicalMetrics(sessions: CognitiveSessionRecord[]): ClinicalMetricsSummary {
  if (sessions.length === 0) {
    return {
      avgRtMs: 0,
      rtDeltaMs: null,
      consistencyIndex: 0,
      consistencyDelta: null,
      avgRtSdMs: 0,
      avgAccuracyPct: 0,
      impulsivityPerSession: 0,
      earlyClearRatePct: 0,
      totalSessions: 0,
    };
  }

  const chronological = [...sessions].reverse();
  const validRt = chronological.filter((s) => s.rt_mean_ms > 0);
  const avgRtMs = validRt.length
    ? Math.round(validRt.reduce((acc, s) => acc + s.rt_mean_ms, 0) / validRt.length)
    : 0;

  const validSd = chronological.filter((s) => s.rt_sd_ms > 0);
  const avgRtSdMs = validSd.length
    ? Math.round(validSd.reduce((acc, s) => acc + s.rt_sd_ms, 0) / validSd.length)
    : 0;

  const avgAccuracyPct = Number(
    (chronological.reduce((acc, s) => acc + Number(s.accuracy_pct || 0), 0) / chronological.length).toFixed(1)
  );
  const impulsivityPerSession = Number(
    (chronological.reduce((acc, s) => acc + (s.commission_errors || 0), 0) / chronological.length).toFixed(1)
  );
  const earlyClears = chronological.filter((s) => s.completed_early || s.waves_completed >= 5).length;
  const earlyClearRatePct = Math.round((earlyClears / chronological.length) * 100);

  const calcConsistency = (slice: CognitiveSessionRecord[]): number => {
    if (slice.length === 0) return 0;
    const rts = slice.filter((s) => s.rt_mean_ms > 0);
    const avgCv = rts.length
      ? rts.reduce((acc, s) => acc + (s.rt_sd_ms > 0 ? s.rt_sd_ms / s.rt_mean_ms : 0.28), 0) / rts.length
      : 0.3;
    const avgComm = slice.reduce((acc, s) => acc + (s.commission_errors || 0), 0) / slice.length;
    const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, avgCv - 0.15) * 130)));
    const impulseScore = Math.max(0, Math.min(100, Math.round(100 - avgComm * 12)));
    return Math.round(stabilityScore * 0.62 + impulseScore * 0.38);
  };

  const consistencyIndex = calcConsistency(chronological.slice(-10));

  let rtDeltaMs: number | null = null;
  if (validRt.length >= 2) {
    const windowSize = Math.max(1, Math.min(4, Math.floor(validRt.length / 2)));
    const initialAvg =
      validRt.slice(0, windowSize).reduce((acc, s) => acc + s.rt_mean_ms, 0) / windowSize;
    const recentAvg =
      validRt.slice(-windowSize).reduce((acc, s) => acc + s.rt_mean_ms, 0) / windowSize;
    rtDeltaMs = Math.round(recentAvg - initialAvg);
  }

  let consistencyDelta: number | null = null;
  if (chronological.length >= 4) {
    const split = Math.floor(chronological.length / 2);
    const earlyC = calcConsistency(chronological.slice(0, split));
    const lateC = calcConsistency(chronological.slice(split));
    consistencyDelta = lateC - earlyC;
  }

  return {
    avgRtMs,
    rtDeltaMs,
    consistencyIndex,
    consistencyDelta,
    avgRtSdMs,
    avgAccuracyPct,
    impulsivityPerSession,
    earlyClearRatePct,
    totalSessions: sessions.length,
  };
}

export function buildGameMasteryList(
  progress: Record<GameSlug, GameProgressRecord>,
  sessions: CognitiveSessionRecord[],
  benchmarks: PopulationBenchmarks,
  ageBracket?: AgeBracket | string | null
): GameMasterySummary[] {
  return GAME_REGISTRY.map((g) => {
    const prog = progress[g.slug];
    const gameSessions = sessions.filter((s) => s.game_slug === g.slug);
    const bench = benchmarks.games[g.slug] ?? NORMATIVE_BENCHMARKS.games[g.slug];

    const bestWave = gameSessions.reduce((mx, s) => Math.max(mx, s.waves_completed || 0), 0);
    const bestRemainingMs = gameSessions.reduce(
      (mx, s) => (s.completed_early ? Math.max(mx, s.time_remaining_ms || 0) : mx),
      0
    );

    const avgScore = gameSessions.length
      ? Math.round(gameSessions.reduce((acc, s) => acc + s.score, 0) / gameSessions.length)
      : 0;

    const earlyCount = gameSessions.filter((s) => s.completed_early || s.waves_completed >= 5).length;
    const earlyClearRatePct = gameSessions.length
      ? Math.round((earlyCount / gameSessions.length) * 100)
      : 0;

    const bestSessionPct = gameSessions.reduce((mx, s) => Math.max(mx, Number(s.percentile || 0)), 0);
    const refScore =
      prog?.highest_score > 0
        ? Math.round(prog.highest_score * 0.65 + (avgScore || prog.highest_score) * 0.35)
        : 0;
    const percentile =
      bestSessionPct > 0
        ? bestSessionPct
        : refScore > 0
          ? percentileFromBenchmark(refScore, bench, ageBracket)
          : 50;

    const last10 = [...gameSessions]
      .slice(0, 10)
      .reverse()
      .map((s, idx) => {
        const dt = new Date(s.created_at);
        const dateLabel = Number.isNaN(dt.getTime())
          ? `#${idx + 1}`
          : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
        return {
          idx: idx + 1,
          score: s.score,
          waves: s.waves_completed || 0,
          dateLabel,
        };
      });

    return {
      slug: g.slug,
      domain: g.domain,
      currentStage: Math.max(1, prog?.current_stage ?? 1),
      highestScore: prog?.highest_score ?? 0,
      totalPlays: prog?.total_plays ?? gameSessions.length,
      bestWave,
      bestRemainingMs,
      percentile: Number(percentile.toFixed(1)),
      topPercent: percentileToTopPercent(percentile),
      earlyClearRatePct,
      avgScore,
      sparkline: last10,
    };
  });
}

function estimateSpeedBeatsPct(avgRtMs: number): number {
  if (avgRtMs <= 0) return 50;
  const pct = normalCDF(1250 - avgRtMs, 0, 380) * 100;
  return Math.max(5, Math.min(98, Math.round(pct)));
}

/**
 * Motor do Dossiê Cognitivo em linguagem clara, objetiva e em porcentagens.
 */
export function generateCognitiveDossier(params: {
  profile: UserProfile;
  scores: DomainScoresRecord;
  progress: Record<GameSlug, GameProgressRecord>;
  sessions: CognitiveSessionRecord[];
  benchmarks: PopulationBenchmarks;
}): CognitiveDossier {
  const { profile, scores, progress, sessions, benchmarks } = params;
  const { def, topDomains, ranked } = resolveArchetype(scores);
  const clinical = computeClinicalMetrics(sessions);
  const ageLabel = getAgeBracketMeta(profile.age_bracket).label;

  const measuredKeys = DOMAIN_LIST.map((d) => d.key).filter((k) => (scores[k] ?? 0) > 0);
  const hasMeasured = profile.global_cognitive_index > 0 && measuredKeys.length > 0;

  const globalPct = hasMeasured
    ? percentileFromBenchmark(profile.global_cognitive_index, benchmarks.global, profile.age_bracket)
    : 0;
  const topPercent = hasMeasured ? percentileToTopPercent(globalPct) : 100;
  const populationBand = hasMeasured ? getPopulationBand(globalPct) : 'Em Evolução';

  const top1 = DOMAIN_MAP[topDomains[0]];
  const top2 = DOMAIN_MAP[topDomains[1]];
  const top1Score = scores[top1.key] ?? 0;
  const top2Score = scores[top2.key] ?? 0;
  const top1Pct = top1Score > 0
    ? Math.round(percentileFromBenchmark(top1Score, benchmarks.domains[top1.key], profile.age_bracket))
    : 0;
  const top2Pct = top2Score > 0
    ? Math.round(percentileFromBenchmark(top2Score, benchmarks.domains[top2.key], profile.age_bracket))
    : 0;
  const top1Top = top1Score > 0 ? percentileToTopPercent(top1Pct) : 100;

  const bottleneckKey = ranked[ranked.length - 1];
  const bottleneckMeta = DOMAIN_MAP[bottleneckKey];
  const bottleneckScore = scores[bottleneckKey] ?? 0;
  const bottleneckBase = scores.baseline_scores?.[bottleneckKey] ?? bottleneckScore;
  const spreadPct = scoreToPercent(top1Score) - scoreToPercent(bottleneckScore);
  const growthRoomPct = Math.max(6, Math.min(55, Math.round(((Math.max(top1Score, 750) - bottleneckScore) / 1000) * 100)));
  const changePct =
    bottleneckBase > 0 ? Math.round(((bottleneckScore - bottleneckBase) / bottleneckBase) * 100) : 0;

  const bottleneckGames = GAMES_BY_DOMAIN[bottleneckKey];
  const recommendedGameMeta = [...bottleneckGames].sort((a, b) => {
    const pa = progress[a.slug];
    const pb = progress[b.slug];
    const stageDiff = (pa?.current_stage ?? 1) - (pb?.current_stage ?? 1);
    if (stageDiff !== 0) return stageDiff;
    return (pa?.total_plays ?? 0) - (pb?.total_plays ?? 0);
  })[0];

  if (!hasMeasured) {
    const p1Zero = `Este perfil começou zerado (0%) na faixa ${ageLabel}. Conclua as primeiras sessões de 30 segundos para registrar sua linha de base real em velocidade e precisão.`;
    const p2Zero = `Assim que você terminar o primeiro exercício, o NeuroLab passa a medir seu tempo de reação (ms), sua precisão média e sua evolução comparando você com você mesmo.`;
    const p3Zero = `Primeiro passo recomendado: iniciar ${recommendedGameMeta.name} (${bottleneckMeta.name}) ou concluir a avaliação de linha de base para gerar insights personalizados.`;

    return {
      archetypeTitle: def.title,
      archetypeSubtitle: def.subtitle,
      archetypeColor: def.color,
      topDomains,
      bottleneckDomain: bottleneckKey,
      recommendedGame: recommendedGameMeta.slug,
      globalPercentile: 0,
      topPercent: 100,
      populationBand: 'Em Evolução',
      paragraphs: {
        profileAndStrengths: p1Zero,
        behaviorUnderPressure: p2Zero,
        bottleneckAndPrescription: p3Zero,
      },
      clinical,
      shareSummaryText: [
        `NeuroLab — Dossiê Cognitivo`,
        `Perfil: ${def.title} (Faixa ${ageLabel})`,
        `Índice Global: 0% · Aguardando primeiras medições de 30s`,
        `Próximo passo: ${bottleneckMeta.name} → ${recommendedGameMeta.name}`,
      ].join('\n'),
    };
  }

  const declaredBottlenecks = (profile.cognitive_bottlenecks ?? [])
    .map((id) => ({ id, meta: BOTTLENECK_HUMAN_LABELS[id] }))
    .filter((x) => Boolean(x.meta));

  const ctxArray =
    profile.application_contexts?.length > 0
      ? profile.application_contexts
      : (profile.application_context || '')
          .split(' • ')
          .map((s) => s.trim())
          .filter(Boolean);
  const formattedContexts =
    ctxArray.length === 0
      ? ''
      : ctxArray.length === 1
        ? ctxArray[0].toLowerCase()
        : `${ctxArray
            .slice(0, -1)
            .map((c) => c.toLowerCase())
            .join(', ')} e ${ctxArray[ctxArray.length - 1].toLowerCase()}`;

  const stamina = profile.mental_stamina_baseline ?? 3;
  const speedBeatsPct = estimateSpeedBeatsPct(clinical.avgRtMs);

  // --- Parágrafo 1: Equilíbrio entre os 6 domínios, Pontos Fortes e Faixa Etária ---
  const balanceNote =
    spreadPct <= 8
      ? `Seus 6 domínios apresentam equilíbrio elevado (variação de apenas ${spreadPct}% entre o maior e o menor índice)`
      : `Há uma diferença de ${spreadPct}% entre seu domínio mais desenvolvido e a área prioritária`;

  const speedPhrase =
    clinical.avgRtMs > 0
      ? `com tempo de resposta superior a ${speedBeatsPct}% da faixa ${ageLabel}`
      : `com protocolo configurado para ${profile.daily_goal_minutes} minutos por dia`;

  const goalPhrase = formattedContexts
    ? ` Alinhado ao foco em ${formattedContexts}, você ${def.trait}.`
    : ` Na prática, você ${def.trait}.`;

  const p1 =
    measuredKeys.length === 1
      ? `Primeira medição registrada em ${top1.name} (${scoreToPercent(top1Score)}%), com estimativa normativa de ${top1Pct}% na faixa ${ageLabel}, ${speedPhrase}. Avalie os demais domínios para mapear seu equilíbrio completo.`
      : def.title === BALANCED_ARCHETYPE.title
        ? `No índice global (${scoreToPercent(profile.global_cognitive_index)}%), sua estimativa normativa supera ${Math.round(globalPct)}% na faixa ${ageLabel}. ${balanceNote}, com leve liderança em ${top1.name} (${scoreToPercent(top1Score)}%) e ${top2.name} (${scoreToPercent(top2Score)}%), ${speedPhrase}.${goalPhrase}`
        : `Seus maiores pontos fortes hoje são ${top1.name} (${scoreToPercent(top1Score)}%, est. Top ${top1Top}% na faixa ${ageLabel}) e ${top2.name} (${scoreToPercent(top2Score)}%, est. ${top2Pct}%), ${speedPhrase}. ${balanceNote}.${goalPhrase}`;

  // --- Parágrafo 2: Comportamento sob Pressão e Estabilidade ---
  let p2: string;
  if (sessions.length === 0) {
    const staminaText =
      stamina <= 2
        ? 'Como sua resistência à fadiga basal é inicial, o protocolo começa em cadência leve para construir constância.'
        : 'Com boa resistência à carga contínua, a dificuldade progride de forma suave ao longo de cada sessão.';
    p2 = `Conclua suas primeiras sessões para liberar a leitura de precisão e estabilidade sob pressão temporal. ${staminaText}`;
  } else {
    const accRounded = Math.round(clinical.avgAccuracyPct);
    let precisionTone: string;
    if (accRounded >= 88 && clinical.impulsivityPerSession <= 1.2) {
      precisionTone = `Sob pressão temporal, manteve precisão média de ${accRounded}% com baixo índice de erros por impulsividade`;
    } else if (accRounded < 65) {
      precisionTone = `Sua precisão média atual está em ${accRounded}%, indicando respostas apressadas — reduzir discretamente o ritmo tende a elevar rapidamente o índice final`;
    } else {
      precisionTone = `Manteve equilíbrio consistente sob pressão, registrando ${accRounded}% de precisão média`;
    }

    const wavePhrase =
      clinical.earlyClearRatePct >= 45
        ? `Concluiu integralmente a meta antes do tempo limite em ${clinical.earlyClearRatePct}% das sessões, sustentando ${clinical.consistencyIndex}% de estabilidade de foco.`
        : clinical.earlyClearRatePct > 0
          ? `Alcançou 100% da meta contínua em ${clinical.earlyClearRatePct}% das sessões, com ${clinical.consistencyIndex}% de estabilidade atencional.`
          : `Sua estabilidade de foco está em ${clinical.consistencyIndex}% — concluir a meta com precisão acima de 80% destravará os próximos níveis.`;

    p2 = `${precisionTone}. ${wavePhrase}`;
  }

  // --- Parágrafo 3: Área em Desenvolvimento & Prescrição ---
  let anamnesisLead = '';
  if (declaredBottlenecks.length > 0) {
    const matched = declaredBottlenecks.find((b) => b.meta.domains.includes(bottleneckKey));
    if (matched) {
      anamnesisLead = `Os dados confirmam o atrito relatado na anamnese (${matched.meta.short}): `;
    } else {
      const firstDeclared = declaredBottlenecks[0];
      const declaredDomName = DOMAIN_MAP[firstDeclared.meta.domains[0]].shortName;
      anamnesisLead = `Seu desempenho em ${declaredDomName} ficou acima da percepção inicial, enquanto `;
    }
  }

  const trendPhrase =
    changePct > 2
      ? `já evoluiu +${changePct}% desde a linha de base, mantendo cerca de ${growthRoomPct}% de margem adicional`
      : changePct < -2
        ? `oscilou ${changePct}% em relação à linha de base e apresenta ${growthRoomPct}% de margem de recuperação`
        : `apresenta ${growthRoomPct}% de margem de evolução em relação aos seus domínios mais fortes`;

  const p3 = `${anamnesisLead}${anamnesisLead ? 'a' : 'A'} área com maior potencial de ganho é ${bottleneckMeta.name} (${scoreToPercent(bottleneckScore)}%), que ${trendPhrase}. Priorizar ${recommendedGameMeta.name} no protocolo diário é a intervenção mais direta para elevar o equilíbrio global.`;

  const shareSummaryText = [
    `NeuroLab — Dossiê Cognitivo`,
    `Perfil: ${def.title}`,
    `Índice Global: ${scoreToPercent(profile.global_cognitive_index)}% · Faixa ${ageLabel}: Top ${topPercent}% (superou ${Math.round(globalPct)}%)`,
    `Pontos fortes: ${top1.name} (${scoreToPercent(top1Score)}%) e ${top2.name} (${scoreToPercent(top2Score)}%)`,
    sessions.length > 0
      ? `Precisão média: ${Math.round(clinical.avgAccuracyPct)}% · Estabilidade de foco: ${clinical.consistencyIndex}%`
      : `Protocolo diário: ${profile.daily_goal_minutes} min/dia`,
    `Prioridade atual: ${bottleneckMeta.name} → ${recommendedGameMeta.name}`,
  ].join('\n');

  return {
    archetypeTitle: def.title,
    archetypeSubtitle: def.subtitle,
    archetypeColor: def.color,
    topDomains,
    bottleneckDomain: bottleneckKey,
    recommendedGame: recommendedGameMeta.slug,
    globalPercentile: globalPct,
    topPercent,
    populationBand,
    paragraphs: {
      profileAndStrengths: p1,
      behaviorUnderPressure: p2,
      bottleneckAndPrescription: p3,
    },
    clinical,
    shareSummaryText,
  };
}

function toLocalDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sessionLocalDateIso(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return (iso || '').slice(0, 10);
  return toLocalDateIso(dt);
}

/**
 * Calcula a evolução semanal (Seg..Dom da semana atual + comparativo 7d vs. 7d anteriores).
 */
export function computeWeeklyEvolution(
  sessions: CognitiveSessionRecord[],
  snapshots: CognitiveSnapshotRecord[],
  globalCognitiveIndex: number
): WeeklyEvolutionSummary {
  const now = getAppNow();
  const todayStr = toLocalDateIso(now);

  // Segunda-feira da semana atual (Seg = 0 .. Dom = 6)
  const dayOfWeek = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);

  const countByDate = new Map<string, number>();
  for (const s of sessions) {
    const key = sessionLocalDateIso(s.created_at);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  }

  const WEEK_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;
  const days: WeeklyDayItem[] = WEEK_LABELS.map((shortLabel, idx) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
    const dateIso = toLocalDateIso(d);
    const sessionsCount = countByDate.get(dateIso) ?? 0;
    return {
      dateIso,
      shortLabel,
      isToday: dateIso === todayStr,
      isFuture: dateIso > todayStr,
      sessionsCount,
      trained: sessionsCount > 0,
    };
  });

  const activeDaysThisWeek = days.filter((d) => d.trained).length;

  // Janela móvel: últimos 7 dias vs 7 dias anteriores
  const startCurrent7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const startPrev7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13).getTime();

  const current7 = sessions.filter((s) => {
    const ts = new Date(s.created_at).getTime();
    return !Number.isNaN(ts) && ts >= startCurrent7;
  });
  const prev7 = sessions.filter((s) => {
    const ts = new Date(s.created_at).getTime();
    return !Number.isNaN(ts) && ts >= startPrev7 && ts < startCurrent7;
  });

  const avgAcc = (list: CognitiveSessionRecord[]) =>
    list.length
      ? Math.round(list.reduce((acc, s) => acc + Number(s.accuracy_pct || 0), 0) / list.length)
      : 0;

  const avgRt = (list: CognitiveSessionRecord[]) => {
    const valid = list.filter((s) => s.rt_mean_ms > 0);
    return valid.length
      ? Math.round(valid.reduce((acc, s) => acc + s.rt_mean_ms, 0) / valid.length)
      : 0;
  };

  const avgAccuracyThisWeek = avgAcc(current7);
  const prevAcc = avgAcc(prev7);
  const accuracyDeltaVsPrevWeek =
    current7.length > 0 && prev7.length > 0 ? avgAccuracyThisWeek - prevAcc : null;

  const avgRtThisWeek = avgRt(current7);
  const prevRt = avgRt(prev7);
  const rtDeltaVsPrevWeek =
    avgRtThisWeek > 0 && prevRt > 0 ? avgRtThisWeek - prevRt : null;

  // Ganho de índice global nos últimos 7 dias via snapshots
  const sortedSnaps = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const recentSnaps = sortedSnaps.filter((s) => {
    const ts = new Date(`${s.snapshot_date}T12:00:00`).getTime();
    return !Number.isNaN(ts) && ts >= startCurrent7;
  });
  let indexDelta7dPct: number | null = null;
  if (recentSnaps.length >= 2) {
    indexDelta7dPct =
      scoreToPercent(recentSnaps[recentSnaps.length - 1].global_index) -
      scoreToPercent(recentSnaps[0].global_index);
  } else if (sortedSnaps.length >= 1) {
    const first = sortedSnaps[0];
    indexDelta7dPct = scoreToPercent(globalCognitiveIndex) - scoreToPercent(first.global_index);
  }

  // Domínio com melhor média na semana
  let bestDomainThisWeek: DomainKey | null = null;
  if (current7.length > 0) {
    const byDom = new Map<DomainKey, { sum: number; count: number }>();
    for (const s of current7) {
      const cur = byDom.get(s.domain) ?? { sum: 0, count: 0 };
      cur.sum += s.score;
      cur.count += 1;
      byDom.set(s.domain, cur);
    }
    let bestAvg = -1;
    for (const [dom, stat] of byDom.entries()) {
      const avg = stat.sum / stat.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestDomainThisWeek = dom;
      }
    }
  }

  return {
    days,
    activeDaysThisWeek,
    sessionsThisWeek: current7.length,
    sessionsPrevWeek: prev7.length,
    sessionsDelta: current7.length - prev7.length,
    avgAccuracyThisWeek,
    accuracyDeltaVsPrevWeek,
    avgRtThisWeek,
    rtDeltaVsPrevWeek,
    indexDelta7dPct,
    bestDomainThisWeek,
  };
}

/**
 * Monta o histórico cronológico exercício-a-exercício com variação direta vs. tentativa anterior do mesmo exercício.
 */
export function buildExerciseHistory(
  sessions: CognitiveSessionRecord[],
  limit = 40
): ExerciseHistoryEntry[] {
  const now = getAppNow();
  const todayStr = toLocalDateIso(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayStr = toLocalDateIso(yesterday);

  // Ordena do mais antigo para o mais recente para calcular deltas reais exercício-a-exercício
  const chronological = [...sessions].sort((a, b) =>
    (a.created_at || '').localeCompare(b.created_at || '')
  );

  const prevBySlug = new Map<GameSlug, { indexPct: number; rtMeanMs: number }>();
  const bestBySlug = new Map<GameSlug, number>();

  const entries: ExerciseHistoryEntry[] = chronological.map((s) => {
    const indexPct = scoreToPercent(s.score);
    const prev = prevBySlug.get(s.game_slug);
    const prevBest = bestBySlug.get(s.game_slug) ?? -1;

    const deltaVsPrevPct = prev ? indexPct - prev.indexPct : null;
    const rtDeltaVsPrevMs =
      prev && prev.rtMeanMs > 0 && s.rt_mean_ms > 0 ? s.rt_mean_ms - prev.rtMeanMs : null;
    const isRecord = prev !== undefined && indexPct > prevBest;

    prevBySlug.set(s.game_slug, { indexPct, rtMeanMs: s.rt_mean_ms });
    if (indexPct > prevBest) bestBySlug.set(s.game_slug, indexPct);

    const dt = new Date(s.created_at);
    const dateIso = sessionLocalDateIso(s.created_at);
    const dayLabel =
      dateIso === todayStr
        ? 'Hoje'
        : dateIso === yesterdayStr
          ? 'Ontem'
          : Number.isNaN(dt.getTime())
            ? dateIso
            : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const timeLabel = Number.isNaN(dt.getTime())
      ? ''
      : `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

    return {
      id: s.id,
      dateIso,
      dayLabel,
      timeLabel,
      slug: s.game_slug,
      domain: s.domain,
      stagePlayed: s.stage_played,
      indexPct,
      accuracyPct: Math.round(Number(s.accuracy_pct || 0)),
      rtMeanMs: s.rt_mean_ms,
      deltaVsPrevPct,
      rtDeltaVsPrevMs,
      isRecord,
    };
  });

  return entries.reverse().slice(0, limit);
}

/**
 * Nota curta e objetiva para o rodapé do Treino Diário falando como o usuário está hoje.
 */
export function buildPersonalDailyNote(params: {
  profile: UserProfile;
  scores: DomainScoresRecord;
  sessions: CognitiveSessionRecord[];
  snapshots: CognitiveSnapshotRecord[];
  completedTodayCount: number;
  totalTodayCount: number;
}): { tag: string; text: string } {
  const { profile, scores, sessions, snapshots, completedTodayCount, totalTodayCount } = params;
  const globalPct = scoreToPercent(profile.global_cognitive_index);
  const weekly = computeWeeklyEvolution(sessions, snapshots, profile.global_cognitive_index);

  const ranked = [...DOMAIN_LIST].sort((a, b) => (scores[a.key] ?? 0) - (scores[b.key] ?? 0));
  const weakest = ranked[0];
  const strongest = ranked[ranked.length - 1];
  const weakPct = scoreToPercent(scores[weakest.key] ?? 0);
  const strongPct = scoreToPercent(scores[strongest.key] ?? 0);

  if (sessions.length === 0 && globalPct === 0) {
    return {
      tag: 'Pronto para começar',
      text: `Perfil zerado (0%). Faça seu primeiro exercício de 30s (${weakest.name}) para registrar sua linha de base real e iniciar sua evolução.`,
    };
  }

  if (sessions.length === 0) {
    return {
      tag: 'Seu estado atual',
      text: `Índice inicial em ${globalPct}%. Concluir os ${totalTodayCount} exercícios de hoje inicia sua curva semanal e reforça ${weakest.name}.`,
    };
  }

  const weekPhrase =
    weekly.indexDelta7dPct !== null && weekly.indexDelta7dPct > 0
      ? ` (+${weekly.indexDelta7dPct}% nos últimos 7 dias)`
      : weekly.activeDaysThisWeek >= 3
        ? ` com ${weekly.activeDaysThisWeek} dias ativos nesta semana`
        : '';

  if (completedTodayCount >= totalTodayCount && totalTodayCount > 0) {
    return {
      tag: 'Resumo de hoje · Meta batida',
      text: `Você fechou o protocolo em ${globalPct}%${weekPhrase}. ${strongest.name} segue em destaque (${strongPct}%) e ${weakest.name} (${weakPct}%) já ganhou estímulo direto hoje.`,
    };
  }

  const accNote =
    weekly.avgAccuracyThisWeek > 0
      ? ` Precisão semanal de ${weekly.avgAccuracyThisWeek}%.`
      : '';

  return {
    tag: 'Como você está hoje',
    text: `Equilíbrio geral em ${globalPct}%${weekPhrase}, liderado por ${strongest.name} (${strongPct}%). Focar em ${weakest.name} (${weakPct}%) hoje é o atalho para elevar sua média.${accNote}`,
  };
}

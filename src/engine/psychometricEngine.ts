import type {
  AdaptiveStatus,
  AgeBracket,
  CognitiveTier,
  ComputedSessionResult,
  DailyProtocolRecord,
  DomainKey,
  DomainScoresRecord,
  GameSlug,
  RawGamePerformance,
  SessionMode,
  StageConfig,
  TrainingFocusMode,
  WaveState,
} from '../types/cognitive';
import { DOMAIN_LIST, GAMES_BY_DOMAIN } from './gameRegistry';
import { TOTAL_WAVE_HITS } from './waveEngine';

export const AGE_BRACKET_OPTIONS: { id: AgeBracket; label: string; meanOffset: number }[] = [
  { id: '18-24', label: '18–24 anos', meanOffset: 14 },
  { id: '25-34', label: '25–34 anos', meanOffset: 0 },
  { id: '35-44', label: '35–44 anos', meanOffset: -10 },
  { id: '45-54', label: '45–54 anos', meanOffset: -20 },
  { id: '55+', label: '55+ anos', meanOffset: -32 },
];

export function getAgeBracketMeta(bracket?: AgeBracket | string | null) {
  return AGE_BRACKET_OPTIONS.find((a) => a.id === bracket) ?? AGE_BRACKET_OPTIONS[1];
}

/** Converte escala interna (0..1000) em porcentagem limpa (0..100%) */
export function scoreToPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score / 10)));
}

/** As 7 faixas de classificação cognitiva (0 a 1000 pontos) */
export const COGNITIVE_TIERS: CognitiveTier[] = [
  {
    tierIndex: 1,
    title: 'Linha Inicial',
    subtitle: 'Fase inicial de adaptação cognitiva',
    minScore: 0,
    accentColor: '#94a3b8',
  },
  {
    tierIndex: 2,
    title: 'Observador',
    subtitle: 'Consolidando ritmo e precisão',
    minScore: 300,
    accentColor: '#60a5fa',
  },
  {
    tierIndex: 3,
    title: 'Analista',
    subtitle: 'Na média normativa da faixa etária',
    minScore: 460,
    accentColor: '#38bdf8',
  },
  {
    tierIndex: 4,
    title: 'Estrategista',
    subtitle: 'Acima da média com controle estável',
    minScore: 600,
    accentColor: '#10b981',
  },
  {
    tierIndex: 5,
    title: 'Tático',
    subtitle: 'Alta precisão e agilidade consistente',
    minScore: 720,
    accentColor: '#818cf8',
  },
  {
    tierIndex: 6,
    title: 'Referência Cognitiva',
    subtitle: 'Entre os 10% melhores da faixa etária',
    minScore: 830,
    accentColor: '#a78bfa',
  },
  {
    tierIndex: 7,
    title: 'Ápice Neural',
    subtitle: 'Desempenho de elite com precisão exemplar',
    minScore: 930,
    accentColor: '#f59e0b',
  },
];

export function getCognitiveTier(score: number): CognitiveTier {
  for (let i = COGNITIVE_TIERS.length - 1; i >= 0; i--) {
    if (score >= COGNITIVE_TIERS[i].minScore) return COGNITIVE_TIERS[i];
  }
  return COGNITIVE_TIERS[0];
}

/**
 * Distribuição Normal Acumulada (CDF) — Abramowitz & Stegun (erro < 1.5e-7)
 * Recalibrada: média μ = 500 (50%), σ = 235 (<200 -> <10%, 750 -> ~85%, 900+ -> Top 5%).
 */
export function normalCDF(x: number, mean = 500, sd = 235): number {
  const safeSd = Math.max(50, sd);
  const z = (x - mean) / (safeSd * Math.SQRT2);
  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.3275911 * absZ);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const erf = 1 - poly * Math.exp(-absZ * absZ);
  return 0.5 * (1 + sign * erf);
}

/**
 * Converte Score (0..1000) em Percentil realista (1.0% a 99.9%) com regra Anti-Chute.
 */
export function scoreToPercentile(
  score: number,
  baseStage = 0,
  accuracyPct = 100,
  correctCount = 1,
  ageBracket?: AgeBracket | string | null
): number {
  if (correctCount <= 0 || score <= 0) return 1.0;
  if (accuracyPct < 50) {
    const capped = 1.0 + (Math.max(0, accuracyPct) / 50) * 4.0;
    return Number(Math.max(1.0, Math.min(5.0, capped)).toFixed(1));
  }

  const ageOffset = getAgeBracketMeta(ageBracket).meanOffset;
  const mean = 500 + ageOffset;
  let rawPct = normalCDF(score, mean, 235) * 100;

  const stageCap =
    baseStage <= 0 ? 89.5 : baseStage === 1 ? 92.5 : baseStage === 2 ? 95.0 : baseStage <= 4 ? 97.5 : 99.9;
  rawPct = Math.min(rawPct, stageCap);

  const clamped = Math.max(1.0, Math.min(99.9, rawPct));
  return Number(clamped.toFixed(1));
}

/** Tempo-alvo de referência (ms) por exercício e nível base */
export function getTargetRtMs(slug: GameSlug, baseStage: number): number {
  const baseByGame: Record<GameSlug, number> = {
    'go-nogo-reflex': 620,
    'speed-match': 780,
    'stroop-conflict': 960,
    'symbol-digit': 1150,
    'visual-search': 1250,
    'dual-n-back': 1250,
    'number-comparison': 1420,
    'spatial-span': 1350,
    'sustained-tracking': 1450,
    'path-logic': 1380,
    'chain-arithmetic': 1750,
    'raven-matrices': 2750,
  };
  const base = baseByGame[slug] ?? 1200;
  const safeStage = Math.max(0, baseStage);
  return Math.max(440, Math.round(base * (1 - Math.min(0.24, safeStage * 0.025))));
}

export function computeReactionStats(times: number[]): { mean: number; sd: number } {
  const valid = times.filter((t) => Number.isFinite(t) && t > 60 && t < 20000);
  if (valid.length === 0) return { mean: 0, sd: 0 };
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((acc, v) => acc + (v - mean) ** 2, 0) / valid.length;
  return {
    mean: Math.round(mean),
    sd: Math.round(Math.sqrt(variance)),
  };
}

/**
 * Motor Psicométrico Anti-Chute (0 a 1000) — 60% Assertividade / 40% Tempo Condicional.
 */
export function evaluateSession(params: {
  domain: DomainKey;
  gameSlug: GameSlug;
  mode: SessionMode;
  baseStage: number;
  config: StageConfig;
  wave: WaveState;
  timeRemainingMs: number;
  totalDurationMs: number;
  perf: RawGamePerformance;
  weakestTwoDomains: DomainKey[];
  ageBracket?: AgeBracket | string | null;
}): ComputedSessionResult {
  const {
    domain,
    gameSlug,
    mode,
    baseStage,
    wave,
    timeRemainingMs,
    totalDurationMs,
    perf,
    weakestTwoDomains,
    ageBracket,
  } = params;

  const safeBaseStage = Math.max(0, Math.floor(baseStage));
  const totalAttempts = perf.correct + perf.commissionErrors + perf.omissionErrors;
  const accuracyPct =
    totalAttempts > 0 ? Number(((perf.correct / totalAttempts) * 100).toFixed(1)) : 0;

  const { mean: rtMeanMs, sd: rtSdMs } = computeReactionStats(perf.reactionTimesMs);
  const completedEarly = wave.isCleared && timeRemainingMs > 0;
  const safeRemainingMs = completedEarly ? Math.max(0, Math.round(timeRemainingMs)) : 0;
  const waveReached = wave.currentWave;
  const wavesCompleted = wave.wavesCompleted;

  const failedAccuracyGate = perf.correct <= 0 || accuracyPct < 50;

  // 1. Assertividade (60% — máx. 600 pts) ponderada pelo avanço nas 5 ondas
  const netAccuracyRatio =
    totalAttempts > 0
      ? Math.max(0, (perf.correct - perf.commissionErrors * 0.35) / totalAttempts)
      : 0;
  const waveProgressRatio = Math.min(1, wave.totalHits / TOTAL_WAVE_HITS);
  const waveWeight = 0.25 + 0.75 * waveProgressRatio;

  const accuracyPoints =
    perf.correct <= 0
      ? 0
      : failedAccuracyGate
        ? Math.min(190, Math.round(netAccuracyRatio * 380 * waveWeight))
        : Math.min(600, Math.round(netAccuracyRatio * 600 * waveWeight));

  // 2. Velocidade & Conclusão Antecipada (40% — máx. 400 pts) com Gate Condicional
  let speedPoints = 0;
  let earlyBonusPoints = 0;

  if (!failedAccuracyGate) {
    const targetRt = getTargetRtMs(gameSlug, safeBaseStage);
    let rtRatio = 0.55;
    if (rtMeanMs > 0) {
      const fastBound = targetRt * 0.58;
      const slowBound = targetRt * 2.5;
      const norm = (slowBound - rtMeanMs) / (slowBound - fastBound);
      rtRatio = Math.max(0.1, Math.min(1, 0.1 + norm * 0.9));
    }
    const rawRtPoints = Math.round(rtRatio * 290 * (0.35 + 0.65 * waveProgressRatio));

    const savedTimeRatio =
      completedEarly && totalDurationMs > 0
        ? Math.min(1, safeRemainingMs / totalDurationMs)
        : 0;
    const rawEarlyBonus = completedEarly
      ? Math.max(25, Math.round(40 + savedTimeRatio * 70))
      : 0;

    const rawSpeedTotal = Math.min(400, rawRtPoints + rawEarlyBonus);

    const accFactor = accuracyPct >= 100 ? 1 : Math.pow(accuracyPct / 100, 2);
    speedPoints = Math.min(400, Math.round(rawSpeedTotal * accFactor));
    earlyBonusPoints = Math.round(rawEarlyBonus * accFactor);
  }

  const speedScore = Math.round((speedPoints / 400) * 100);

  // 3. Pontuação Final (0 a 1000) com teto suave no Nível Zero
  const stageScale = Math.min(1.0, 0.86 + safeBaseStage * 0.03);
  const rawCombined = accuracyPoints + speedPoints;
  const finalScore =
    perf.correct <= 0
      ? 0
      : Math.max(0, Math.min(1000, Math.round(rawCombined * (failedAccuracyGate ? 1 : stageScale))));

  const performanceIndex = scoreToPercent(finalScore);
  const percentile = scoreToPercentile(finalScore, safeBaseStage, accuracyPct, perf.correct, ageBracket);
  const tier = getCognitiveTier(finalScore);

  // 4. Regra de Evolução Permanente do estágio base (piso 0)
  let adaptiveDelta = 0;
  let adaptiveStatus: AdaptiveStatus = 'hold';
  let stageCleared = false;

  if (wavesCompleted === 5 && accuracyPct >= 80) {
    stageCleared = true;
    if (accuracyPct === 100 && completedEarly && safeBaseStage >= 1 && finalScore >= 860) {
      adaptiveDelta = 2;
      adaptiveStatus = 'fast_track';
    } else {
      adaptiveDelta = 1;
      adaptiveStatus = 'level_up';
    }
  } else if (failedAccuracyGate) {
    stageCleared = false;
    if (safeBaseStage > 0) {
      adaptiveDelta = -1;
      adaptiveStatus = 'step_down';
    } else {
      adaptiveDelta = 0;
      adaptiveStatus = 'ease_mode';
    }
  } else {
    adaptiveDelta = 0;
    adaptiveStatus = 'hold';
    stageCleared = false;
  }

  const nextStage = Math.max(0, safeBaseStage + adaptiveDelta);
  const isPriorityDomain = weakestTwoDomains.includes(domain);

  // Evolução do domínio (escala 120..999)
  const domainDelta =
    perf.correct <= 0
      ? -18
      : failedAccuracyGate
        ? -14
        : stageCleared
          ? Math.min(28, 12 + Math.round(Math.max(0, finalScore - 500) / 28))
          : 4;

  return {
    domain,
    gameSlug,
    mode,
    stagePlayed: safeBaseStage,
    stageCleared,
    nextStage,
    adaptiveDelta,
    adaptiveStatus,
    score: finalScore,
    accuracyPct,
    accuracyPoints,
    speedPoints,
    earlyBonusPoints,
    speedScore,
    performanceIndex,
    percentile,
    earnedTitle: tier.title,
    earnedSubtitle: tier.subtitle,
    tierAccent: tier.accentColor,
    wavesCompleted,
    waveReached,
    completedEarly,
    timeRemainingMs: safeRemainingMs,
    commissionErrors: perf.commissionErrors,
    omissionErrors: perf.omissionErrors,
    rtMeanMs,
    rtSdMs,
    isPriorityDomain,
    domainDelta,
  };
}

export function calculateGlobalCognitiveIndex(scores: DomainScoresRecord): number {
  const sum = DOMAIN_LIST.reduce((acc, d) => acc + (scores[d.key] ?? 500), 0);
  return Math.round(sum / DOMAIN_LIST.length);
}

export function getWeakestDomains(scores: DomainScoresRecord, count = 2): DomainKey[] {
  return [...DOMAIN_LIST]
    .sort((a, b) => (scores[a.key] ?? 500) - (scores[b.key] ?? 500))
    .slice(0, count)
    .map((d) => d.key);
}

export function getCalibrationDomains(selectedDomains?: DomainKey[]): DomainKey[] {
  const valid = Array.from(
    new Set((selectedDomains ?? []).filter((d) => DOMAIN_LIST.some((m) => m.key === d)))
  );
  if (valid.length === 0) return DOMAIN_LIST.map((d) => d.key);
  if (valid.length === 1) {
    const complement: DomainKey =
      valid[0] === 'processing_speed' ? 'selective_attention' : 'processing_speed';
    return [...valid, complement];
  }
  return valid.slice(0, 6);
}

export function getDailyGamesCount(dailyGoalMinutes?: number): number {
  const mins = dailyGoalMinutes ?? 10;
  if (mins <= 5) return 2;
  if (mins <= 10) return 3;
  if (mins <= 15) return 4;
  return 5;
}

/**
 * Motivo técnico curto exibido no card da Sessão Guiada do Dia.
 */
export function getProtocolReason(
  role: 'weak' | 'priority' | 'maintenance',
  indexInQueue: number,
  domainScore: number
): string {
  if (role === 'maintenance') {
    return 'Manutenção: consolidação de domínio já elevado';
  }
  if (indexInQueue === 0) {
    return 'Prioridade: área com maior margem de evolução';
  }
  if (indexInQueue === 1) {
    return 'Prioridade: segundo menor percentual atual';
  }
  if (domainScore < 500) {
    return 'Treino de déficit: fortalecimento abaixo da mediana';
  }
  return 'Equilíbrio adaptativo: estímulo de simetria cognitiva';
}

interface NeuroInsight {
  tag: string;
  text: string;
}

const PAIR_INSIGHTS: Record<string, NeuroInsight> = {
  'inhibitory_control+selective_attention': {
    tag: 'Neuroplasticidade · Pré-Frontal',
    text: 'A alternância entre atenção seletiva e controle inibitório fortalece o córtex pré-frontal dorsolateral.',
  },
  'fluid_reasoning+working_memory': {
    tag: 'Rede Frontoparietal',
    text: 'Sustentar regras ativas na memória de trabalho amplia a capacidade de inferência lógica sob alta carga cognitiva.',
  },
  'processing_speed+selective_attention': {
    tag: 'Eficiência Visuoespacial',
    text: 'Discriminar alvos rapidamente entre distratores reduz a latência de triagem na rede atencional dorsal.',
  },
  'numerical_cognition+working_memory': {
    tag: 'Sulco Intraparietal',
    text: 'O cálculo mental encadeado recruta o sulco intraparietal junto ao executivo central, fortalecendo a retenção ativa.',
  },
  'inhibitory_control+processing_speed': {
    tag: 'Controle Executivo',
    text: 'Decidir com restrição de tempo diante de conflito calibra o giro frontal inferior direito, responsável pelo freio motor.',
  },
  'fluid_reasoning+inhibitory_control': {
    tag: 'Flexibilidade Cognitiva',
    text: 'Inibir respostas intuitivas incorretas libera recursos analíticos para detectar padrões estruturais inéditos.',
  },
  'numerical_cognition+processing_speed': {
    tag: 'Fluidez Quantitativa',
    text: 'Alternar estimativa de magnitude e ritmo rápido automatiza rotas numéricas e reduz o esforço mental em decisões cotidianas.',
  },
  'selective_attention+working_memory': {
    tag: 'Estabilidade de Foco',
    text: 'Filtrar estímulos irrelevantes protege a capacidade limitada da memória de trabalho contra interferência externa.',
  },
};

const SINGLE_DOMAIN_INSIGHTS: Record<DomainKey, NeuroInsight> = {
  selective_attention: {
    tag: 'Atenção Seletiva',
    text: 'Sessões curtas e frequentes de busca visual aumentam o ganho sinal-ruído na rede atencional frontoparietal.',
  },
  working_memory: {
    tag: 'Memória de Trabalho',
    text: 'Atualizar sequências sob carga progressiva estimula a plasticidade funcional no córtex pré-frontal e parietal posterior.',
  },
  fluid_reasoning: {
    tag: 'Raciocínio Fluido',
    text: 'Resolver relações abstratas inéditas exercita a integração de múltiplas variáveis sem depender de memória cristalizada.',
  },
  processing_speed: {
    tag: 'Velocidade de Processamento',
    text: 'Treinos de discriminação rápida com alta precisão promovem consolidação da velocidade de condução em circuitos decisórios.',
  },
  numerical_cognition: {
    tag: 'Cálculo Mental',
    text: 'Manipular magnitudes e operações encadeadas sem apoio externo fortalece o eixo parietal-frontal de cognição numérica.',
  },
  inhibitory_control: {
    tag: 'Controle Inibitório',
    text: 'Suprimir respostas automáticas em tarefas de conflito reforça a modulação top-down do córtex cingulado anterior.',
  },
};

/**
 * Seleciona uma nota curta e embasada de neurociência alinhada aos domínios do treino do dia.
 */
export function getDailyNeuroInsight(domains: DomainKey[], dateStr: string): NeuroInsight {
  const unique = Array.from(new Set(domains));
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const key = [unique[i], unique[j]].sort().join('+');
      if (PAIR_INSIGHTS[key]) return PAIR_INSIGHTS[key];
    }
  }
  const daySeed = Number(dateStr.replace(/-/g, '')) || 1;
  const fallbackDomain = unique[daySeed % Math.max(1, unique.length)] ?? 'selective_attention';
  return SINGLE_DOMAIN_INSIGHTS[fallbackDomain];
}

/**
 * Gera a fila diária priorizando automaticamente os domínios com menor percentual atual (treino de déficit).
 */
export function buildTrainingQueue(
  scores: DomainScoresRecord,
  dateStr: string,
  focusMode: TrainingFocusMode,
  selectedDomains?: DomainKey[],
  dailyGoalMinutes = 10
): DailyProtocolRecord['recommended_games'] {
  const totalGames = getDailyGamesCount(dailyGoalMinutes);
  const daySeed = Number(dateStr.replace(/-/g, '')) || 1;

  const pickGame = (domain: DomainKey, offset: number): GameSlug => {
    const games = GAMES_BY_DOMAIN[domain];
    return games[(daySeed + offset) % games.length].slug;
  };

  if (focusMode === 'goals') {
    const chosen = selectedDomains?.length ? selectedDomains : DOMAIN_LIST.map((d) => d.key);
    const orderedGoals = [...chosen].sort((a, b) => (scores[a] ?? 500) - (scores[b] ?? 500));
    const result: DailyProtocolRecord['recommended_games'] = [];
    const usedSlugs = new Set<GameSlug>();

    for (let i = 0; i < totalGames; i++) {
      const dom = orderedGoals[i % orderedGoals.length];
      let slug = pickGame(dom, i);
      if (usedSlugs.has(slug)) {
        const alt = GAMES_BY_DOMAIN[dom].find((g) => !usedSlugs.has(g.slug));
        if (alt) slug = alt.slug;
      }
      usedSlugs.add(slug);
      result.push({ slug, domain: dom, role: 'priority' });
    }
    return result;
  }

  const rankedWeak = [...DOMAIN_LIST].sort((a, b) => (scores[a.key] ?? 500) - (scores[b.key] ?? 500));
  const hasMaintenance = totalGames >= 3;
  const focusCount = hasMaintenance ? totalGames - 1 : totalGames;

  const gamesList: DailyProtocolRecord['recommended_games'] = rankedWeak.slice(0, focusCount).map((d, idx) => ({
    slug: pickGame(d.key, idx),
    domain: d.key,
    role: 'weak',
  }));

  if (hasMaintenance) {
    const strongest = rankedWeak[rankedWeak.length - 1];
    gamesList.push({
      slug: pickGame(strongest.key, 1),
      domain: strongest.key,
      role: 'maintenance',
    });
  }

  return gamesList;
}

export function generateDailyProtocol(
  scores: DomainScoresRecord,
  dateStr: string,
  selectedDomains?: DomainKey[],
  dailyGoalMinutes = 10
): DailyProtocolRecord {
  return {
    protocol_date: dateStr,
    recommended_games: buildTrainingQueue(scores, dateStr, 'weak', selectedDomains, dailyGoalMinutes),
    completed_games: [],
  };
}

import type {
  AdaptiveStatus,
  AgeBracket,
  CognitiveTier,
  ComputedSessionResult,
  DailyProtocolRecord,
  DomainKey,
  DomainScoresRecord,
  GameProgressRecord,
  GameSlug,
  RawGamePerformance,
  SessionMode,
  StageConfig,
  TrainingFocusMode,
  WaveState,
} from '../types/cognitive';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_REGISTRY, GAMES_BY_DOMAIN } from './gameRegistry';
import { TOTAL_WAVE_HITS } from './waveEngine';

/**
 * Faixas etárias calibradas com fatores de velocidade da literatura psicométrica
 * (Deary & Der 2005; Salthouse 2009; Tombaugh 2004):
 * - rtFactor ajusta o tempo de reação esperado à idade (evita penalizar faixas 35+/55+)
 * - meanOffset ajusta a mediana normativa da curva daquela década de vida
 */
export const AGE_BRACKET_OPTIONS: {
  id: AgeBracket;
  label: string;
  meanOffset: number;
  rtFactor: number;
}[] = [
  { id: '18-24', label: '18–24 anos', meanOffset: 16, rtFactor: 0.94 },
  { id: '25-34', label: '25–34 anos', meanOffset: 0, rtFactor: 1.0 },
  { id: '35-44', label: '35–44 anos', meanOffset: -12, rtFactor: 1.07 },
  { id: '45-54', label: '45–54 anos', meanOffset: -24, rtFactor: 1.15 },
  { id: '55+', label: '55+ anos', meanOffset: -38, rtFactor: 1.25 },
];

export function getAgeBracketMeta(bracket?: AgeBracket | string | null) {
  return AGE_BRACKET_OPTIONS.find((a) => a.id === bracket) ?? AGE_BRACKET_OPTIONS[1];
}

/** Converte escala interna (0..1000) em porcentagem limpa (0..100%) */
export function scoreToPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score / 10)));
}

/**
 * Teto progressivo de pontuação por nível (0..1000) distribuído em 20 níveis:
 * - Nível 1 (ultrabásico): teto 600 (60%), diferenciando pela velocidade.
 * - Sobe ~20 pontos por nível até 1000 (100%) no Nível 20.
 */
export function getStageScoreCeiling(level: number): number {
  const safe = Math.max(1, Math.min(20, Math.floor(level)));
  return Math.min(1000, Math.round(600 + ((safe - 1) / 19) * 400));
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
    accentColor: '#6366f1',
  },
  {
    tierIndex: 6,
    title: 'Referência Cognitiva',
    subtitle: 'Entre os 10% melhores da faixa etária',
    minScore: 830,
    accentColor: '#8b5cf6',
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
 * Percentil específico daquele exercício naquele nível e faixa etária:
 * - Calibrado com logs reais: ir lento (~2x alvo) fica em ~35–55%, ritmo médio (~1x alvo) em ~55–68%,
 *   rápido (~0.65x) em ~85–92%, e extremo (~0.5x) em ~95–99%.
 */
export function scoreToPercentile(
  levelScore: number,
  baseStage = 1,
  accuracyPct = 100,
  correctCount = 1,
  ageBracket?: AgeBracket | string | null
): number {
  if (correctCount <= 0 || levelScore <= 0) return 1.0;
  if (accuracyPct < 50) {
    const capped = 1.0 + (Math.max(0, accuracyPct) / 50) * 4.0;
    return Number(Math.max(1.0, Math.min(5.0, capped)).toFixed(1));
  }

  const ageOffset = getAgeBracketMeta(ageBracket).meanOffset;
  const levelBaseMean = baseStage <= 1 ? 690 : baseStage <= 5 ? 660 : 635;
  const mean = levelBaseMean + Math.round(ageOffset * 0.4);
  const sd = 145;

  const rawPct = normalCDF(levelScore, mean, sd) * 100;
  const clamped = Math.max(1.0, Math.min(99.5, rawPct));
  return Number(clamped.toFixed(1));
}

/** Tempo-alvo de referência (ms) calibrado por exercício, nível e faixa etária (literatura psicométrica) */
export function getTargetRtMs(
  slug: GameSlug,
  baseStage: number,
  ageBracket?: AgeBracket | string | null
): number {
  const baseByGame: Record<GameSlug, number> = {
    'go-nogo-reflex': 430,
    'schulte-order': 650,
    'flanker-focus': 720,
    'spatial-span': 750,
    'speed-match': 850,
    'memory-pairs': 900,
    'sustained-tracking': 900,
    'path-logic': 950,
    'stroop-conflict': 1050,
    'photo-recall': 1100,
    'odd-one-out': 1150,
    'visual-search': 1150,
    'opposite-arrow': 1150,
    'rule-switch': 1350,
    'number-comparison': 1350,
    'symbol-digit': 1400,
    'flash-match': 1450,
    'logic-intruder': 1450,
    'dual-n-back': 1550,
    'missing-operator': 1650,
    'chain-arithmetic': 1850,
    'number-sequence': 2100,
    'target-sum': 2200,
    'raven-matrices': 2400,
    'conjunction-search': 1250,
    'reverse-digits': 2100,
    'logic-balance': 2300,
    'quick-pair': 1400,
    'quick-estimate': 1550,
    'inverted-signal': 1050,
    'pass-the-ball': 780,
    'hidden-gold': 850,
    'shopping-list': 1100,
    'match-pairs': 950,
    'phone-number': 2200,
    'secret-code': 900,
    'strange-signals': 780,
    'ancient-numbers': 720,
    'crime-scene': 1650,
    'treasure-hunt': 1350,
    'identical-items': 1350,
    'missing-number': 1550,
    'fan-count': 1750,
    'secret-anagrams': 2100,
    'fish-out-of-water': 1250,
    'sort-trash': 980,
    'complex-patterns': 1750,
  };
  const base = baseByGame[slug] ?? 1200;
  const d = Math.max(0, baseStage - 1);
  const ageFactor = getAgeBracketMeta(ageBracket).rtFactor;
  return Math.max(440, Math.round(base * ageFactor * (1 - Math.min(0.24, d * 0.022))));
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
 * Motor Psicométrico em Curva de Flow (Nível 1+):
 * - No Nível 1 (ultrabásico), gabaritar é natural e a VELOCIDADE diferencia a pontuação (teto 70%).
 * - Cada nível seguinte aumenta a dificuldade suavemente e libera tetos maiores até 100%.
 * - Regra Anti-Chute mantida: assertividade < 50% bloqueia bônus de velocidade.
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

  const safeBaseStage = Math.max(1, Math.floor(baseStage));
  const totalAttempts = perf.correct + perf.commissionErrors + perf.omissionErrors;
  const accuracyPct =
    totalAttempts > 0 ? Number(((perf.correct / totalAttempts) * 100).toFixed(1)) : 0;

  const { mean: rtMeanMs, sd: rtSdMs } = computeReactionStats(perf.reactionTimesMs);
  const completedEarly = wave.isCleared && timeRemainingMs > 0;
  const safeRemainingMs = completedEarly ? Math.max(0, Math.round(timeRemainingMs)) : 0;
  const waveReached = wave.currentWave;
  const wavesCompleted = wave.wavesCompleted;

  const failedAccuracyGate = perf.correct <= 0 || accuracyPct < 50;

  // No Nível 1 ultrabásico, velocidade tem peso maior (55%) porque quase todos gabaritam.
  // Nos níveis mais altos, volta ao equilíbrio 60% precisão / 40% velocidade.
  const isBasicLevel = safeBaseStage === 1;
  const maxAccPts = isBasicLevel ? 450 : 600;
  const maxSpdPts = isBasicLevel ? 550 : 400;

  const targetHits = Math.max(1, wave.totalTargetHits || TOTAL_WAVE_HITS);
  const netAccuracyRatio =
    totalAttempts > 0
      ? Math.max(0, (perf.correct - perf.commissionErrors * 0.35) / totalAttempts)
      : 0;
  const progressRatio = Math.min(1, wave.totalHits / targetHits);
  const progressWeight = 0.28 + 0.72 * progressRatio;

  const accuracyPoints =
    perf.correct <= 0
      ? 0
      : failedAccuracyGate
        ? Math.min(190, Math.round(netAccuracyRatio * 360 * progressWeight))
        : Math.min(maxAccPts, Math.round(netAccuracyRatio * maxAccPts * progressWeight));

  const targetRt = getTargetRtMs(gameSlug, safeBaseStage, ageBracket);
  let speedPoints = 0;
  let earlyBonusPoints = 0;

  if (!failedAccuracyGate) {
    let rtRatio = 0.45;
    if (rtMeanMs > 0) {
      // Curva sensível à velocidade real:
      // - 0.50x do alvo -> 1.00 (extremo)
      // - 1.00x do alvo -> ~0.50 (ritmo médio)
      // - >= 1.95x do alvo -> 0.04 (muito lento)
      const fastBound = targetRt * 0.5;
      const slowBound = targetRt * 1.95;
      const norm = (slowBound - rtMeanMs) / (slowBound - fastBound);
      const clampedNorm = Math.max(0, Math.min(1, norm));
      rtRatio = 0.04 + Math.pow(clampedNorm, 1.35) * 0.96;
    }

    const rtShare = Math.round(maxSpdPts * 0.78);
    const earlyShare = maxSpdPts - rtShare;

    const rawRtPoints = Math.round(rtRatio * rtShare * (0.35 + 0.65 * progressRatio));
    const savedTimeRatio =
      completedEarly && totalDurationMs > 0
        ? Math.min(1, safeRemainingMs / totalDurationMs)
        : 0;
    // Bônus de tempo economizado ponderado pelo ritmo real (evita inflar nota quando o RT foi lento)
    const rawEarlyBonus = completedEarly
      ? Math.round(earlyShare * savedTimeRatio * (0.25 + 0.75 * rtRatio))
      : 0;

    const rawSpeedTotal = Math.min(maxSpdPts, rawRtPoints + rawEarlyBonus);
    const accFactor = accuracyPct >= 95 ? 1 : Math.pow(accuracyPct / 100, 1.8);
    speedPoints = Math.min(maxSpdPts, Math.round(rawSpeedTotal * accFactor));
    earlyBonusPoints = Math.round(rawEarlyBonus * accFactor);
  }

  const speedScore = Math.round((speedPoints / maxSpdPts) * 100);

  // Aplica o teto progressivo por nível no score global (Nível 1 = até 70% ... Nível 8+ = até 100%),
  // mas calcula o percentil específico DO NÍVEL usando o desempenho bruto (rawCombined 0..1000)!
  const levelCeiling = getStageScoreCeiling(safeBaseStage);
  const rawCombined = Math.min(1000, accuracyPoints + speedPoints);
  const finalScore =
    perf.correct <= 0
      ? 0
      : failedAccuracyGate
        ? Math.min(240, rawCombined)
        : Math.max(0, Math.min(levelCeiling, Math.round((rawCombined / 1000) * levelCeiling)));

  const performanceIndex = scoreToPercent(finalScore);
  const percentile = scoreToPercentile(rawCombined, safeBaseStage, accuracyPct, perf.correct, ageBracket);
  const tier = getCognitiveTier(finalScore);

  // Evolução de nível suave e motivadora (piso = Nível 1, sobe com facilidade para dar sensação de progresso)
  let adaptiveDelta = 0;
  let adaptiveStatus: AdaptiveStatus = 'hold';
  let stageCleared = false;

  const passedBasicComfort =
    safeBaseStage <= 2 && wave.totalHits >= Math.ceil(targetHits * 0.75) && accuracyPct >= 80;
  const passedFull = (wavesCompleted === 5 || wave.isCleared) && accuracyPct >= 80;

  if (passedFull || passedBasicComfort) {
    stageCleared = true;
    if (accuracyPct === 100 && completedEarly && safeBaseStage >= 2 && speedScore >= 85) {
      adaptiveDelta = 2;
      adaptiveStatus = 'fast_track';
    } else {
      adaptiveDelta = 1;
      adaptiveStatus = 'level_up';
    }
  } else if (failedAccuracyGate) {
    stageCleared = false;
    if (safeBaseStage > 1) {
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

  const nextStage = Math.max(1, Math.min(20, safeBaseStage + adaptiveDelta));
  const isPriorityDomain = weakestTwoDomains.includes(domain);

  // Evolução motivadora do domínio (cresce visivelmente quando o usuário avança de nível)
  const domainDelta =
    perf.correct <= 0
      ? -12
      : failedAccuracyGate
        ? -10
        : stageCleared
          ? Math.min(28, 14 + Math.round(Math.max(0, finalScore - 420) / 30))
          : 5;

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
    rawLevelScore: rawCombined,
    targetRtMs: targetRt,
    hits: wave.totalHits,
    targetHits,
  };
}

export function calculateGlobalCognitiveIndex(scores: DomainScoresRecord): number {
  const measured = DOMAIN_LIST.map((d) => scores[d.key] ?? 0).filter((v) => v > 0);
  if (measured.length === 0) return 0;
  const sum = measured.reduce((acc, v) => acc + v, 0);
  return Math.round(sum / measured.length);
}

export function getWeakestDomains(scores: DomainScoresRecord, count = 2): DomainKey[] {
  return [...DOMAIN_LIST]
    .sort((a, b) => (scores[a.key] ?? 0) - (scores[b.key] ?? 0))
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

export function getProtocolReason(
  role: 'weak' | 'priority' | 'maintenance',
  indexInQueue: number,
  domainScore: number
): string {
  if (domainScore <= 0) {
    return 'Linha de base: primeira medição neste domínio (30s)';
  }
  if (role === 'maintenance') {
    return 'Manutenção: manter forte o que você já manda bem';
  }
  if (indexInQueue === 0) {
    return 'Foco principal: área onde você pode evoluir mais rápido';
  }
  if (indexInQueue === 1) {
    return 'Segundo foco: reforço para equilibrar sua mente';
  }
  if (domainScore < 500) {
    return 'Reforço: ajuda a subir essa habilidade hoje';
  }
  return 'Equilíbrio: mantém todas as habilidades no mesmo nível';
}

interface NeuroInsight {
  tag: string;
  text: string;
}

const PAIR_INSIGHTS: Record<string, NeuroInsight> = {
  'inhibitory_control+selective_attention': {
    tag: 'Foco & Autocontrole',
    text: 'Treinar foco junto com autocontrole ajuda você a ignorar distrações e evitar decisões por impulso no dia a dia.',
  },
  'fluid_reasoning+working_memory': {
    tag: 'Memória & Lógica',
    text: 'Guardar informações na cabeça enquanto resolve problemas deixa seu raciocínio mais rápido sob pressão.',
  },
  'processing_speed+selective_attention': {
    tag: 'Olho Rápido',
    text: 'Encontrar detalhes importantes no meio da bagunça treina seu cérebro a reagir mais rápido sem perder o foco.',
  },
  'numerical_cognition+working_memory': {
    tag: 'Contas na Cabeça',
    text: 'Fazer contas mentais exercita sua memória de curto prazo e deixa decisões com números bem mais fáceis.',
  },
  'inhibitory_control+processing_speed': {
    tag: 'Freio Mental',
    text: 'Decidir rápido sem cair em pegadinhas treina seu cérebro a pensar antes de agir mesmo na correria.',
  },
  'fluid_reasoning+inhibitory_control': {
    tag: 'Mente Flexível',
    text: 'Segurar a primeira resposta automática abre espaço para enxergar soluções mais inteligentes.',
  },
  'numerical_cognition+processing_speed': {
    tag: 'Agilidade com Números',
    text: 'Treinar cálculos curtos deixa seu cérebro mais ágil para comparar preços, prazos e contas do dia a dia.',
  },
  'selective_attention+working_memory': {
    tag: 'Foco Protegido',
    text: 'Filtrar o que não importa evita que você esqueça o que estava fazendo no meio de uma tarefa.',
  },
};

const SINGLE_DOMAIN_INSIGHTS: Record<DomainKey, NeuroInsight> = {
  selective_attention: {
    tag: 'Atenção Seletiva',
    text: 'Treinos curtos todo dia ajudam você a manter o foco no que importa, mesmo com barulho ou distrações por perto.',
  },
  working_memory: {
    tag: 'Memória',
    text: 'Exercitar a memória de curto prazo ajuda a lembrar nomes, números, listas e tarefas sem depender tanto de anotações.',
  },
  fluid_reasoning: {
    tag: 'Raciocínio Lógico',
    text: 'Resolver padrões novos deixa seu cérebro mais afiado para achar soluções criativas em problemas inesperados.',
  },
  processing_speed: {
    tag: 'Velocidade Mental',
    text: 'Praticar decisões rápidas treina seu cérebro a entender informações e responder com mais agilidade.',
  },
  numerical_cognition: {
    tag: 'Cálculo Mental',
    text: 'Fazer contas de cabeça regularmente mantém a mente ativa e traz mais segurança para lidar com números.',
  },
  inhibitory_control: {
    tag: 'Autocontrole',
    text: 'Treinar o freio mental ajuda a não agir no piloto automático e manter a calma em situações de pressão.',
  },
};

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
    const orderedGoals = [...chosen].sort((a, b) => (scores[a] ?? 0) - (scores[b] ?? 0));
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

  const rankedWeak = [...DOMAIN_LIST].sort((a, b) => (scores[a.key] ?? 0) - (scores[b.key] ?? 0));
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

export interface FlowPick {
  slug: GameSlug;
  reasonType: 'new' | 'catchup' | 'improve';
  reasonLabel: string;
  targetStage?: number;
}

/**
 * Motor do Modo Flow Contínuo:
 * 1) Jogos que o usuário ainda nunca jogou (priorizando domínios mais baixos).
 * 2) Jogos atrasados de fase em relação ao nível geral (mantém subindo até igualar).
 * 3) Quando todos estiverem nivelados, alterna de forma inteligente nos mais fracos/aleatórios.
 */
export function pickNextFlowGame(
  progress: Record<GameSlug, GameProgressRecord>,
  scores: DomainScoresRecord,
  justPlayedSlug?: GameSlug
): FlowPick {
  const allGames = GAME_REGISTRY;

  // 1. Jogos nunca jogados primeiro
  const unplayed = allGames
    .filter((g) => (progress[g.slug]?.total_plays ?? 0) === 0 && g.slug !== justPlayedSlug)
    .sort((a, b) => (scores[a.domain] ?? 0) - (scores[b.domain] ?? 0));

  if (unplayed.length > 0) {
    const pick = unplayed[0];
    return {
      slug: pick.slug,
      reasonType: 'new',
      reasonLabel: `Jogo novo · ${DOMAIN_MAP[pick.domain].shortName}`,
    };
  }

  // 2. Jogos atrasados de fase em relação ao nível típico do usuário
  const playedStages = allGames
    .map((g) => Math.max(1, progress[g.slug]?.current_stage ?? 1))
    .sort((a, b) => a - b);

  // Usa o percentil 65 dos níveis como referência ("nível geral" dos jogos que você já domina)
  const refIdx = Math.min(playedStages.length - 1, Math.floor(playedStages.length * 0.65));
  const referenceStage = playedStages[refIdx] ?? 1;

  // Se o jogo que acabou de jogar ainda está bem atrás da referência (diferença >= 2), continua subindo ele!
  if (justPlayedSlug) {
    const curStage = Math.max(1, progress[justPlayedSlug]?.current_stage ?? 1);
    if (referenceStage - curStage >= 2) {
      return {
        slug: justPlayedSlug,
        reasonType: 'catchup',
        reasonLabel: `Subir fase (Nv.${curStage} → Nv.${referenceStage})`,
        targetStage: referenceStage,
      };
    }
  }

  // Procura o jogo mais atrasado de fase (diferença >= 2 da referência)
  const lagging = allGames
    .filter((g) => {
      const st = Math.max(1, progress[g.slug]?.current_stage ?? 1);
      return referenceStage - st >= 2;
    })
    .sort((a, b) => {
      const sa = Math.max(1, progress[a.slug]?.current_stage ?? 1);
      const sb = Math.max(1, progress[b.slug]?.current_stage ?? 1);
      if (sa !== sb) return sa - sb;
      return (scores[a.domain] ?? 0) - (scores[b.domain] ?? 0);
    });

  if (lagging.length > 0) {
    const pick = lagging[0];
    const st = Math.max(1, progress[pick.slug]?.current_stage ?? 1);
    return {
      slug: pick.slug,
      reasonType: 'catchup',
      reasonLabel: `Alcançar nível (Nv.${st} → Nv.${referenceStage})`,
      targetStage: referenceStage,
    };
  }

  // 3. Tudo nivelado: escolhe aleatoriamente entre os jogos/domínios com maior margem de evolução (sem repetir o último)
  const rankedWeak = allGames
    .filter((g) => g.slug !== justPlayedSlug)
    .sort((a, b) => {
      const scoreA = (scores[a.domain] ?? 0) * 0.6 + (progress[a.slug]?.highest_score ?? 0) * 0.4;
      const scoreB = (scores[b.domain] ?? 0) * 0.6 + (progress[b.slug]?.highest_score ?? 0) * 0.4;
      return scoreA - scoreB;
    });

  const poolSize = Math.min(8, rankedWeak.length);
  const pick = rankedWeak[Math.floor(Math.random() * Math.max(1, poolSize))] ?? allGames[0];

  return {
    slug: pick.slug,
    reasonType: 'improve',
    reasonLabel: `Melhorar ${DOMAIN_MAP[pick.domain].shortName}`,
  };
}

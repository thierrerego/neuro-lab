import type {
  AdaptiveStatus,
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

/** As 7 faixas de Alcunhas / Patentes Cognitivas (0 a 1000 pontos) */
export const COGNITIVE_TIERS: CognitiveTier[] = [
  {
    tierIndex: 1,
    title: 'Em Aquecimento',
    subtitle: 'Sinapses em fase de ativação',
    minScore: 0,
    accentColor: '#94a3b8',
  },
  {
    tierIndex: 2,
    title: 'Observador',
    subtitle: 'Construindo base de foco e ritmo',
    minScore: 380,
    accentColor: '#60a5fa',
  },
  {
    tierIndex: 3,
    title: 'Analista',
    subtitle: 'Desempenho dentro da média populacional',
    minScore: 480,
    accentColor: '#38bdf8',
  },
  {
    tierIndex: 4,
    title: 'Estrategista',
    subtitle: 'Processamento acima da média',
    minScore: 570,
    accentColor: '#34d399',
  },
  {
    tierIndex: 5,
    title: 'Tático',
    subtitle: 'Alta precisão e baixo tempo de latência',
    minScore: 640,
    accentColor: '#a855f7',
  },
  {
    tierIndex: 6,
    title: 'Mestre Cognitivo',
    subtitle: 'Performance de elite — Top 10%',
    minScore: 735,
    accentColor: '#f472b6',
  },
  {
    tierIndex: 7,
    title: 'Ápice Neural',
    subtitle: 'Superou 99% dos jogadores — Precisão cirúrgica',
    minScore: 860,
    accentColor: '#fbbf24',
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
 * Referência populacional: média μ = 520, desvio padrão σ = 165.
 */
export function normalCDF(x: number, mean = 520, sd = 165): number {
  const z = (x - mean) / (sd * Math.SQRT2);
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

/** Converte Score (0..1000) em Percentil formatado de 1.0% a 99.9% */
export function scoreToPercentile(score: number, baseStage = 1): number {
  const adjustedMean = Math.max(495, 520 - (baseStage - 1) * 3);
  const rawPct = normalCDF(score, adjustedMean, 165) * 100;
  const clamped = Math.max(1.0, Math.min(99.9, rawPct));
  return Number(clamped.toFixed(1));
}

/** Tempo-alvo de referência (ms) por minigame e estágio base */
export function getTargetRtMs(slug: GameSlug, baseStage: number): number {
  const baseByGame: Record<GameSlug, number> = {
    'go-nogo-reflex': 560,
    'speed-match': 720,
    'stroop-conflict': 880,
    'symbol-digit': 1050,
    'visual-search': 1150,
    'dual-n-back': 1150,
    'number-comparison': 1350,
    'spatial-span': 1250,
    'sustained-tracking': 1350,
    'path-logic': 1300,
    'chain-arithmetic': 1650,
    'raven-matrices': 2600,
  };
  const base = baseByGame[slug] ?? 1100;
  return Math.max(420, Math.round(base * (1 - Math.min(0.22, (baseStage - 1) * 0.035))));
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
 * Motor Psicométrico (0 a 1000 pts) — 60% Assertividade + Avanço de Ondas / 40% Tempo + Bônus de Teto:
 * 1. Assertividade (máx. 600 pts): precisão líquida (descontando impulsividade) × fator de avanço nas 5 ondas.
 * 2. Velocidade & Conclusão Antecipada (máx. 400 pts): rt_mean_ms vs target_rt_ms + bônus de tempo economizado ao zerar a Onda 5.
 * 3. Avanço do `baseStage`: sobe se atingir Onda >= 4 com >= 80% de assertividade OU se zerar a Onda 5 (+2/+3 em performance excepcional).
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
  } = params;

  const totalAttempts = perf.correct + perf.commissionErrors + perf.omissionErrors;
  const accuracyPct =
    totalAttempts > 0 ? Number(((perf.correct / totalAttempts) * 100).toFixed(1)) : 0;

  const { mean: rtMeanMs, sd: rtSdMs } = computeReactionStats(perf.reactionTimesMs);
  const completedEarly = wave.isCleared && timeRemainingMs > 0;
  const safeRemainingMs = completedEarly ? Math.max(0, Math.round(timeRemainingMs)) : 0;
  const waveReached = wave.currentWave; // 1..5
  const wavesCompleted = wave.wavesCompleted; // 0..5

  // --- 1. Assertividade (60% — máx. 600 pts) ponderada pelo avanço nas 5 ondas ---
  // Quem chegou na Onda 5 com 100% pontua bem mais que quem parou na Onda 2 com 100%
  const netAccuracyRatio =
    totalAttempts > 0
      ? Math.max(0, (perf.correct - perf.commissionErrors * 0.25) / totalAttempts)
      : 0;
  const waveProgressRatio = Math.min(1, wave.totalHits / TOTAL_WAVE_HITS);
  const waveWeight = 0.35 + 0.65 * waveProgressRatio; // Onda 1 (~0.43) -> Onda 5 zerada (1.0)
  const accuracyPoints =
    totalAttempts > 0 ? Math.min(600, Math.round(netAccuracyRatio * 600 * waveWeight)) : 0;

  // --- 2. Velocidade & Conclusão Antecipada (40% — máx. 400 pts) ---
  const targetRt = getTargetRtMs(gameSlug, baseStage);
  let rtBasePoints = 0;
  if (perf.correct > 0) {
    let rtRatio = 0.6;
    if (rtMeanMs > 0) {
      const fastBound = targetRt * 0.6;
      const slowBound = targetRt * 2.55;
      const norm = (slowBound - rtMeanMs) / (slowBound - fastBound);
      rtRatio = Math.max(0.12, Math.min(1, 0.12 + norm * 0.88));
    }
    // Sem zerar a partida, a velocidade base vai até 310 pts escalada pelo avanço de ondas
    rtBasePoints = Math.round(rtRatio * 310 * (0.4 + 0.6 * waveProgressRatio));
  }

  // Bônus de Tempo Economizado ao zerar os 5 micro-níveis antes do relógio zerar
  const savedTimeRatio =
    completedEarly && totalDurationMs > 0
      ? Math.min(1, safeRemainingMs / totalDurationMs)
      : 0;
  const earlyBonusPoints = completedEarly
    ? Math.max(25, Math.round(45 + savedTimeRatio * 115))
    : 0;

  const speedPoints = Math.min(400, rtBasePoints + earlyBonusPoints);
  const speedScore = Math.round((speedPoints / 400) * 100);

  // --- 3. Pontuação Final (0 a 1000) + bônus sutil pelo baseStage ---
  const stageBonusMultiplier = 1 + Math.min(0.15, (baseStage - 1) * 0.025);
  const finalScore =
    totalAttempts > 0
      ? Math.max(0, Math.min(1000, Math.round((accuracyPoints + speedPoints) * stageBonusMultiplier)))
      : 0;

  const performanceIndex = Math.round(finalScore / 10);
  const percentile = scoreToPercentile(finalScore, baseStage);
  const tier = getCognitiveTier(finalScore);

  // --- 4. Regra de Evolução Permanente do `baseStage` ---
  // Sobe se atingiu Micro-nível >= 4 com >= 80% de assertividade OU se zerou o Micro-nível 5
  let adaptiveDelta = 0;
  let adaptiveStatus: AdaptiveStatus = 'hold';
  let stageCleared = false;

  if (wavesCompleted === 5 && accuracyPct >= 95 && finalScore >= 860) {
    adaptiveDelta = 3;
    adaptiveStatus = 'fast_track';
    stageCleared = true;
  } else if (wavesCompleted === 5 && accuracyPct >= 88 && finalScore >= 735) {
    adaptiveDelta = 2;
    adaptiveStatus = 'fast_track';
    stageCleared = true;
  } else if (wavesCompleted === 5 || (waveReached >= 4 && accuracyPct >= 80)) {
    adaptiveDelta = 1;
    adaptiveStatus = 'level_up';
    stageCleared = true;
  } else if (totalAttempts >= 3 && accuracyPct >= 60) {
    adaptiveDelta = 0;
    adaptiveStatus = 'hold';
    stageCleared = false;
  } else {
    stageCleared = false;
    if (baseStage > 1) {
      adaptiveDelta = -1;
      adaptiveStatus = 'step_down';
    } else {
      adaptiveDelta = 0;
      adaptiveStatus = 'ease_mode';
    }
  }

  const nextStage = Math.max(1, baseStage + adaptiveDelta);

  // XP (+20% nos 2 domínios mais fracos)
  const bonusXp = weakestTwoDomains.includes(domain);
  const rawXp =
    (stageCleared ? 120 + (adaptiveDelta - 1) * 45 : 45) +
    (completedEarly ? 40 : 0) +
    Math.round(finalScore / 8);
  const xpEarned = Math.round(bonusXp ? rawXp * 1.2 : rawXp);

  // Evolução do domínio (escala 200..999)
  const domainDelta =
    adaptiveStatus === 'fast_track'
      ? Math.min(40, 20 + adaptiveDelta * 6)
      : stageCleared
        ? Math.min(26, 10 + Math.round((finalScore - 500) / 26))
        : adaptiveStatus === 'hold'
          ? 2
          : -12;

  return {
    domain,
    gameSlug,
    mode,
    stagePlayed: baseStage,
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
    xpEarned,
    bonusXp,
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
 * Gera lista de jogos do dia para cada um dos 2 modos de treino:
 * - 'weak': foca nos domínios em que o usuário é mais fraco (+ 1 manutenção se 3+ jogos)
 * - 'goals': foca nas áreas que o usuário escolheu treinar no Onboarding
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
    const chosen = (selectedDomains?.length ? selectedDomains : DOMAIN_LIST.map((d) => d.key));
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

  // Modo 'weak': foca nos pontos mais fracos detectados pelo rastreio/histórico
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

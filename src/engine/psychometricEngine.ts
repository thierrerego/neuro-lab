import type {
  AdaptiveStatus,
  ComputedSessionResult,
  DailyProtocolRecord,
  DomainKey,
  DomainScoresRecord,
  GameSlug,
  RawGamePerformance,
  SessionMode,
  StageConfig,
} from '../types/cognitive';
import { DOMAIN_LIST, GAMES_BY_DOMAIN } from './gameRegistry';

export function computeReactionStats(times: number[]): { mean: number; sd: number } {
  const valid = times.filter((t) => Number.isFinite(t) && t > 60 && t < 15000);
  if (valid.length === 0) return { mean: 0, sd: 0 };
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((acc, v) => acc + (v - mean) ** 2, 0) / valid.length;
  return {
    mean: Math.round(mean),
    sd: Math.round(Math.sqrt(variance)),
  };
}

/**
 * Calcula a Nota de Velocidade (0..100) combinando:
 * - Tempo médio de reação (RT_mean em ms) frente à janela esperada da fase
 * - Cadência de respostas corretas no tempo disponível
 */
export function computeSpeedScore(
  rtMeanMs: number,
  correctCount: number,
  config: StageConfig
): number {
  if (correctCount <= 0) return 0;

  // Referência de rapidez: 420ms = nota 100, cai suavemente até 2600ms = nota 15
  let rtScore = 60;
  if (rtMeanMs > 0) {
    const fastRef = Math.max(360, Math.min(540, config.stimulusMs * 0.34));
    const slowRef = Math.max(2100, config.stimulusMs * 1.55);
    const ratio = (slowRef - rtMeanMs) / (slowRef - fastRef);
    rtScore = Math.max(12, Math.min(100, Math.round(12 + ratio * 88)));
  }

  // Bônus/ajuste de volume (acertos por minuto)
  const pacePerMin = (correctCount / Math.max(15, config.durationSec)) * 60;
  const paceScore = Math.max(20, Math.min(100, Math.round((pacePerMin / 28) * 100)));

  return Math.max(0, Math.min(100, Math.round(rtScore * 0.72 + paceScore * 0.28)));
}

/**
 * Motor Psicométrico & Auto-Adaptação (60% Assertividade + 40% Velocidade):
 * - Índice da partida = 0.60 * Assertividade + 0.40 * Velocidade
 * - Pontuação final reflete acertos × índice 60/40 × multiplicador da fase
 * - Avanço adaptativo:
 *   • Excepcional (≥95% precisão e índice ≥93, 10+ jogadas): +3 fases
 *   • Muito bom (≥90% precisão e índice ≥84, 5+ jogadas): +2 fases
 *   • Bom (≥80% precisão e índice ≥68): +1 fase
 *   • Regular (60%–79% ou acertou bem mas bem lento): mantém fase
 *   • Fraco (<60%): desce 1 fase (ou ativa modo mais leve na Fase 1)
 */
export function evaluateSession(params: {
  domain: DomainKey;
  gameSlug: GameSlug;
  mode: SessionMode;
  config: StageConfig;
  perf: RawGamePerformance;
  weakestTwoDomains: DomainKey[];
}): ComputedSessionResult {
  const { domain, gameSlug, mode, config, perf, weakestTwoDomains } = params;
  const totalAttempts = perf.correct + perf.commissionErrors + perf.omissionErrors;
  const accuracyPct =
    totalAttempts > 0 ? Number(((perf.correct / totalAttempts) * 100).toFixed(1)) : 0;

  const { mean: rtMeanMs, sd: rtSdMs } = computeReactionStats(perf.reactionTimesMs);
  const speedScore = computeSpeedScore(rtMeanMs, perf.correct, config);

  // Nota composta: 60% assertividade + 40% velocidade
  const performanceIndex =
    totalAttempts > 0 ? Math.round(accuracyPct * 0.6 + speedScore * 0.4) : 0;

  // Pontuação final diretamente ligada a assertividade + velocidade + fase
  const rawVolume =
    perf.rawPoints ??
    Math.max(0, perf.correct * 100 - perf.commissionErrors * 45 - perf.omissionErrors * 25);
  const indexFactor = 0.45 + (performanceIndex / 100) * 1.1; // 0.45x até 1.55x
  const speedBonus = Math.round(speedScore * 2.4);
  const accuracyBonus = Math.round(accuracyPct * 3.0);

  const finalScore =
    totalAttempts > 0
      ? Math.max(0, Math.round((rawVolume * indexFactor + accuracyBonus + speedBonus) * config.scoreMultiplier))
      : 0;

  // --- Auto-Adaptação de Fase (Staircase com piso de assertividade) ---
  let adaptiveDelta = 0;
  let adaptiveStatus: AdaptiveStatus = 'hold';
  let stageCleared = false;

  if (totalAttempts >= 10 && accuracyPct >= 95 && performanceIndex >= 93) {
    adaptiveDelta = 3;
    adaptiveStatus = 'fast_track';
    stageCleared = true;
  } else if (totalAttempts >= 5 && accuracyPct >= 90 && performanceIndex >= 84) {
    adaptiveDelta = 2;
    adaptiveStatus = 'fast_track';
    stageCleared = true;
  } else if (totalAttempts >= 3 && accuracyPct >= config.minAccuracyPct && performanceIndex >= 68) {
    adaptiveDelta = 1;
    adaptiveStatus = 'level_up';
    stageCleared = true;
  } else if (totalAttempts >= 3 && accuracyPct >= 60) {
    adaptiveDelta = 0;
    adaptiveStatus = 'hold';
    stageCleared = false;
  } else {
    stageCleared = false;
    if (config.stage > 1) {
      adaptiveDelta = -1;
      adaptiveStatus = 'step_down';
    } else {
      adaptiveDelta = 0;
      adaptiveStatus = 'ease_mode';
    }
  }

  const nextStage = Math.max(1, config.stage + adaptiveDelta);

  // XP (+20% nos 2 domínios mais fracos)
  const bonusXp = weakestTwoDomains.includes(domain);
  const rawXp = (stageCleared ? 130 + (adaptiveDelta - 1) * 45 : 45) + Math.round(finalScore / 30);
  const xpEarned = Math.round(bonusXp ? rawXp * 1.2 : rawXp);

  // Evolução do domínio (escala 200..999) guiada pelo índice 60/40
  const domainDelta =
    adaptiveStatus === 'fast_track'
      ? Math.min(36, 18 + adaptiveDelta * 5)
      : stageCleared
        ? Math.min(24, 9 + Math.round((performanceIndex - 65) * 0.4))
        : adaptiveStatus === 'hold'
          ? 2
          : -10;

  return {
    domain,
    gameSlug,
    mode,
    stagePlayed: config.stage,
    stageCleared,
    nextStage,
    adaptiveDelta,
    adaptiveStatus,
    score: finalScore,
    accuracyPct,
    speedScore,
    performanceIndex,
    commissionErrors: perf.commissionErrors,
    omissionErrors: perf.omissionErrors,
    rtMeanMs,
    rtSdMs,
    xpEarned,
    bonusXp,
    domainDelta,
  };
}

/** Calcula o Índice Cognitivo Global (ICG) — média dos 6 domínios */
export function calculateGlobalCognitiveIndex(scores: DomainScoresRecord): number {
  const sum = DOMAIN_LIST.reduce((acc, d) => acc + (scores[d.key] ?? 500), 0);
  return Math.round(sum / DOMAIN_LIST.length);
}

/** Retorna os N domínios com menor pontuação atual */
export function getWeakestDomains(scores: DomainScoresRecord, count = 2): DomainKey[] {
  return [...DOMAIN_LIST]
    .sort((a, b) => (scores[a.key] ?? 500) - (scores[b.key] ?? 500))
    .slice(0, count)
    .map((d) => d.key);
}

/**
 * Converte as respostas do questionário de hábitos/foco em pesos de prioridade por domínio
 * (nunca altera dificuldade — apenas influencia quais áreas entram com foco no Treino Diário).
 */
export function getOnboardingDomainWeights(
  answers?: Record<string, string>
): Partial<Record<DomainKey, number>> {
  if (!answers) return {};
  const w: Partial<Record<DomainKey, number>> = {};
  const add = (d: DomainKey, v: number) => {
    w[d] = (w[d] ?? 0) + v;
  };

  if (answers.goal === 'attention') add('selective_attention', 2);
  if (answers.goal === 'memory') add('working_memory', 2);
  if (answers.goal === 'reasoning') add('fluid_reasoning', 2);
  if (answers.goal === 'speed_math') {
    add('processing_speed', 1.5);
    add('numerical_cognition', 1.5);
  }

  if (answers.pain === 'distraction') add('selective_attention', 1.5);
  if (answers.pain === 'forgetting') add('working_memory', 1.5);
  if (answers.pain === 'slowness') add('processing_speed', 1.5);
  if (answers.pain === 'impulse') add('inhibitory_control', 2);

  if (answers.pressure === 'decisions') add('fluid_reasoning', 1.2);
  if (answers.pressure === 'math') add('numerical_cognition', 1.5);
  if (answers.pressure === 'sustained') add('selective_attention', 1.2);
  if (answers.pressure === 'sequence') add('working_memory', 1.2);

  return w;
}

/**
 * Gera o Protocolo Diário Adaptativo:
 * 3 minigames combinando domínios mais fracos + prioridades do questionário, + 1 de manutenção.
 */
export function generateDailyProtocol(
  scores: DomainScoresRecord,
  dateStr: string,
  onboardingAnswers?: Record<string, string>
): DailyProtocolRecord {
  const weights = getOnboardingDomainWeights(onboardingAnswers);

  // Score efetivo: domínios fracos e domínios priorizados no questionário sobem pro topo
  const ranked = [...DOMAIN_LIST].sort((a, b) => {
    const effA = (scores[a.key] ?? 500) - (weights[a.key] ?? 0) * 42;
    const effB = (scores[b.key] ?? 500) - (weights[b.key] ?? 0) * 42;
    return effA - effB;
  });

  const daySeed = Number(dateStr.replace(/-/g, '')) || 1;
  const pickGame = (domain: DomainKey, offset: number): GameSlug => {
    const games = GAMES_BY_DOMAIN[domain];
    return games[(daySeed + offset) % games.length].slug;
  };

  const focus3 = ranked.slice(0, 3).map((d, idx) => ({
    slug: pickGame(d.key, idx),
    domain: d.key,
    role: (weights[d.key] ?? 0) > 0 ? ('priority' as const) : ('weak' as const),
  }));

  const strongest = ranked[ranked.length - 1];
  const maintenance = {
    slug: pickGame(strongest.key, 1),
    domain: strongest.key,
    role: 'maintenance' as const,
  };

  return {
    protocol_date: dateStr,
    recommended_games: [...focus3, maintenance],
    completed_games: [],
  };
}

/** Converte resultado da calibração (60% assertividade + 40% velocidade) em pontuação inicial (350..750) */
export function calibrationScoreToDomainValue(accuracyPct: number, rtMeanMs: number): number {
  const speedPart = rtMeanMs > 0 ? Math.max(15, Math.min(100, ((2200 - rtMeanMs) / 1780) * 100)) : 50;
  const composite = accuracyPct * 0.6 + speedPart * 0.4;
  return Math.round(Math.max(350, Math.min(750, 350 + composite * 4)));
}

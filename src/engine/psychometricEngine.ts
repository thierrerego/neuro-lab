import type {
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
 * Calcula pontuação, precisão, métricas de RT, avanço de fase e XP.
 * Pontuação base × (1 + stage * 0.15) + bônus de precisão + bônus de velocidade.
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
  const accuracyPct = totalAttempts > 0
    ? Number(((perf.correct / totalAttempts) * 100).toFixed(1))
    : 0;

  const { mean: rtMeanMs, sd: rtSdMs } = computeReactionStats(perf.reactionTimesMs);

  // Pontuação base
  const basePoints = perf.rawPoints ?? Math.max(0, perf.correct * 100 - perf.commissionErrors * 45 - perf.omissionErrors * 25);

  // Bônus de precisão e de velocidade de reação (quanto menor o RT, maior o bônus)
  const accuracyBonus = accuracyPct >= 95 ? 180 : accuracyPct >= 85 ? 110 : accuracyPct >= 80 ? 60 : 0;
  const speedBonus = rtMeanMs > 0 ? Math.max(0, Math.round((1200 - rtMeanMs) * 0.28)) : 0;

  const finalScore = Math.max(
    0,
    Math.round((basePoints + accuracyBonus + speedBonus) * config.scoreMultiplier)
  );

  // Regra de avanço: precisa ter jogado de verdade (>= 3 respostas) e >= 80% de acerto
  const stageCleared = totalAttempts >= 3 && accuracyPct >= config.minAccuracyPct;
  const nextStage = stageCleared ? config.stage + 1 : config.stage;

  // XP (+20% nos 2 domínios mais fracos)
  const bonusXp = weakestTwoDomains.includes(domain);
  const rawXp = (stageCleared ? 140 : 55) + Math.round(finalScore / 25);
  const xpEarned = Math.round(bonusXp ? rawXp * 1.2 : rawXp);

  // Delta no score do domínio (escala 200..999)
  const domainDelta = stageCleared
    ? Math.min(28, 10 + Math.round((accuracyPct - 75) * 0.4) + Math.min(8, config.stage))
    : accuracyPct >= 65
      ? 3
      : -4;

  return {
    domain,
    gameSlug,
    mode,
    stagePlayed: config.stage,
    stageCleared,
    nextStage,
    score: finalScore,
    accuracyPct,
    commissionErrors: perf.commissionErrors,
    omissionErrors: perf.omissionErrors,
    rtMeanMs,
    rtSdMs,
    xpEarned,
    bonusXp,
    domainDelta,
  };
}

/** Calcula o Índice Cognitivo Global (ICG) — média ponderada dos 6 domínios */
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
 * Gera o Protocolo Diário Adaptativo:
 * 3 minigames nos 3 domínios com menor score atual + 1 de manutenção no mais forte.
 */
export function generateDailyProtocol(
  scores: DomainScoresRecord,
  dateStr: string
): DailyProtocolRecord {
  const ordered = [...DOMAIN_LIST].sort((a, b) => (scores[a.key] ?? 500) - (scores[b.key] ?? 500));
  const daySeed = Number(dateStr.replace(/-/g, '')) || 1;

  const pickGame = (domain: DomainKey, offset: number): GameSlug => {
    const games = GAMES_BY_DOMAIN[domain];
    return games[(daySeed + offset) % games.length].slug;
  };

  const weak3 = ordered.slice(0, 3).map((d, idx) => ({
    slug: pickGame(d.key, idx),
    domain: d.key,
    role: 'weak' as const,
  }));

  const strongest = ordered[ordered.length - 1];
  const maintenance = {
    slug: pickGame(strongest.key, 1),
    domain: strongest.key,
    role: 'maintenance' as const,
  };

  return {
    protocol_date: dateStr,
    recommended_games: [...weak3, maintenance],
    completed_games: [],
  };
}

/** Converte pontuação da calibração (Fase 1) em pontuação inicial do domínio (380..720) */
export function calibrationScoreToDomainValue(accuracyPct: number, rtMeanMs: number): number {
  const accPart = (accuracyPct / 100) * 240;
  const speedPart = rtMeanMs > 0 ? Math.max(0, Math.min(100, (1200 - rtMeanMs) / 9)) : 45;
  return Math.round(Math.max(360, Math.min(720, 370 + accPart + speedPart)));
}

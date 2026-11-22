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
 * Motor Psicométrico & Auto-Adaptação de Dificuldade:
 * - Muito bom (domínio alto + rápido): pula +2 ou +3 fases de uma vez (sobe rápido!)
 * - Bom (≥ 80%): sobe +1 fase
 * - Regular (60%–79%): mantém a fase atual
 * - Fraco (< 60% ou pouquíssimas respostas): desce 1 fase (ou ativa modo mais leve se já estiver na Fase 1)
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

  const basePoints =
    perf.rawPoints ??
    Math.max(0, perf.correct * 100 - perf.commissionErrors * 45 - perf.omissionErrors * 25);

  const accuracyBonus = accuracyPct >= 95 ? 180 : accuracyPct >= 85 ? 110 : accuracyPct >= 80 ? 60 : 0;
  const speedBonus = rtMeanMs > 0 ? Math.max(0, Math.round((1200 - rtMeanMs) * 0.28)) : 0;

  const finalScore = Math.max(
    0,
    Math.round((basePoints + accuracyBonus + speedBonus) * config.scoreMultiplier)
  );

  // --- Lógica de Auto-Adaptação (Staircase Dinâmico) ---
  let adaptiveDelta = 0;
  let adaptiveStatus: AdaptiveStatus = 'hold';
  let stageCleared = false;

  const fastEnough = rtMeanMs === 0 || rtMeanMs <= 950;
  const ultraFast = rtMeanMs > 0 && rtMeanMs <= 620;

  if (totalAttempts >= 10 && accuracyPct >= 98 && ultraFast) {
    // Usuário excepcional: salta +3 fases para alcançar desafio real rapidamente
    adaptiveDelta = 3;
    adaptiveStatus = 'fast_track';
    stageCleared = true;
  } else if (totalAttempts >= 5 && accuracyPct >= 94 && fastEnough) {
    // Usuário muito bom: salta +2 fases de uma vez
    adaptiveDelta = 2;
    adaptiveStatus = 'fast_track';
    stageCleared = true;
  } else if (totalAttempts >= 3 && accuracyPct >= config.minAccuracyPct) {
    // Bom desempenho (>= 80%): avança +1 fase
    adaptiveDelta = 1;
    adaptiveStatus = 'level_up';
    stageCleared = true;
  } else if (totalAttempts >= 3 && accuracyPct >= 60) {
    // Regular (60% - 79%): mantém na mesma fase
    adaptiveDelta = 0;
    adaptiveStatus = 'hold';
    stageCleared = false;
  } else {
    // Desempenho baixo (< 60% ou travou): facilita automaticamente na próxima!
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
  const rawXp = (stageCleared ? 140 + (adaptiveDelta - 1) * 45 : 50) + Math.round(finalScore / 25);
  const xpEarned = Math.round(bonusXp ? rawXp * 1.2 : rawXp);

  // Delta no score do domínio (200..999)
  const domainDelta =
    adaptiveStatus === 'fast_track'
      ? Math.min(36, 18 + adaptiveDelta * 5)
      : stageCleared
        ? Math.min(24, 10 + Math.round((accuracyPct - 75) * 0.35) + Math.min(6, config.stage))
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

/** Converte resultado da calibração em pontuação inicial do domínio (360..740) */
export function calibrationScoreToDomainValue(accuracyPct: number, rtMeanMs: number): number {
  const accPart = (accuracyPct / 100) * 260;
  const speedPart = rtMeanMs > 0 ? Math.max(0, Math.min(110, (1250 - rtMeanMs) / 8.5)) : 45;
  return Math.round(Math.max(350, Math.min(740, 360 + accPart + speedPart)));
}

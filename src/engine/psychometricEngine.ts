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
} from '../types/cognitive';
import { DOMAIN_LIST, GAMES_BY_DOMAIN } from './gameRegistry';

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
 * Distribuição Normal Acumulada (CDF) — aproximação Abramowitz & Stegun (erro < 1.5e-7)
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
export function scoreToPercentile(score: number, stage = 1): number {
  // Referência populacional: μ = 520, σ = 165 (com ajuste sutil de fase)
  const adjustedMean = Math.max(495, 520 - (stage - 1) * 3);
  const rawPct = normalCDF(score, adjustedMean, 165) * 100;
  const clamped = Math.max(1.0, Math.min(99.9, rawPct));
  return Number(clamped.toFixed(1));
}

/** Tempo-alvo de referência (ms) por minigame e fase */
export function getTargetRtMs(slug: GameSlug, stage: number): number {
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
    'raven-matrices': 3200,
  };
  const base = baseByGame[slug] ?? 1100;
  // Fases mais altas esperam respostas ligeiramente mais rápidas (ou mais complexas compensadas pelo bônus de fase)
  return Math.max(420, Math.round(base * (1 - Math.min(0.22, (stage - 1) * 0.035))));
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
 * Motor Psicométrico (0 a 1000 pts) — 60% Assertividade / 40% Velocidade + Percentil + Alcunha + Auto-Adaptação:
 * 1. Assertividade (60% = máx. 600 pts): accuracy_pct líquida descontando erros impulsivos (commission).
 * 2. Velocidade (40% = máx. 400 pts): rt_mean_ms comparado ao target_rt_ms da fase/jogo.
 * 3. Bônus sutil de fase (reflete dificuldade) dentro do teto de 1000 pts.
 * 4. Curva normal (μ=520, σ=165) -> percentil (1% a 99.9%) + 7 Alcunhas Cognitivas.
 * 5. Auto-Adaptação de fase: +2/+3 (excepcional), +1 (bom), 0 (regular), -1 ou ritmo leve (<60%).
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

  // --- 1. Componente de Assertividade (60% = máx. 600 pts) ---
  // Desconta erros de comissão (impulsividade) com peso extra (0.25) sobre a precisão líquida
  const netAccuracyRatio =
    totalAttempts > 0
      ? Math.max(0, (perf.correct - perf.commissionErrors * 0.25) / totalAttempts)
      : 0;
  // Proteção contra tentar só 1-2 vezes e parar
  const volumeGate = Math.min(1, totalAttempts / 4);
  const accuracyPoints = Math.round(netAccuracyRatio * 600 * (totalAttempts > 0 ? (0.45 + 0.55 * volumeGate) : 0));

  // --- 2. Componente de Velocidade (40% = máx. 400 pts) ---
  const targetRt = getTargetRtMs(gameSlug, config.stage);
  let speedRatio = 0;
  if (perf.correct > 0) {
    if (rtMeanMs > 0) {
      // RT <= 0.65 * alvo -> 1.0 (400 pts); RT == alvo -> ~0.78; RT >= 2.6 * alvo -> 0.12
      const fastBound = targetRt * 0.62;
      const slowBound = targetRt * 2.55;
      const norm = (slowBound - rtMeanMs) / (slowBound - fastBound);
      speedRatio = Math.max(0.12, Math.min(1, 0.12 + norm * 0.88));
    } else {
      speedRatio = 0.62;
    }
    // Pondera levemente por volume mínimo de acertos
    speedRatio *= 0.55 + 0.45 * Math.min(1, perf.correct / 5);
  }
  const speedPoints = Math.round(speedRatio * 400);
  const speedScore = Math.round((speedPoints / 400) * 100);

  // --- 3. Pontuação Final (0 a 1000) com multiplicador sutil de fase ---
  const rawTotal = accuracyPoints + speedPoints; // 0..1000
  const stageBonusMultiplier = 1 + Math.min(0.16, (config.stage - 1) * 0.028);
  const finalScore =
    totalAttempts > 0
      ? Math.max(0, Math.min(1000, Math.round(rawTotal * stageBonusMultiplier)))
      : 0;

  const performanceIndex = Math.round(finalScore / 10);

  // --- 4. Percentil & Alcunha Cognitiva ---
  const percentile = scoreToPercentile(finalScore, config.stage);
  const tier = getCognitiveTier(finalScore);

  // --- 5. Auto-Adaptação de Fase (Staircase dinâmico com piso de assertividade) ---
  let adaptiveDelta = 0;
  let adaptiveStatus: AdaptiveStatus = 'hold';
  let stageCleared = false;

  if (totalAttempts >= 8 && accuracyPct >= 95 && finalScore >= 860) {
    adaptiveDelta = 3;
    adaptiveStatus = 'fast_track';
    stageCleared = true;
  } else if (totalAttempts >= 5 && accuracyPct >= 90 && finalScore >= 735) {
    adaptiveDelta = 2;
    adaptiveStatus = 'fast_track';
    stageCleared = true;
  } else if (totalAttempts >= 3 && accuracyPct >= config.minAccuracyPct && finalScore >= 540) {
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
  const rawXp = (stageCleared ? 120 + (adaptiveDelta - 1) * 45 : 45) + Math.round(finalScore / 8);
  const xpEarned = Math.round(bonusXp ? rawXp * 1.2 : rawXp);

  // Delta no score do domínio (escala 200..999)
  const domainDelta =
    adaptiveStatus === 'fast_track'
      ? Math.min(40, 20 + adaptiveDelta * 6)
      : stageCleared
        ? Math.min(26, 10 + Math.round((finalScore - 520) / 28))
        : adaptiveStatus === 'hold'
          ? 2
          : -12;

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
    accuracyPoints,
    speedPoints,
    speedScore,
    performanceIndex,
    percentile,
    earnedTitle: tier.title,
    earnedSubtitle: tier.subtitle,
    tierAccent: tier.accentColor,
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
 * Resolve a lista dinâmica de domínios da Calibração Inicial (mín. 2, máx. 6).
 * Se o usuário escolheu apenas 1 domínio, completa com Velocidade (ou Atenção).
 */
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

/** Converte meta diária em minutos para quantidade de minigames no Treino Diário */
export function getDailyGamesCount(dailyGoalMinutes?: number): number {
  const mins = dailyGoalMinutes ?? 10;
  if (mins <= 5) return 2;
  if (mins <= 10) return 3;
  if (mins <= 15) return 4;
  return 5;
}

/**
 * Gera o Protocolo Diário Adaptativo:
 * - Quantidade dinâmica (2, 3, 4 ou 5 minigames) conforme `daily_goal_minutes`.
 * - Prioriza domínios escolhidos no Onboarding (`selected_domains`) + domínios mais fracos.
 * - Reserva 1 jogo de manutenção quando a sessão tiver 3+ jogos.
 */
export function generateDailyProtocol(
  scores: DomainScoresRecord,
  dateStr: string,
  selectedDomains?: DomainKey[],
  dailyGoalMinutes = 10
): DailyProtocolRecord {
  const totalGames = getDailyGamesCount(dailyGoalMinutes);
  const selectedSet = new Set<DomainKey>(selectedDomains ?? []);
  const daySeed = Number(dateStr.replace(/-/g, '')) || 1;

  // Score efetivo: domínios escolhidos no onboarding ganham prioridade (-55 no ranking)
  const ranked = [...DOMAIN_LIST].sort((a, b) => {
    const effA = (scores[a.key] ?? 500) - (selectedSet.has(a.key) ? 55 : 0);
    const effB = (scores[b.key] ?? 500) - (selectedSet.has(b.key) ? 55 : 0);
    return effA - effB;
  });

  const pickGame = (domain: DomainKey, offset: number): GameSlug => {
    const games = GAMES_BY_DOMAIN[domain];
    return games[(daySeed + offset) % games.length].slug;
  };

  const hasMaintenance = totalGames >= 3;
  const focusCount = hasMaintenance ? totalGames - 1 : totalGames;

  const focusGames: DailyProtocolRecord['recommended_games'] = ranked.slice(0, focusCount).map((d, idx) => ({
    slug: pickGame(d.key, idx),
    domain: d.key,
    role: selectedSet.has(d.key) ? 'priority' : 'weak',
  }));

  if (hasMaintenance) {
    const strongest = ranked[ranked.length - 1];
    focusGames.push({
      slug: pickGame(strongest.key, 1),
      domain: strongest.key,
      role: 'maintenance' as const,
    });
  }

  return {
    protocol_date: dateStr,
    recommended_games: focusGames,
    completed_games: [],
  };
}

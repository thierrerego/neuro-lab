import type { GameSlug, StageConfig } from '../types/cognitive';

/**
 * Motor de Fases (Stage Engine)
 * Escala automaticamente grade, exposição em ms, complexidade cognitiva e multiplicador
 * conforme a fase atual do jogador naquele minigame (Fase 1, 2, 3... sem teto fixo).
 */
export function getStageConfig(slug: GameSlug, stage: number): StageConfig {
  const s = Math.max(1, Math.floor(stage));

  // Grade cresce: Fase 1 -> 3x3, Fase 2-3 -> 4x4, Fase 4-5 -> 5x5, Fase 6+ -> 6x6
  const gridSize = s === 1 ? 3 : s <= 3 ? 4 : s <= 5 ? 5 : 6;

  // Janela de exposição reduz gradualmente: 1500ms -> 1100ms -> 850ms -> 620ms
  const stimulusMs = Math.max(580, Math.round(1500 - (s - 1) * 165));

  // Quantidade de alvos / tamanho de sequência
  const targetCount = Math.min(7, 2 + Math.floor((s + 1) / 2));

  // N-Back: 1-Back (fases 1-2), 2-Back (fases 3-4), 3-Back (fases 5+)
  const nBackLevel = s <= 2 ? 1 : s <= 4 ? 2 : 3;

  // Complexidade aritmética
  const mathComplexity: 1 | 2 | 3 | 4 = s === 1 ? 1 : s === 2 ? 2 : s <= 4 ? 3 : 4;

  // Duração padrão entre 30s e 45s (jogos por turno usam roundsTarget)
  const durationBySlug: Record<GameSlug, number> = {
    'visual-search': 35,
    'sustained-tracking': 42,
    'spatial-span': 45,
    'dual-n-back': 40,
    'raven-matrices': 45,
    'path-logic': 40,
    'speed-match': 35,
    'symbol-digit': 35,
    'chain-arithmetic': 38,
    'number-comparison': 35,
    'stroop-conflict': 35,
    'go-nogo-reflex': 35,
  };

  // Rodadas para jogos baseados em tentativas
  const roundsTarget = slug === 'sustained-tracking'
    ? Math.min(6, 3 + Math.floor(s / 2))
    : slug === 'spatial-span'
      ? Math.min(6, 3 + Math.floor(s / 2))
      : slug === 'raven-matrices'
        ? Math.min(8, 5 + Math.floor(s / 2))
        : slug === 'dual-n-back'
          ? Math.min(20, 12 + s * 2)
          : 15;

  return {
    stage: s,
    durationSec: durationBySlug[slug] ?? 35,
    gridSize,
    stimulusMs,
    targetCount,
    nBackLevel,
    reverseOrder: s >= 3,
    alternatingRule: s >= 3,
    mathComplexity,
    minAccuracyPct: 80,
    scoreMultiplier: Number((1 + s * 0.15).toFixed(2)),
    roundsTarget,
  };
}

/** Rótulo curtíssimo da dificuldade técnica da fase (pouquíssimas letras!) */
export function getStageShortBadge(slug: GameSlug, cfg: StageConfig): string {
  switch (slug) {
    case 'visual-search':
      return `${cfg.gridSize}×${cfg.gridSize} · ${cfg.targetCount} alvos`;
    case 'sustained-tracking':
      return `${Math.min(5, cfg.targetCount)} alvos`;
    case 'spatial-span':
      return cfg.reverseOrder ? `${cfg.gridSize}×${cfg.gridSize} · Inverso` : `${cfg.gridSize}×${cfg.gridSize} · Normal`;
    case 'dual-n-back':
      return `${cfg.nBackLevel}-Back · ${cfg.stimulusMs}ms`;
    case 'raven-matrices':
      return `${cfg.roundsTarget} matrizes`;
    case 'path-logic':
      return cfg.alternatingRule ? `1→A→2→B` : `1→2→3`;
    case 'speed-match':
      return `${cfg.durationSec}s · ×${cfg.scoreMultiplier}`;
    case 'symbol-digit':
      return `${Math.min(9, 4 + cfg.stage)} símbolos`;
    case 'chain-arithmetic':
      return cfg.mathComplexity === 1 ? '+' : cfg.mathComplexity === 2 ? '+ −' : cfg.mathComplexity === 3 ? '+ − ×' : 'Composto';
    case 'number-comparison':
      return `${cfg.durationSec}s · Nível ${cfg.mathComplexity}`;
    case 'stroop-conflict':
      return cfg.alternatingRule ? 'Regra alternada' : 'Cor da tinta';
    case 'go-nogo-reflex':
      return `${cfg.stimulusMs}ms`;
  }
}

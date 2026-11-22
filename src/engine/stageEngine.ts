import type { GameSlug, StageConfig } from '../types/cognitive';

/**
 * Motor de Dificuldade Técnica por Nível Efetivo (`effectiveLevel = baseStage + (wave - 1) * 0.25`).
 * - Nível Zero (`0`) começa extremamente acessível e acolhedor para qualquer jogador.
 * - A progressão entre as 5 ondas é sutil (+0.25 por onda) e atingir o topo exige várias partidas vencidas.
 */
export function getStageConfig(slug: GameSlug, effectiveLevel: number, easeBoost = false): StageConfig {
  const s = Math.max(0, effectiveLevel);
  const easy = s < 1 && easeBoost;

  // Grade cresce de forma gradual ao longo de vários estágios permanentes
  // 0..2.9 -> 3x3 | 3..6.9 -> 4x4 | 7..10.9 -> 5x5 | 11+ -> 6x6
  const gridSize = s < 3 ? 3 : s < 7 ? 4 : s < 11 ? 5 : 6;

  // Janela de exposição (ms): generosa no nível 0 (2150ms) e reduz gradualmente (~115ms por estágio)
  const baseStimulus = Math.max(580, Math.round(2150 - s * 115));
  const stimulusMs = easy ? Math.round(baseStimulus * 1.15) : baseStimulus;

  // Quantidade de alvos (começa sempre em 2 no Nível Zero e sobe devagar)
  const targetCount = s < 2.5 ? 2 : s < 5.5 ? 3 : s < 8.5 ? 4 : 5;

  // N-Back: 1-Back nos estágios iniciais (0..4.9), 2-Back (5..8.9), 3-Back (9+)
  const nBackLevel = s < 5 ? 1 : s < 9 ? 2 : 3;

  // Complexidade matemática gradual
  const mathComplexity: 1 | 2 | 3 | 4 = s < 2.5 ? 1 : s < 5.5 ? 2 : s < 8.5 ? 3 : 4;

  // Tempo limite da partida (confortável no nível zero)
  const durationBySlug: Record<GameSlug, number> = {
    'visual-search': 40,
    'sustained-tracking': 50,
    'spatial-span': 48,
    'dual-n-back': 45,
    'raven-matrices': 48,
    'path-logic': 42,
    'speed-match': 36,
    'symbol-digit': 38,
    'chain-arithmetic': 42,
    'number-comparison': 38,
    'stroop-conflict': 38,
    'go-nogo-reflex': 40,
  };

  return {
    stage: Number(s.toFixed(2)),
    durationSec: durationBySlug[slug] ?? 40,
    gridSize,
    stimulusMs,
    targetCount,
    nBackLevel,
    reverseOrder: s >= 5,
    alternatingRule: s >= 4,
    mathComplexity,
    minAccuracyPct: 80,
    scoreMultiplier: Number((1 + s * 0.05).toFixed(2)),
    roundsTarget: 16,
    easeBoost: easy,
  };
}

/** Rótulo curtíssimo da dificuldade técnica da onda atual */
export function getStageShortBadge(slug: GameSlug, cfg: StageConfig): string {
  const lvl = Math.floor(cfg.stage);
  if (cfg.stage < 1 && cfg.easeBoost) return 'Iniciante leve';
  switch (slug) {
    case 'visual-search':
      return `${cfg.gridSize}×${cfg.gridSize}`;
    case 'sustained-tracking':
      return `${Math.min(5, cfg.targetCount)} alvos`;
    case 'spatial-span':
      return cfg.reverseOrder ? `${cfg.gridSize}×${cfg.gridSize} · Inverso` : `${cfg.gridSize}×${cfg.gridSize}`;
    case 'dual-n-back':
      return `${cfg.nBackLevel}-Back`;
    case 'raven-matrices':
      return lvl === 0 ? 'Inicial' : `Nível ${lvl}`;
    case 'path-logic':
      return cfg.stage >= 3 ? '1→A→2→B' : '1→2→3';
    case 'speed-match':
      return lvl === 0 ? 'Inicial' : `Nível ${lvl}`;
    case 'symbol-digit':
      return `${Math.min(9, 3 + Math.floor(cfg.stage * 0.6))} símb.`;
    case 'chain-arithmetic':
      return cfg.mathComplexity === 1 ? '+' : cfg.mathComplexity === 2 ? '+ −' : cfg.mathComplexity === 3 ? '+ − ×' : 'Composto';
    case 'number-comparison':
      return `Nível ${cfg.mathComplexity}`;
    case 'stroop-conflict':
      return cfg.alternatingRule ? 'Alternado' : 'Cor';
    case 'go-nogo-reflex':
      return `${cfg.stimulusMs}ms`;
  }
}

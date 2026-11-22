import type { GameSlug, StageConfig } from '../types/cognitive';

export const MAX_EXERCISE_LEVEL = 20;

/**
 * Motor de Dificuldade em Curva de Flow (1 a 20 níveis):
 * - Nível 1 é ultrabásico: foco em velocidade e prazer inicial.
 * - A dificuldade sobe em 20 degraus graduais até o limite humano (Níveis 16–20).
 */
export function getStageConfig(slug: GameSlug, effectiveLevel: number, easeBoost = false): StageConfig {
  const lvl = Math.max(1, Math.min(MAX_EXERCISE_LEVEL, effectiveLevel));
  const d = Math.max(0, lvl - 1); // d = 0 no Nível 1 .. 19 no Nível 20
  const easy = lvl < 2 && easeBoost;

  // Grade cresce ao longo dos 20 níveis: 1..3 -> 3x3 | 4..8 -> 4x4 | 9..13 -> 5x5 | 14..17 -> 6x6 | 18..20 -> 7x7
  const gridSize = lvl < 4 ? 3 : lvl < 9 ? 4 : lvl < 14 ? 5 : lvl < 18 ? 6 : 7;

  // Janela de exposição (ms): confortável no Nível 1 (2300ms) e reduz suavemente até 480ms no Nível 20
  const baseStimulus = Math.max(480, Math.round(2300 - d * 95));
  const stimulusMs = easy ? Math.round(baseStimulus * 1.15) : baseStimulus;

  // Quantidade de alvos / tamanho inicial: 1..2 -> 2 | 3..7 -> 3 | 8..13 -> 4 | 14..17 -> 5 | 18..20 -> 6
  const targetCount = lvl < 3 ? 2 : lvl < 8 ? 3 : lvl < 14 ? 4 : lvl < 18 ? 5 : 6;

  // N-Back: 1-Back (1..6), 2-Back (7..13), 3-Back (14..18), 4-Back (19..20)
  const nBackLevel = lvl < 7 ? 1 : lvl < 14 ? 2 : lvl < 19 ? 3 : 4;

  // Complexidade matemática gradual ao longo dos 20 níveis
  const mathComplexity: 1 | 2 | 3 | 4 = lvl < 5 ? 1 : lvl < 10 ? 2 : lvl < 15 ? 3 : 4;

  // Duração padronizada em 30 segundos por exercício
  const durationSec = 30;

  return {
    stage: Number(lvl.toFixed(2)),
    durationSec,
    gridSize,
    stimulusMs,
    targetCount,
    nBackLevel,
    reverseOrder: lvl >= 8,
    alternatingRule: lvl >= 7,
    mathComplexity,
    minAccuracyPct: 80,
    scoreMultiplier: Number((1 + d * 0.04).toFixed(2)),
    roundsTarget: 10,
    easeBoost: easy,
  };
}

/** Rótulo técnico curto do nível atual exibido no topo do exercício */
export function getStageShortBadge(slug: GameSlug, cfg: StageConfig): string {
  const lvl = Math.max(1, Math.floor(cfg.stage));
  if (lvl === 1) return 'Básico · Velocidade';

  switch (slug) {
    case 'visual-search':
    case 'odd-one-out':
      return `${cfg.gridSize}×${cfg.gridSize}`;
    case 'sustained-tracking':
      return `${Math.min(5, cfg.targetCount)} alvos`;
    case 'flanker-focus':
      return lvl >= 4 ? 'Alta interferência' : '5 setas';
    case 'memory-pairs':
      return lvl <= 2 ? '3 pares' : lvl <= 4 ? '4 pares' : lvl <= 7 ? '6 pares' : '8 pares';
    case 'photo-recall':
      return `${Math.min(6, cfg.targetCount + 1)} ícones`;
    case 'spatial-span':
      return cfg.reverseOrder ? `${cfg.gridSize}×${cfg.gridSize} · Inverso` : `${cfg.gridSize}×${cfg.gridSize}`;
    case 'dual-n-back':
      return `${cfg.nBackLevel}-Back`;
    case 'number-sequence':
      return lvl <= 3 ? 'Soma fixa' : lvl <= 6 ? 'Progressão' : 'Composto';
    case 'logic-intruder':
      return lvl <= 3 ? '4 opções' : '6 opções';
    case 'raven-matrices':
      return `Padrão N${lvl}`;
    case 'path-logic':
      return cfg.stage >= 5 ? '1→A→2→B' : '1→2→3';
    case 'speed-match':
      return `Ritmo N${lvl}`;
    case 'symbol-digit':
      return `${Math.min(9, 3 + Math.floor((lvl - 1) * 0.6))} símb.`;
    case 'schulte-order':
      return `${cfg.gridSize}×${cfg.gridSize}`;
    case 'flash-match':
      return `${Math.min(12, 4 + Math.floor((lvl - 1) * 1.2))} cartas`;
    case 'chain-arithmetic':
      return cfg.mathComplexity === 1 ? '+' : cfg.mathComplexity === 2 ? '+ −' : cfg.mathComplexity === 3 ? '+ − ×' : 'Composto';
    case 'number-comparison':
    case 'target-sum':
      return `Faixa N${cfg.mathComplexity}`;
    case 'missing-operator':
      return cfg.mathComplexity <= 1 ? '+ −' : '+ − × ÷';
    case 'stroop-conflict':
      return cfg.alternatingRule ? 'Alternado' : 'Cor da tinta';
    case 'go-nogo-reflex':
      return `${cfg.stimulusMs}ms`;
    case 'opposite-arrow':
      return lvl >= 4 ? '4 direções' : 'Esq / Dir';
    case 'rule-switch':
      return lvl >= 4 ? 'Alternância rápida' : '2 regras';
  }
}

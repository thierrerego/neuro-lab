import type { GameSlug, StageConfig } from '../types/cognitive';

/**
 * Motor de Dificuldade Técnica por Nível Efetivo (`effectiveDifficulty = baseStage + wave - 1`).
 * - Nível 1 começa bem acessível (3x3, 2 alvos, contas simples, janela generosa).
 * - Escala continuamente dentro da própria partida (Ondas 1 -> 5) e entre estágios permanentes.
 */
export function getStageConfig(slug: GameSlug, effectiveLevel: number, easeBoost = false): StageConfig {
  const s = Math.max(1, Math.floor(effectiveLevel));
  const easy = s === 1 && easeBoost;

  // Grade: 1-2 -> 3x3, 3-4 -> 4x4, 5-6 -> 5x5, 7+ -> 6x6
  const gridSize = s <= 2 ? 3 : s <= 4 ? 4 : s <= 6 ? 5 : 6;

  // Janela de exposição (ms): começa confortável (1800ms / 2200ms em modo leve) e acelera forte
  const baseStimulus = Math.max(520, Math.round(1800 - (s - 1) * 185));
  const stimulusMs = easy ? Math.round(baseStimulus * 1.22) : baseStimulus;

  // Quantidade de alvos (MOT / Varredura / Sequência)
  const targetCount = easy ? 2 : Math.min(6, s <= 1 ? 2 : s <= 3 ? 3 : s <= 5 ? 4 : 5);

  // N-Back: 1-Back (níveis 1-3), 2-Back (níveis 4-6), 3-Back (níveis 7+)
  const nBackLevel = s <= 3 ? 1 : s <= 6 ? 2 : 3;

  // Complexidade matemática: 1 (+ simples), 2 (+ / -), 3 (× e × -), 4 (composto)
  const mathComplexity: 1 | 2 | 3 | 4 = s === 1 ? 1 : s <= 3 ? 2 : s <= 5 ? 3 : 4;

  // Tempo limite da partida (30s a 45s conforme o minigame; 45s para jogos com fase de observação)
  const durationBySlug: Record<GameSlug, number> = {
    'visual-search': 35,
    'sustained-tracking': 45,
    'spatial-span': 45,
    'dual-n-back': 42,
    'raven-matrices': 45,
    'path-logic': 40,
    'speed-match': 32,
    'symbol-digit': 35,
    'chain-arithmetic': 40,
    'number-comparison': 35,
    'stroop-conflict': 35,
    'go-nogo-reflex': 38,
  };

  return {
    stage: s,
    durationSec: durationBySlug[slug] ?? 35,
    gridSize,
    stimulusMs,
    targetCount,
    nBackLevel,
    reverseOrder: s >= 4,
    alternatingRule: s >= 3,
    mathComplexity,
    minAccuracyPct: 80,
    scoreMultiplier: Number((1 + (s - 1) * 0.08).toFixed(2)),
    roundsTarget: 16,
    easeBoost: easy,
  };
}

/** Rótulo curtíssimo da dificuldade técnica da onda atual */
export function getStageShortBadge(slug: GameSlug, cfg: StageConfig): string {
  if (cfg.easeBoost) return 'Ritmo leve';
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
      return `Nível ${cfg.stage}`;
    case 'path-logic':
      return cfg.stage >= 2 ? '1→A→2→B' : '1→2→3';
    case 'speed-match':
      return `Nível ${cfg.stage}`;
    case 'symbol-digit':
      return `${Math.min(9, 3 + cfg.stage)} símb.`;
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

import type { GameSlug, StageConfig } from '../types/cognitive';

/**
 * Motor de Fases Adaptativo (Stage Engine)
 * - Todo jogo começa fácil na Fase 1 para qualquer jogador entrar no ritmo.
 * - Escala rapidamente (grade, exposição em ms, complexidade) quando o motor sobe fases (+1/+2/+3).
 * - Se o jogador tiver dificuldade na Fase 1, `easeBoost` alivia automaticamente a próxima partida.
 */
export function getStageConfig(slug: GameSlug, stage: number, easeBoost = false): StageConfig {
  const s = Math.max(1, Math.floor(stage));
  const easy = s === 1 && easeBoost;

  // Grade cresce: Fase 1 -> 3x3, Fase 2-3 -> 4x4, Fase 4-5 -> 5x5, Fase 6+ -> 6x6
  const gridSize = s === 1 ? 3 : s <= 3 ? 4 : s <= 5 ? 5 : 6;

  // Fase 1 começa bem confortável (1800ms; 2250ms em easeBoost) e acelera forte com as fases
  const baseStimulus = Math.max(540, Math.round(1800 - (s - 1) * 210));
  const stimulusMs = easy ? Math.round(baseStimulus * 1.25) : baseStimulus;

  // Quantidade de alvos / tamanho inicial de sequência (começa com 2 na Fase 1!)
  const targetCount = easy ? 2 : Math.min(7, s === 1 ? 2 : 2 + Math.floor(s / 2));

  // N-Back: 1-Back (fases 1-2), 2-Back (fases 3-4), 3-Back (fases 5+)
  const nBackLevel = s <= 2 ? 1 : s <= 4 ? 2 : 3;

  // Complexidade numérica (Fase 1 bem leve, escala rápido a partir da Fase 3)
  const mathComplexity: 1 | 2 | 3 | 4 = s === 1 ? 1 : s === 2 ? 2 : s <= 4 ? 3 : 4;

  // Duração padrão entre 30s e 45s
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

  // Rodadas para jogos por turno
  const roundsTarget =
    slug === 'sustained-tracking'
      ? easy ? 3 : Math.min(6, 3 + Math.floor(s / 2))
      : slug === 'spatial-span'
        ? easy ? 3 : Math.min(6, 3 + Math.floor(s / 2))
        : slug === 'raven-matrices'
          ? easy ? 4 : Math.min(8, 5 + Math.floor(s / 2))
          : slug === 'dual-n-back'
            ? easy ? 10 : Math.min(20, 12 + s * 2)
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
    easeBoost: easy,
  };
}

/** Rótulo curtíssimo da dificuldade técnica da fase */
export function getStageShortBadge(slug: GameSlug, cfg: StageConfig): string {
  if (cfg.easeBoost) return 'Ritmo leve';
  switch (slug) {
    case 'visual-search':
      return `${cfg.gridSize}×${cfg.gridSize} · ${cfg.targetCount} alvos`;
    case 'sustained-tracking':
      return `${Math.min(5, cfg.targetCount)} alvos`;
    case 'spatial-span':
      return cfg.reverseOrder ? `${cfg.gridSize}×${cfg.gridSize} · Inverso` : `${cfg.gridSize}×${cfg.gridSize}`;
    case 'dual-n-back':
      return `${cfg.nBackLevel}-Back`;
    case 'raven-matrices':
      return `${cfg.roundsTarget} matrizes`;
    case 'path-logic':
      return cfg.stage >= 2 ? '1→A→2→B' : '1→2→3';
    case 'speed-match':
      return `×${cfg.scoreMultiplier}`;
    case 'symbol-digit':
      return `${Math.min(9, 3 + cfg.stage)} símbolos`;
    case 'chain-arithmetic':
      return cfg.mathComplexity === 1 ? '+' : cfg.mathComplexity === 2 ? '+ −' : cfg.mathComplexity === 3 ? '+ − ×' : 'Composto';
    case 'number-comparison':
      return `Nível ${cfg.mathComplexity}`;
    case 'stroop-conflict':
      return cfg.alternatingRule ? 'Alternado' : 'Cor da tinta';
    case 'go-nogo-reflex':
      return `${cfg.stimulusMs}ms`;
  }
}

import type { GameSlug, StageConfig } from '../types/cognitive';

export const MAX_EXERCISE_LEVEL = 30;

export const MEMORY_GAMES_60S: GameSlug[] = [
  'photo-recall',
  'spatial-span',
  'dual-n-back',
  'reverse-digits',
  'pass-the-ball',
  'shopping-list',
  'phone-number',
  'secret-code',
];

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
  // Fases 21–30 ("além do limite"): cada fase extra acelera os estímulos e aumenta os itens
  const extra = Math.max(0, Math.floor(lvl) - 20);

  const gridSize = lvl < 4 ? 3 : lvl < 9 ? 4 : lvl < 14 ? 5 : lvl < 18 ? 6 : lvl < 26 ? 7 : 8;

  // Janela de exposição (ms): 2400ms no Nível 1 → 360ms no Nível 20 → 240ms no Nível 30
  const baseStimulus =
    extra > 0 ? Math.max(240, 360 - extra * 12) : Math.max(360, Math.round(2400 - d * 107));
  const stimulusMs = easy ? Math.round(baseStimulus * 1.15) : baseStimulus;

  // Quantidade de alvos: 1..2 -> 2 | 3..7 -> 3 | 8..13 -> 4 | 14..17 -> 5 | 18..22 -> 6 | 23..26 -> 7 | 27..30 -> 8
  const targetCount = lvl < 3 ? 2 : lvl < 8 ? 3 : lvl < 14 ? 4 : lvl < 18 ? 5 : lvl < 23 ? 6 : lvl < 27 ? 7 : 8;

  // N-Back: 1-Back (1..6), 2-Back (7..13), 3-Back (14..18), 4-Back (19..24), 5-Back (25..30)
  const nBackLevel = lvl < 7 ? 1 : lvl < 14 ? 2 : lvl < 19 ? 3 : lvl < 25 ? 4 : 5;

  // Complexidade matemática gradual ao longo dos 20 níveis
  const mathComplexity: 1 | 2 | 3 | 4 = lvl < 5 ? 1 : lvl < 10 ? 2 : lvl < 15 ? 3 : 4;

  // Duração padronizada em 30 segundos por exercício
  // Jogos de memória precisam de tempo para memorizar e lembrar: 60s. Os demais seguem com 30s.
  const durationSec = MEMORY_GAMES_60S.includes(slug) ? 60 : 30;

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
    case 'conjunction-search':
      return `${cfg.gridSize}×${cfg.gridSize} · Forma+Cor`;
    case 'reverse-digits':
      return `${lvl <= 2 ? 2 : lvl <= 6 ? 3 : lvl <= 10 ? 4 : lvl <= 14 ? 5 : lvl <= 17 ? 6 : lvl <= 19 ? 7 : 8} dígitos`;
    case 'logic-balance':
      return lvl <= 3 ? '1 equação' : lvl <= 8 ? '2 equações' : '3 símbolos';
    case 'pass-the-ball':
      return lvl <= 2 ? '3×3' : lvl <= 5 ? '4×4' : lvl <= 10 ? '5×5' : '6×6';
    case 'shopping-list':
      return `${lvl <= 2 ? 3 : lvl <= 5 ? 4 : lvl <= 9 ? 5 : lvl <= 13 ? 6 : lvl <= 17 ? 7 : 8} itens`;
    case 'phone-number':
      return `${lvl <= 2 ? 4 : lvl <= 4 ? 5 : lvl <= 7 ? 6 : lvl <= 10 ? 8 : lvl <= 14 ? 9 : 11} dígitos`;
    case 'secret-code':
      return `${lvl <= 2 ? 3 : lvl <= 5 ? 4 : lvl <= 9 ? 5 : lvl <= 14 ? 6 : 7} números`;
    case 'crime-scene':
      return lvl <= 3 ? '1 item sem par' : lvl <= 9 ? '2 itens sem par' : '3 itens sem par';
    case 'treasure-hunt':
      return lvl <= 3 ? '3 cores' : '4 cores';
    case 'missing-number':
      return `1..${lvl <= 2 ? 6 : lvl <= 5 ? 8 : lvl <= 9 ? 10 : 12}`;
    case 'fan-count':
      return `${lvl <= 2 ? 9 : lvl <= 5 ? 12 : lvl <= 10 ? 16 : 20} fãs`;
    case 'secret-anagrams':
      return lvl <= 4 ? '4–5 letras' : lvl <= 10 ? '6 letras' : '7+ letras';
    case 'sort-trash':
      return `${lvl <= 3 ? 2 : lvl <= 7 ? 3 : 4} lixeiras`;
    case 'complex-patterns':
      return lvl <= 6 ? '3×3 · Rotação' : '4×4 · Rotação';
    case 'whack-target':
      return lvl <= 5 ? '3×3 · Relâmpago' : '4×4 · Relâmpago';
    case 'parity-dash':
      return lvl <= 7 ? 'Números' : 'Contas rápidas';
    case 'word-radar':
      return `${lvl <= 2 ? 4 : lvl <= 6 ? 6 : 9} palavras`;
    case 'color-sort':
      return lvl >= 6 ? '4 cores móveis' : '4 cores';
    case 'math-verdict':
      return lvl <= 7 ? '+ −' : '+ − ×';
    case 'exact-change':
      return lvl <= 3 ? 'Até R$20' : lvl <= 7 ? 'Até R$50' : 'Até R$200';
    case 'double-half':
      return lvl >= 8 ? '×2 · ÷2 · ×3' : '×2 · ÷2';
    case 'bomb-defuse':
      return '3 pistas';
    case 'simon-says':
      return 'Mestre Mandou';
    case 'mirror-words':
      return lvl >= 7 ? 'Palavra + Seta' : 'Efeito Simon';
  }
}

import type { GameSlug, StageConfig, WaveState } from '../types/cognitive';
import { getStageConfig } from './stageEngine';

/** Meta padrão de referência (mantida para compatibilidade) */
export const TOTAL_WAVES = 5;
export const TOTAL_WAVE_HITS = 10;

/**
 * Meta de acertos/etapas calibrada com testes reais para cada exercício durar ~20–30 segundos:
 * - Etapas longas (spatial-span por sequência completa): 4 etapas
 * - Cadenciados (rastreamento, matrizes, soma alvo, sequências, foto): 6
 * - Médios (memória, n-back, cálculos): 8
 * - Ágeis (busca visual, stroop, regras, símbolos): 10–12
 * - Rápidos / reflexo (go/no-go, schulte, path-logic, setas, comparação): 14–16
 */
export function getTargetHitsForGame(slug?: GameSlug): number {
  switch (slug) {
    case 'spatial-span':
      return 4;
    case 'sustained-tracking':
    case 'raven-matrices':
    case 'photo-recall':
    case 'target-sum':
    case 'number-sequence':
      return 6;
    case 'dual-n-back':
    case 'memory-pairs':
    case 'chain-arithmetic':
    case 'missing-operator':
    case 'number-comparison':
      return 8;
    case 'visual-search':
    case 'odd-one-out':
    case 'flash-match':
    case 'symbol-digit':
    case 'rule-switch':
    case 'stroop-conflict':
      return 10;
    case 'logic-intruder':
      return 12;
    case 'opposite-arrow':
    case 'speed-match':
    case 'flanker-focus':
      return 14;
    case 'go-nogo-reflex':
    case 'path-logic':
    case 'schulte-order':
      return 16;
    default:
      return 10;
  }
}

/** Rampa de dificuldade intra-sessão bem suave (+0.4 do início ao fim para manter Flow) */
function calcContinuousDiff(baseStage: number, totalHits: number, targetHits: number): number {
  const safeBase = Math.max(1, baseStage);
  const ratio = Math.min(1, Math.max(0, totalHits) / Math.max(1, targetHits));
  return Number((safeBase + ratio * 0.4).toFixed(2));
}

function hitsToCompletedQuintiles(totalHits: number, targetHits: number, isCleared: boolean): number {
  if (isCleared || totalHits >= targetHits) return TOTAL_WAVES;
  return Math.min(TOTAL_WAVES - 1, Math.floor((totalHits / Math.max(1, targetHits)) * TOTAL_WAVES));
}

/** Inicializa o progresso contínuo da sessão (~30s) a partir do nível base (piso = Nível 1) */
export function createWaveState(baseStage: number, slug?: GameSlug): WaveState {
  const safeBase = Math.max(1, Math.floor(baseStage));
  const targetHits = getTargetHitsForGame(slug);
  return {
    baseStage: safeBase,
    currentWave: 1,
    waveHits: 0,
    waveQuota: targetHits,
    wavesCompleted: 0,
    totalHits: 0,
    totalTargetHits: targetHits,
    effectiveDifficulty: calcContinuousDiff(safeBase, 0, targetHits),
    isCleared: false,
  };
}

/**
 * Registra 1 acerto de forma 100% contínua (0 -> targetHits), sem pausas nem divisões em blocos.
 */
export function advanceWaveHit(state: WaveState): {
  next: WaveState;
  waveJustCleared: boolean;
  matchCleared: boolean;
  clearedWaveNum: number;
} {
  const targetHits = Math.max(1, state.totalTargetHits || TOTAL_WAVE_HITS);
  if (state.isCleared) {
    return { next: state, waveJustCleared: false, matchCleared: true, clearedWaveNum: TOTAL_WAVES };
  }

  const nextTotalHits = Math.min(targetHits, state.totalHits + 1);
  const matchCleared = nextTotalHits >= targetHits;
  const completedQ = hitsToCompletedQuintiles(nextTotalHits, targetHits, matchCleared);

  return {
    next: {
      ...state,
      currentWave: Math.min(TOTAL_WAVES, completedQ + 1),
      waveHits: nextTotalHits,
      waveQuota: targetHits,
      wavesCompleted: completedQ,
      totalHits: nextTotalHits,
      totalTargetHits: targetHits,
      effectiveDifficulty: calcContinuousDiff(state.baseStage, nextTotalHits, targetHits),
      isCleared: matchCleared,
    },
    waveJustCleared: false,
    matchCleared,
    clearedWaveNum: matchCleared ? TOTAL_WAVES : 0,
  };
}

export function regressWaveError(state: WaveState): {
  next: WaveState;
  regressed: boolean;
  fromWave: number;
  toWave: number;
} {
  return {
    next: state,
    regressed: false,
    fromWave: state.currentWave,
    toWave: state.currentWave,
  };
}

export function getWaveEffectiveConfig(
  slug: GameSlug,
  wave: WaveState,
  easeBoost = false
): StageConfig {
  const baseDuration = getStageConfig(slug, wave.baseStage, easeBoost).durationSec;
  const cfg = getStageConfig(slug, wave.effectiveDifficulty, easeBoost && wave.totalHits < 3);
  return {
    ...cfg,
    durationSec: baseDuration,
    roundsTarget: wave.totalTargetHits,
  };
}

export function getWaveBarPct(wave: WaveState): number {
  if (wave.isCleared) return 100;
  return Math.min(100, Math.round((wave.totalHits / Math.max(1, wave.totalTargetHits)) * 100));
}

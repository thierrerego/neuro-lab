import type { GameSlug, StageConfig, WaveState } from '../types/cognitive';
import { getStageConfig } from './stageEngine';
import {
  createAdaptiveStaircase,
  stepAdaptiveError,
  stepAdaptiveHit,
} from './adaptiveEngine';

/** Meta padrão de referência (mantida para compatibilidade) */
export const TOTAL_WAVES = 5;
export const TOTAL_WAVE_HITS = 10;

/** Teste inicial adaptativo: para quando a dificuldade virar 6 vezes (achou o nível) ou após 40 jogadas */
export const CALIBRATION_REVERSALS = 6;
export const CALIBRATION_MAX_TRIALS = 40;

function calibrationDone(reversals: number, trials: number): boolean {
  return reversals >= CALIBRATION_REVERSALS || trials >= CALIBRATION_MAX_TRIALS;
}

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
    case 'schulte-order':
    case 'path-logic':
      return 3;
    case 'spatial-span':
    case 'sustained-tracking':
    case 'reverse-digits':
    case 'pass-the-ball':
    case 'shopping-list':
    case 'phone-number':
    case 'secret-code':
      return 4;
    case 'visual-search':
    case 'conjunction-search':
      return 5;
    case 'raven-matrices':
    case 'photo-recall':
    case 'target-sum':
    case 'number-sequence':
    case 'logic-balance':
    case 'crime-scene':
    case 'fan-count':
    case 'secret-anagrams':
      return 6;
    case 'dual-n-back':
    case 'memory-pairs':
    case 'chain-arithmetic':
    case 'missing-operator':
    case 'number-comparison':
    case 'treasure-hunt':
    case 'missing-number':
    case 'complex-patterns':
    case 'exact-change':
    case 'double-half':
      return 8;
    case 'odd-one-out':
    case 'flash-match':
    case 'symbol-digit':
    case 'rule-switch':
    case 'stroop-conflict':
    case 'word-radar':
    case 'math-verdict':
    case 'simon-says':
      return 10;
    case 'logic-intruder':
    case 'sort-trash':
    case 'whack-target':
    case 'bomb-defuse':
      return 12;
    case 'opposite-arrow':
    case 'speed-match':
    case 'flanker-focus':
    case 'parity-dash':
    case 'color-sort':
    case 'mirror-words':
      return 14;
    case 'go-nogo-reflex':
      return 16;
    default:
      return 10;
  }
}

/** Rampa de dificuldade intra-sessão bem suave (+0.4 do início ao fim para manter Flow) */
function calcContinuousDiff(baseStage: number, totalHits: number, targetHits: number): number {
  const safeBase = Math.max(1, baseStage);
  const ratio = Math.min(1, Math.max(0, totalHits) / Math.max(1, targetHits));
  // Sem rampa: a fase fica igual do começo ao fim da partida
  void ratio;
  return Number(safeBase.toFixed(2));
}

function hitsToCompletedQuintiles(totalHits: number, targetHits: number, isCleared: boolean): number {
  if (isCleared || totalHits >= targetHits) return TOTAL_WAVES;
  return Math.min(TOTAL_WAVES - 1, Math.floor((totalHits / Math.max(1, targetHits)) * TOTAL_WAVES));
}

export interface WaveTuningOverride {
  effectiveLevel?: number;
  speedScale?: number;
  targetHits?: number;
}

/** Inicializa o progresso contínuo da sessão (~30s) a partir do nível base (piso = Nível 1) */
export function createWaveState(
  baseStage: number,
  slug?: GameSlug,
  tuning?: WaveTuningOverride,
  opts?: { calibration?: boolean }
): WaveState {
  const safeBase = Math.max(1, Number(baseStage) || 1);
  // Partidas normais: dificuldade FIXA (só muda de uma partida para a outra).
  // Teste inicial: dificuldade adaptativa (sobe com acertos, cai com erros) até estabilizar.
  const isCalibration = Boolean(opts?.calibration) && tuning?.effectiveLevel === undefined;
  const locked = !isCalibration;
  const effectiveBase =
    tuning?.effectiveLevel !== undefined
      ? Math.max(1, Math.min(20, Number(tuning.effectiveLevel)))
      : safeBase;
  const targetHits =
    tuning?.targetHits !== undefined
      ? Math.max(2, Math.min(25, Math.round(tuning.targetHits)))
      : getTargetHitsForGame(slug);
  const staircase = createAdaptiveStaircase(effectiveBase);
  return {
    baseStage: effectiveBase,
    currentWave: 1,
    waveHits: 0,
    waveQuota: targetHits,
    wavesCompleted: 0,
    totalHits: 0,
    totalTargetHits: targetHits,
    calibrationRun: isCalibration,
    trials: 0,
    stepTargetHits: targetHits,
    effectiveDifficulty: locked
      ? calcContinuousDiff(effectiveBase, 0, targetHits)
      : staircase.currentLoad,
    isCleared: false,
    adaptiveLocked: locked,
    adaptiveStreak: staircase.streakHits,
    adaptiveReversals: staircase.reversals,
    adaptiveDirection: staircase.lastDirection,
    difficultyTrail: staircase.trail,
  };
}

/**
 * Registra 1 acerto de forma 100% contínua (0 -> targetHits),
 * ajustando a dificuldade dinamicamente pela escada adaptativa (CAT 2-up/1-down).
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

  // Teste inicial: escada adaptativa sem meta de acertos; termina quando estabiliza
  if (state.calibrationRun) {
    const stair = stepAdaptiveHit(
      {
        currentLoad: state.effectiveDifficulty,
        streakHits: state.adaptiveStreak ?? 0,
        reversals: state.adaptiveReversals ?? 0,
        lastDirection: state.adaptiveDirection ?? null,
        trail: state.difficultyTrail ?? [state.effectiveDifficulty],
      },
      state.stepTargetHits ?? targetHits
    );
    const trials = (state.trials ?? 0) + 1;
    const done = calibrationDone(stair.reversals, trials);
    return {
      next: {
        ...state,
        totalHits: state.totalHits + 1,
        waveHits: state.totalHits + 1,
        wavesCompleted: done ? TOTAL_WAVES : state.wavesCompleted,
        effectiveDifficulty: stair.currentLoad,
        adaptiveStreak: stair.streakHits,
        adaptiveReversals: stair.reversals,
        adaptiveDirection: stair.lastDirection,
        difficultyTrail: stair.trail,
        trials,
        isCleared: done,
      },
      waveJustCleared: false,
      matchCleared: done,
      clearedWaveNum: done ? TOTAL_WAVES : 0,
    };
  }

  const nextTotalHits = Math.min(targetHits, state.totalHits + 1);
  const matchCleared = nextTotalHits >= targetHits;
  const completedQ = hitsToCompletedQuintiles(nextTotalHits, targetHits, matchCleared);

  if (state.adaptiveLocked) {
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

  const nextStair = stepAdaptiveHit(
    {
      currentLoad: state.effectiveDifficulty,
      streakHits: state.adaptiveStreak ?? 0,
      reversals: state.adaptiveReversals ?? 0,
      lastDirection: state.adaptiveDirection ?? null,
      trail: state.difficultyTrail ?? [state.effectiveDifficulty],
    },
    targetHits
  );

  return {
    next: {
      ...state,
      currentWave: Math.min(TOTAL_WAVES, completedQ + 1),
      waveHits: nextTotalHits,
      waveQuota: targetHits,
      wavesCompleted: completedQ,
      totalHits: nextTotalHits,
      totalTargetHits: targetHits,
      effectiveDifficulty: nextStair.currentLoad,
      isCleared: matchCleared,
      adaptiveStreak: nextStair.streakHits,
      adaptiveReversals: nextStair.reversals,
      adaptiveDirection: nextStair.lastDirection,
      difficultyTrail: nextStair.trail,
    },
    waveJustCleared: false,
    matchCleared,
    clearedWaveNum: matchCleared ? TOTAL_WAVES : 0,
  };
}

/**
 * Registra 1 erro: no modo adaptativo contínuo, alivia suavemente a dificuldade
 * para convergir no ponto de equilíbrio real do usuário (~78% de acerto).
 */
export function regressWaveError(state: WaveState): {
  next: WaveState;
  regressed: boolean;
  fromWave: number;
  toWave: number;
} {
  if (state.adaptiveLocked || state.isCleared) {
    return {
      next: state,
      regressed: false,
      fromWave: state.currentWave,
      toWave: state.currentWave,
    };
  }

  const nextStair = stepAdaptiveError({
    currentLoad: state.effectiveDifficulty,
    streakHits: state.adaptiveStreak ?? 0,
    reversals: state.adaptiveReversals ?? 0,
    lastDirection: state.adaptiveDirection ?? null,
    trail: state.difficultyTrail ?? [state.effectiveDifficulty],
  });

  const trials = (state.trials ?? 0) + (state.calibrationRun ? 1 : 0);
  const calDone = Boolean(state.calibrationRun) && calibrationDone(nextStair.reversals, trials);

  return {
    next: {
      ...state,
      effectiveDifficulty: nextStair.currentLoad,
      adaptiveStreak: nextStair.streakHits,
      adaptiveReversals: nextStair.reversals,
      adaptiveDirection: nextStair.lastDirection,
      difficultyTrail: nextStair.trail,
      trials,
      isCleared: calDone ? true : state.isCleared,
      wavesCompleted: calDone ? TOTAL_WAVES : state.wavesCompleted,
    },
    regressed: nextStair.currentLoad < state.effectiveDifficulty,
    fromWave: state.currentWave,
    toWave: state.currentWave,
  };
}

export function getWaveEffectiveConfig(
  slug: GameSlug,
  wave: WaveState,
  easeBoost = false,
  tuning?: WaveTuningOverride
): StageConfig {
  const baseDuration = getStageConfig(slug, wave.baseStage, easeBoost).durationSec;
  const cfg = getStageConfig(slug, wave.effectiveDifficulty, easeBoost && wave.totalHits < 3);
  const speedScale = tuning?.speedScale ?? 1;
  const stimulusMs =
    Math.abs(speedScale - 1) > 0.001
      ? Math.max(250, Math.min(4500, Math.round(cfg.stimulusMs / speedScale)))
      : cfg.stimulusMs;
  return {
    ...cfg,
    stimulusMs,
    durationSec: baseDuration,
    roundsTarget: wave.totalTargetHits,
  };
}

export function getWaveBarPct(wave: WaveState): number {
  if (wave.isCleared) return 100;
  if (wave.calibrationRun) {
    const byRev = (wave.adaptiveReversals ?? 0) / CALIBRATION_REVERSALS;
    const byTrials = (wave.trials ?? 0) / CALIBRATION_MAX_TRIALS;
    return Math.min(99, Math.round(Math.max(byRev, byTrials) * 100));
  }
  return Math.min(100, Math.round((wave.totalHits / Math.max(1, wave.totalTargetHits)) * 100));
}

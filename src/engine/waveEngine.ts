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

/**
 * TESTE INICIAL (busca rápida do nível real):
 * 1) Subida: a cada jogada boa (acertou e rápido) o nível DOBRA: 1 → 2 → 4 → 8 → 16 → 30.
 * 2) Na 1ª trava (errou, ou demorou mais que o dobro do seu ritmo inicial, ou passou do limite
 *    fixo do jogo) começa a busca no meio entre o último nível vencido e o que travou.
 * 3) Nunca desce abaixo do último nível em que a pessoa acertou.
 * 4) Termina quando a distância entre "vencido" e "travou" for de 1 nível (ou no limite de 1 min).
 */
export const CALIBRATION_MAX_LEVEL = 30;
export const CALIBRATION_DURATION_SEC = 60;
/** Quantas jogadas boas formam o "seu ritmo" do início */
const CAL_BASELINE_ITEMS = 3;
/** Demorou mais que isto × o seu ritmo do início = travou */
const CAL_SLOW_FACTOR = 2;

export function calibrationAnswer(
  state: WaveState,
  correct: boolean,
  itemMs: number
): { next: WaveState; waveJustCleared: boolean; matchCleared: boolean; clearedWaveNum: number } {
  const level = Math.max(1, Math.round(state.effectiveDifficulty));
  const fast = state.calFastTimes ?? [];
  const baseline =
    fast.length >= CAL_BASELINE_ITEMS
      ? [...fast].sort((a, b) => a - b)[Math.floor(fast.length / 2)]
      : 0;
  const overFixed = state.calItemLimitMs ? itemMs > state.calItemLimitMs : false;
  const overRhythm = baseline > 0 && itemMs > baseline * CAL_SLOW_FACTOR;
  const success = correct && !(itemMs > 0 && (overFixed || overRhythm));

  const nextFast =
    correct && !overFixed && itemMs > 0 && fast.length < CAL_BASELINE_ITEMS ? [...fast, itemMs] : fast;

  let low = state.calLow ?? 0;
  let high = state.calHigh ?? null;
  let highFails = state.calHighFails ?? 0;
  const hadFail = Boolean(state.calHadFail) || !success;
  let nextLevel: number;

  if (success) {
    low = Math.max(low, level);
    if (high !== null && low >= high) {
      // Venceu o nível onde tinha travado (foi azar): reabre a busca acima
      high = null;
      highFails = 0;
    }
    nextLevel =
      high === null
        ? // Antes da 1ª trava: dobra. Depois: sobe de 2 em 2 (já está perto do limite)
          Math.min(CALIBRATION_MAX_LEVEL, state.calHadFail ? level + 2 : level * 2)
        : Math.floor((low + high) / 2);
  } else {
    if (high === null || level < high) {
      high = level;
      highFails = 1;
    } else if (level === high) {
      highFails += 1;
    }
    if (high <= low) high = low + 1;
    nextLevel = Math.floor((Math.max(1, low) + high) / 2);
  }
  // Trava confirmada = 2 erros/demoras no mesmo nível. Se só travou 1 vez, testa de novo.
  if (high !== null && high - low <= 1 && highFails < 2 && low >= 1) nextLevel = high;
  // Nunca abaixo do último nível vencido
  nextLevel = Math.max(Math.max(1, low), Math.min(CALIBRATION_MAX_LEVEL, nextLevel));
  if (low >= CALIBRATION_MAX_LEVEL) {
    high = CALIBRATION_MAX_LEVEL + 1;
    highFails = 2;
  }

  const done = low >= 1 && high !== null && high - low <= 1 && highFails >= 2;
  const trials = (state.trials ?? 0) + 1;
  const trail = [...(state.difficultyTrail ?? []), nextLevel];

  return {
    next: {
      ...state,
      totalHits: state.totalHits + (correct ? 1 : 0),
      waveHits: state.totalHits + (correct ? 1 : 0),
      wavesCompleted: done ? TOTAL_WAVES : state.wavesCompleted,
      effectiveDifficulty: nextLevel,
      difficultyTrail: trail,
      calLow: low,
      calHigh: high,
      calHighFails: highFails,
      calHadFail: hadFail,
      calFastTimes: nextFast,
      trials,
      isCleared: done,
    },
    waveJustCleared: false,
    matchCleared: done && correct,
    clearedWaveNum: done ? TOTAL_WAVES : 0,
  };
}

/** Nível encontrado pelo teste inicial (o maior nível vencido) */
export function getCalibrationFoundLevel(wave: WaveState): number {
  return Math.max(1, wave.calLow ?? 1);
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
  opts?: { calibration?: boolean; itemLimitMs?: number }
): WaveState {
  const safeBase = Math.max(1, Number(baseStage) || 1);
  // Partidas normais: dificuldade FIXA (só muda de uma partida para a outra).
  // Teste inicial: dificuldade adaptativa (sobe com acertos, cai com erros) até estabilizar.
  const isCalibration = Boolean(opts?.calibration) && tuning?.effectiveLevel === undefined;
  const locked = !isCalibration;
  const effectiveBase =
    tuning?.effectiveLevel !== undefined
      ? Math.max(1, Math.min(30, Number(tuning.effectiveLevel)))
      : safeBase;
  // Fases 21–30: a meta de acertos cresce ~5% por fase (até +50% na fase 30) no mesmo tempo
  const extraLevels = Math.max(0, Math.floor(effectiveBase) - 20);
  const targetHits =
    tuning?.targetHits !== undefined
      ? Math.max(2, Math.min(25, Math.round(tuning.targetHits)))
      : Math.round(getTargetHitsForGame(slug) * (1 + 0.05 * extraLevels));
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
    calLow: 0,
    calHigh: null,
    calFastTimes: [],
    calItemLimitMs: isCalibration ? opts?.itemLimitMs : undefined,
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
export function advanceWaveHit(state: WaveState, itemMs = 0): {
  next: WaveState;
  waveJustCleared: boolean;
  matchCleared: boolean;
  clearedWaveNum: number;
} {
  const targetHits = Math.max(1, state.totalTargetHits || TOTAL_WAVE_HITS);
  if (state.isCleared) {
    return { next: state, waveJustCleared: false, matchCleared: true, clearedWaveNum: TOTAL_WAVES };
  }

  // Teste inicial: dobra o nível até travar, depois busca no meio
  if (state.calibrationRun) return calibrationAnswer(state, true, itemMs);

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
export function regressWaveError(state: WaveState, itemMs = 0): {
  next: WaveState;
  regressed: boolean;
  fromWave: number;
  toWave: number;
} {
  if (state.calibrationRun && !state.isCleared) {
    const r = calibrationAnswer(state, false, itemMs);
    return {
      next: r.next,
      regressed: r.next.effectiveDifficulty < state.effectiveDifficulty,
      fromWave: state.currentWave,
      toWave: state.currentWave,
    };
  }
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

  return {
    next: {
      ...state,
      effectiveDifficulty: nextStair.currentLoad,
      adaptiveStreak: nextStair.streakHits,
      adaptiveReversals: nextStair.reversals,
      adaptiveDirection: nextStair.lastDirection,
      difficultyTrail: nextStair.trail,
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
    // Progresso do teste = quão perto "vencido" e "travou" estão (subida conta até a 1ª trava)
    const low = wave.calLow ?? 0;
    const high = wave.calHigh;
    if (high === null || high === undefined) return Math.min(50, Math.round((Math.log2(Math.max(1, low) + 1) / 5) * 50));
    const gap = Math.max(1, high - low);
    return Math.min(99, Math.round(50 + (50 * (1 - Math.log2(gap) / 4))));
  }
  return Math.min(100, Math.round((wave.totalHits / Math.max(1, wave.totalTargetHits)) * 100));
}

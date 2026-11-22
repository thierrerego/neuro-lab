import type { GameSlug, StageConfig, WaveState } from '../types/cognitive';
import { getStageConfig } from './stageEngine';

/** Cotas oficiais das 5 ondas por partida: 2 + 3 + 3 + 4 + 4 = 16 acertos */
export const WAVE_QUOTAS = [2, 3, 3, 4, 4] as const;
export const TOTAL_WAVES = WAVE_QUOTAS.length;
export const TOTAL_WAVE_HITS = WAVE_QUOTAS.reduce((a, b) => a + b, 0); // 16

/** Incremento sutil por onda dentro da mesma partida (+0.25 por micro-nível) */
const INTRA_WAVE_STEP = 0.25;

function calcEffectiveDiff(baseStage: number, waveNum: number): number {
  return Number((Math.max(0, baseStage) + Math.max(0, waveNum - 1) * INTRA_WAVE_STEP).toFixed(2));
}

/** Inicializa o estado da sessão progressiva a partir do baseStage permanente (piso 0 = Nível Zero) */
export function createWaveState(baseStage: number): WaveState {
  const safeBase = Math.max(0, Math.floor(baseStage));
  return {
    baseStage: safeBase,
    currentWave: 1,
    waveHits: 0,
    waveQuota: WAVE_QUOTAS[0],
    wavesCompleted: 0,
    totalHits: 0,
    totalTargetHits: TOTAL_WAVE_HITS,
    effectiveDifficulty: calcEffectiveDiff(safeBase, 1),
    isCleared: false,
  };
}

/**
 * Registra 1 acerto/estímulo concluído e avança suavemente os micro-níveis (Ondas 1 -> 5).
 * Ao completar a Onda 5, sinaliza `matchCleared = true` para conclusão antecipada.
 */
export function advanceWaveHit(state: WaveState): {
  next: WaveState;
  waveJustCleared: boolean;
  matchCleared: boolean;
  clearedWaveNum: number;
} {
  if (state.isCleared) {
    return { next: state, waveJustCleared: false, matchCleared: true, clearedWaveNum: TOTAL_WAVES };
  }

  const nextTotalHits = Math.min(TOTAL_WAVE_HITS, state.totalHits + 1);
  const nextWaveHits = state.waveHits + 1;

  if (nextWaveHits >= state.waveQuota) {
    const clearedWaveNum = state.currentWave;
    const matchCleared = clearedWaveNum >= TOTAL_WAVES;
    const nextWave = matchCleared ? TOTAL_WAVES : clearedWaveNum + 1;
    const nextQuota = WAVE_QUOTAS[nextWave - 1];

    return {
      next: {
        ...state,
        currentWave: nextWave,
        waveHits: matchCleared ? nextQuota : 0,
        waveQuota: nextQuota,
        wavesCompleted: matchCleared ? TOTAL_WAVES : Math.max(state.wavesCompleted, clearedWaveNum),
        totalHits: nextTotalHits,
        effectiveDifficulty: calcEffectiveDiff(state.baseStage, nextWave),
        isCleared: matchCleared,
      },
      waveJustCleared: true,
      matchCleared,
      clearedWaveNum,
    };
  }

  return {
    next: {
      ...state,
      waveHits: nextWaveHits,
      totalHits: nextTotalHits,
    },
    waveJustCleared: false,
    matchCleared: false,
    clearedWaveNum: 0,
  };
}

/**
 * Sistema de Retrocesso Intra-Partida:
 * - Se o jogador errar na Onda 2..5, retrocede 1 onda (mínimo Onda 1) e reinicia os acertos da onda.
 * - Se errar na Onda 1, reinicia o progresso da Onda 1 mantendo o piso na Onda 1.
 */
export function regressWaveError(state: WaveState): {
  next: WaveState;
  regressed: boolean;
  fromWave: number;
  toWave: number;
} {
  if (state.isCleared) {
    return { next: state, regressed: false, fromWave: state.currentWave, toWave: state.currentWave };
  }

  const fromWave = state.currentWave;
  const toWave = Math.max(1, fromWave - 1);
  const regressed = toWave < fromWave;
  const nextQuota = WAVE_QUOTAS[toWave - 1];
  const baseHitsOfPrevWaves = WAVE_QUOTAS.slice(0, toWave - 1).reduce((a, b) => a + b, 0);

  return {
    next: {
      ...state,
      currentWave: toWave,
      waveHits: 0,
      waveQuota: nextQuota,
      wavesCompleted: Math.max(0, toWave - 1),
      totalHits: baseHitsOfPrevWaves,
      effectiveDifficulty: calcEffectiveDiff(state.baseStage, toWave),
      isCleared: false,
    },
    regressed,
    fromWave,
    toWave,
  };
}

/** Calcula a configuração técnica efetiva suave para a onda atual */
export function getWaveEffectiveConfig(
  slug: GameSlug,
  wave: WaveState,
  easeBoost = false
): StageConfig {
  const baseDuration = getStageConfig(slug, wave.baseStage, easeBoost).durationSec;
  const cfg = getStageConfig(slug, wave.effectiveDifficulty, easeBoost && wave.currentWave === 1);
  return {
    ...cfg,
    durationSec: baseDuration,
  };
}

export function getWaveBarPct(wave: WaveState): number {
  if (wave.isCleared) return 100;
  return Math.min(100, Math.round((wave.waveHits / wave.waveQuota) * 100));
}

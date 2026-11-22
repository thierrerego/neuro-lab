import type { GameSlug, StageConfig, WaveState } from '../types/cognitive';
import { getStageConfig } from './stageEngine';

/** Cotas oficiais das 5 ondas por partida: 2 + 3 + 3 + 4 + 4 = 16 acertos */
export const WAVE_QUOTAS = [2, 3, 3, 4, 4] as const;
export const TOTAL_WAVES = WAVE_QUOTAS.length;
export const TOTAL_WAVE_HITS = WAVE_QUOTAS.reduce((a, b) => a + b, 0); // 16

/** Inicializa o estado da sessão progressiva a partir do baseStage permanente do minigame */
export function createWaveState(baseStage: number): WaveState {
  const safeBase = Math.max(1, Math.floor(baseStage));
  return {
    baseStage: safeBase,
    currentWave: 1,
    waveHits: 0,
    waveQuota: WAVE_QUOTAS[0],
    wavesCompleted: 0,
    totalHits: 0,
    totalTargetHits: TOTAL_WAVE_HITS,
    effectiveDifficulty: safeBase,
    isCleared: false,
  };
}

/**
 * Registra 1 acerto/estímulo concluído e avança automaticamente os micro-níveis (Ondas 1 -> 5).
 * Ao completar a Onda 5 (16º acerto), sinaliza `matchCleared = true` para conclusão antecipada.
 */
export function advanceWaveHit(state: WaveState): {
  next: WaveState;
  waveJustCleared: boolean;
  matchCleared: boolean;
} {
  if (state.isCleared) {
    return { next: state, waveJustCleared: false, matchCleared: true };
  }

  const nextTotalHits = Math.min(TOTAL_WAVE_HITS, state.totalHits + 1);
  const nextWaveHits = state.waveHits + 1;

  if (nextWaveHits >= state.waveQuota) {
    const nextCompleted = Math.min(TOTAL_WAVES, state.wavesCompleted + 1);
    const matchCleared = nextCompleted >= TOTAL_WAVES;
    const nextWave = matchCleared ? TOTAL_WAVES : state.currentWave + 1;
    const nextQuota = WAVE_QUOTAS[nextWave - 1];

    return {
      next: {
        ...state,
        currentWave: nextWave,
        waveHits: matchCleared ? nextQuota : 0,
        waveQuota: nextQuota,
        wavesCompleted: nextCompleted,
        totalHits: nextTotalHits,
        effectiveDifficulty: state.baseStage + (nextWave - 1),
        isCleared: matchCleared,
      },
      waveJustCleared: true,
      matchCleared,
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
  };
}

/** Calcula a configuração técnica efetiva para a onda atual: effectiveDifficulty = baseStage + (wave - 1) */
export function getWaveEffectiveConfig(
  slug: GameSlug,
  wave: WaveState,
  easeBoost = false
): StageConfig {
  const effectiveDiff = wave.baseStage + (wave.currentWave - 1);
  const baseDuration = getStageConfig(slug, wave.baseStage, easeBoost).durationSec;
  const cfg = getStageConfig(slug, effectiveDiff, easeBoost && wave.currentWave === 1);
  return {
    ...cfg,
    durationSec: baseDuration,
  };
}

export function getWaveBarPct(wave: WaveState): number {
  if (wave.isCleared) return 100;
  return Math.min(100, Math.round((wave.waveHits / wave.waveQuota) * 100));
}

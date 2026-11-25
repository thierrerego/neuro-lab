import type { GameSlug } from '../types/cognitive';
import { getTargetHitsForGame } from '../engine/waveEngine';

const LAB_TUNING_KEY = 'neurolab_lab_tuning_v1';
const PLATEAU_ATTEMPTS_KEY = 'neurolab_plateau_attempts_v1';
export const MAX_PLATEAU_ATTEMPTS = 3;

export interface LabLevelTuning {
  /** Dificuldade real enviada ao stageEngine (1..20, passo 0.5) */
  effectiveLevel: number;
  /** Multiplicador de velocidade (0.5 = mais lento, 1.0 = padrão, 1.5 = mais rápido) */
  speedScale: number;
  /** Meta de acertos para fechar os 30s (2..25) */
  targetHits: number;
}

export interface PlateauAttempt {
  timestamp: string;
  hits: number;
  targetHits: number;
  accuracyPct: number;
  timeRemainingMs: number;
  completedEarly: boolean;
  tuningUsed: LabLevelTuning;
  suggestedTuning: LabLevelTuning;
  direction: 'up' | 'down' | 'hold';
}

export function getLabTuningKey(slug: GameSlug, stage: number): string {
  return `${slug}:${Math.max(1, Math.min(30, Math.floor(stage)))}`;
}

export function getDefaultLabTuning(slug: GameSlug, stage: number): LabLevelTuning {
  const safeStage = Math.max(1, Math.min(30, Math.floor(stage)));
  return {
    effectiveLevel: safeStage,
    speedScale: 1,
    targetHits: getTargetHitsForGame(slug),
  };
}

export function isLabTuningModified(
  slug: GameSlug,
  stage: number,
  tuning: LabLevelTuning | null | undefined
): boolean {
  if (!tuning) return false;
  const def = getDefaultLabTuning(slug, stage);
  return (
    Math.abs(tuning.effectiveLevel - def.effectiveLevel) > 0.001 ||
    Math.abs(tuning.speedScale - def.speedScale) > 0.001 ||
    tuning.targetHits !== def.targetHits
  );
}

export function getAllLabTunings(): Record<string, LabLevelTuning> {
  try {
    const raw = localStorage.getItem(LAB_TUNING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, LabLevelTuning>;
  } catch {
    return {};
  }
}

export function getSavedLabTuning(slug: GameSlug, stage: number): LabLevelTuning | null {
  const all = getAllLabTunings();
  return all[getLabTuningKey(slug, stage)] ?? null;
}

export function getEffectiveLabTuning(slug: GameSlug, stage: number): LabLevelTuning {
  const def = getDefaultLabTuning(slug, stage);
  const saved = getSavedLabTuning(slug, stage);
  if (!saved) return def;
  return {
    effectiveLevel: clampLevel(saved.effectiveLevel ?? def.effectiveLevel),
    speedScale: clampSpeed(saved.speedScale ?? def.speedScale),
    targetHits: clampHits(saved.targetHits ?? def.targetHits),
  };
}

export function saveLabTuning(slug: GameSlug, stage: number, tuning: LabLevelTuning): LabLevelTuning {
  const normalized: LabLevelTuning = {
    effectiveLevel: clampLevel(tuning.effectiveLevel),
    speedScale: clampSpeed(tuning.speedScale),
    targetHits: clampHits(tuning.targetHits),
  };
  const key = getLabTuningKey(slug, stage);
  const all = getAllLabTunings();

  if (!isLabTuningModified(slug, stage, normalized)) {
    delete all[key];
  } else {
    all[key] = normalized;
  }

  try {
    localStorage.setItem(LAB_TUNING_KEY, JSON.stringify(all));
  } catch {
    // ignora cota do navegador
  }
  return normalized;
}

export function resetLabTuning(slug: GameSlug, stage: number): LabLevelTuning {
  const key = getLabTuningKey(slug, stage);
  const all = getAllLabTunings();
  delete all[key];
  try {
    localStorage.setItem(LAB_TUNING_KEY, JSON.stringify(all));
  } catch {
    // ignora
  }
  return getDefaultLabTuning(slug, stage);
}

export function clearAllLabTunings() {
  try {
    localStorage.removeItem(LAB_TUNING_KEY);
  } catch {
    // ignora
  }
}

export function formatTuningShort(tuning: LabLevelTuning): string {
  return `Dif ${tuning.effectiveLevel.toFixed(1).replace(/\.0$/, '')} · Vel ${tuning.speedScale.toFixed(2)}x · Meta ${tuning.targetHits}`;
}

export function formatAllLabTuningsForChat(): string {
  const all = getAllLabTunings();
  const entries = Object.entries(all).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return '';

  const lines = entries.map(([key, t]) => {
    const [slug, stageStr] = key.split(':');
    return `- ${slug} Nv.${stageStr} -> ${formatTuningShort(t)}`;
  });

  return ['', `Ajustes reais calibrados no Lab (${entries.length}):`, ...lines].join('\n');
}

function clampLevel(v: number): number {
  const rounded = Math.round(v * 2) / 2;
  return Math.max(1, Math.min(30, Number(rounded.toFixed(1))));
}

function clampSpeed(v: number): number {
  const rounded = Math.round(v * 20) / 20;
  return Math.max(0.5, Math.min(1.5, Number(rounded.toFixed(2))));
}

function clampHits(v: number): number {
  return Math.max(2, Math.min(25, Math.round(v)));
}

export function getAllPlateauAttempts(): Record<string, PlateauAttempt[]> {
  try {
    const raw = localStorage.getItem(PLATEAU_ATTEMPTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, PlateauAttempt[]>;
  } catch {
    return {};
  }
}

export function getPlateauAttempts(slug: GameSlug): PlateauAttempt[] {
  return getAllPlateauAttempts()[slug] ?? [];
}

export function resetPlateauAttempts(slug: GameSlug): LabLevelTuning {
  const all = getAllPlateauAttempts();
  delete all[slug];
  try {
    localStorage.setItem(PLATEAU_ATTEMPTS_KEY, JSON.stringify(all));
  } catch {
    // ignora
  }
  return resetLabTuning(slug, 13);
}

/**
 * Calcula a sugestão individual desta tentativa para levar o usuário ao limiar do Platô (Nv. 13):
 * objetivo = ficar raspando o limite (~95%–100% da meta nos 30s, às vezes passando, às vezes quase).
 */
function suggestTuningForAttempt(params: {
  hits: number;
  targetHits: number;
  accuracyPct: number;
  timeRemainingMs: number;
  completedEarly: boolean;
  tuningUsed: LabLevelTuning;
}): { suggested: LabLevelTuning; direction: 'up' | 'down' | 'hold' } {
  const { hits, targetHits, accuracyPct, timeRemainingMs, completedEarly, tuningUsed } = params;
  const safeTarget = Math.max(1, targetHits);
  const activeSec = completedEarly ? Math.max(4, (30000 - timeRemainingMs) / 1000) : 30;
  const paceHitsPer30s = hits > 0 ? (hits / activeSec) * 30 : Math.max(1, safeTarget * 0.45);
  const accFactor = accuracyPct >= 92 ? 1.0 : accuracyPct >= 80 ? 0.92 : 0.78;
  const ratio = (paceHitsPer30s * accFactor) / safeTarget;

  // Alvo do limiar: 0.98 (quase passando ou passando no limite de 0s–1.5s)
  const error = ratio - 0.98;

  if (Math.abs(error) <= 0.06 && accuracyPct >= 85) {
    return { suggested: { ...tuningUsed }, direction: 'hold' };
  }

  const direction: 'up' | 'down' = error > 0 ? 'up' : 'down';

  let nextLevel = tuningUsed.effectiveLevel;
  let nextSpeed = tuningUsed.speedScale;
  let nextHits = tuningUsed.targetHits;

  if (direction === 'up') {
    const lvlStep = Math.min(3.0, Math.max(0.5, Math.round(error * 4.5 * 2) / 2));
    nextLevel = clampLevel(tuningUsed.effectiveLevel + lvlStep);

    if (error >= 0.14) {
      const speedStep = Math.min(0.15, Math.max(0.05, Math.round(error * 0.25 * 20) / 20));
      nextSpeed = clampSpeed(tuningUsed.speedScale + speedStep);
    }

    // Se ainda tem folga de nível, puxa a meta mais suave; se já bateu no teto (20), puxa mais pela meta
    const idealHits = Math.round(paceHitsPer30s * 0.98);
    const weight = nextLevel >= 20 ? 0.75 : 0.4;
    nextHits = clampHits(tuningUsed.targetHits + (idealHits - tuningUsed.targetHits) * weight);
  } else {
    const absErr = Math.abs(error);
    const lvlStep = Math.min(3.5, Math.max(0.5, Math.round(absErr * 5.0 * 2) / 2));
    nextLevel = clampLevel(tuningUsed.effectiveLevel - lvlStep);

    if (absErr >= 0.14) {
      const speedStep = Math.min(0.15, Math.max(0.05, Math.round(absErr * 0.25 * 20) / 20));
      nextSpeed = clampSpeed(tuningUsed.speedScale - speedStep);
    }

    const idealHits = Math.max(2, Math.round(paceHitsPer30s * 1.02));
    const weight = nextLevel <= 1 ? 0.75 : 0.45;
    nextHits = clampHits(tuningUsed.targetHits + (idealHits - tuningUsed.targetHits) * weight);
  }

  return {
    suggested: {
      effectiveLevel: nextLevel,
      speedScale: nextSpeed,
      targetHits: nextHits,
    },
    direction,
  };
}

/**
 * Registra uma tentativa no Platô (Nv. 13), mantém as últimas 3 tentativas
 * e ajusta automaticamente as 3 barras pela média delas.
 */
export function recordPlateauAttempt(params: {
  slug: GameSlug;
  hits: number;
  targetHits: number;
  accuracyPct: number;
  timeRemainingMs: number;
  completedEarly: boolean;
  tuningUsed: LabLevelTuning;
}): { attempts: PlateauAttempt[]; nextTuning: LabLevelTuning } {
  const { slug, hits, targetHits, accuracyPct, timeRemainingMs, completedEarly, tuningUsed } =
    params;
  const { suggested, direction } = suggestTuningForAttempt({
    hits,
    targetHits,
    accuracyPct,
    timeRemainingMs,
    completedEarly,
    tuningUsed,
  });

  const entry: PlateauAttempt = {
    timestamp: new Date().toISOString(),
    hits,
    targetHits,
    accuracyPct,
    timeRemainingMs,
    completedEarly,
    tuningUsed: { ...tuningUsed },
    suggestedTuning: suggested,
    direction,
  };

  const all = getAllPlateauAttempts();
  const prev = all[slug] ?? [];
  const attempts = [...prev, entry].slice(-MAX_PLATEAU_ATTEMPTS);
  all[slug] = attempts;

  try {
    localStorage.setItem(PLATEAU_ATTEMPTS_KEY, JSON.stringify(all));
  } catch {
    // ignora
  }

  const count = attempts.length;
  const avgLevel = clampLevel(
    attempts.reduce((acc, a) => acc + a.suggestedTuning.effectiveLevel, 0) / count
  );
  const avgSpeed = clampSpeed(
    attempts.reduce((acc, a) => acc + a.suggestedTuning.speedScale, 0) / count
  );
  const avgHits = clampHits(
    attempts.reduce((acc, a) => acc + a.suggestedTuning.targetHits, 0) / count
  );

  const nextTuning = saveLabTuning(slug, 13, {
    effectiveLevel: avgLevel,
    speedScale: avgSpeed,
    targetHits: avgHits,
  });

  return { attempts, nextTuning };
}

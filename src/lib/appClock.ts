const SIM_DAY_OFFSET_KEY = 'neurolab_sim_day_offset_v1';

export function getSimulatedDayOffset(): number {
  try {
    const raw = localStorage.getItem(SIM_DAY_OFFSET_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setSimulatedDayOffset(days: number): number {
  const safe = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  try {
    if (safe === 0) localStorage.removeItem(SIM_DAY_OFFSET_KEY);
    else localStorage.setItem(SIM_DAY_OFFSET_KEY, String(safe));
  } catch {
    // ignora cota
  }
  return safe;
}

export function advanceSimulatedDay(delta = 1): number {
  return setSimulatedDayOffset(getSimulatedDayOffset() + delta);
}

export function resetSimulatedDayOffset(): number {
  return setSimulatedDayOffset(0);
}

/** Retorna a data/hora atual do app já considerando os dias pulados no modo ADM */
export function getAppNow(): Date {
  const d = new Date();
  const offset = getSimulatedDayOffset();
  if (offset !== 0) {
    d.setDate(d.getDate() + offset);
  }
  return d;
}

export function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getAppTodayIso(): string {
  return toLocalIsoDate(getAppNow());
}

export function getAppYesterdayIso(): string {
  const d = getAppNow();
  d.setDate(d.getDate() - 1);
  return toLocalIsoDate(d);
}

export function getAppNowIso(): string {
  return getAppNow().toISOString();
}

export function formatShortDateBr(dateIso: string): string {
  const parts = dateIso.split('-');
  if (parts.length !== 3) return dateIso;
  return `${parts[2]}/${parts[1]}`;
}

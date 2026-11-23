import type {
  AgeBracket,
  ComputedSessionResult,
  DomainKey,
  GameSlug,
  SessionMode,
} from '../types/cognitive';
import { GAME_MAP } from '../engine/gameRegistry';
import {
  formatAllLabTuningsForChat,
  formatTuningShort,
  type LabLevelTuning,
} from './labTuning';

const CALIBRATION_LOG_KEY = 'neurolab_calibration_log_v1';
const MAX_LOG_ENTRIES = 300;

export type CalibrationAlertCode =
  | 'lvl1_not_perfect'
  | 'lvl1_incomplete'
  | 'lvl1_low_percentile'
  | 'high_lvl_too_easy'
  | 'rt_too_tight'
  | 'rt_too_loose'
  | 'stage_stuck';

export interface CalibrationAlert {
  code: CalibrationAlertCode;
  label: string;
}

export interface SandboxFeedback {
  difficulty?: 1 | 2 | 3 | 4 | 5; // Opcional: só preenche se achar que o nível não está certo
  note?: string;
}

export const DIFFICULTY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Muito fácil pro nível',
  2: 'Fácil pro nível',
  3: 'Ideal pro nível',
  4: 'Difícil pro nível',
  5: 'Pesado demais pro nível',
};

export interface CalibrationLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  isAdmin: boolean;
  isSandbox: boolean;
  ageBracket: AgeBracket;
  gameSlug: GameSlug;
  gameName: string;
  domain: DomainKey;
  mode: SessionMode;
  stagePlayed: number;
  hits: number;
  targetHits: number;
  durationSec: number;
  timeRemainingMs: number;
  completedEarly: boolean;
  accuracyPct: number;
  commissionErrors: number;
  omissionErrors: number;
  rtMeanMs: number;
  rtSdMs: number;
  targetRtMs: number;
  rtRatio: number | null;
  rawLevelScore: number;
  globalScore: number;
  performanceIndex: number;
  levelPercentile: number;
  stageCleared: boolean;
  nextStage: number;
  alerts: CalibrationAlert[];
  tuning?: LabLevelTuning;
  feedback?: SandboxFeedback;
}

/**
 * Avalia alertas automáticos usando o ADM como usuário de referência de alta performance.
 * Se no Nível 1 ele não gabarita, não fecha a meta em 30s ou não bate pontuação extrema,
 * ou se o tempo-alvo do jogo estiver apertado/folgado demais, acende alerta para recalibragem.
 */
export function evaluateCalibrationAlerts(result: ComputedSessionResult): CalibrationAlert[] {
  const alerts: CalibrationAlert[] = [];
  const hits = result.hits ?? 0;
  const targetHits = result.targetHits ?? 10;
  const targetRt = result.targetRtMs ?? 0;

  if (result.stagePlayed === 1) {
    if (result.accuracyPct < 100) {
      alerts.push({
        code: 'lvl1_not_perfect',
        label: `Nível 1 não gabaritado (${result.accuracyPct}% precisão, ${result.commissionErrors} erro(s))`,
      });
    }
    if (targetHits > 0 && hits < targetHits) {
      alerts.push({
        code: 'lvl1_incomplete',
        label: `Nível 1 não fechou a meta em 30s (${hits}/${targetHits})`,
      });
    }
    if (result.percentile < 85) {
      alerts.push({
        code: 'lvl1_low_percentile',
        label: `Nível 1 abaixo do extremo esperado (superou ${result.percentile}%)`,
      });
    }
  }

  if (
    result.stagePlayed >= 12 &&
    result.accuracyPct === 100 &&
    result.completedEarly &&
    result.timeRemainingMs >= 8000
  ) {
    alerts.push({
      code: 'high_lvl_too_easy',
      label: `Nível ${result.stagePlayed} fácil demais (100% com ${(result.timeRemainingMs / 1000).toFixed(1)}s de sobra)`,
    });
  }

  if (result.accuracyPct >= 95 && result.rtMeanMs > 0 && targetRt > 0) {
    if (result.rtMeanMs > targetRt * 1.15) {
      alerts.push({
        code: 'rt_too_tight',
        label: `Tempo-alvo apertado (RT ${result.rtMeanMs}ms vs. alvo ${targetRt}ms)`,
      });
    } else if (result.accuracyPct === 100 && result.rtMeanMs < targetRt * 0.55) {
      alerts.push({
        code: 'rt_too_loose',
        label: `Tempo-alvo folgado (RT ${result.rtMeanMs}ms vs. alvo ${targetRt}ms)`,
      });
    }
  }

  if (result.accuracyPct >= 90 && !result.stageCleared) {
    alerts.push({
      code: 'stage_stuck',
      label: `Alta precisão (${result.accuracyPct}%) mas não avançou de nível`,
    });
  }

  return alerts;
}

export function getCalibrationLogs(): CalibrationLogEntry[] {
  try {
    const raw = localStorage.getItem(CALIBRATION_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CalibrationLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendCalibrationLog(params: {
  userId: string;
  userName: string;
  isAdmin: boolean;
  isSandbox?: boolean;
  ageBracket: AgeBracket;
  result: ComputedSessionResult;
  tuning?: LabLevelTuning;
}): CalibrationLogEntry {
  const { userId, userName, isAdmin, isSandbox = false, ageBracket, result, tuning } = params;
  const game = GAME_MAP[result.gameSlug];
  const targetRtMs = result.targetRtMs ?? 0;
  const rtRatio =
    result.rtMeanMs > 0 && targetRtMs > 0
      ? Number((result.rtMeanMs / targetRtMs).toFixed(2))
      : null;

  const entry: CalibrationLogEntry = {
    id: `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    isAdmin,
    isSandbox,
    ageBracket,
    gameSlug: result.gameSlug,
    gameName: game?.name ?? result.gameSlug,
    domain: result.domain,
    mode: result.mode,
    stagePlayed: result.stagePlayed,
    hits: result.hits ?? 0,
    targetHits: result.targetHits ?? 10,
    durationSec: game?.durationSec ?? 30,
    timeRemainingMs: result.timeRemainingMs,
    completedEarly: result.completedEarly,
    accuracyPct: result.accuracyPct,
    commissionErrors: result.commissionErrors,
    omissionErrors: result.omissionErrors,
    rtMeanMs: result.rtMeanMs,
    rtSdMs: result.rtSdMs,
    targetRtMs,
    rtRatio,
    rawLevelScore: result.rawLevelScore ?? result.score,
    globalScore: result.score,
    performanceIndex: result.performanceIndex,
    levelPercentile: result.percentile,
    stageCleared: result.stageCleared,
    nextStage: result.nextStage,
    alerts: evaluateCalibrationAlerts(result),
    ...(tuning ? { tuning } : {}),
  };

  try {
    const existing = getCalibrationLogs();
    const next = [entry, ...existing].slice(0, MAX_LOG_ENTRIES);
    localStorage.setItem(CALIBRATION_LOG_KEY, JSON.stringify(next));
  } catch {
    // ignora cota do navegador
  }

  return entry;
}

export function updateLatestCalibrationFeedback(
  gameSlug: GameSlug,
  stagePlayed: number,
  feedback: SandboxFeedback
) {
  try {
    const existing = getCalibrationLogs();
    const idx = existing.findIndex(
      (e) => e.gameSlug === gameSlug && e.stagePlayed === stagePlayed
    );
    if (idx === -1) return;
    existing[idx] = {
      ...existing[idx],
      feedback: {
        ...feedback,
        note: feedback.note?.trim() || undefined,
      },
    };
    localStorage.setItem(CALIBRATION_LOG_KEY, JSON.stringify(existing));
  } catch {
    // ignora
  }
}

export function clearCalibrationLogs() {
  try {
    localStorage.removeItem(CALIBRATION_LOG_KEY);
  } catch {
    // ignora
  }
}

/**
 * Gera um relato bem simples e limpo (1 linha por teste) pronto para colar direto no chat.
 */
export function formatCalibrationLogForChat(entries: CalibrationLogEntry[]): string {
  const header = `NeuroLab · Log de Balanceio (${entries.length} ${entries.length === 1 ? 'teste' : 'testes'})`;

  const lines = entries.slice(0, 80).map((e) => {
    const remSec = (e.timeRemainingMs / 1000).toFixed(1);
    const tun = e.tuning ? ` | [${formatTuningShort(e.tuning)}]` : '';
    const dif = e.feedback?.difficulty
      ? ` | Nota ${e.feedback.difficulty}/5 (${DIFFICULTY_LABELS[e.feedback.difficulty]})`
      : '';
    const obs = e.feedback?.note ? ` | "${e.feedback.note}"` : '';
    return `- ${e.gameSlug} Nv.${e.stagePlayed} | ${e.hits}/${e.targetHits} · ${e.accuracyPct}% · ${e.rtMeanMs}ms (sobra ${remSec}s) · Sup ${e.levelPercentile}%${tun}${dif}${obs}`;
  });

  const tuningSummary = formatAllLabTuningsForChat();
  return [header, ...lines, tuningSummary].filter(Boolean).join('\n');
}

export function downloadCalibrationLogJson(entries: CalibrationLogEntry[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    totalSessions: entries.length,
    totalWithAlerts: entries.filter((e) => e.alerts.length > 0).length,
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neurolab-calibracao-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

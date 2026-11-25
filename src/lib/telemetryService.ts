import type { AgeBracket, DomainKey, GameSlug, SessionMode } from '../types/cognitive';
import { GAME_MAP } from '../engine/gameRegistry';
import { supabase } from './supabase';

const LOCAL_TELEMETRY_KEY = 'neurolab_interaction_telemetry_v1';
const MAX_LOCAL_EVENTS = 500;

export type TelemetryOutcome = 'completed' | 'time_up' | 'abandoned' | 'abandoned_tutorial';
export type BalanceFlag = 'too_easy' | 'balanced' | 'too_hard';
export type GameBalanceStatus = 'too_easy' | 'too_hard' | 'high_abandon' | 'balanced';

export interface InteractionTelemetryEvent {
  id: string;
  timestamp: string;
  userId: string;
  ageBracket: AgeBracket;
  domain: DomainKey;
  gameSlug: GameSlug;
  mode: SessionMode;
  difficultyStart: number;
  difficultyEnd: number;
  outcome: TelemetryOutcome;
  hits: number;
  targetHits: number;
  commissionErrors: number;
  omissionErrors: number;
  accuracyPct: number;
  rtMeanMs: number;
  elapsedMs: number;
  timeRemainingMs: number;
  helpOpens: number;
  balanceFlag: BalanceFlag;
}

export interface GameTelemetryStat {
  gameSlug: GameSlug;
  gameName: string;
  domain: DomainKey;
  total: number;
  completed: number;
  abandoned: number;
  abandonedTutorial: number;
  abandonRatePct: number;
  avgAccuracyPct: number;
  avgRtMs: number;
  avgRemainingMs: number;
  avgDifficulty: number;
  helpRatePct: number;
  tooEasyCount: number;
  tooHardCount: number;
  status: GameBalanceStatus;
}

export interface AgeTelemetryStat {
  ageBracket: string;
  total: number;
  completionRatePct: number;
  avgAccuracyPct: number;
  avgRtMs: number;
  avgDifficulty: number;
}

export interface TelemetrySummary {
  source: 'supabase' | 'local';
  totalInteractions: number;
  distinctUsers: number;
  completionRatePct: number;
  abandonRatePct: number;
  avgAccuracyPct: number;
  byGame: GameTelemetryStat[];
  byAgeBracket: AgeTelemetryStat[];
}

/**
 * Classifica automaticamente se a interação pareceu fácil demais, equilibrada ou difícil demais.
 */
export function classifyInteractionBalance(params: {
  outcome: TelemetryOutcome;
  accuracyPct: number;
  timeRemainingMs: number;
  hits: number;
  targetHits: number;
}): BalanceFlag {
  const { outcome, accuracyPct, timeRemainingMs, hits, targetHits } = params;
  if (outcome === 'abandoned' || outcome === 'abandoned_tutorial') {
    return 'too_hard';
  }
  if (outcome === 'completed' && accuracyPct >= 98 && timeRemainingMs >= 9000) {
    return 'too_easy';
  }
  const completionRatio = targetHits > 0 ? hits / targetHits : 0;
  if (accuracyPct < 60 || (outcome === 'time_up' && completionRatio < 0.45)) {
    return 'too_hard';
  }
  return 'balanced';
}

export function getLocalTelemetryEvents(): InteractionTelemetryEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_TELEMETRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InteractionTelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearLocalTelemetryEvents() {
  try {
    localStorage.removeItem(LOCAL_TELEMETRY_KEY);
  } catch {
    // ignora
  }
}

/**
 * Grava a telemetria da interação localmente e, quando online com conta real, envia para o Supabase.
 */
export function recordInteractionTelemetry(
  input: Omit<InteractionTelemetryEvent, 'id' | 'timestamp' | 'balanceFlag'>,
  sendRemote: boolean
): InteractionTelemetryEvent {
  const balanceFlag = classifyInteractionBalance({
    outcome: input.outcome,
    accuracyPct: input.accuracyPct,
    timeRemainingMs: input.timeRemainingMs,
    hits: input.hits,
    targetHits: input.targetHits,
  });

  const event: InteractionTelemetryEvent = {
    ...input,
    id: `tel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    balanceFlag,
  };

  try {
    const prev = getLocalTelemetryEvents();
    const next = [event, ...prev].slice(0, MAX_LOCAL_EVENTS);
    localStorage.setItem(LOCAL_TELEMETRY_KEY, JSON.stringify(next));
  } catch {
    // ignora cota do navegador
  }

  if (sendRemote && input.userId && !input.userId.startsWith('local-')) {
    void Promise.resolve(
      supabase.from('interaction_telemetry').insert({
        user_id: input.userId,
        age_bracket: input.ageBracket,
        domain: input.domain,
        game_slug: input.gameSlug,
        mode: input.mode,
        difficulty_start: input.difficultyStart,
        difficulty_end: input.difficultyEnd,
        outcome: input.outcome,
        hits: input.hits,
        target_hits: input.targetHits,
        commission_errors: input.commissionErrors,
        omission_errors: input.omissionErrors,
        accuracy_pct: input.accuracyPct,
        rt_mean_ms: input.rtMeanMs,
        elapsed_ms: input.elapsedMs,
        time_remaining_ms: input.timeRemainingMs,
        help_opens: input.helpOpens,
        balance_flag: balanceFlag,
      })
    ).catch(() => {
      // telemetria nunca deve interromper o fluxo do usuário
    });
  }

  return event;
}

function resolveGameStatus(stat: {
  total: number;
  abandoned: number;
  avgAccuracyPct: number;
  avgRemainingMs: number;
  tooEasyCount: number;
  tooHardCount: number;
}): GameBalanceStatus {
  const abandonRate = stat.total > 0 ? (stat.abandoned / stat.total) * 100 : 0;
  if (abandonRate >= 35) return 'high_abandon';
  if (stat.tooHardCount > stat.tooEasyCount && (stat.avgAccuracyPct < 68 || stat.tooHardCount / Math.max(1, stat.total) >= 0.4)) {
    return 'too_hard';
  }
  if (stat.tooEasyCount > stat.tooHardCount && (stat.avgAccuracyPct >= 96 && stat.avgRemainingMs >= 8500 || stat.tooEasyCount / Math.max(1, stat.total) >= 0.5)) {
    return 'too_easy';
  }
  return 'balanced';
}

export function buildLocalTelemetrySummary(events = getLocalTelemetryEvents()): TelemetrySummary {
  const total = events.length;
  const users = new Set(events.map((e) => e.userId)).size;
  const finished = events.filter((e) => e.outcome === 'completed' || e.outcome === 'time_up');
  const abandoned = events.filter((e) => e.outcome === 'abandoned' || e.outcome === 'abandoned_tutorial');

  const avgAccuracyPct = finished.length
    ? Number((finished.reduce((a, e) => a + e.accuracyPct, 0) / finished.length).toFixed(1))
    : 0;

  const gameMap = new Map<GameSlug, InteractionTelemetryEvent[]>();
  const ageMap = new Map<string, InteractionTelemetryEvent[]>();

  for (const e of events) {
    const gList = gameMap.get(e.gameSlug) ?? [];
    gList.push(e);
    gameMap.set(e.gameSlug, gList);

    const aList = ageMap.get(e.ageBracket) ?? [];
    aList.push(e);
    ageMap.set(e.ageBracket, aList);
  }

  const byGame: GameTelemetryStat[] = Array.from(gameMap.entries())
    .map(([slug, list]) => {
      const fin = list.filter((e) => e.outcome === 'completed' || e.outcome === 'time_up');
      const ab = list.filter((e) => e.outcome === 'abandoned' || e.outcome === 'abandoned_tutorial');
      const abTut = list.filter((e) => e.outcome === 'abandoned_tutorial');
      const validRt = fin.filter((e) => e.rtMeanMs > 0);
      const avgAcc = fin.length
        ? Number((fin.reduce((a, e) => a + e.accuracyPct, 0) / fin.length).toFixed(1))
        : 0;
      const avgRt = validRt.length
        ? Math.round(validRt.reduce((a, e) => a + e.rtMeanMs, 0) / validRt.length)
        : 0;
      const avgRem = fin.length
        ? Math.round(fin.reduce((a, e) => a + e.timeRemainingMs, 0) / fin.length)
        : 0;
      const avgDiff = Number(
        (list.reduce((a, e) => a + e.difficultyEnd, 0) / Math.max(1, list.length)).toFixed(2)
      );
      const helpRatePct = Number(
        ((list.filter((e) => e.helpOpens > 0).length / Math.max(1, list.length)) * 100).toFixed(1)
      );
      const tooEasyCount = list.filter((e) => e.balanceFlag === 'too_easy').length;
      const tooHardCount = list.filter((e) => e.balanceFlag === 'too_hard').length;
      const status = resolveGameStatus({
        total: list.length,
        abandoned: ab.length,
        avgAccuracyPct: avgAcc,
        avgRemainingMs: avgRem,
        tooEasyCount,
        tooHardCount,
      });

      return {
        gameSlug: slug,
        gameName: GAME_MAP[slug]?.name ?? slug,
        domain: list[0].domain,
        total: list.length,
        completed: fin.length,
        abandoned: ab.length,
        abandonedTutorial: abTut.length,
        abandonRatePct: Number(((ab.length / Math.max(1, list.length)) * 100).toFixed(1)),
        avgAccuracyPct: avgAcc,
        avgRtMs: avgRt,
        avgRemainingMs: avgRem,
        avgDifficulty: avgDiff,
        helpRatePct,
        tooEasyCount,
        tooHardCount,
        status,
      };
    })
    .sort((a, b) => b.total - a.total);

  const byAgeBracket: AgeTelemetryStat[] = Array.from(ageMap.entries())
    .map(([ageBracket, list]) => {
      const fin = list.filter((e) => e.outcome === 'completed' || e.outcome === 'time_up');
      const validRt = fin.filter((e) => e.rtMeanMs > 0);
      return {
        ageBracket,
        total: list.length,
        completionRatePct: Number(((fin.length / Math.max(1, list.length)) * 100).toFixed(1)),
        avgAccuracyPct: fin.length
          ? Number((fin.reduce((a, e) => a + e.accuracyPct, 0) / fin.length).toFixed(1))
          : 0,
        avgRtMs: validRt.length
          ? Math.round(validRt.reduce((a, e) => a + e.rtMeanMs, 0) / validRt.length)
          : 0,
        avgDifficulty: Number(
          (list.reduce((a, e) => a + e.difficultyEnd, 0) / Math.max(1, list.length)).toFixed(2)
        ),
      };
    })
    .sort((a, b) => a.ageBracket.localeCompare(b.ageBracket));

  return {
    source: 'local',
    totalInteractions: total,
    distinctUsers: users,
    completionRatePct: total > 0 ? Number(((finished.length / total) * 100).toFixed(1)) : 0,
    abandonRatePct: total > 0 ? Number(((abandoned.length / total) * 100).toFixed(1)) : 0,
    avgAccuracyPct,
    byGame,
    byAgeBracket,
  };
}

export async function fetchTelemetrySummary(backendOnline: boolean, days = 30): Promise<TelemetrySummary> {
  if (backendOnline) {
    try {
      const { data, error } = await supabase.rpc('get_admin_telemetry_summary', { p_days: days });
      if (!error && data && typeof data === 'object') {
        const raw = data as {
          totalInteractions?: number;
          distinctUsers?: number;
          completionRatePct?: number;
          abandonRatePct?: number;
          avgAccuracyPct?: number;
          byGame?: Array<Omit<GameTelemetryStat, 'gameName' | 'abandonRatePct' | 'status'>>;
          byAgeBracket?: AgeTelemetryStat[];
        };
        if ((raw.totalInteractions ?? 0) > 0) {
          const byGame: GameTelemetryStat[] = (raw.byGame ?? []).map((g) => {
            const total = Number(g.total ?? 0);
            const abandoned = Number(g.abandoned ?? 0);
            const avgAccuracyPct = Number(g.avgAccuracyPct ?? 0);
            const avgRemainingMs = Number(g.avgRemainingMs ?? 0);
            const tooEasyCount = Number(g.tooEasyCount ?? 0);
            const tooHardCount = Number(g.tooHardCount ?? 0);
            return {
              ...g,
              gameName: GAME_MAP[g.gameSlug]?.name ?? g.gameSlug,
              abandonRatePct: total > 0 ? Number(((abandoned / total) * 100).toFixed(1)) : 0,
              status: resolveGameStatus({
                total,
                abandoned,
                avgAccuracyPct,
                avgRemainingMs,
                tooEasyCount,
                tooHardCount,
              }),
            };
          });
          return {
            source: 'supabase',
            totalInteractions: Number(raw.totalInteractions ?? 0),
            distinctUsers: Number(raw.distinctUsers ?? 0),
            completionRatePct: Number(raw.completionRatePct ?? 0),
            abandonRatePct: Number(raw.abandonRatePct ?? 0),
            avgAccuracyPct: Number(raw.avgAccuracyPct ?? 0),
            byGame,
            byAgeBracket: raw.byAgeBracket ?? [],
          };
        }
      }
    } catch {
      // cai pro fallback local
    }
  }
  return buildLocalTelemetrySummary();
}

export function formatTelemetryReportForChat(summary: TelemetrySummary): string {
  const header = `NeuroLab · Telemetria (${summary.source === 'supabase' ? 'Supabase' : 'Local'} · ${summary.totalInteractions} interações · ${summary.distinctUsers} usuários)`;
  const overview = `Conclusão: ${summary.completionRatePct}% | Abandono: ${summary.abandonRatePct}% | Precisão média: ${summary.avgAccuracyPct}%`;
  const alerts = summary.byGame
    .filter((g) => g.status !== 'balanced')
    .map(
      (g) =>
        `- [${g.status.toUpperCase()}] ${g.gameSlug}: ${g.total}x | Prec ${g.avgAccuracyPct}% | RT ${g.avgRtMs}ms | Sobra ${(g.avgRemainingMs / 1000).toFixed(1)}s | Abandono ${g.abandonRatePct}%`
    );
  const ages = summary.byAgeBracket.map(
    (a) =>
      `- Idade ${a.ageBracket}: ${a.total}x | Concl ${a.completionRatePct}% | Prec ${a.avgAccuracyPct}% | RT ${a.avgRtMs}ms | Dif ${a.avgDifficulty}`
  );
  return [
    header,
    overview,
    alerts.length ? '\nAlertas de balanceamento:\n' + alerts.join('\n') : '\nSem alertas de desbalanceamento.',
    ages.length ? '\nPor faixa etária:\n' + ages.join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

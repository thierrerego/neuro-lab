import type {
  CognitiveSessionRecord,
  CognitiveSnapshotRecord,
  DomainKey,
  DomainScoresRecord,
} from '../types/cognitive';
import type { AppDataState } from './dataService';
import { DOMAIN_LIST } from '../engine/gameRegistry';
import { getExpectedAgeEquilibrium } from '../engine/adaptiveEngine';
import {
  calculateGlobalCognitiveIndex,
  computeAgeNormPercentile,
  getCognitiveTier,
  getTargetRtMs,
  nextDomainScore,
  percentileToNormScore,
} from '../engine/psychometricEngine';

export const NORM_VERSION = 2;

/**
 * Recalcula o percentil de uma partida antiga com a régua científica nova,
 * usando só o que ficou salvo (precisão, tempo de reação, jogo e nível).
 */
export function recomputeSessionPercentile(
  s: CognitiveSessionRecord,
  ageBracket?: string | null
): number {
  if (Number(s.accuracy_pct || 0) <= 0 || (s.score ?? 0) <= 0) return 1.0;
  const stage = Math.max(1, s.stage_played || 1);
  const ageNorm = getExpectedAgeEquilibrium(ageBracket, s.domain, s.game_slug);
  return computeAgeNormPercentile({
    accuracyPct: Number(s.accuracy_pct || 0),
    rtMeanMs: s.rt_mean_ms || 0,
    targetRtMs: getTargetRtMs(s.game_slug, stage, ageBracket),
    // O ponto de equilíbrio exato não fica salvo: o nível jogado é uma boa aproximação
    equilibriumIndex: stage,
    ageExpected: ageNorm.expected,
    ageSd: ageNorm.sd,
    ageBracket,
    trials: 8,
  });
}

/** Converte uma nota antiga (percentil × 10) para a escala padronizada nova */
function convertOldScore(v: number): number {
  if (!v || v <= 0) return 0;
  return percentileToNormScore(v / 10);
}

function convertSnapshot(s: CognitiveSnapshotRecord): CognitiveSnapshotRecord {
  const domainJson = { ...(s.domain_scores_json ?? {}) } as Record<DomainKey, number>;
  for (const d of DOMAIN_LIST) {
    domainJson[d.key] = convertOldScore(domainJson[d.key] ?? 0);
  }
  return {
    ...s,
    global_index: convertOldScore(s.global_index),
    domain_scores_json: domainJson,
  };
}

/**
 * Leva o estado de quem já jogava para a régua nova:
 * - recalcula o percentil das partidas antigas;
 * - refaz as notas das 6 habilidades reaplicando o histórico em ordem (mesma regra do app);
 * - converte os pontos antigos do gráfico de evolução.
 *
 * `onlyOlderThanIso`: para dados vindos do servidor (que não guardam a marcação de versão),
 * só mexe no que é anterior à data da migração.
 */
export function migrateStateToNormV2(
  state: AppDataState,
  opts: { recomputeScores: boolean; onlyOlderThanIso?: string } = { recomputeScores: true }
): AppDataState {
  const age = state.profile.age_bracket;
  const isOld = (iso: string | undefined, isV2?: number) =>
    opts.onlyOlderThanIso ? (iso || '') < opts.onlyOlderThanIso : isV2 !== NORM_VERSION;

  const sessions = state.sessions.map((s) =>
    isOld(s.created_at, s.norm_v)
      ? { ...s, percentile: recomputeSessionPercentile(s, age), norm_v: NORM_VERSION }
      : s
  );

  const snapshots = state.snapshots.map((s) =>
    (opts.onlyOlderThanIso ? s.snapshot_date < opts.onlyOlderThanIso.slice(0, 10) : opts.recomputeScores)
      ? convertSnapshot(s)
      : s
  );

  if (!opts.recomputeScores) {
    return { ...state, sessions, snapshots };
  }

  const nextScores: DomainScoresRecord = {
    ...state.scores,
    baseline_scores: {},
    norm_version: NORM_VERSION,
  };
  for (const d of DOMAIN_LIST) nextScores[d.key] = 0;

  const chronological = [...sessions].sort((a, b) =>
    (a.created_at || '').localeCompare(b.created_at || '')
  );

  if (chronological.length === 0) {
    // Sem histórico: só converte o que existir para a escala nova
    for (const d of DOMAIN_LIST) {
      nextScores[d.key] = convertOldScore(state.scores[d.key] ?? 0);
      const base = state.scores.baseline_scores?.[d.key];
      if (base) nextScores.baseline_scores[d.key] = convertOldScore(base);
    }
  } else {
    for (const s of chronological) {
      const cur = nextScores[s.domain] ?? 0;
      const target = percentileToNormScore(s.percentile);
      const { score, baseline } = nextDomainScore(cur, target, s.mode === 'calibration');
      nextScores[s.domain] = score;
      if (!nextScores.baseline_scores[s.domain]) {
        nextScores.baseline_scores[s.domain] = baseline;
      }
    }
  }

  const icg = calculateGlobalCognitiveIndex(nextScores);
  return {
    ...state,
    scores: nextScores,
    sessions,
    snapshots,
    profile: {
      ...state.profile,
      global_cognitive_index: icg,
      current_title: icg > 0 ? getCognitiveTier(icg).title : 'Sem avaliação',
    },
  };
}

export function needsNormMigration(state: AppDataState | null | undefined): boolean {
  return Boolean(state?.scores) && state!.scores.norm_version !== NORM_VERSION;
}

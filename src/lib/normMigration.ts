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

/** 2 = régua científica por idade; 3 = peso por habilidade + referência por jogo + fase fixa */
export const NORM_VERSION = 3;

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
    slug: s.game_slug,
    domain: s.domain,
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
  opts: {
    recomputeScores: boolean;
    /** Servidor: recalcula partidas anteriores a esta data */
    onlyOlderThanIso?: string;
    /** Servidor: pontos do gráfico anteriores a esta data ainda estão na escala antiga (percentil × 10) */
    snapshotsOldBeforeIso?: string;
  } = { recomputeScores: true }
): AppDataState {
  const age = state.profile.age_bracket;
  const isOld = (iso: string | undefined, version?: number) =>
    opts.onlyOlderThanIso ? (iso || '') < opts.onlyOlderThanIso : version !== NORM_VERSION;

  const sessions = state.sessions.map((s) =>
    isOld(s.created_at, s.norm_v)
      ? { ...s, percentile: recomputeSessionPercentile(s, age), norm_v: NORM_VERSION }
      : s
  );

  // Só converte pontos do gráfico que ainda estão na escala da 1ª versão (sem marcação de versão)
  const snapshotsAreV1 = state.scores?.norm_version === undefined;
  const snapshots = state.snapshots.map((s) =>
    (opts.snapshotsOldBeforeIso
      ? s.snapshot_date < opts.snapshotsOldBeforeIso.slice(0, 10)
      : !opts.onlyOlderThanIso && opts.recomputeScores && snapshotsAreV1)
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
    // Sem histórico: converte o que existir para a escala nova (só se ainda estiver na 1ª versão)
    for (const d of DOMAIN_LIST) {
      const cur = state.scores[d.key] ?? 0;
      nextScores[d.key] = snapshotsAreV1 ? convertOldScore(cur) : cur;
      const base = state.scores.baseline_scores?.[d.key];
      if (base) nextScores.baseline_scores[d.key] = snapshotsAreV1 ? convertOldScore(base) : base;
    }
  } else {
    const calCount: Partial<Record<DomainKey, number>> = {};
    for (const s of chronological) {
      const cur = nextScores[s.domain] ?? 0;
      const target = percentileToNormScore(s.percentile);
      const isCal = s.mode === 'calibration';
      const { score, baseline } = nextDomainScore(cur, target, isCal, calCount[s.domain] ?? 0);
      if (isCal) calCount[s.domain] = (calCount[s.domain] ?? 0) + 1;
      nextScores[s.domain] = score;
      if (isCal || !nextScores.baseline_scores[s.domain]) {
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

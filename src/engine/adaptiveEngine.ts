import type { AgeBracket, DomainKey, GameSlug } from '../types/cognitive';

export const MIN_ADAPTIVE_LOAD = 1.0;
export const MAX_ADAPTIVE_LOAD = 30.0;

/**
 * Curva normativa de ponto de equilíbrio esperado por faixa etária (escala contínua 1..20).
 * Baseada nos fatores de velocidade/capacidade de processamento da literatura psicométrica
 * (Salthouse 2009; Deary & Der 2005; WAIS-IV normative decay).
 */
const AGE_EXPECTED_EQUILIBRIUM: Record<AgeBracket, { mean: number; sd: number }> = {
  '18-24': { mean: 6.8, sd: 2.3 },
  '25-34': { mean: 6.4, sd: 2.3 },
  '35-44': { mean: 5.9, sd: 2.2 },
  '45-54': { mean: 5.3, sd: 2.1 },
  '55+': { mean: 4.6, sd: 2.0 },
};

const DOMAIN_LOAD_OFFSET: Record<DomainKey, number> = {
  selective_attention: 0.2,
  working_memory: -0.3,
  fluid_reasoning: -0.4,
  processing_speed: 0.4,
  numerical_cognition: 0.0,
  inhibitory_control: 0.2,
};

export interface AdaptiveStaircaseState {
  currentLoad: number;
  streakHits: number;
  reversals: number;
  lastDirection: 'up' | 'down' | null;
  trail: number[];
}

export function createAdaptiveStaircase(startLoad: number): AdaptiveStaircaseState {
  const safe = clampLoad(startLoad);
  return {
    currentLoad: safe,
    streakHits: 0,
    reversals: 0,
    lastDirection: null,
    trail: [safe],
  };
}

export function clampLoad(val: number): number {
  return Number(Math.max(MIN_ADAPTIVE_LOAD, Math.min(MAX_ADAPTIVE_LOAD, val)).toFixed(2));
}

/**
 * Passo adaptativo 2-up / 1-down (ou 1-up em jogos de poucas rodadas):
 * - No início (0 reversões) dá passos maiores para alcançar rápido a zona de desafio do usuário.
 * - Depois que o usuário oscila (reversões), o passo diminui para convergir com precisão
 *   no limiar psicofísico (~78% de acerto).
 */
export function stepAdaptiveHit(
  state: AdaptiveStaircaseState,
  targetHits: number
): AdaptiveStaircaseState {
  const hitsPerStep = targetHits <= 5 ? 1 : 2;
  const nextStreak = state.streakHits + 1;

  if (nextStreak < hitsPerStep) {
    return {
      ...state,
      streakHits: nextStreak,
      trail: [...state.trail, state.currentLoad],
    };
  }

  const baseStep = state.reversals === 0 ? 0.95 : state.reversals === 1 ? 0.65 : 0.4;
  const isReversal = state.lastDirection === 'down';
  const nextLoad = clampLoad(state.currentLoad + baseStep);

  return {
    currentLoad: nextLoad,
    streakHits: 0,
    reversals: state.reversals + (isReversal ? 1 : 0),
    lastDirection: 'up',
    trail: [...state.trail, nextLoad],
  };
}

export function stepAdaptiveError(state: AdaptiveStaircaseState): AdaptiveStaircaseState {
  const downStep = state.reversals === 0 ? 1.05 : state.reversals === 1 ? 0.75 : 0.5;
  const isReversal = state.lastDirection === 'up';
  const nextLoad = clampLoad(state.currentLoad - downStep);

  return {
    currentLoad: nextLoad,
    streakHits: 0,
    reversals: state.reversals + (isReversal ? 1 : 0),
    lastDirection: 'down',
    trail: [...state.trail, nextLoad],
  };
}

/**
 * Calcula o ponto de equilíbrio real atingido na partida usando a segunda metade da trajetória
 * (onde a escada adaptativa já convergiu perto do limiar do usuário).
 */
export function computeEquilibriumIndex(trail: number[], fallbackLoad: number): number {
  if (!trail || trail.length === 0) return clampLoad(fallbackLoad);
  const startIdx = Math.floor(trail.length * 0.45);
  const tail = trail.slice(startIdx);
  const avg = tail.reduce((acc, v) => acc + v, 0) / tail.length;
  return clampLoad(avg);
}

/**
 * Estima a habilidade latente (theta, escala 1..20) no padrão TRI (Teoria de Resposta ao Item):
 * - Parte da dificuldade realmente sustentada (equilíbrio + pico alcançado).
 * - A precisão em torno do limiar psicofísico (78%) e a velocidade ajustam o theta para cima ou para baixo,
 *   sem derrubar para o piso quem já chegou a uma dificuldade muito acima da média da faixa etária.
 */
export function estimateTriAbility(params: {
  equilibriumIndex: number;
  trail?: number[];
  accuracyPct: number;
  rtRatio: number; // 0..1 (0.5 = ritmo esperado para a idade)
  correctCount: number;
}): number {
  const { equilibriumIndex, trail, accuracyPct, rtRatio, correctCount } = params;
  if (correctCount <= 0) return MIN_ADAPTIVE_LOAD;

  const peakLoad =
    trail && trail.length > 0 ? Math.max(...trail, equilibriumIndex) : equilibriumIndex;
  const baseDifficulty = equilibriumIndex * 0.78 + peakLoad * 0.22;

  // Ajuste fino pela precisão em torno do limiar esperado da escada adaptativa (~78%)
  const accAdj =
    accuracyPct >= 78
      ? ((accuracyPct - 78) / 22) * 1.35
      : -((78 - Math.max(0, accuracyPct)) / 78) * 3.4;

  // Ajuste fino pela velocidade (bloqueia bônus positivo se a precisão for baixa / chute)
  const clampedRt = Math.max(0, Math.min(1, rtRatio));
  const speedAdj =
    accuracyPct >= 55
      ? (clampedRt - 0.5) * 1.4
      : Math.min(0, (clampedRt - 0.5) * 0.8);

  return clampLoad(baseDifficulty + accAdj + speedAdj);
}

/**
 * Simula o ponto de equilíbrio médio esperado para uma pessoa da faixa etária informada
 * naquele domínio/exercício.
 */
export function getExpectedAgeEquilibrium(
  ageBracket: AgeBracket | string | null | undefined,
  domain: DomainKey,
  _slug?: GameSlug
): { expected: number; sd: number } {
  const key = (ageBracket && ageBracket in AGE_EXPECTED_EQUILIBRIUM
    ? ageBracket
    : '25-34') as AgeBracket;
  const base = AGE_EXPECTED_EQUILIBRIUM[key];
  const offset = DOMAIN_LOAD_OFFSET[domain] ?? 0;
  return {
    expected: clampLoad(base.mean + offset),
    sd: base.sd,
  };
}

/**
 * Estimativa normativa: quantos % das pessoas da faixa etária chegam a esta fase
 * (curva normal do nível sustentável esperado para a idade naquela habilidade).
 */
export function getStageReachPercent(
  stage: number,
  ageBracket: AgeBracket | string | null | undefined,
  domain: DomainKey
): number {
  const { expected, sd } = getExpectedAgeEquilibrium(ageBracket, domain);
  const safe = Math.max(1, stage);
  if (safe <= 1) return 99;
  // Chegar à fase N = sustentar pelo menos o nível N - 0,5
  const z = (safe - 0.5 - expected) / Math.max(0.5, sd);
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const tail = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const cdf = z >= 0 ? 1 - tail : tail;
  const pct = (1 - cdf) * 100;
  return pct >= 10 ? Math.round(pct) : Math.max(0.1, Number(pct.toFixed(1)));
}

export function getEquilibriumBandLabel(load: number): string {
  if (load < 3.5) return 'Ritmo leve';
  if (load < 7.0) return 'Ritmo moderado';
  if (load < 11.5) return 'Ritmo intenso';
  if (load < 15.5) return 'Ritmo alto';
  return 'Ritmo máximo';
}

export function getIntensityLabel(load: number): string {
  return getEquilibriumBandLabel(load);
}

export function buildAgeComparisonNote(
  equilibrium: number,
  expected: number,
  ageLabel: string
): string {
  const diff = Number((equilibrium - expected).toFixed(1));
  if (diff >= 1.2) {
    return `Acima da média esperada para ${ageLabel}.`;
  }
  if (diff <= -1.2) {
    return `Ritmo em construção para ${ageLabel}, focando em precisão.`;
  }
  return `Dentro do esperado para ${ageLabel}.`;
}

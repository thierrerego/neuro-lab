import type {
  AgeBracket,
  BenchmarkDistribution,
  ClinicalMetricsSummary,
  CognitiveDossier,
  CognitiveSessionRecord,
  DomainKey,
  DomainScoresRecord,
  GameMasterySummary,
  GameProgressRecord,
  GameSlug,
  PopulationBenchmarks,
  UserProfile,
} from '../types/cognitive';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_REGISTRY, GAMES_BY_DOMAIN } from './gameRegistry';
import { getAgeBracketMeta, normalCDF, scoreToPercent } from './psychometricEngine';

/**
 * Parâmetros normativos recalibrados (mediana real = 500, σ = 235):
 * - 500 = 50% | < 200 < 10% | 750 ≈ 85% | 900+ = elite/ápice
 */
export const NORMATIVE_BENCHMARKS: PopulationBenchmarks = {
  source: 'normative',
  sample_sessions: 0,
  distinct_users: 0,
  global: { mean: 500, sd: 235, p50: 500, p75: 658, p90: 801, p99: 960 },
  domains: {
    selective_attention: { mean: 505, sd: 230, p50: 505, p75: 660, p90: 800, p99: 958, avg_rt_ms: 1180 },
    working_memory: { mean: 495, sd: 235, p50: 495, p75: 653, p90: 796, p99: 955, avg_rt_ms: 1280 },
    fluid_reasoning: { mean: 490, sd: 240, p50: 490, p75: 652, p90: 798, p99: 958, avg_rt_ms: 1980 },
    processing_speed: { mean: 510, sd: 228, p50: 510, p75: 664, p90: 802, p99: 960, avg_rt_ms: 930 },
    numerical_cognition: { mean: 498, sd: 235, p50: 498, p75: 656, p90: 799, p99: 958, avg_rt_ms: 1520 },
    inhibitory_control: { mean: 502, sd: 232, p50: 502, p75: 658, p90: 799, p99: 958, avg_rt_ms: 790 },
  },
  games: {
    'visual-search': { mean: 508, sd: 230, p50: 508, p75: 663, p90: 803, p99: 960, avg_rt_ms: 1150, early_rate_pct: 34 },
    'sustained-tracking': { mean: 496, sd: 235, p50: 496, p75: 654, p90: 797, p99: 955, avg_rt_ms: 1350, early_rate_pct: 28 },
    'spatial-span': { mean: 498, sd: 235, p50: 498, p75: 656, p90: 799, p99: 958, avg_rt_ms: 1260, early_rate_pct: 30 },
    'dual-n-back': { mean: 490, sd: 238, p50: 490, p75: 650, p90: 795, p99: 955, avg_rt_ms: 1220, early_rate_pct: 26 },
    'raven-matrices': { mean: 488, sd: 240, p50: 488, p75: 650, p90: 796, p99: 956, avg_rt_ms: 2380, early_rate_pct: 24 },
    'path-logic': { mean: 502, sd: 232, p50: 502, p75: 658, p90: 799, p99: 958, avg_rt_ms: 1300, early_rate_pct: 34 },
    'speed-match': { mean: 515, sd: 225, p50: 515, p75: 667, p90: 803, p99: 960, avg_rt_ms: 770, early_rate_pct: 40 },
    'symbol-digit': { mean: 506, sd: 230, p50: 506, p75: 661, p90: 801, p99: 958, avg_rt_ms: 1060, early_rate_pct: 36 },
    'chain-arithmetic': { mean: 496, sd: 236, p50: 496, p75: 655, p90: 798, p99: 958, avg_rt_ms: 1620, early_rate_pct: 30 },
    'number-comparison': { mean: 504, sd: 232, p50: 504, p75: 660, p90: 801, p99: 958, avg_rt_ms: 1360, early_rate_pct: 36 },
    'stroop-conflict': { mean: 504, sd: 232, p50: 504, p75: 660, p90: 801, p99: 958, avg_rt_ms: 910, early_rate_pct: 34 },
    'go-nogo-reflex': { mean: 500, sd: 234, p50: 500, p75: 658, p90: 800, p99: 958, avg_rt_ms: 630, early_rate_pct: 32 },
  },
};

export function adjustDistributionForAge(
  dist: BenchmarkDistribution,
  ageBracket?: AgeBracket | string | null
): BenchmarkDistribution {
  const offset = getAgeBracketMeta(ageBracket).meanOffset;
  if (offset === 0) return dist;
  return {
    ...dist,
    mean: Math.max(300, Math.min(700, dist.mean + offset)),
    p50: Math.max(300, Math.min(700, dist.p50 + offset)),
    p75: Math.max(420, Math.min(820, dist.p75 + offset)),
    p90: Math.max(550, Math.min(910, dist.p90 + offset)),
    p99: Math.max(720, Math.min(990, dist.p99 + offset)),
  };
}

interface ArchetypeDef {
  title: string;
  subtitle: string;
  color: string;
  trait: string;
}

const ARCHETYPE_PAIRS: Record<string, ArchetypeDef> = {
  'inhibitory_control+processing_speed': {
    title: 'Perfil Executivo Preciso',
    subtitle: 'Alta velocidade de resposta com baixo índice de impulsividade',
    color: '#38bdf8',
    trait: 'responde rápido mantendo o freio decisório contra erros por impulso',
  },
  'fluid_reasoning+working_memory': {
    title: 'Perfil Analítico Estrutural',
    subtitle: 'Elevada retenção ativa combinada à detecção de padrões complexos',
    color: '#818cf8',
    trait: 'sustenta múltiplas variáveis na memória operacional enquanto infere regras novas',
  },
  'numerical_cognition+selective_attention': {
    title: 'Perfil Quantitativo Focado',
    subtitle: 'Foco sustentado aliado à precisão em cálculo mental',
    color: '#10b981',
    trait: 'filtra distratores enquanto manipula relações numéricas com clareza',
  },
  'processing_speed+selective_attention': {
    title: 'Perfil de Varredura Ágil',
    subtitle: 'Rápida triagem visual e resposta imediata sob estímulos competitivos',
    color: '#38bdf8',
    trait: 'localiza estímulos relevantes em ambientes densos com baixa latência',
  },
  'selective_attention+working_memory': {
    title: 'Perfil de Vigilância Operacional',
    subtitle: 'Acompanhamento contínuo com retenção sequencial preservada',
    color: '#818cf8',
    trait: 'monitora múltiplos elementos simultâneos sem perder a ordem de referência',
  },
  'fluid_reasoning+selective_attention': {
    title: 'Perfil Decodificador Visual',
    subtitle: 'Captação de detalhes sutis e inferência rápida de regras ocultas',
    color: '#a78bfa',
    trait: 'isola sinais relevantes entre distratores e identifica padrões estruturais',
  },
  'inhibitory_control+selective_attention': {
    title: 'Perfil de Foco Blindado',
    subtitle: 'Alta resistência a distratores e estímulos conflitantes',
    color: '#38bdf8',
    trait: 'mantém o alvo cognitivo estável mesmo sob interferência direta',
  },
  'processing_speed+working_memory': {
    title: 'Perfil de Atualização Rápida',
    subtitle: 'Alta taxa de renovação da memória de trabalho sob pressão temporal',
    color: '#f59e0b',
    trait: 'acompanha e atualiza sequências dinâmicas com fluidez acima da média',
  },
  'numerical_cognition+working_memory': {
    title: 'Perfil de Cálculo Operacional',
    subtitle: 'Manipulação numérica mental sustentada sem perda de etapas',
    color: '#10b981',
    trait: 'retém resultados intermediários e encadeia operações com autonomia',
  },
  'inhibitory_control+working_memory': {
    title: 'Perfil de Controle Executivo',
    subtitle: 'Proteção ativa da memória operacional contra interferências',
    color: '#818cf8',
    trait: 'mantém o plano mental íntegro sem ceder a respostas precipitadas',
  },
  'fluid_reasoning+processing_speed': {
    title: 'Perfil Estratégico Ágil',
    subtitle: 'Resolução acelerada de problemas inéditos sob restrição de tempo',
    color: '#a78bfa',
    trait: 'assimila regras novas rapidamente mantendo ritmo consistente',
  },
  'fluid_reasoning+numerical_cognition': {
    title: 'Perfil Lógico-Quantitativo',
    subtitle: 'Sinergia entre abstração estrutural e fluidez numérica',
    color: '#10b981',
    trait: 'traduz cenários complexos em relações lógicas e quantitativas claras',
  },
  'fluid_reasoning+inhibitory_control': {
    title: 'Perfil Deliberativo',
    subtitle: 'Avaliação criteriosa que evita atalhos impulsivos',
    color: '#a78bfa',
    trait: 'bloqueia respostas óbvias incorretas para selecionar a solução válida',
  },
  'numerical_cognition+processing_speed': {
    title: 'Perfil Quantitativo Veloz',
    subtitle: 'Estimativa rápida de grandezas e agilidade aritmética',
    color: '#f59e0b',
    trait: 'compara magnitudes e conclui cálculos mentais com alta eficiência',
  },
  'inhibitory_control+numerical_cognition': {
    title: 'Perfil Analítico Criterioso',
    subtitle: 'Avaliação numérica precisa com elevado autocontrole',
    color: '#10b981',
    trait: 'verifica grandezas e operações com baixa taxa de erro por precipitação',
  },
};

const BALANCED_ARCHETYPE: ArchetypeDef = {
  title: 'Perfil Cognitivo Equilibrado',
  subtitle: 'Distribuição homogênea entre os seis domínios avaliados',
  color: '#38bdf8',
  trait: 'mantém desempenho simétrico entre atenção, memória, lógica, velocidade, cálculo e inibição',
};

const BOTTLENECK_HUMAN_LABELS: Record<string, { short: string; domains: DomainKey[] }> = {
  wm_reread: { short: 'precisar reler ou reconfirmar instruções recentes', domains: ['working_memory'] },
  att_tabs: { short: 'fragmentação de foco ao alternar tarefas', domains: ['selective_attention'] },
  inh_impulse: { short: 'respostas precipitadas sob pressão de tempo', domains: ['inhibitory_control'] },
  spd_num_slow: { short: 'maior lentidão em conexões rápidas e cálculo mental', domains: ['processing_speed', 'numerical_cognition'] },
  fld_stuck: { short: 'dificuldade inicial diante de problemas sem roteiro prévio', domains: ['fluid_reasoning'] },
};

export function percentileFromBenchmark(
  score: number,
  dist: BenchmarkDistribution,
  ageBracket?: AgeBracket | string | null
): number {
  if (score <= 0) return 1.0;
  const adjusted = adjustDistributionForAge(dist, ageBracket);
  const safeSd = Math.max(55, adjusted.sd || 235);
  const pct = normalCDF(score, adjusted.mean, safeSd) * 100;
  return Number(Math.max(1.0, Math.min(99.9, pct)).toFixed(1));
}

export function percentileToTopPercent(percentile: number): number {
  return Math.max(1, Math.min(99, Math.round(100 - percentile)));
}

export function getPopulationBand(percentile: number): CognitiveDossier['populationBand'] {
  if (percentile >= 99) return 'Ápice (Top 1%)';
  if (percentile >= 90) return 'Elite (Top 10%)';
  if (percentile >= 75) return 'Acima da Média (Top 25%)';
  if (percentile >= 45) return 'Média Geral (50%)';
  return 'Em Evolução';
}

export function resolveArchetype(
  scores: DomainScoresRecord
): { def: ArchetypeDef; topDomains: [DomainKey, DomainKey]; ranked: DomainKey[] } {
  const ranked = [...DOMAIN_LIST]
    .sort((a, b) => (scores[b.key] ?? 500) - (scores[a.key] ?? 500))
    .map((d) => d.key);

  const top1 = ranked[0];
  const top2 = ranked[1];
  const highest = scores[top1] ?? 500;
  const lowest = scores[ranked[ranked.length - 1]] ?? 500;

  if (highest - lowest < 14) {
    return { def: BALANCED_ARCHETYPE, topDomains: [top1, top2], ranked };
  }

  const pairKey = [top1, top2].sort().join('+');
  return {
    def: ARCHETYPE_PAIRS[pairKey] ?? BALANCED_ARCHETYPE,
    topDomains: [top1, top2],
    ranked,
  };
}

export function computeClinicalMetrics(sessions: CognitiveSessionRecord[]): ClinicalMetricsSummary {
  if (sessions.length === 0) {
    return {
      avgRtMs: 0,
      rtDeltaMs: null,
      consistencyIndex: 0,
      consistencyDelta: null,
      avgRtSdMs: 0,
      avgAccuracyPct: 0,
      impulsivityPerSession: 0,
      earlyClearRatePct: 0,
      totalSessions: 0,
    };
  }

  const chronological = [...sessions].reverse();
  const validRt = chronological.filter((s) => s.rt_mean_ms > 0);
  const avgRtMs = validRt.length
    ? Math.round(validRt.reduce((acc, s) => acc + s.rt_mean_ms, 0) / validRt.length)
    : 0;

  const validSd = chronological.filter((s) => s.rt_sd_ms > 0);
  const avgRtSdMs = validSd.length
    ? Math.round(validSd.reduce((acc, s) => acc + s.rt_sd_ms, 0) / validSd.length)
    : 0;

  const avgAccuracyPct = Number(
    (chronological.reduce((acc, s) => acc + Number(s.accuracy_pct || 0), 0) / chronological.length).toFixed(1)
  );
  const impulsivityPerSession = Number(
    (chronological.reduce((acc, s) => acc + (s.commission_errors || 0), 0) / chronological.length).toFixed(1)
  );
  const earlyClears = chronological.filter((s) => s.completed_early || s.waves_completed >= 5).length;
  const earlyClearRatePct = Math.round((earlyClears / chronological.length) * 100);

  const calcConsistency = (slice: CognitiveSessionRecord[]): number => {
    if (slice.length === 0) return 0;
    const rts = slice.filter((s) => s.rt_mean_ms > 0);
    const avgCv = rts.length
      ? rts.reduce((acc, s) => acc + (s.rt_sd_ms > 0 ? s.rt_sd_ms / s.rt_mean_ms : 0.28), 0) / rts.length
      : 0.3;
    const avgComm = slice.reduce((acc, s) => acc + (s.commission_errors || 0), 0) / slice.length;
    const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, avgCv - 0.15) * 130)));
    const impulseScore = Math.max(0, Math.min(100, Math.round(100 - avgComm * 12)));
    return Math.round(stabilityScore * 0.62 + impulseScore * 0.38);
  };

  const consistencyIndex = calcConsistency(chronological.slice(-10));

  let rtDeltaMs: number | null = null;
  if (validRt.length >= 2) {
    const windowSize = Math.max(1, Math.min(4, Math.floor(validRt.length / 2)));
    const initialAvg =
      validRt.slice(0, windowSize).reduce((acc, s) => acc + s.rt_mean_ms, 0) / windowSize;
    const recentAvg =
      validRt.slice(-windowSize).reduce((acc, s) => acc + s.rt_mean_ms, 0) / windowSize;
    rtDeltaMs = Math.round(recentAvg - initialAvg);
  }

  let consistencyDelta: number | null = null;
  if (chronological.length >= 4) {
    const split = Math.floor(chronological.length / 2);
    const earlyC = calcConsistency(chronological.slice(0, split));
    const lateC = calcConsistency(chronological.slice(split));
    consistencyDelta = lateC - earlyC;
  }

  return {
    avgRtMs,
    rtDeltaMs,
    consistencyIndex,
    consistencyDelta,
    avgRtSdMs,
    avgAccuracyPct,
    impulsivityPerSession,
    earlyClearRatePct,
    totalSessions: sessions.length,
  };
}

export function buildGameMasteryList(
  progress: Record<GameSlug, GameProgressRecord>,
  sessions: CognitiveSessionRecord[],
  benchmarks: PopulationBenchmarks,
  ageBracket?: AgeBracket | string | null
): GameMasterySummary[] {
  return GAME_REGISTRY.map((g) => {
    const prog = progress[g.slug];
    const gameSessions = sessions.filter((s) => s.game_slug === g.slug);
    const bench = benchmarks.games[g.slug] ?? NORMATIVE_BENCHMARKS.games[g.slug];

    const bestWave = gameSessions.reduce((mx, s) => Math.max(mx, s.waves_completed || 0), 0);
    const bestRemainingMs = gameSessions.reduce(
      (mx, s) => (s.completed_early ? Math.max(mx, s.time_remaining_ms || 0) : mx),
      0
    );

    const avgScore = gameSessions.length
      ? Math.round(gameSessions.reduce((acc, s) => acc + s.score, 0) / gameSessions.length)
      : 0;

    const earlyCount = gameSessions.filter((s) => s.completed_early || s.waves_completed >= 5).length;
    const earlyClearRatePct = gameSessions.length
      ? Math.round((earlyCount / gameSessions.length) * 100)
      : 0;

    const bestSessionPct = gameSessions.reduce((mx, s) => Math.max(mx, Number(s.percentile || 0)), 0);
    const refScore =
      prog?.highest_score > 0
        ? Math.round(prog.highest_score * 0.65 + (avgScore || prog.highest_score) * 0.35)
        : 0;
    const percentile =
      refScore > 0
        ? Math.min(bestSessionPct > 0 ? bestSessionPct : 99.9, percentileFromBenchmark(refScore, bench, ageBracket))
        : 50;

    const last10 = [...gameSessions]
      .slice(0, 10)
      .reverse()
      .map((s, idx) => {
        const dt = new Date(s.created_at);
        const dateLabel = Number.isNaN(dt.getTime())
          ? `#${idx + 1}`
          : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
        return {
          idx: idx + 1,
          score: s.score,
          waves: s.waves_completed || 0,
          dateLabel,
        };
      });

    return {
      slug: g.slug,
      domain: g.domain,
      currentStage: prog?.current_stage ?? 0,
      highestScore: prog?.highest_score ?? 0,
      totalPlays: prog?.total_plays ?? gameSessions.length,
      bestWave,
      bestRemainingMs,
      percentile: Number(percentile.toFixed(1)),
      topPercent: percentileToTopPercent(percentile),
      earlyClearRatePct,
      avgScore,
      sparkline: last10,
    };
  });
}

function estimateSpeedBeatsPct(avgRtMs: number): number {
  if (avgRtMs <= 0) return 50;
  const pct = normalCDF(1250 - avgRtMs, 0, 380) * 100;
  return Math.max(5, Math.min(98, Math.round(pct)));
}

/**
 * Motor do Dossiê Cognitivo em linguagem clara, objetiva e em porcentagens.
 */
export function generateCognitiveDossier(params: {
  profile: UserProfile;
  scores: DomainScoresRecord;
  progress: Record<GameSlug, GameProgressRecord>;
  sessions: CognitiveSessionRecord[];
  benchmarks: PopulationBenchmarks;
}): CognitiveDossier {
  const { profile, scores, progress, sessions, benchmarks } = params;
  const { def, topDomains, ranked } = resolveArchetype(scores);
  const clinical = computeClinicalMetrics(sessions);
  const ageLabel = getAgeBracketMeta(profile.age_bracket).label;

  const globalPct = percentileFromBenchmark(
    profile.global_cognitive_index,
    benchmarks.global,
    profile.age_bracket
  );
  const topPercent = percentileToTopPercent(globalPct);
  const populationBand = getPopulationBand(globalPct);

  const top1 = DOMAIN_MAP[topDomains[0]];
  const top2 = DOMAIN_MAP[topDomains[1]];
  const top1Score = scores[top1.key] ?? 500;
  const top2Score = scores[top2.key] ?? 500;
  const top1Pct = Math.round(percentileFromBenchmark(top1Score, benchmarks.domains[top1.key], profile.age_bracket));
  const top2Pct = Math.round(percentileFromBenchmark(top2Score, benchmarks.domains[top2.key], profile.age_bracket));
  const top1Top = percentileToTopPercent(top1Pct);

  const bottleneckKey = ranked[ranked.length - 1];
  const bottleneckMeta = DOMAIN_MAP[bottleneckKey];
  const bottleneckScore = scores[bottleneckKey] ?? 500;
  const bottleneckBase = scores.baseline_scores?.[bottleneckKey] ?? bottleneckScore;
  const spreadPct = scoreToPercent(top1Score) - scoreToPercent(bottleneckScore);
  const growthRoomPct = Math.max(6, Math.min(55, Math.round(((Math.max(top1Score, 750) - bottleneckScore) / 1000) * 100)));
  const changePct =
    bottleneckBase > 0 ? Math.round(((bottleneckScore - bottleneckBase) / bottleneckBase) * 100) : 0;

  const bottleneckGames = GAMES_BY_DOMAIN[bottleneckKey];
  const recommendedGameMeta = [...bottleneckGames].sort((a, b) => {
    const pa = progress[a.slug];
    const pb = progress[b.slug];
    const stageDiff = (pa?.current_stage ?? 0) - (pb?.current_stage ?? 0);
    if (stageDiff !== 0) return stageDiff;
    return (pa?.total_plays ?? 0) - (pb?.total_plays ?? 0);
  })[0];

  const declaredBottlenecks = (profile.cognitive_bottlenecks ?? [])
    .map((id) => ({ id, meta: BOTTLENECK_HUMAN_LABELS[id] }))
    .filter((x) => Boolean(x.meta));

  const ctxArray =
    profile.application_contexts?.length > 0
      ? profile.application_contexts
      : (profile.application_context || '')
          .split(' • ')
          .map((s) => s.trim())
          .filter(Boolean);
  const formattedContexts =
    ctxArray.length === 0
      ? ''
      : ctxArray.length === 1
        ? ctxArray[0].toLowerCase()
        : `${ctxArray
            .slice(0, -1)
            .map((c) => c.toLowerCase())
            .join(', ')} e ${ctxArray[ctxArray.length - 1].toLowerCase()}`;

  const stamina = profile.mental_stamina_baseline ?? 3;
  const speedBeatsPct = estimateSpeedBeatsPct(clinical.avgRtMs);

  // --- Parágrafo 1: Equilíbrio entre os 6 domínios, Pontos Fortes e Faixa Etária ---
  const balanceNote =
    spreadPct <= 8
      ? `Seus 6 domínios apresentam equilíbrio elevado (variação de apenas ${spreadPct}% entre o maior e o menor índice)`
      : `Há uma diferença de ${spreadPct}% entre seu domínio mais desenvolvido e a área prioritária`;

  const speedPhrase =
    clinical.avgRtMs > 0
      ? `com tempo de resposta superior a ${speedBeatsPct}% da faixa ${ageLabel}`
      : `com protocolo configurado para ${profile.daily_goal_minutes} minutos por dia`;

  const goalPhrase = formattedContexts
    ? ` Alinhado ao foco em ${formattedContexts}, você ${def.trait}.`
    : ` Na prática, você ${def.trait}.`;

  const p1 =
    def.title === BALANCED_ARCHETYPE.title
      ? `No índice global (${scoreToPercent(profile.global_cognitive_index)}%), você supera ${Math.round(globalPct)}% da faixa ${ageLabel}. ${balanceNote}, com leve liderança em ${top1.name} (${scoreToPercent(top1Score)}%) e ${top2.name} (${scoreToPercent(top2Score)}%), ${speedPhrase}.${goalPhrase}`
      : `Seus maiores pontos fortes hoje são ${top1.name} (${scoreToPercent(top1Score)}%, Top ${top1Top}% na faixa ${ageLabel}) e ${top2.name} (${scoreToPercent(top2Score)}%, superando ${top2Pct}% da faixa), ${speedPhrase}. ${balanceNote}.${goalPhrase}`;

  // --- Parágrafo 2: Comportamento sob Pressão e Estabilidade ---
  let p2: string;
  if (sessions.length === 0) {
    const staminaText =
      stamina <= 2
        ? 'Como sua resistência à fadiga basal é inicial, o protocolo começa em cadência leve para construir constância.'
        : 'Com boa resistência à carga contínua, a dificuldade progride de forma constante nas 5 ondas de cada sessão.';
    p2 = `Conclua suas primeiras sessões para liberar a leitura de precisão e estabilidade sob pressão temporal. ${staminaText}`;
  } else {
    const accRounded = Math.round(clinical.avgAccuracyPct);
    let precisionTone: string;
    if (accRounded >= 88 && clinical.impulsivityPerSession <= 1.2) {
      precisionTone = `Sob pressão temporal, manteve precisão média de ${accRounded}% com baixo índice de erros por impulsividade`;
    } else if (accRounded < 65) {
      precisionTone = `Sua precisão média atual está em ${accRounded}%, indicando respostas apressadas — reduzir discretamente o ritmo tende a elevar rapidamente o índice final`;
    } else {
      precisionTone = `Manteve equilíbrio consistente sob pressão, registrando ${accRounded}% de precisão média`;
    }

    const wavePhrase =
      clinical.earlyClearRatePct >= 45
        ? `Completou integralmente as 5 ondas antes do tempo limite em ${clinical.earlyClearRatePct}% das sessões, sustentando ${clinical.consistencyIndex}% de estabilidade de foco.`
        : clinical.earlyClearRatePct > 0
          ? `Concluiu as 5 ondas completas em ${clinical.earlyClearRatePct}% das sessões, com ${clinical.consistencyIndex}% de estabilidade atencional.`
          : `Sua estabilidade de foco está em ${clinical.consistencyIndex}% — manter precisão acima de 80% até a 5ª onda destravará os próximos níveis.`;

    p2 = `${precisionTone}. ${wavePhrase}`;
  }

  // --- Parágrafo 3: Área em Desenvolvimento & Prescrição ---
  let anamnesisLead = '';
  if (declaredBottlenecks.length > 0) {
    const matched = declaredBottlenecks.find((b) => b.meta.domains.includes(bottleneckKey));
    if (matched) {
      anamnesisLead = `Os dados confirmam o atrito relatado na anamnese (${matched.meta.short}): `;
    } else {
      const firstDeclared = declaredBottlenecks[0];
      const declaredDomName = DOMAIN_MAP[firstDeclared.meta.domains[0]].shortName;
      anamnesisLead = `Seu desempenho em ${declaredDomName} ficou acima da percepção inicial, enquanto `;
    }
  }

  const trendPhrase =
    changePct > 2
      ? `já evoluiu +${changePct}% desde a linha de base, mantendo cerca de ${growthRoomPct}% de margem adicional`
      : changePct < -2
        ? `oscilou ${changePct}% em relação à linha de base e apresenta ${growthRoomPct}% de margem de recuperação`
        : `apresenta ${growthRoomPct}% de margem de evolução em relação aos seus domínios mais fortes`;

  const p3 = `${anamnesisLead}${anamnesisLead ? 'a' : 'A'} área com maior potencial de ganho é ${bottleneckMeta.name} (${scoreToPercent(bottleneckScore)}%), que ${trendPhrase}. Priorizar ${recommendedGameMeta.name} no protocolo diário é a intervenção mais direta para elevar o equilíbrio global.`;

  const shareSummaryText = [
    `NeuroLab — Dossiê Cognitivo`,
    `Perfil: ${def.title}`,
    `Índice Global: ${scoreToPercent(profile.global_cognitive_index)}% · Faixa ${ageLabel}: Top ${topPercent}% (superou ${Math.round(globalPct)}%)`,
    `Pontos fortes: ${top1.name} (${scoreToPercent(top1Score)}%) e ${top2.name} (${scoreToPercent(top2Score)}%)`,
    sessions.length > 0
      ? `Precisão média: ${Math.round(clinical.avgAccuracyPct)}% · Estabilidade de foco: ${clinical.consistencyIndex}%`
      : `Protocolo diário: ${profile.daily_goal_minutes} min/dia`,
    `Prioridade atual: ${bottleneckMeta.name} → ${recommendedGameMeta.name}`,
  ].join('\n');

  return {
    archetypeTitle: def.title,
    archetypeSubtitle: def.subtitle,
    archetypeColor: def.color,
    topDomains,
    bottleneckDomain: bottleneckKey,
    recommendedGame: recommendedGameMeta.slug,
    globalPercentile: globalPct,
    topPercent,
    populationBand,
    paragraphs: {
      profileAndStrengths: p1,
      behaviorUnderPressure: p2,
      bottleneckAndPrescription: p3,
    },
    clinical,
    shareSummaryText,
  };
}

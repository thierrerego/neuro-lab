import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AgeBracket,
  BenchmarkDistribution,
  CognitiveSessionRecord,
  CognitiveSnapshotRecord,
  DomainKey,
  DomainScoresRecord,
  PopulationBenchmarks,
  ThemeMode,
} from '../types/cognitive';
import { DOMAIN_LIST, DOMAIN_MAP } from '../engine/gameRegistry';
import {
  adjustDistributionForAge,
  getPopulationBand,
  percentileFromBenchmark,
  percentileToTopPercent,
} from '../engine/cognitiveProfiler';
import { getAgeBracketMeta, scoreToPercent } from '../engine/psychometricEngine';
import { getAppNow } from '../lib/appClock';

/* ============================================================================
   1. GRÁFICO DE RADAR (Linha de Base vs. Atual vs. Média da Faixa)
   ============================================================================ */
export function ComparativeRadarChart({
  scores,
  benchmarks,
  theme,
  ageBracket,
  totalStages,
}: {
  scores: DomainScoresRecord;
  benchmarks: PopulationBenchmarks;
  theme: ThemeMode;
  ageBracket?: AgeBracket;
  totalStages: number;
}) {
  const isLight = theme === 'light';
  const ageLabel = getAgeBracketMeta(ageBracket).label;

  const data = useMemo(
    () =>
      DOMAIN_LIST.map((d) => {
        const adj = adjustDistributionForAge(benchmarks.domains[d.key], ageBracket);
        return {
          domain: d.shortName,
          fullName: d.name,
          Base: scoreToPercent(scores.baseline_scores?.[d.key] ?? 0),
          Atual: scoreToPercent(scores[d.key] ?? 0),
          Media: scoreToPercent(adj.mean),
        };
      }),
    [scores, benchmarks, ageBracket]
  );

  const currentStroke = isLight ? '#4F6EF7' : '#7C98FF';
  const currentFill = isLight ? '#4F6EF7' : '#7C98FF';
  const baseStroke = '#94A3B8';
  const meanStroke = isLight ? '#F59E0B' : '#FBBF24';
  const tickColor = isLight ? '#4B5563' : '#A8B5CC';

  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <div className="text-base font-bold tracking-tight">Equilíbrio Cognitivo</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
            Escala percentual · Estimativa {ageLabel}
          </div>
        </div>
        <span
          className="text-xs font-semibold tabular px-3 py-1 rounded-full shrink-0"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
        >
          {totalStages} níveis
        </span>
      </div>

      {/* Legenda suave das 3 camadas */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium mt-3 mb-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 h-1 rounded-full" style={{ background: currentStroke }} />
          <span>Atual</span>
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: baseStroke }} />
          <span>Linha de Base</span>
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <span className="w-3.5 border-t-2 border-dotted" style={{ borderColor: meanStroke }} />
          <span>Média ({ageLabel})</span>
        </span>
      </div>

      <div className="w-full h-[265px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
            <PolarGrid stroke={isLight ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,0.16)'} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <PolarAngleAxis dataKey="domain" tick={{ fill: tickColor, fontSize: 12, fontWeight: 600 }} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                fontSize: '12px',
                color: 'var(--text)',
                boxShadow: 'var(--card-shadow)',
              }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
              formatter={(value, name) => [`${value}%`, name]}
            />
            <Radar
              name={`Média (${ageLabel})`}
              dataKey="Media"
              stroke={meanStroke}
              fill="transparent"
              strokeWidth={1.8}
              strokeDasharray="2 3"
            />
            <Radar
              name="Linha de Base"
              dataKey="Base"
              stroke={baseStroke}
              fill="transparent"
              strokeWidth={1.8}
              strokeDasharray="5 3"
            />
            <Radar
              name="Estado Atual"
              dataKey="Atual"
              stroke={currentStroke}
              fill={currentFill}
              fillOpacity={0.18}
              strokeWidth={2.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ============================================================================
   2. DISTRIBUIÇÃO NORMATIVA POR FAIXA ETÁRIA (CURVA DE SINO)
   ============================================================================ */
export function BellCurveChart({
  score,
  dist,
  label,
  source,
  sampleSessions,
  theme,
  ageBracket,
  compact = false,
}: {
  score: number;
  dist: BenchmarkDistribution;
  label: string;
  source: 'population' | 'normative';
  sampleSessions: number;
  theme: ThemeMode;
  ageBracket?: AgeBracket;
  compact?: boolean;
}) {
  const isLight = theme === 'light';
  const ageLabel = getAgeBracketMeta(ageBracket).label;
  const adjustedDist = useMemo(() => adjustDistributionForAge(dist, ageBracket), [dist, ageBracket]);
  const hasScore = score > 0;
  const safeScore = hasScore ? Math.max(50, Math.min(1000, Math.round(score))) : 0;
  const percentile = hasScore ? percentileFromBenchmark(safeScore, dist, ageBracket) : 0;
  const topPct = hasScore ? percentileToTopPercent(percentile) : 100;
  const band = hasScore ? getPopulationBand(percentile) : 'Sem medição';

  const curveData = useMemo(() => {
    const mean = adjustedDist.mean || 500;
    const sd = Math.max(55, adjustedDist.sd || 235);
    const minX = 60;
    const maxX = 990;
    const steps = 43;
    const pts: { x: number; density: number; userFill: number | null }[] = [];

    for (let i = 0; i <= steps; i++) {
      const x = Math.round(minX + ((maxX - minX) * i) / steps);
      const z = (x - mean) / sd;
      const density = Number((Math.exp(-0.5 * z * z) * 100).toFixed(2));
      pts.push({
        x: scoreToPercent(x),
        density,
        userFill: hasScore && x <= safeScore ? density : null,
      });
    }
    return pts;
  }, [adjustedDist.mean, adjustedDist.sd, safeScore, hasScore]);

  const snapX = (valPct: number) => {
    let best = curveData[0]?.x ?? valPct;
    let minDiff = Infinity;
    for (const pt of curveData) {
      const d = Math.abs(pt.x - valPct);
      if (d < minDiff) {
        minDiff = d;
        best = pt.x;
      }
    }
    return best;
  };

  const accentHex = isLight ? '#4F6EF7' : '#7C98FF';
  const userHex = isLight ? '#10B981' : '#34D399';
  const axisColor = isLight ? '#6B7280' : '#7E8DA8';

  const milestones = [
    { label: 'Média', value: `${scoreToPercent(adjustedDist.p50)}%`, active: percentile >= 50 },
    { label: 'Top 25%', value: `${scoreToPercent(adjustedDist.p75)}%`, active: percentile >= 75 },
    { label: 'Top 10%', value: `${scoreToPercent(adjustedDist.p90)}%`, active: percentile >= 90 },
    { label: 'Top 1%', value: `${scoreToPercent(adjustedDist.p99)}%`, active: percentile >= 99 },
  ];

  const gradId = `bellFill-${label.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className={compact ? 'flex flex-col gap-3' : 'surface-card p-5 flex flex-col gap-4'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={compact ? 'text-sm font-bold' : 'text-base font-bold tracking-tight'}>
            {compact ? `Distribuição · ${label}` : `Estimativa Normativa · ${label}`}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
            {hasScore ? (
              <>
                {source === 'population' ? 'Base real: superou ' : 'Estimativa: superou '}
                <strong style={{ color: 'var(--text)' }}>{percentile}%</strong> na faixa {ageLabel}
              </>
            ) : (
              <>Sem medição ainda · conclua 1 exercício de 30s para posicionar na curva ({ageLabel})</>
            )}
          </div>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap tabular"
          style={{
            background: hasScore ? 'var(--accent-glow)' : 'var(--bg-subtle)',
            border: hasScore ? '1px solid var(--border-strong)' : '1px solid transparent',
            color: hasScore ? 'var(--accent)' : 'var(--text-soft)',
          }}
        >
          {!hasScore ? 'Sem dados' : percentile >= 50 ? `Top ${topPct}%` : band}
        </span>
      </div>

      <div className={`w-full ${compact ? 'h-[124px]' : 'h-[160px]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={curveData} margin={{ top: 18, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentHex} stopOpacity={0.32} />
                <stop offset="100%" stopColor={accentHex} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="x"
              type="number"
              domain={[10, 100]}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              tickCount={5}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, 114]} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                fontSize: '12px',
                color: 'var(--text)',
                boxShadow: 'var(--card-shadow)',
              }}
              labelFormatter={(v) => `Índice ${v}%`}
              formatter={(_, name) =>
                name === 'userFill' ? ['Faixa superada', ''] : ['Curva normativa', '']
              }
            />
            <Area
              type="monotone"
              dataKey="density"
              stroke={isLight ? 'rgba(100,116,139,0.38)' : 'rgba(148,163,184,0.35)'}
              fill={isLight ? 'rgba(100,116,139,0.08)' : 'rgba(148,163,184,0.08)'}
              strokeWidth={1.6}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="userFill"
              stroke={accentHex}
              fill={`url(#${gradId})`}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <ReferenceLine x={snapX(scoreToPercent(adjustedDist.p50))} stroke="#94A3B8" strokeDasharray="3 3" strokeWidth={1.2} />
            <ReferenceLine x={snapX(scoreToPercent(adjustedDist.p90))} stroke={accentHex} strokeDasharray="2 3" strokeWidth={1.2} />
            {hasScore && (
              <ReferenceLine
                x={snapX(scoreToPercent(safeScore))}
                stroke={userHex}
                strokeWidth={2.4}
                label={{
                  value: 'Você',
                  position: 'top',
                  fill: userHex,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {milestones.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl px-3 py-2.5 text-center"
            style={{
              background: m.active ? 'var(--accent-glow)' : 'var(--bg-subtle)',
              border: m.active ? '1px solid var(--border-strong)' : '1px solid transparent',
            }}
          >
            <div
              className="text-xs font-semibold leading-tight"
              style={{ color: m.active ? 'var(--accent)' : 'var(--text-soft)' }}
            >
              {m.label}
            </div>
            <div className="text-sm font-extrabold tabular mt-0.5">{m.value}</div>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="text-xs font-medium flex items-center justify-between flex-wrap gap-2" style={{ color: 'var(--text-soft)' }}>
          <span>Faixa {ageLabel} · Mediana {scoreToPercent(adjustedDist.p50)}%</span>
          <span>
            {source === 'population'
              ? `Base real (${sampleSessions} sessões)`
              : 'Estimativa normativa (literatura)'}
          </span>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   3. CURVA DE EVOLUÇÃO LONGITUDINAL (7d / 30d / Tudo × Índice Global ou Domínio)
   ============================================================================ */
type PeriodFilter = '7d' | '30d' | 'all';
type MetricFilter = 'icg' | DomainKey;

export function LongitudinalEvolutionChart({
  snapshots,
  sessions,
  scores,
  benchmarks,
  theme,
  ageBracket,
  selectedMetric,
  onSelectMetric,
}: {
  snapshots: CognitiveSnapshotRecord[];
  sessions: CognitiveSessionRecord[];
  scores: DomainScoresRecord;
  benchmarks: PopulationBenchmarks;
  theme: ThemeMode;
  ageBracket?: AgeBracket;
  selectedMetric: MetricFilter;
  onSelectMetric: (m: MetricFilter) => void;
}) {
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const isLight = theme === 'light';

  const points = useMemo(() => {
    const now = getAppNow().getTime();
    const cutoffMs =
      period === '7d'
        ? now - 7 * 86400_000
        : period === '30d'
          ? now - 30 * 86400_000
          : 0;

    // 1. Snapshots diários
    const filteredSnaps = snapshots
      .filter((s) => {
        if (!cutoffMs) return true;
        const ts = new Date(`${s.snapshot_date}T12:00:00`).getTime();
        return ts >= cutoffMs;
      })
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

    if (filteredSnaps.length >= 2) {
      return filteredSnaps.map((s) => {
        const [, mm, dd] = s.snapshot_date.split('-');
        const rawVal =
          selectedMetric === 'icg'
            ? s.global_index
            : (s.domain_scores_json?.[selectedMetric] ?? scores[selectedMetric] ?? 0);
        return {
          label: `${dd}/${mm}`,
          valor: scoreToPercent(rawVal),
        };
      });
    }

    // 2. Fallback por sessão no mesmo dia
    const filteredSess = [...sessions]
      .reverse()
      .filter((s) => {
        const ts = new Date(s.created_at).getTime();
        const inRange = !cutoffMs || Number.isNaN(ts) || ts >= cutoffMs;
        const matchDom = selectedMetric === 'icg' || s.domain === selectedMetric;
        return inRange && matchDom;
      })
      .slice(-20);

    if (filteredSess.length >= 2) {
      return filteredSess.map((s, idx) => ({
        label: `S${idx + 1}`,
        valor: scoreToPercent(s.score),
      }));
    }

    // 3. Fallback mínimo: Linha de Base vs. Atual (média apenas dos domínios já medidos)
    const measuredBase = DOMAIN_LIST.map((d) => scores.baseline_scores?.[d.key] ?? 0).filter((v) => v > 0);
    const measuredCur = DOMAIN_LIST.map((d) => scores[d.key] ?? 0).filter((v) => v > 0);

    const baseRaw =
      selectedMetric === 'icg'
        ? measuredBase.length > 0
          ? Math.round(measuredBase.reduce((acc, v) => acc + v, 0) / measuredBase.length)
          : 0
        : (scores.baseline_scores?.[selectedMetric] ?? 0);

    const curRaw =
      selectedMetric === 'icg'
        ? measuredCur.length > 0
          ? Math.round(measuredCur.reduce((acc, v) => acc + v, 0) / measuredCur.length)
          : 0
        : (scores[selectedMetric] ?? 0);

    return [
      { label: 'Base', valor: scoreToPercent(baseRaw) },
      { label: 'Atual', valor: scoreToPercent(curRaw) },
    ];
  }, [snapshots, sessions, scores, period, selectedMetric]);

  const rawDist =
    selectedMetric === 'icg'
      ? benchmarks.global
      : (benchmarks.domains[selectedMetric] ?? benchmarks.global);
  const benchMeanPct = scoreToPercent(adjustDistributionForAge(rawDist, ageBracket).mean);

  const strokeColor =
    selectedMetric === 'icg'
      ? isLight
        ? '#4F6EF7'
        : '#7C98FF'
      : DOMAIN_MAP[selectedMetric].color;
  const axisColor = isLight ? '#6B7280' : '#7E8DA8';

  return (
    <div className="surface-card p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold tracking-tight">Evolução Longitudinal</span>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
          {(
            [
              { id: '7d', label: '7d' },
              { id: '30d', label: '30d' },
              { id: 'all', label: 'Tudo' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: period === p.id ? 'var(--bg-card)' : 'transparent',
                color: period === p.id ? 'var(--accent)' : 'var(--text-soft)',
                boxShadow: period === p.id ? 'var(--card-shadow)' : 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por Índice Global ou Domínio */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => onSelectMetric('icg')}
          className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
            selectedMetric === 'icg' ? 'btn-accent' : 'btn-soft'
          }`}
        >
          Global
        </button>
        {DOMAIN_LIST.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelectMetric(d.key)}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
              selectedMetric === d.key ? 'btn-accent' : 'btn-soft'
            }`}
          >
            {d.shortName}
          </button>
        ))}
      </div>

      <div className="w-full h-[175px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="longGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.26} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                fontSize: '12px',
                color: 'var(--text)',
                boxShadow: 'var(--card-shadow)',
              }}
              formatter={(value) => [
                `${value}%`,
                selectedMetric === 'icg' ? 'Índice Global' : DOMAIN_MAP[selectedMetric].name,
              ]}
            />
            <ReferenceLine
              y={benchMeanPct}
              stroke="#F59E0B"
              strokeDasharray="3 3"
              strokeWidth={1.3}
              label={{ value: `Média ${benchMeanPct}%`, position: 'insideTopRight', fill: '#F59E0B', fontSize: 11 }}
            />
            <Area
              type="monotone"
              dataKey="valor"
              stroke={strokeColor}
              fill="url(#longGrad)"
              strokeWidth={2.5}
              dot={{ r: 3.2, fill: strokeColor }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ============================================================================
   4. SPARKLINE DAS ÚLTIMAS 10 SESSÕES POR EXERCÍCIO
   ============================================================================ */
export function GameSparkline({
  data,
  color,
}: {
  data: { idx: number; score: number; waves: number; dateLabel: string }[];
  color: string;
}) {
  if (data.length === 0) {
    return (
      <div
        className="h-[46px] rounded-2xl flex items-center justify-center text-xs font-medium"
        style={{ background: 'var(--bg-subtle)', color: 'var(--text-soft)', border: '1px dashed var(--border)' }}
      >
        Sem sessões registradas
      </div>
    );
  }

  const normalized = data.map((d) => ({ ...d, pct: scoreToPercent(d.score) }));
  const chartData =
    normalized.length === 1
      ? [
          { ...normalized[0], idx: 0 },
          { ...normalized[0], idx: 1 },
        ]
      : normalized;

  return (
    <div className="w-full h-[48px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 6, left: 6, bottom: 5 }}>
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              fontSize: '12px',
              padding: '6px 10px',
              color: 'var(--text)',
              boxShadow: 'var(--card-shadow)',
            }}
            labelFormatter={(_label, payload) => {
              const p = payload?.[0]?.payload as { dateLabel?: string } | undefined;
              return p?.dateLabel ?? '';
            }}
            formatter={(val, _name, item) => {
              const waves = (item?.payload as { waves?: number } | undefined)?.waves ?? 0;
              return [`${val}% · ${Math.round((waves / 5) * 100)}% da meta`, 'Índice'] as [string, string];
            }}
          />
          <Line
            type="monotone"
            dataKey="pct"
            stroke={color}
            strokeWidth={2.4}
            dot={{ r: 2.6, fill: color }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

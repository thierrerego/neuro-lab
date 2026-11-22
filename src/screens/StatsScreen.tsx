import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
} from 'recharts';
import type { AppDataState } from '../lib/dataService';
import { DOMAIN_LIST, GAME_REGISTRY } from '../engine/gameRegistry';

interface StatsScreenProps {
  data: AppDataState;
}

export function StatsScreen({ data }: StatsScreenProps) {
  const { profile, scores, sessions, progress } = data;
  const isGamified = profile.theme_preference === 'gamified';

  const radarData = DOMAIN_LIST.map((d) => ({
    domain: d.shortName,
    Atual: scores[d.key] ?? 500,
    Base: scores.baseline_scores?.[d.key] ?? 500,
  }));

  const recentSessions = [...sessions].slice(0, 12).reverse().map((s, idx) => ({
    n: `#${idx + 1}`,
    rt: s.rt_mean_ms,
    acc: Math.round(s.accuracy_pct),
    score: s.score,
  }));

  const rtList = sessions.map((s) => s.rt_mean_ms).filter((v) => v > 0);
  const avgRt = rtList.length ? Math.round(rtList.reduce((a, b) => a + b, 0) / rtList.length) : 0;
  const avgAcc = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + Number(s.accuracy_pct), 0) / sessions.length)
    : 0;
  const totalStages = GAME_REGISTRY.reduce((acc, g) => acc + (progress[g.slug]?.current_stage ?? 1) - 1, 0);

  return (
    <div className="flex flex-col gap-4 animate-pop">
      {/* Resumo numérico enxuto */}
      <div className="grid grid-cols-3 gap-2">
        <div className="surface-card py-3.5 px-2 text-center">
          <div className="text-2xl font-black tabular" style={{ color: 'var(--accent)' }}>
            {profile.global_cognitive_index}
          </div>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--text-soft)' }}>ICG</div>
        </div>
        <div className="surface-card py-3.5 px-2 text-center">
          <div className="text-2xl font-black tabular">{avgRt ? `${avgRt}` : '—'}</div>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--text-soft)' }}>RT (ms)</div>
        </div>
        <div className="surface-card py-3.5 px-2 text-center">
          <div className="text-2xl font-black tabular" style={{ color: 'var(--ok)' }}>
            {sessions.length ? `${avgAcc}%` : '—'}
          </div>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--text-soft)' }}>Precisão</div>
        </div>
      </div>

      {/* Gráfico de Radar 6 eixos (Recharts): Baseline vs Atual */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Base vs. Atual
          </span>
          <span className="text-xs font-bold tabular" style={{ color: 'var(--text-soft)' }}>
            {totalStages} fases
          </span>
        </div>

        <div className="w-full h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="74%" data={radarData}>
              <PolarGrid stroke="rgba(148,163,184,0.18)" />
              <PolarAngleAxis dataKey="domain" tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 700 }} />
              <Radar
                name="Base"
                dataKey="Base"
                stroke="#94a3b8"
                fill="transparent"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
              <Radar
                name="Atual"
                dataKey="Atual"
                stroke={isGamified ? '#f472b6' : '#38bdf8'}
                fill={isGamified ? '#a855f7' : '#38bdf8'}
                fillOpacity={0.28}
                strokeWidth={2.5}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Evolução Longitudinal (RT médio) */}
      {recentSessions.length >= 2 && (
        <div className="surface-card p-4">
          <div className="text-xs font-extrabold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Tempo de Reação (ms)
          </div>
          <div className="w-full h-[130px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recentSessions}>
                <XAxis dataKey="n" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#16161c',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rt"
                  stroke={isGamified ? '#06b6d4' : '#38bdf8'}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Barras por Domínio */}
      <div className="surface-card p-4 flex flex-col gap-3">
        {DOMAIN_LIST.map((d) => {
          const cur = scores[d.key] ?? 500;
          const base = scores.baseline_scores?.[d.key] ?? 500;
          const diff = cur - base;
          return (
            <div key={d.key}>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>{d.shortName}</span>
                <span className="tabular">
                  <span style={{ color: 'var(--text-soft)' }}>{base}</span> → {cur}
                  {diff !== 0 && (
                    <span className="ml-1" style={{ color: diff > 0 ? 'var(--ok)' : 'var(--err)' }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, cur / 10)}%`, background: d.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

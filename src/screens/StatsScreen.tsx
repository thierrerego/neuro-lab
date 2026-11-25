import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Gauge,
  LayoutGrid,
  Share2,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import type {
  DomainKey,
  GameSlug,
  PopulationBenchmarks,
  SessionMode,
  ThemeMode,
} from '../types/cognitive';
import { fetchPopulationBenchmarks, type AppDataState } from '../lib/dataService';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_MAP, GAME_REGISTRY } from '../engine/gameRegistry';
import { getIntensityLabel } from '../engine/adaptiveEngine';
import { getAgeBracketMeta, scoreToPercent } from '../engine/psychometricEngine';
import {
  adjustDistributionForAge,
  buildExerciseHistory,
  buildGameMasteryList,
  computeWeeklyEvolution,
  generateCognitiveDossier,
  NORMATIVE_BENCHMARKS,
  percentileFromBenchmark,
  percentileToTopPercent,
} from '../engine/cognitiveProfiler';
import {
  BellCurveChart,
  ComparativeRadarChart,
  GameSparkline,
  LongitudinalEvolutionChart,
} from '../components/StatsCharts';
import { GameIcon } from '../components/DomainIcon';

interface StatsScreenProps {
  data: AppDataState;
  backendOnline: boolean;
  justCalibrated?: boolean;
  onDismissCalibratedBanner?: () => void;
  onStartGame: (slug: GameSlug, mode: SessionMode) => void;
  onImproveDomain: (domain: DomainKey) => void;
}

type HubTab = 'brain' | 'exercises' | 'history';

function exportDossierCardPng(params: {
  theme: ThemeMode;
  playerName: string;
  archetypeTitle: string;
  archetypeSubtitle: string;
  icgPct: number;
  percentile: number;
  ageLabel: string;
  band: string;
  top1: { label: string; pct: number };
  top2: { label: string; pct: number };
  avgRtMs: number;
  consistency: number;
  bottleneck: string;
  recommendedGame: string;
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1120;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isLight = params.theme === 'light';
  const bg = isLight ? '#F3F6FA' : '#0D121E';
  const card = isLight ? '#FFFFFF' : '#182135';
  const border = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.18)';
  const textMain = isLight ? '#111827' : '#F1F5F9';
  const textMuted = isLight ? '#4B5563' : '#A8B5CC';
  const textSoft = isLight ? '#6B7280' : '#7E8DA8';
  const accent = isLight ? '#4F6EF7' : '#7C98FF';
  const ok = isLight ? '#10B981' : '#34D399';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 900, 1120);

  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(42, 42, 816, 1036, 32);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = '700 22px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText('NEUROLAB · DOSSIÊ COGNITIVO', 90, 116);

  ctx.fillStyle = textMuted;
  ctx.font = '500 22px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText(`${params.playerName} · Faixa ${params.ageLabel}`, 90, 156);

  ctx.fillStyle = textMain;
  ctx.font = '800 46px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText(params.archetypeTitle, 90, 244);

  ctx.fillStyle = textMuted;
  ctx.font = '500 22px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText(params.archetypeSubtitle.slice(0, 62), 90, 286);

  ctx.fillStyle = card;
  ctx.beginPath();
  ctx.roundRect(90, 338, 720, 178, 24);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.stroke();

  ctx.fillStyle = textSoft;
  ctx.font = '700 18px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText('ÍNDICE COGNITIVO GLOBAL', 126, 388);

  ctx.fillStyle = accent;
  ctx.font = '800 74px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText(`${params.icgPct}%`, 126, 478);

  ctx.fillStyle = ok;
  ctx.font = '700 26px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText(params.band, 410, 440);

  ctx.fillStyle = textMuted;
  ctx.font = '500 22px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText(`Superou ${Math.round(params.percentile)}% na faixa ${params.ageLabel}`, 410, 480);

  const drawStat = (x: number, y: number, w: number, label: string, val: string, valColor: string) => {
    ctx.fillStyle = card;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 134, 22);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.stroke();
    ctx.fillStyle = textSoft;
    ctx.font = '700 17px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.fillText(label, x + 26, y + 46);
    ctx.fillStyle = valColor;
    ctx.font = '800 32px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.fillText(val, x + 26, y + 98);
  };

  drawStat(90, 554, 345, 'PONTO FORTE #1', `${params.top1.label} · ${params.top1.pct}%`, accent);
  drawStat(465, 554, 345, 'PONTO FORTE #2', `${params.top2.label} · ${params.top2.pct}%`, '#6366F1');
  drawStat(90, 714, 345, 'TEMPO MÉDIO (RT)', params.avgRtMs ? `${params.avgRtMs} ms` : '—', textMain);
  drawStat(465, 714, 345, 'ESTABILIDADE DE FOCO', `${params.consistency}%`, ok);

  ctx.fillStyle = card;
  ctx.beginPath();
  ctx.roundRect(90, 884, 720, 128, 22);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = '700 18px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText('PRIORIDADE DE EVOLUÇÃO', 124, 932);
  ctx.fillStyle = textMain;
  ctx.font = '700 26px "Plus Jakarta Sans", Inter, sans-serif';
  ctx.fillText(`${params.bottleneck} → ${params.recommendedGame}`, 124, 980);

  const link = document.createElement('a');
  link.download = `neurolab-dossie-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function StatsScreen({
  data,
  backendOnline,
  justCalibrated = false,
  onDismissCalibratedBanner,
  onStartGame,
  onImproveDomain,
}: StatsScreenProps) {
  const { profile, scores, sessions, snapshots, progress } = data;
  const theme = profile.theme_preference;
  const ageBracket = profile.age_bracket ?? '25-34';
  const ageLabel = getAgeBracketMeta(ageBracket).label;

  const [hubTab, setHubTab] = useState<HubTab>('brain');
  const [benchmarks, setBenchmarks] = useState<PopulationBenchmarks>(NORMATIVE_BENCHMARKS);
  const [dossierExpanded, setDossierExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const [selectedMetric, setSelectedMetric] = useState<'icg' | DomainKey>('icg');
  const [exerciseDomainFilter, setExerciseDomainFilter] = useState<'all' | DomainKey>('all');
  const [historyDomainFilter, setHistoryDomainFilter] = useState<'all' | DomainKey>('all');
  const [expandedGameSlug, setExpandedGameSlug] = useState<GameSlug | null>(null);

  useEffect(() => {
    let active = true;
    void fetchPopulationBenchmarks(backendOnline).then((res) => {
      if (active) setBenchmarks(res);
    });
    return () => {
      active = false;
    };
  }, [backendOnline, sessions.length]);

  const dossier = useMemo(
    () =>
      generateCognitiveDossier({
        profile,
        scores,
        progress,
        sessions,
        benchmarks,
      }),
    [profile, scores, progress, sessions, benchmarks]
  );

  const weekly = useMemo(
    () => computeWeeklyEvolution(sessions, snapshots, profile.global_cognitive_index),
    [sessions, snapshots, profile.global_cognitive_index]
  );

  const historyEntries = useMemo(() => buildExerciseHistory(sessions, 50), [sessions]);

  const filteredHistory = useMemo(
    () =>
      historyDomainFilter === 'all'
        ? historyEntries
        : historyEntries.filter((e) => e.domain === historyDomainFilter),
    [historyEntries, historyDomainFilter]
  );

  const groupedHistory = useMemo(() => {
    const groups: { dateIso: string; dayLabel: string; items: typeof filteredHistory }[] = [];
    for (const item of filteredHistory) {
      const last = groups[groups.length - 1];
      if (last && last.dateIso === item.dateIso) {
        last.items.push(item);
      } else {
        groups.push({ dateIso: item.dateIso, dayLabel: item.dayLabel, items: [item] });
      }
    }
    return groups;
  }, [filteredHistory]);

  const gameMasteryList = useMemo(
    () => buildGameMasteryList(progress, sessions, benchmarks, ageBracket),
    [progress, sessions, benchmarks, ageBracket]
  );

  const totalStages = useMemo(
    () => GAME_REGISTRY.reduce((acc, g) => acc + Math.max(0, progress[g.slug]?.current_stage ?? 0), 0),
    [progress]
  );

  const icgPct = scoreToPercent(profile.global_cognitive_index);
  const { baseIcgPct, hasBaseline } = useMemo(() => {
    const vals = DOMAIN_LIST.map((d) => scores.baseline_scores?.[d.key] ?? 0).filter((v) => v > 0);
    if (vals.length === 0) return { baseIcgPct: 0, hasBaseline: false };
    const avg = Math.round(vals.reduce((acc, v) => acc + v, 0) / vals.length);
    return { baseIcgPct: scoreToPercent(avg), hasBaseline: true };
  }, [scores]);

  const icgDeltaPct = hasBaseline ? icgPct - baseIcgPct : 0;

  // Comparativo real "Você vs. Você Mesmo" (RT inicial vs. recente)
  const selfComparison = useMemo(() => {
    const validRt = [...sessions]
      .reverse()
      .filter((s) => s.rt_mean_ms > 0)
      .map((s) => s.rt_mean_ms);
    const windowSize = validRt.length >= 2 ? Math.max(1, Math.min(4, Math.floor(validRt.length / 2))) : 0;
    const initialRtMs = windowSize
      ? Math.round(validRt.slice(0, windowSize).reduce((a, b) => a + b, 0) / windowSize)
      : validRt[0] ?? 0;
    const recentRtMs = windowSize
      ? Math.round(validRt.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize)
      : validRt[0] ?? 0;
    const rtDeltaMs = windowSize ? recentRtMs - initialRtMs : null;
    const bestSessionPct = sessions.reduce((mx, s) => Math.max(mx, scoreToPercent(s.score)), 0);
    return { initialRtMs, recentRtMs, rtDeltaMs, bestSessionPct };
  }, [sessions]);

  const recommendedGameMeta = GAME_MAP[dossier.recommendedGame];

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(dossier.shareSummaryText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = dossier.shareSummaryText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const activeBellScore =
    selectedMetric === 'icg'
      ? profile.global_cognitive_index
      : (scores[selectedMetric] ?? 0);
  const activeBellDist =
    selectedMetric === 'icg'
      ? benchmarks.global
      : benchmarks.domains[selectedMetric];
  const activeBellLabel =
    selectedMetric === 'icg' ? 'Índice Global' : DOMAIN_MAP[selectedMetric].name;

  const filteredExercises = useMemo(
    () =>
      exerciseDomainFilter === 'all'
        ? gameMasteryList
        : gameMasteryList.filter((g) => g.domain === exerciseDomainFilter),
    [gameMasteryList, exerciseDomainFilter]
  );

  const bestExercisePercentile = useMemo(() => {
    const played = gameMasteryList.filter((g) => g.totalPlays > 0);
    if (played.length === 0) return null;
    return played.reduce((best, cur) => (cur.percentile > best.percentile ? cur : best), played[0]);
  }, [gameMasteryList]);

  return (
    <div className="flex flex-col gap-5 animate-pop">
      {/* Banner suave pós-calibração */}
      {justCalibrated && (
        <div
          className="surface-card px-5 py-4 flex items-center justify-between gap-3 animate-pop"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
          }}
        >
          <div className="text-sm font-semibold" style={{ color: 'var(--ok)' }}>
            Avaliação inicial concluída. Seu Dossiê Cognitivo está pronto.
          </div>
          {onDismissCalibratedBanner && (
            <button
              type="button"
              onClick={onDismissCalibratedBanner}
              className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
              style={{ color: 'var(--ok)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          1. DOSSIÊ TEXTUAL (LEITURA SERENA E ESPACIOSA)
          ===================================================================== */}
      <section className="surface-card p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="text-xs font-bold tracking-wide mb-1"
              style={{ color: 'var(--accent)' }}
            >
              Dossiê Cognitivo · Faixa {ageLabel}
            </div>
            <h1 className="text-[22px] font-extrabold tracking-tight leading-snug">
              {dossier.archetypeTitle}
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {dossier.archetypeSubtitle}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {icgPct > 0 ? (
              <>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold tabular"
                  style={{
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--accent)',
                  }}
                >
                  Est. Top {dossier.topPercent}%
                </span>
                <span className="text-xs font-medium tabular" style={{ color: 'var(--text-soft)' }}>
                  Percentil {Math.round(dossier.globalPercentile)}%
                </span>
              </>
            ) : (
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-soft)' }}
              >
                0% · Novo
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dossier.topDomains
            .filter((dk) => (scores[dk] ?? 0) > 0)
            .map((dk) => {
              const d = DOMAIN_MAP[dk];
              return (
                <span
                  key={dk}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tabular"
                  style={{ background: 'var(--bg-subtle)' }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span>{d.shortName}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{scoreToPercent(scores[dk] ?? 0)}%</span>
                </span>
              );
            })}
          <button
            type="button"
            onClick={() => setDossierExpanded((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold cursor-pointer px-2.5 py-1.5 rounded-xl"
            style={{ color: 'var(--accent)' }}
          >
            <span>{dossierExpanded ? 'Recolher' : 'Ler relatório'}</span>
            {dossierExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {dossierExpanded && (
          <div className="flex flex-col gap-3">
            {/* Insights rápidos fáceis de entender */}
            {(() => {
              const playedGamesCount = GAME_REGISTRY.filter(
                (g) => (progress[g.slug]?.total_plays ?? 0) > 0
              ).length;
              const remainingGames = GAME_REGISTRY.length - playedGamesCount;
              const measuredVals = DOMAIN_LIST.map((d) => scoreToPercent(scores[d.key] ?? 0)).filter(
                (v) => v > 0
              );
              const spread =
                measuredVals.length >= 2
                  ? Math.max(...measuredVals) - Math.min(...measuredVals)
                  : 0;

              return (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl p-3.5" style={{ background: 'var(--bg-subtle)' }}>
                    <div className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
                      Jogos descobertos
                    </div>
                    <div className="text-lg font-extrabold tabular mt-0.5">
                      {playedGamesCount}/{GAME_REGISTRY.length}
                    </div>
                    <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {remainingGames > 0
                        ? `Faltam ${remainingGames} para conhecer todos`
                        : 'Você já experimentou todo o catálogo!'}
                    </div>
                  </div>

                  <div className="rounded-2xl p-3.5" style={{ background: 'var(--bg-subtle)' }}>
                    <div className="text-[11px] font-bold" style={{ color: 'var(--ok)' }}>
                      Equilíbrio mental
                    </div>
                    <div className="text-lg font-extrabold tabular mt-0.5">
                      {measuredVals.length < 2
                        ? 'Em aberto'
                        : spread <= 12
                          ? 'Equilibrado'
                          : `${spread}% de diferença`}
                    </div>
                    <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {measuredVals.length < 2
                        ? 'Jogue áreas diferentes para comparar'
                        : spread <= 12
                          ? 'Suas habilidades estão andando juntas'
                          : 'Treinar a área mais baixa nivela tudo'}
                    </div>
                  </div>

                  <div className="rounded-2xl p-3.5" style={{ background: 'var(--bg-subtle)' }}>
                    <div className="text-[11px] font-bold" style={{ color: 'var(--warn)' }}>
                      Ritmo na semana
                    </div>
                    <div className="text-lg font-extrabold tabular mt-0.5">
                      {weekly.activeDaysThisWeek} de 7 dias
                    </div>
                    <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {weekly.activeDaysThisWeek >= 4
                        ? 'Constância ótima — cérebro ativo!'
                        : 'Treinos curtos todo dia rendem mais'}
                    </div>
                  </div>

                  <div className="rounded-2xl p-3.5" style={{ background: 'var(--bg-subtle)' }}>
                    <div className="text-[11px] font-bold" style={{ color: 'var(--text-soft)' }}>
                      Superação geral
                    </div>
                    <div className="text-lg font-extrabold tabular mt-0.5">
                      {Math.round(dossier.globalPercentile)}%
                    </div>
                    <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                      Pessoas superadas na faixa {ageLabel}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-subtle)' }}>
              <div className="text-xs font-bold tracking-wide mb-1.5" style={{ color: 'var(--accent)' }}>
                1. Onde você está mandando bem
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                {dossier.paragraphs.profileAndStrengths}
              </p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-subtle)' }}>
              <div className="text-xs font-bold tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
                2. Como você reage com o tempo correndo
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                {dossier.paragraphs.behaviorUnderPressure}
              </p>
            </div>

            <div className="rounded-2xl p-4 flex flex-col gap-3.5" style={{ background: 'var(--bg-subtle)' }}>
              <div>
                <div className="text-xs font-bold tracking-wide mb-1.5" style={{ color: 'var(--ok)' }}>
                  3. O que vale treinar agora
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                  {dossier.paragraphs.bottleneckAndPrescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onImproveDomain(dossier.bottleneckDomain)}
                className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl font-bold text-sm btn-accent cursor-pointer flex items-center justify-center gap-2"
              >
                <Target size={16} />
                <span>Melhorar {DOMAIN_MAP[dossier.bottleneckDomain].name}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className="min-h-[46px] py-3 px-3 rounded-2xl font-semibold text-xs sm:text-sm btn-soft cursor-pointer flex items-center justify-center gap-2"
          >
            {copied ? <Check size={16} style={{ color: 'var(--ok)' }} /> : <Copy size={16} />}
            <span>{copied ? 'Copiado' : 'Copiar resumo'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="min-h-[46px] py-3 px-3 rounded-2xl font-semibold text-xs sm:text-sm btn-soft cursor-pointer flex items-center justify-center gap-2"
          >
            <Share2 size={16} />
            <span>Exportar card</span>
          </button>
        </div>
      </section>

      {/* Controle segmentado estilo iOS: Evolução | Exercícios | Histórico */}
      <div
        className="grid grid-cols-3 gap-1 p-1.5 rounded-2xl"
        style={{ background: 'var(--bg-subtle)' }}
      >
        {(
          [
            { id: 'brain', label: 'Evolução', icon: Brain },
            { id: 'exercises', label: 'Exercícios', icon: LayoutGrid },
            { id: 'history', label: 'Histórico', icon: Clock },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = hubTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setHubTab(item.id)}
              className="py-2.5 px-2 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              style={{
                background: active ? 'var(--bg-card)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: active ? 'var(--card-shadow)' : 'none',
              }}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          VISÃO A: EVOLUÇÃO CEREBRAL (SEMANAL + 6 DOMÍNIOS + RADAR + LONGITUDINAL)
          ===================================================================== */}
      {hubTab === 'brain' && (
        <div className="flex flex-col gap-5 animate-pop">
          {/* Card de Evolução Semanal */}
          <section className="surface-card p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-base font-bold tracking-tight">Evolução Semanal</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
                  {weekly.activeDaysThisWeek} de 7 dias ativos nesta semana
                </div>
              </div>
              {weekly.indexDelta7dPct !== null && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold tabular inline-flex items-center gap-1 shrink-0"
                  style={{
                    background:
                      weekly.indexDelta7dPct >= 0
                        ? 'rgba(16, 185, 129, 0.14)'
                        : 'rgba(239, 68, 68, 0.12)',
                    color: weekly.indexDelta7dPct >= 0 ? 'var(--ok)' : 'var(--err)',
                  }}
                >
                  {weekly.indexDelta7dPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span>
                    {weekly.indexDelta7dPct >= 0
                      ? `+${weekly.indexDelta7dPct}%`
                      : `${weekly.indexDelta7dPct}%`}{' '}
                    (7d)
                  </span>
                </span>
              )}
            </div>

            {/* Faixa semanal Seg..Dom ampla */}
            <div className="grid grid-cols-7 gap-1.5">
              {weekly.days.map((d) => (
                <div key={d.dateIso} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: d.trained ? 'var(--ok)' : 'var(--bg-subtle)',
                      color: d.trained ? '#FFFFFF' : d.isToday ? 'var(--accent)' : 'var(--text-soft)',
                      border: d.isToday
                        ? `2px solid ${d.trained ? 'var(--ok)' : 'var(--accent)'}`
                        : '1px solid transparent',
                      boxShadow: d.trained ? '0 3px 10px rgba(16, 185, 129, 0.28)' : 'none',
                      opacity: d.isFuture ? 0.5 : 1,
                    }}
                  >
                    {d.trained ? <Check size={16} strokeWidth={3} /> : d.shortLabel}
                  </div>
                  <span className="text-xs font-medium tabular" style={{ color: 'var(--text-soft)' }}>
                    {d.sessionsCount > 0 ? `${d.sessionsCount}x` : d.shortLabel}
                  </span>
                </div>
              ))}
            </div>

            {/* 3 métricas semanais comparativas */}
            <div
              className="grid grid-cols-3 gap-2.5 pt-4"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                  Sessões (7d)
                </div>
                <div className="text-lg font-extrabold tabular mt-0.5">{weekly.sessionsThisWeek}</div>
                <div className="text-xs font-medium tabular mt-0.5" style={{ color: 'var(--text-soft)' }}>
                  {weekly.sessionsPrevWeek > 0
                    ? `${weekly.sessionsDelta >= 0 ? '+' : ''}${weekly.sessionsDelta} vs. ant.`
                    : 'Semana atual'}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                  Precisão
                </div>
                <div className="text-lg font-extrabold tabular mt-0.5" style={{ color: 'var(--ok)' }}>
                  {weekly.sessionsThisWeek > 0 ? `${weekly.avgAccuracyThisWeek}%` : '—'}
                </div>
                <div
                  className="text-xs font-medium tabular mt-0.5"
                  style={{
                    color:
                      weekly.accuracyDeltaVsPrevWeek === null
                        ? 'var(--text-soft)'
                        : weekly.accuracyDeltaVsPrevWeek >= 0
                          ? 'var(--ok)'
                          : 'var(--warn)',
                  }}
                >
                  {weekly.accuracyDeltaVsPrevWeek === null
                    ? 'Média 7d'
                    : `${weekly.accuracyDeltaVsPrevWeek >= 0 ? '+' : ''}${weekly.accuracyDeltaVsPrevWeek}%`}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                  RT (7d)
                </div>
                <div className="text-lg font-extrabold tabular mt-0.5">
                  {weekly.avgRtThisWeek > 0 ? `${weekly.avgRtThisWeek}ms` : '—'}
                </div>
                <div
                  className="text-xs font-medium tabular mt-0.5"
                  style={{
                    color:
                      weekly.rtDeltaVsPrevWeek === null
                        ? 'var(--text-soft)'
                        : weekly.rtDeltaVsPrevWeek <= 0
                          ? 'var(--ok)'
                          : 'var(--warn)',
                  }}
                >
                  {weekly.rtDeltaVsPrevWeek === null
                    ? 'Velocidade'
                    : `${weekly.rtDeltaVsPrevWeek <= 0 ? '' : '+'}${weekly.rtDeltaVsPrevWeek}ms`}
                </div>
              </div>
            </div>
          </section>

          {/* Card de Evolução Real: Você vs. Você Mesmo */}
          <section className="surface-card p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-base font-bold tracking-tight">Você vs. Você Mesmo</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
                  Comparação direta com sua própria linha de base (100% real)
                </div>
              </div>
              {hasBaseline && icgDeltaPct !== 0 && (
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold tabular shrink-0"
                  style={{
                    background:
                      icgDeltaPct > 0 ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.12)',
                    color: icgDeltaPct > 0 ? 'var(--ok)' : 'var(--err)',
                  }}
                >
                  {icgDeltaPct > 0 ? `+${icgDeltaPct}%` : `${icgDeltaPct}%`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl p-3.5" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
                  Linha de Base → Hoje
                </div>
                <div className="text-lg font-extrabold tabular mt-1 flex items-baseline gap-1.5">
                  <span style={{ color: 'var(--text-soft)' }}>
                    {hasBaseline ? `${baseIcgPct}%` : '0%'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-soft)' }}>→</span>
                  <span style={{ color: 'var(--accent)' }}>{icgPct}%</span>
                </div>
                <div className="text-xs mt-0.5 tabular" style={{ color: 'var(--text-muted)' }}>
                  {selfComparison.bestSessionPct > 0
                    ? `Melhor sessão: ${selfComparison.bestSessionPct}%`
                    : 'Aguardando 1ª sessão'}
                </div>
              </div>

              <div className="rounded-2xl p-3.5" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
                  Velocidade (RT)
                </div>
                <div className="text-lg font-extrabold tabular mt-1">
                  {selfComparison.recentRtMs > 0 ? `${selfComparison.recentRtMs} ms` : '—'}
                </div>
                <div
                  className="text-xs font-semibold tabular mt-0.5"
                  style={{
                    color:
                      selfComparison.rtDeltaMs === null
                        ? 'var(--text-muted)'
                        : selfComparison.rtDeltaMs <= 0
                          ? 'var(--ok)'
                          : 'var(--warn)',
                  }}
                >
                  {selfComparison.rtDeltaMs === null
                    ? selfComparison.initialRtMs > 0
                      ? 'Base registrada'
                      : 'Sem histórico'
                    : selfComparison.rtDeltaMs <= 0
                      ? `${selfComparison.rtDeltaMs} ms mais rápido`
                      : `+${selfComparison.rtDeltaMs} ms vs. início`}
                </div>
              </div>
            </div>
          </section>

          {/* 3 indicadores psicométricos globais */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="surface-card p-4 flex flex-col justify-between gap-1.5">
              <div className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
                Índice Global
              </div>
              <div className="text-2xl font-extrabold tabular leading-none" style={{ color: 'var(--accent)' }}>
                {icgPct}%
              </div>
              <div
                className="text-xs font-semibold tabular"
                style={{ color: !hasBaseline ? 'var(--text-soft)' : icgDeltaPct >= 0 ? 'var(--ok)' : 'var(--err)' }}
              >
                {!hasBaseline
                  ? 'Sem base'
                  : icgDeltaPct > 0
                    ? `+${icgDeltaPct}% base`
                    : icgDeltaPct < 0
                      ? `${icgDeltaPct}% base`
                      : 'Linha base'}
              </div>
            </div>

            <div className="surface-card p-4 flex flex-col justify-between gap-1.5">
              <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
                <Gauge size={13} />
                <span>RT Médio</span>
              </div>
              <div className="text-2xl font-extrabold tabular leading-none">
                {dossier.clinical.avgRtMs ? `${dossier.clinical.avgRtMs}` : '—'}
                {dossier.clinical.avgRtMs > 0 && (
                  <span className="text-xs font-semibold ml-0.5" style={{ color: 'var(--text-soft)' }}>
                    ms
                  </span>
                )}
              </div>
              <div
                className="text-xs font-semibold tabular"
                style={{
                  color:
                    dossier.clinical.rtDeltaMs === null
                      ? 'var(--text-soft)'
                      : dossier.clinical.rtDeltaMs <= 0
                        ? 'var(--ok)'
                        : 'var(--warn)',
                }}
              >
                {dossier.clinical.rtDeltaMs === null
                  ? 'Sem histórico'
                  : dossier.clinical.rtDeltaMs <= 0
                    ? `${dossier.clinical.rtDeltaMs} ms`
                    : `+${dossier.clinical.rtDeltaMs} ms`}
              </div>
            </div>

            <div className="surface-card p-4 flex flex-col justify-between gap-1.5">
              <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
                <ShieldCheck size={13} style={{ color: 'var(--ok)' }} />
                <span>Foco</span>
              </div>
              <div className="text-2xl font-extrabold tabular leading-none" style={{ color: 'var(--ok)' }}>
                {dossier.clinical.totalSessions > 0 ? `${dossier.clinical.consistencyIndex}%` : '—'}
              </div>
              <div className="text-xs font-medium tabular" style={{ color: 'var(--text-soft)' }}>
                {dossier.clinical.totalSessions > 0
                  ? `Prec. ${Math.round(dossier.clinical.avgAccuracyPct)}%`
                  : 'Consistência'}
              </div>
            </div>
          </div>

          {/* 6 Domínios com botão tátil "Melhorar →" */}
          <div className="surface-card p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-base font-bold tracking-tight">6 Domínios Cognitivos</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
                  Faixa {ageLabel} · Treine qualquer área em 1 toque (30s)
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {DOMAIN_LIST.map((d) => {
                const curRaw = scores[d.key] ?? 0;
                const baseRaw = scores.baseline_scores?.[d.key] ?? 0;
                const isMeasured = curRaw > 0;
                const curPct = scoreToPercent(curRaw);
                const basePct = scoreToPercent(baseRaw);
                const diffPct = baseRaw > 0 && isMeasured ? curPct - basePct : 0;
                const bench = adjustDistributionForAge(benchmarks.domains[d.key], ageBracket);
                const benchMeanPct = scoreToPercent(bench.mean);
                const pct = isMeasured
                  ? percentileFromBenchmark(curRaw, benchmarks.domains[d.key], ageBracket)
                  : 0;
                const topP = isMeasured ? percentileToTopPercent(pct) : 100;
                const isSelected = selectedMetric === d.key;

                return (
                  <div
                    key={d.key}
                    onClick={() => setSelectedMetric(d.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedMetric(d.key);
                    }}
                    className="text-left rounded-2xl p-4 transition-all cursor-pointer flex flex-col gap-2.5"
                    style={{
                      background: isSelected ? 'var(--accent-glow)' : 'var(--bg-subtle)',
                      border: isSelected ? '1.5px solid var(--border-strong)' : '1px solid transparent',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <div className="min-w-0">
                          <div className="text-[15px] font-bold truncate">{d.name}</div>
                          <div className="text-xs tabular flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            <span className="font-extrabold" style={{ color: 'var(--text)' }}>
                              {curPct}%
                            </span>
                            <span>{isMeasured ? `· Est. Top ${topP}%` : '· Sem medição'}</span>
                            {diffPct !== 0 && (
                              <span
                                className="font-bold"
                                style={{ color: diffPct > 0 ? 'var(--ok)' : 'var(--err)' }}
                              >
                                ({diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onImproveDomain(d.key);
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shrink-0 transition-all"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-strong)',
                          color: 'var(--accent)',
                          boxShadow: 'var(--card-shadow)',
                        }}
                      >
                        <span>{isMeasured ? 'Melhorar' : 'Iniciar'}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    <div
                      className="relative h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--bg-card)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${curPct}%`, background: d.color }}
                      />
                      <div
                        title={`Estimativa normativa da faixa: ${benchMeanPct}%`}
                        className="absolute top-0 bottom-0 w-0.5"
                        style={{ left: `${Math.min(98, benchMeanPct)}%`, background: '#F59E0B' }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs tabular" style={{ color: 'var(--text-soft)' }}>
                      <span>Base: {baseRaw > 0 ? `${basePct}%` : '—'}</span>
                      <span>Est. {ageLabel}: {benchMeanPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráfico de Radar */}
          <ComparativeRadarChart
            scores={scores}
            benchmarks={benchmarks}
            theme={theme}
            ageBracket={ageBracket}
            totalStages={totalStages}
          />

          {/* Curva de Evolução Longitudinal */}
          <LongitudinalEvolutionChart
            snapshots={snapshots}
            sessions={sessions}
            scores={scores}
            benchmarks={benchmarks}
            theme={theme}
            ageBracket={ageBracket}
            selectedMetric={selectedMetric}
            onSelectMetric={setSelectedMetric}
          />

          {/* Distribuição Normativa */}
          <BellCurveChart
            score={activeBellScore}
            dist={activeBellDist}
            label={activeBellLabel}
            source={benchmarks.source}
            sampleSessions={benchmarks.sample_sessions}
            theme={theme}
            ageBracket={ageBracket}
          />

          {dossier.clinical.totalSessions > 0 && (
            <div className="surface-card px-5 py-3.5 flex items-center justify-between gap-2 text-xs font-medium tabular flex-wrap">
              <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Activity size={14} style={{ color: 'var(--accent)' }} />
                σ RT: <strong style={{ color: 'var(--text)' }}>{dossier.clinical.avgRtSdMs} ms</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                Sessões: <strong style={{ color: 'var(--text)' }}>{dossier.clinical.totalSessions}</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                Meta 100%: <strong style={{ color: 'var(--ok)' }}>{dossier.clinical.earlyClearRatePct}%</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VISÃO B: EVOLUÇÃO POR EXERCÍCIO (12 PROTOCOLOS)
          ===================================================================== */}
      {hubTab === 'exercises' && (
        <div className="flex flex-col gap-4 animate-pop">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="surface-card p-4 text-center">
              <div className="text-2xl font-extrabold tabular" style={{ color: 'var(--accent)' }}>
                {totalStages}
              </div>
              <div className="text-xs font-medium mt-1" style={{ color: 'var(--text-soft)' }}>
                Níveis
              </div>
            </div>
            <div className="surface-card p-4 text-center">
              <div className="text-2xl font-extrabold tabular" style={{ color: 'var(--ok)' }}>
                {dossier.clinical.earlyClearRatePct}%
              </div>
              <div className="text-xs font-medium mt-1" style={{ color: 'var(--text-soft)' }}>
                Conclusão
              </div>
            </div>
            <div className="surface-card p-4 text-center">
              <div className="text-2xl font-extrabold tabular">
                {bestExercisePercentile ? `Top ${bestExercisePercentile.topPercent}%` : '—'}
              </div>
              <div className="text-xs font-medium mt-1 truncate" style={{ color: 'var(--text-soft)' }}>
                {bestExercisePercentile ? GAME_MAP[bestExercisePercentile.slug].name : 'Destaque'}
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setExerciseDomainFilter('all')}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer ${
                exerciseDomainFilter === 'all' ? 'btn-accent' : 'btn-soft'
              }`}
            >
              Todos (24)
            </button>
            {DOMAIN_LIST.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setExerciseDomainFilter(d.key)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer ${
                  exerciseDomainFilter === d.key ? 'btn-accent' : 'btn-soft'
                }`}
              >
                {d.shortName}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3.5">
            {filteredExercises.map((item) => {
              const gameMeta = GAME_MAP[item.slug];
              const domMeta = DOMAIN_MAP[item.domain];
              const bench = benchmarks.games[item.slug] ?? NORMATIVE_BENCHMARKS.games[item.slug];
              const isExpanded = expandedGameSlug === item.slug;

              return (
                <div key={item.slug} className="surface-card p-4 sm:p-5 flex flex-col gap-3.5">
                  <button
                    type="button"
                    onClick={() => setExpandedGameSlug(isExpanded ? null : item.slug)}
                    className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: `${domMeta.color}16`, color: domMeta.color }}
                      >
                        <GameIcon slug={item.slug} size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[16px] font-bold truncate">{gameMeta.name}</div>
                        <div className="text-xs flex flex-wrap items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-soft)' }}>
                          <span className="font-semibold" style={{ color: domMeta.color }}>
                            {domMeta.shortName}
                          </span>
                          <span>·</span>
                          <span>{getIntensityLabel(item.currentStage)}</span>
                          <span>·</span>
                          <span>{item.totalPlays} sessões</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.highestScore > 0 ? (
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-bold tabular"
                          style={{
                            background: 'var(--accent-glow)',
                            color: 'var(--accent)',
                            border: '1px solid var(--border-strong)',
                          }}
                        >
                          Top {item.topPercent}%
                        </span>
                      ) : (
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--bg-subtle)', color: 'var(--text-soft)' }}
                        >
                          Novo
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={18} style={{ color: 'var(--text-soft)' }} />
                      ) : (
                        <ChevronDown size={18} style={{ color: 'var(--text-soft)' }} />
                      )}
                    </div>
                  </button>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl py-2.5 px-2" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                        Recorde
                      </div>
                      <div className="text-sm font-extrabold tabular mt-0.5">
                        {item.highestScore > 0 ? `${scoreToPercent(item.highestScore)}%` : '—'}
                      </div>
                    </div>
                    <div className="rounded-2xl py-2.5 px-2" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                        Progresso
                      </div>
                      <div
                        className="text-sm font-extrabold tabular mt-0.5"
                        style={{ color: item.bestWave >= 5 ? 'var(--ok)' : 'var(--text)' }}
                      >
                        {item.bestWave > 0 ? `${Math.round((item.bestWave / 5) * 100)}%` : '—'}
                      </div>
                    </div>
                    <div className="rounded-2xl py-2.5 px-2" style={{ background: 'var(--bg-subtle)' }}>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                        Conclusão
                      </div>
                      <div className="text-sm font-extrabold tabular mt-0.5" style={{ color: 'var(--accent)' }}>
                        {item.totalPlays > 0 ? `${item.earlyClearRatePct}%` : '—'}
                      </div>
                    </div>
                  </div>

                  <GameSparkline data={item.sparkline} color={domMeta.color} />

                  {isExpanded && (
                    <div
                      className="pt-3.5 flex flex-col gap-3.5 animate-pop"
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      <BellCurveChart
                        score={item.highestScore > 0 ? item.highestScore : bench.mean}
                        dist={bench}
                        label={gameMeta.name}
                        source={benchmarks.source}
                        sampleSessions={benchmarks.sample_sessions}
                        theme={theme}
                        ageBracket={ageBracket}
                        compact
                      />
                      <button
                        type="button"
                        onClick={() => onStartGame(item.slug, 'free')}
                        className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl font-bold text-sm btn-accent cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>Treinar {gameMeta.name}</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          VISÃO C: HISTÓRICO EXERCÍCIO-A-EXERCÍCIO (CRONOLÓGICO COM DELTAS)
          ===================================================================== */}
      {hubTab === 'history' && (
        <div className="flex flex-col gap-4 animate-pop">
          {/* Filtros por domínio */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setHistoryDomainFilter('all')}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer ${
                historyDomainFilter === 'all' ? 'btn-accent' : 'btn-soft'
              }`}
            >
              Todos ({historyEntries.length})
            </button>
            {DOMAIN_LIST.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setHistoryDomainFilter(d.key)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer ${
                  historyDomainFilter === d.key ? 'btn-accent' : 'btn-soft'
                }`}
              >
                {d.shortName}
              </button>
            ))}
          </div>

          {groupedHistory.length === 0 ? (
            <div className="surface-card p-8 text-center flex flex-col items-center gap-2.5">
              <Clock size={26} style={{ color: 'var(--text-soft)' }} />
              <div className="text-base font-bold">Nenhuma sessão registrada ainda</div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Conclua um exercício para acompanhar sua evolução sessão por sessão aqui.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {groupedHistory.map((group) => (
                <div key={group.dateIso} className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      {group.dayLabel}
                    </span>
                    <span className="text-xs font-semibold tabular" style={{ color: 'var(--text-soft)' }}>
                      {group.items.length} {group.items.length === 1 ? 'exercício' : 'exercícios'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {group.items.map((entry) => {
                      const gameMeta = GAME_MAP[entry.slug];
                      const domMeta = DOMAIN_MAP[entry.domain];

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onStartGame(entry.slug, 'free')}
                          className="surface-card surface-card-click p-4 flex items-center gap-3.5 text-left cursor-pointer"
                        >
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                            style={{ background: `${domMeta.color}16`, color: domMeta.color }}
                          >
                            <GameIcon slug={entry.slug} size={20} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[15px] font-bold truncate">{gameMeta.name}</span>
                              {entry.isRecord && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
                                  style={{ background: 'rgba(245, 158, 11, 0.16)', color: 'var(--warn)' }}
                                >
                                  <Award size={11} /> Recorde
                                </span>
                              )}
                            </div>

                            <div className="text-xs mt-1 flex flex-wrap items-center gap-1.5 tabular" style={{ color: 'var(--text-muted)' }}>
                              <span className="font-semibold" style={{ color: domMeta.color }}>
                                {domMeta.shortName}
                              </span>
                              <span>· {getIntensityLabel(entry.stagePlayed)}</span>
                              <span>· {entry.accuracyPct}%</span>
                              {entry.rtMeanMs > 0 && <span>· {entry.rtMeanMs}ms</span>}
                              {entry.timeLabel && <span>· {entry.timeLabel}</span>}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-base font-extrabold tabular">{entry.indexPct}%</div>
                            {entry.deltaVsPrevPct !== null ? (
                              <div
                                className="text-xs font-bold tabular mt-0.5"
                                style={{
                                  color: entry.deltaVsPrevPct >= 0 ? 'var(--ok)' : 'var(--err)',
                                }}
                              >
                                {entry.deltaVsPrevPct >= 0
                                  ? `+${entry.deltaVsPrevPct}%`
                                  : `${entry.deltaVsPrevPct}%`}
                              </div>
                            ) : (
                              <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
                                1ª vez
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Exportação Limpo e Suave */}
      {shareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5 backdrop-blur-sm"
          style={{ background: 'var(--overlay)' }}
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="w-full max-w-[390px] surface-card p-6 flex flex-col gap-4 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                Resumo do Dossiê
              </span>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center btn-soft cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className="rounded-2xl p-4 flex flex-col gap-3.5"
              style={{ background: 'var(--bg-subtle)' }}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span style={{ color: 'var(--accent)' }}>NeuroLab</span>
                <span style={{ color: 'var(--text-soft)' }}>Faixa {ageLabel}</span>
              </div>

              <div>
                <div className="text-lg font-extrabold leading-tight">{dossier.archetypeTitle}</div>
                <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {dossier.archetypeSubtitle}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl p-3" style={{ background: 'var(--bg-card)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-soft)' }}>
                    Índice Global
                  </div>
                  <div className="text-2xl font-extrabold tabular mt-0.5">{icgPct}%</div>
                  <div className="text-xs font-bold mt-0.5" style={{ color: icgPct > 0 ? 'var(--ok)' : 'var(--text-soft)' }}>
                    {icgPct > 0 ? `Est. Top ${dossier.topPercent}%` : 'Sem medição'}
                  </div>
                </div>
                <div className="rounded-2xl p-3" style={{ background: 'var(--bg-card)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-soft)' }}>
                    RT / Foco
                  </div>
                  <div className="text-xl font-extrabold tabular mt-0.5">
                    {dossier.clinical.avgRtMs ? `${dossier.clinical.avgRtMs} ms` : '—'}
                  </div>
                  <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
                    Foco {dossier.clinical.consistencyIndex}%
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void handleCopySummary()}
                className="min-h-[48px] py-3 rounded-2xl font-semibold text-sm btn-soft cursor-pointer flex items-center justify-center gap-2"
              >
                {copied ? <Check size={16} style={{ color: 'var(--ok)' }} /> : <Copy size={16} />}
                <span>{copied ? 'Copiado' : 'Copiar texto'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportDossierCardPng({
                    theme,
                    playerName: profile.name,
                    archetypeTitle: dossier.archetypeTitle,
                    archetypeSubtitle: dossier.archetypeSubtitle,
                    icgPct,
                    percentile: dossier.globalPercentile,
                    ageLabel,
                    band: dossier.populationBand,
                    top1: {
                      label: DOMAIN_MAP[dossier.topDomains[0]].shortName,
                      pct: scoreToPercent(scores[dossier.topDomains[0]] ?? 0),
                    },
                    top2: {
                      label: DOMAIN_MAP[dossier.topDomains[1]].shortName,
                      pct: scoreToPercent(scores[dossier.topDomains[1]] ?? 0),
                    },
                    avgRtMs: dossier.clinical.avgRtMs,
                    consistency: dossier.clinical.consistencyIndex,
                    bottleneck: DOMAIN_MAP[dossier.bottleneckDomain].name,
                    recommendedGame: recommendedGameMeta.name,
                  })
                }
                className="min-h-[48px] py-3 rounded-2xl font-bold text-sm btn-accent cursor-pointer flex items-center justify-center gap-2"
              >
                <Download size={16} />
                <span>Baixar PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Gauge,
  LayoutGrid,
  Share2,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import type { DomainKey, GameSlug, PopulationBenchmarks, SessionMode } from '../types/cognitive';
import { fetchPopulationBenchmarks, type AppDataState } from '../lib/dataService';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_MAP, GAME_REGISTRY } from '../engine/gameRegistry';
import { getAgeBracketMeta, scoreToPercent } from '../engine/psychometricEngine';
import {
  adjustDistributionForAge,
  buildGameMasteryList,
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
}

type HubTab = 'brain' | 'exercises';

/**
 * Desenha um card compartilhável minimalista em PNG (paleta grafite/azul-gelo).
 */
function exportDossierCardPng(params: {
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

  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 900, 1120);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(42, 42, 816, 1036, 28);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 22px Inter, Segoe UI, sans-serif';
  ctx.fillText('NEUROLAB · DOSSIÊ COGNITIVO', 90, 116);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 21px Inter, Segoe UI, sans-serif';
  ctx.fillText(`${params.playerName} · Faixa ${params.ageLabel}`, 90, 154);

  ctx.fillStyle = '#f4f4f5';
  ctx.font = '800 48px Inter, Segoe UI, sans-serif';
  ctx.fillText(params.archetypeTitle, 90, 246);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 23px Inter, Segoe UI, sans-serif';
  ctx.fillText(params.archetypeSubtitle.slice(0, 62), 90, 288);

  ctx.fillStyle = '#15151a';
  ctx.beginPath();
  ctx.roundRect(90, 340, 720, 176, 20);
  ctx.fill();

  ctx.fillStyle = '#71717a';
  ctx.font = '700 18px Inter, Segoe UI, sans-serif';
  ctx.fillText('ÍNDICE COGNITIVO GLOBAL', 126, 388);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 72px Inter, Segoe UI, sans-serif';
  ctx.fillText(`${params.icgPct}%`, 126, 476);

  ctx.fillStyle = '#10b981';
  ctx.font = '700 26px Inter, Segoe UI, sans-serif';
  ctx.fillText(params.band, 410, 440);

  ctx.fillStyle = '#d4d4d8';
  ctx.font = '500 22px Inter, Segoe UI, sans-serif';
  ctx.fillText(`Superou ${Math.round(params.percentile)}% na faixa ${params.ageLabel}`, 410, 480);

  const drawStat = (x: number, y: number, w: number, label: string, val: string, accent: string) => {
    ctx.fillStyle = '#15151a';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 132, 18);
    ctx.fill();
    ctx.fillStyle = '#71717a';
    ctx.font = '700 17px Inter, Segoe UI, sans-serif';
    ctx.fillText(label, x + 26, y + 44);
    ctx.fillStyle = accent;
    ctx.font = '800 32px Inter, Segoe UI, sans-serif';
    ctx.fillText(val, x + 26, y + 96);
  };

  drawStat(90, 556, 345, 'PONTO FORTE #1', `${params.top1.label} · ${params.top1.pct}%`, '#38bdf8');
  drawStat(465, 556, 345, 'PONTO FORTE #2', `${params.top2.label} · ${params.top2.pct}%`, '#818cf8');
  drawStat(90, 716, 345, 'TEMPO MÉDIO (RT)', params.avgRtMs ? `${params.avgRtMs} ms` : '—', '#f4f4f5');
  drawStat(465, 716, 345, 'ESTABILIDADE DE FOCO', `${params.consistency}%`, '#10b981');

  ctx.fillStyle = '#15151a';
  ctx.beginPath();
  ctx.roundRect(90, 886, 720, 126, 18);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 18px Inter, Segoe UI, sans-serif';
  ctx.fillText('PRIORIDADE DE EVOLUÇÃO', 124, 934);
  ctx.fillStyle = '#f4f4f5';
  ctx.font = '700 26px Inter, Segoe UI, sans-serif';
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

  const gameMasteryList = useMemo(
    () => buildGameMasteryList(progress, sessions, benchmarks, ageBracket),
    [progress, sessions, benchmarks, ageBracket]
  );

  const totalStages = useMemo(
    () => GAME_REGISTRY.reduce((acc, g) => acc + Math.max(0, progress[g.slug]?.current_stage ?? 0), 0),
    [progress]
  );

  const icgPct = scoreToPercent(profile.global_cognitive_index);
  const baseIcgPct = useMemo(() => {
    const sum = DOMAIN_LIST.reduce((acc, d) => acc + (scores.baseline_scores?.[d.key] ?? 500), 0);
    return scoreToPercent(Math.round(sum / DOMAIN_LIST.length));
  }, [scores]);

  const icgDeltaPct = icgPct - baseIcgPct;
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
      : (scores[selectedMetric] ?? 500);
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
    <div className="flex flex-col gap-4 animate-pop">
      {/* Banner discreto pós-calibração */}
      {justCalibrated && (
        <div
          className="surface-card px-4 py-3 flex items-center justify-between gap-2 animate-pop"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            borderColor: 'rgba(16, 185, 129, 0.35)',
          }}
        >
          <div className="text-xs font-semibold" style={{ color: 'var(--ok)' }}>
            Avaliação inicial concluída. Seu Dossiê Cognitivo está pronto.
          </div>
          {onDismissCalibratedBanner && (
            <button
              type="button"
              onClick={onDismissCalibratedBanner}
              className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ color: 'var(--ok)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          1. DOSSIÊ TEXTUAL (LINGUAGEM CLARA E PORCENTAGENS)
          ===================================================================== */}
      <section className="surface-card p-4 flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-wider mb-1"
              style={{ color: 'var(--accent)' }}
            >
              Dossiê Cognitivo · Faixa {ageLabel}
            </div>
            <h1 className="text-lg font-extrabold tracking-tight leading-snug">
              {dossier.archetypeTitle}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {dossier.archetypeSubtitle}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-bold tabular"
              style={{
                background: 'var(--accent-glow)',
                border: '1px solid var(--border-strong)',
                color: 'var(--accent)',
              }}
            >
              Top {dossier.topPercent}%
            </span>
            <span className="text-[10px] font-medium tabular" style={{ color: 'var(--text-soft)' }}>
              Percentil {Math.round(dossier.globalPercentile)}%
            </span>
          </div>
        </div>

        {/* Destaques de domínio + controle de expandir/recolher */}
        <div className="flex flex-wrap items-center gap-1.5">
          {dossier.topDomains.map((dk) => {
            const d = DOMAIN_MAP[dk];
            return (
              <span
                key={dk}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold tabular"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span>{d.shortName}</span>
                <span style={{ color: 'var(--text-muted)' }}>{scoreToPercent(scores[dk] ?? 500)}%</span>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => setDossierExpanded((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer px-2 py-1 rounded-lg"
            style={{ color: 'var(--text-soft)' }}
          >
            <span>{dossierExpanded ? 'Recolher' : 'Ler relatório'}</span>
            {dossierExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* 3 Blocos Diagnósticos */}
        {dossierExpanded && (
          <div className="flex flex-col gap-2.5">
            <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>
                1. Equilíbrio & Pontos Fortes
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                {dossier.paragraphs.profileAndStrengths}
              </p>
            </div>

            <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                2. Estabilidade sob Pressão
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                {dossier.paragraphs.behaviorUnderPressure}
              </p>
            </div>

            <div className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--ok)' }}>
                  3. Área em Desenvolvimento & Recomendação
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                  {dossier.paragraphs.bottleneckAndPrescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartGame(dossier.recommendedGame, 'free')}
                className="w-full py-2.5 px-3 rounded-xl font-bold text-xs btn-accent cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Target size={13} />
                <span>Praticar {recommendedGameMeta.name}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Copiar / Exportar */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className="py-2 rounded-xl font-semibold text-xs btn-soft cursor-pointer flex items-center justify-center gap-1.5"
          >
            {copied ? <Check size={13} style={{ color: 'var(--ok)' }} /> : <Copy size={13} />}
            <span>{copied ? 'Copiado' : 'Copiar resumo'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="py-2 rounded-xl font-semibold text-xs btn-soft cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Share2 size={13} />
            <span>Exportar card</span>
          </button>
        </div>
      </section>

      {/* Seletor de visão: Evolução Cerebral vs. Por Exercício */}
      <div
        className="grid grid-cols-2 gap-1 p-1 rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setHubTab('brain')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            hubTab === 'brain' ? 'btn-accent' : ''
          }`}
          style={hubTab === 'brain' ? undefined : { color: 'var(--text-muted)' }}
        >
          <Brain size={14} />
          <span>Evolução Cerebral</span>
        </button>

        <button
          type="button"
          onClick={() => setHubTab('exercises')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
            hubTab === 'exercises' ? 'btn-accent' : ''
          }`}
          style={hubTab === 'exercises' ? undefined : { color: 'var(--text-muted)' }}
        >
          <LayoutGrid size={14} />
          <span>Por Exercício</span>
        </button>
      </div>

      {/* =====================================================================
          VISÃO A: EVOLUÇÃO CEREBRAL (RADAR + LONGITUDINAL + 6 DOMÍNIOS)
          ===================================================================== */}
      {hubTab === 'brain' && (
        <div className="flex flex-col gap-4 animate-pop">
          {/* 3 indicadores psicométricos principais */}
          <div className="grid grid-cols-3 gap-2">
            <div className="surface-card p-3 flex flex-col justify-between gap-1">
              <div className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-soft)' }}>
                Índice Global
              </div>
              <div className="text-2xl font-black tabular leading-none" style={{ color: 'var(--accent)' }}>
                {icgPct}%
              </div>
              <div
                className="text-[10px] font-semibold tabular"
                style={{ color: icgDeltaPct >= 0 ? 'var(--ok)' : 'var(--err)' }}
              >
                {icgDeltaPct > 0 ? `+${icgDeltaPct}% base` : icgDeltaPct < 0 ? `${icgDeltaPct}% base` : 'Linha base'}
              </div>
            </div>

            <div className="surface-card p-3 flex flex-col justify-between gap-1">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--text-soft)' }}>
                <Gauge size={11} />
                <span>RT Médio</span>
              </div>
              <div className="text-2xl font-black tabular leading-none">
                {dossier.clinical.avgRtMs ? `${dossier.clinical.avgRtMs}` : '—'}
                {dossier.clinical.avgRtMs > 0 && (
                  <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--text-soft)' }}>ms</span>
                )}
              </div>
              <div
                className="text-[10px] font-semibold tabular"
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

            <div className="surface-card p-3 flex flex-col justify-between gap-1">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--text-soft)' }}>
                <ShieldCheck size={11} style={{ color: 'var(--ok)' }} />
                <span>Estabilidade</span>
              </div>
              <div className="text-2xl font-black tabular leading-none" style={{ color: 'var(--ok)' }}>
                {dossier.clinical.totalSessions > 0 ? `${dossier.clinical.consistencyIndex}%` : '—'}
              </div>
              <div className="text-[10px] font-medium tabular" style={{ color: 'var(--text-soft)' }}>
                {dossier.clinical.totalSessions > 0
                  ? `Precisão ${Math.round(dossier.clinical.avgAccuracyPct)}%`
                  : 'Consistência'}
              </div>
            </div>
          </div>

          {/* 2. Gráfico de Radar Minimalista (Linha de Base vs. Atual vs. Média da Faixa Etária) */}
          <ComparativeRadarChart
            scores={scores}
            benchmarks={benchmarks}
            theme={theme}
            ageBracket={ageBracket}
            totalStages={totalStages}
          />

          {/* 3. Curva de Evolução Longitudinal por domínio */}
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

          {/* Detalhamento dos 6 Domínios em % vs. Faixa Etária */}
          <div className="surface-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                6 Domínios · Faixa {ageLabel}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-soft)' }}>
                Toque para filtrar curva
              </span>
            </div>

            {DOMAIN_LIST.map((d) => {
              const curRaw = scores[d.key] ?? 500;
              const baseRaw = scores.baseline_scores?.[d.key] ?? 500;
              const curPct = scoreToPercent(curRaw);
              const basePct = scoreToPercent(baseRaw);
              const diffPct = curPct - basePct;
              const bench = adjustDistributionForAge(benchmarks.domains[d.key], ageBracket);
              const benchMeanPct = scoreToPercent(bench.mean);
              const pct = percentileFromBenchmark(curRaw, benchmarks.domains[d.key], ageBracket);
              const topP = percentileToTopPercent(pct);
              const isSelected = selectedMetric === d.key;

              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedMetric(d.key)}
                  className="text-left rounded-xl p-2.5 transition-all cursor-pointer"
                  style={{
                    background: isSelected ? 'var(--accent-glow)' : 'var(--bg)',
                    border: isSelected ? '1px solid var(--border-strong)' : '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="tabular flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
                      >
                        Top {topP}%
                      </span>
                      <span className="font-bold">{curPct}%</span>
                      {diffPct !== 0 && (
                        <span className="text-[11px]" style={{ color: diffPct > 0 ? 'var(--ok)' : 'var(--err)' }}>
                          {diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${curPct}%`, background: d.color }}
                    />
                    <div
                      title={`Média da faixa: ${benchMeanPct}%`}
                      className="absolute top-0 bottom-0 w-0.5"
                      style={{ left: `${Math.min(98, benchMeanPct)}%`, background: '#f59e0b' }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] mt-1 tabular" style={{ color: 'var(--text-soft)' }}>
                    <span>Base: {basePct}%</span>
                    <span>Média {ageLabel}: {benchMeanPct}%</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Distribuição Normativa (Curva de Sino) */}
          <BellCurveChart
            score={activeBellScore}
            dist={activeBellDist}
            label={activeBellLabel}
            source={benchmarks.source}
            sampleSessions={benchmarks.sample_sessions}
            theme={theme}
            ageBracket={ageBracket}
          />

          {/* Telemetria clínica complementar */}
          {dossier.clinical.totalSessions > 0 && (
            <div className="surface-card px-3.5 py-2.5 flex items-center justify-between text-[11px] font-medium tabular">
              <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Activity size={12} style={{ color: 'var(--accent)' }} />
                σ RT: <strong style={{ color: 'var(--text)' }}>{dossier.clinical.avgRtSdMs} ms</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                Sessões: <strong style={{ color: 'var(--text)' }}>{dossier.clinical.totalSessions}</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                5/5 Blocos: <strong style={{ color: 'var(--ok)' }}>{dossier.clinical.earlyClearRatePct}%</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VISÃO B: EVOLUÇÃO POR EXERCÍCIO (12 PROTOCOLOS)
          ===================================================================== */}
      {hubTab === 'exercises' && (
        <div className="flex flex-col gap-3.5 animate-pop">
          <div className="grid grid-cols-3 gap-2">
            <div className="surface-card p-3 text-center">
              <div className="text-xl font-black tabular" style={{ color: 'var(--accent)' }}>
                {totalStages}
              </div>
              <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-soft)' }}>
                Níveis somados
              </div>
            </div>
            <div className="surface-card p-3 text-center">
              <div className="text-xl font-black tabular" style={{ color: 'var(--ok)' }}>
                {dossier.clinical.earlyClearRatePct}%
              </div>
              <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-soft)' }}>
                Conclusão 5/5
              </div>
            </div>
            <div className="surface-card p-3 text-center">
              <div className="text-xl font-black tabular">
                {bestExercisePercentile ? `Top ${bestExercisePercentile.topPercent}%` : '—'}
              </div>
              <div className="text-[10px] font-medium mt-0.5 truncate" style={{ color: 'var(--text-soft)' }}>
                {bestExercisePercentile ? GAME_MAP[bestExercisePercentile.slug].name : 'Melhor percentil'}
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setExerciseDomainFilter('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                exerciseDomainFilter === 'all' ? 'btn-accent' : 'btn-soft'
              }`}
            >
              Todos (12)
            </button>
            {DOMAIN_LIST.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setExerciseDomainFilter(d.key)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                  exerciseDomainFilter === d.key ? 'btn-accent' : 'btn-soft'
                }`}
              >
                {d.shortName}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredExercises.map((item) => {
              const gameMeta = GAME_MAP[item.slug];
              const domMeta = DOMAIN_MAP[item.domain];
              const bench = benchmarks.games[item.slug] ?? NORMATIVE_BENCHMARKS.games[item.slug];
              const isExpanded = expandedGameSlug === item.slug;

              return (
                <div key={item.slug} className="surface-card p-3.5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExpandedGameSlug(isExpanded ? null : item.slug)}
                    className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${domMeta.color}18`, color: domMeta.color }}
                      >
                        <GameIcon slug={item.slug} size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{gameMeta.name}</div>
                        <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-soft)' }}>
                          <span style={{ color: domMeta.color }}>{domMeta.shortName}</span>
                          <span>·</span>
                          <span>Nível {item.currentStage}</span>
                          <span>·</span>
                          <span>{item.totalPlays} sessões</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.highestScore > 0 ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold tabular"
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
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--bg-subtle)', color: 'var(--text-soft)' }}
                        >
                          Novo
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={15} style={{ color: 'var(--text-soft)' }} />
                      ) : (
                        <ChevronDown size={15} style={{ color: 'var(--text-soft)' }} />
                      )}
                    </div>
                  </button>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-xl py-1.5 px-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-soft)' }}>Máximo</div>
                      <div className="text-xs font-bold tabular mt-0.5">
                        {item.highestScore > 0 ? `${scoreToPercent(item.highestScore)}%` : '—'}
                      </div>
                    </div>
                    <div className="rounded-xl py-1.5 px-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-soft)' }}>Melhor Bloco</div>
                      <div className="text-xs font-bold tabular mt-0.5" style={{ color: item.bestWave >= 5 ? 'var(--ok)' : 'var(--text)' }}>
                        {item.bestWave > 0 ? `${item.bestWave}/5` : '—'}
                      </div>
                    </div>
                    <div className="rounded-xl py-1.5 px-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-soft)' }}>Conclusão</div>
                      <div className="text-xs font-bold tabular mt-0.5" style={{ color: 'var(--accent)' }}>
                        {item.totalPlays > 0 ? `${item.earlyClearRatePct}%` : '—'}
                      </div>
                    </div>
                  </div>

                  <GameSparkline data={item.sparkline} color={domMeta.color} />

                  {isExpanded && (
                    <div className="pt-2 flex flex-col gap-3 animate-pop" style={{ borderTop: '1px solid var(--border)' }}>
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
                        className="w-full py-2.5 rounded-xl font-bold text-xs btn-accent cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Praticar {gameMeta.name} (Nível {item.currentStage})</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Exportação Minimalista */}
      {shareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="w-full max-w-[360px] surface-card p-5 flex flex-col gap-4 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                Resumo do Dossiê
              </span>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center btn-soft cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
                <span style={{ color: 'var(--accent)' }}>NeuroLab</span>
                <span style={{ color: 'var(--text-soft)' }}>Faixa {ageLabel}</span>
              </div>

              <div>
                <div className="text-base font-extrabold leading-tight">{dossier.archetypeTitle}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {dossier.archetypeSubtitle}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-card)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--text-soft)' }}>Índice Global</div>
                  <div className="text-xl font-black tabular">{icgPct}%</div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--ok)' }}>Top {dossier.topPercent}%</div>
                </div>
                <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-card)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--text-soft)' }}>RT / Estabilidade</div>
                  <div className="text-lg font-bold tabular">
                    {dossier.clinical.avgRtMs ? `${dossier.clinical.avgRtMs} ms` : '—'}
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
                    Foco {dossier.clinical.consistencyIndex}%
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCopySummary()}
                className="py-2.5 rounded-xl font-semibold text-xs btn-soft cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copied ? <Check size={13} style={{ color: 'var(--ok)' }} /> : <Copy size={13} />}
                <span>{copied ? 'Copiado' : 'Copiar texto'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportDossierCardPng({
                    playerName: profile.name,
                    archetypeTitle: dossier.archetypeTitle,
                    archetypeSubtitle: dossier.archetypeSubtitle,
                    icgPct,
                    percentile: dossier.globalPercentile,
                    ageLabel,
                    band: dossier.populationBand,
                    top1: {
                      label: DOMAIN_MAP[dossier.topDomains[0]].shortName,
                      pct: scoreToPercent(scores[dossier.topDomains[0]] ?? 500),
                    },
                    top2: {
                      label: DOMAIN_MAP[dossier.topDomains[1]].shortName,
                      pct: scoreToPercent(scores[dossier.topDomains[1]] ?? 500),
                    },
                    avgRtMs: dossier.clinical.avgRtMs,
                    consistency: dossier.clinical.consistencyIndex,
                    bottleneck: DOMAIN_MAP[dossier.bottleneckDomain].name,
                    recommendedGame: recommendedGameMeta.name,
                  })
                }
                className="py-2.5 rounded-xl font-bold text-xs btn-accent cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download size={13} />
                <span>Baixar PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

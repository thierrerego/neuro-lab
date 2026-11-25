import { useMemo } from 'react';
import {
  AlertCircle,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { AppDataState } from '../lib/dataService';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_MAP, GAME_REGISTRY } from '../engine/gameRegistry';
import { getIntensityLabel } from '../engine/adaptiveEngine';
import {
  getCalibrationPlan,
  getCalibrationProgress,
  getCalibrationResetAt,
  getDailyNeuroInsight,
  getProtocolReason,
  isRankingReady,
  pickNextFlowGame,
  scoreToPercent,
} from '../engine/psychometricEngine';
import {
  computeWeeklyEvolution,
} from '../engine/cognitiveProfiler';
import type { GameSlug, SessionMode } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface HomeScreenProps {
  data: AppDataState;
  onStartGame: (slug: GameSlug, mode: SessionMode, queue?: GameSlug[]) => void;
  onStartFlow: () => void;
  onOpenCalibration: () => void;
  onContinueCalibration: () => void;
}

export function HomeScreen({
  data,
  onStartGame,
  onStartFlow,
  onOpenCalibration,
  onContinueCalibration,
}: HomeScreenProps) {
  const { profile, scores, progress, dailyProtocol, sessions, snapshots } = data;

  const calProgress = useMemo(
    () =>
      getCalibrationProgress(
        getCalibrationPlan(profile.selected_domains, profile.cognitive_bottlenecks),
        sessions,
        getCalibrationResetAt(profile)
      ),
    [profile, sessions]
  );
  // Some quando o teste termina (ou quando a pessoa já liberou o ranking jogando normalmente)
  const showCalibrationCard =
    calProgress.next !== null && !isRankingReady(profile, sessions);

  const globalPct = scoreToPercent(profile.global_cognitive_index);
  const { basePct, hasBaseline } = useMemo(() => {
    const vals = DOMAIN_LIST.map((d) => scores.baseline_scores?.[d.key] ?? 0).filter((v) => v > 0);
    if (vals.length === 0) return { basePct: 0, hasBaseline: false };
    const avg = Math.round(vals.reduce((acc, v) => acc + v, 0) / vals.length);
    return { basePct: scoreToPercent(avg), hasBaseline: true };
  }, [scores]);
  const deltaPct = hasBaseline ? globalPct - basePct : 0;

  const weekly = useMemo(
    () => computeWeeklyEvolution(sessions, snapshots, profile.global_cognitive_index),
    [sessions, snapshots, profile.global_cognitive_index]
  );

  const completedSet = useMemo(
    () => new Set<GameSlug>(dailyProtocol.completed_games ?? []),
    [dailyProtocol.completed_games]
  );

  // Descobre quais jogos ainda nunca foram jogados para incentivar explorar todo o catálogo antes de repetir
  const unplayedGames = useMemo(
    () => GAME_REGISTRY.filter((g) => (progress[g.slug]?.total_plays ?? 0) === 0),
    [progress]
  );
  const totalCatalogGames = GAME_REGISTRY.length;
  const discoveredCount = totalCatalogGames - unplayedGames.length;
  const discoveryPct = Math.round((discoveredCount / Math.max(1, totalCatalogGames)) * 100);

  // Ordena a Sessão Guiada: enquanto existirem jogos nunca jogados, prioriza jogos inéditos distribuídos entre os domínios
  const sessionTasks = useMemo(() => {
    const items = dailyProtocol.recommended_games ?? [];
    const targetCount = Math.max(3, items.length);

    if (unplayedGames.length > 0) {
      const doneItems = items.filter((it) => completedSet.has(it.slug));
      const usedSlugs = new Set<GameSlug>(doneItems.map((it) => it.slug));
      const picked: Array<{ slug: GameSlug; domain: (typeof DOMAIN_LIST)[number]['key']; role: 'weak' | 'priority' | 'maintenance'; isNew?: boolean }> =
        doneItems.map((it) => ({ ...it, isNew: false }));

      // Intercala jogos inéditos priorizando domínios mais fracos primeiro
      const orderedDomains = [...DOMAIN_LIST].sort((a, b) => (scores[a.key] ?? 0) - (scores[b.key] ?? 0));
      let round = 0;
      while (picked.length < targetCount && round < 12) {
        let addedInRound = false;
        for (const dom of orderedDomains) {
          if (picked.length >= targetCount) break;
          const nextNew = unplayedGames.find((g) => g.domain === dom.key && !usedSlugs.has(g.slug));
          if (nextNew) {
            usedSlugs.add(nextNew.slug);
            picked.push({ slug: nextNew.slug, domain: nextNew.domain, role: 'priority', isNew: true });
            addedInRound = true;
          }
        }
        if (!addedInRound) break;
        round++;
      }

      // Completa se sobrou algum slot
      for (const it of items) {
        if (picked.length >= targetCount) break;
        if (!usedSlugs.has(it.slug)) {
          usedSlugs.add(it.slug);
          picked.push({ ...it, isNew: false });
        }
      }

      return picked
        .filter((item) => Boolean(GAME_MAP[item.slug]))
        .map((item, idx) => {
          const game = GAME_MAP[item.slug];
          const domain = DOMAIN_MAP[item.domain];
          const stage = Math.max(1, progress[item.slug]?.current_stage ?? 1);
          const done = completedSet.has(item.slug);
          const reason = item.isNew
            ? 'Jogo novo · experimente para mapear sua mente'
            : getProtocolReason(item.role, idx, scores[item.domain] ?? 0);
          return { ...item, game, domain, stage, done, reason };
        });
    }

    // Todos os jogos já foram experimentados: foca nos domínios e jogos mais baixos para igualar a mente
    const sorted = [...items]
      .filter((item) => Boolean(GAME_MAP[item.slug]))
      .sort((a, b) => {
        if (a.role === 'maintenance' && b.role !== 'maintenance') return 1;
        if (b.role === 'maintenance' && a.role !== 'maintenance') return -1;
        return (scores[a.domain] ?? 0) - (scores[b.domain] ?? 0);
      });
    return sorted.map((item, idx) => {
      const game = GAME_MAP[item.slug];
      const domain = DOMAIN_MAP[item.domain];
      const stage = Math.max(1, progress[item.slug]?.current_stage ?? 1);
      const done = completedSet.has(item.slug);
      const reason = getProtocolReason(item.role, idx, scores[item.domain] ?? 0);
      return { ...item, game, domain, stage, done, reason, isNew: false };
    });
  }, [dailyProtocol.recommended_games, scores, progress, completedSet, unplayedGames]);

  const completedCount = sessionTasks.filter((t) => t.done).length;
  const totalTasks = sessionTasks.length;
  const allCompleted = totalTasks > 0 && completedCount === totalTasks;
  const nextPendingTask = sessionTasks.find((t) => !t.done) ?? sessionTasks[0];
  const queueSlugs = useMemo(() => sessionTasks.map((t) => t.slug), [sessionTasks]);

  // Pontos fortes e pontos a melhorar em linguagem direta
  const { strongDomains, weakDomains } = useMemo(() => {
    const measured = DOMAIN_LIST.map((d) => ({
      meta: d,
      pct: scoreToPercent(scores[d.key] ?? 0),
      raw: scores[d.key] ?? 0,
    })).filter((item) => item.raw > 0);

    const byDesc = [...measured].sort((a, b) => b.raw - a.raw);
    const strong = byDesc.slice(0, 2);
    const strongKeys = new Set(strong.map((s) => s.meta.key));

    const weak = [...measured]
      .filter((m) => !strongKeys.has(m.meta.key))
      .sort((a, b) => a.raw - b.raw)
      .slice(0, 2);

    return { strongDomains: strong, weakDomains: weak };
  }, [scores]);

  const flowPreview = useMemo(
    () => pickNextFlowGame(progress, scores),
    [progress, scores]
  );
  const flowGameMeta = GAME_MAP[flowPreview.slug];

  const neuroInsight = useMemo(
    () =>
      getDailyNeuroInsight(
        sessionTasks.map((t) => t.domain.key),
        dailyProtocol.protocol_date
      ),
    [sessionTasks, dailyProtocol.protocol_date]
  );

  // Anel SVG suave para o progresso do treino de hoje (estilo Apple Health / Oura)
  const ringRadius = 31;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringRatio = totalTasks > 0 ? completedCount / totalTasks : 0;
  const ringOffset = ringCircumference * (1 - ringRatio);

  return (
    <div className="flex flex-col gap-6 animate-pop">
      {/* Cartão do teste inicial: opcional, dá para sair e continuar de onde parou */}
      {showCalibrationCard && (
        <section
          className="surface-card p-5 flex flex-col gap-3.5"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
            >
              {calProgress.doneCount > 0 ? <AlertCircle size={22} /> : <Target size={22} />}
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold tracking-tight">
                {calProgress.doneCount > 0 ? 'Teste inicial incompleto' : 'Fazer o teste inicial?'}
              </div>
              <p className="text-sm leading-relaxed mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {calProgress.doneCount > 0
                  ? `Você fez ${calProgress.doneCount} de ${calProgress.total} jogos. Toque para continuar de onde parou.`
                  : `${calProgress.total} jogos curtos (2 por habilidade que você escolheu) para medir onde você está frente à sua idade. Pode sair quando quiser.`}
              </p>
            </div>
          </div>
          {calProgress.total > 0 && (
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(calProgress.doneCount / calProgress.total) * 100}%`,
                  background: 'var(--accent-grad)',
                }}
              />
            </div>
          )}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onContinueCalibration}
              className="flex-1 min-h-[46px] rounded-2xl font-bold text-sm btn-accent cursor-pointer flex items-center justify-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              <span>
                {calProgress.doneCount > 0
                  ? `Continuar (${calProgress.doneCount + 1}/${calProgress.total})`
                  : 'Sim, começar'}
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenCalibration}
              className="min-h-[46px] px-4 rounded-2xl font-semibold text-sm btn-soft cursor-pointer"
            >
              Ver jogos
            </button>
          </div>
        </section>
      )}

      {/* =====================================================================
          1. CARD HERO DE ESTADO COGNITIVO + CONSISTÊNCIA SEMANAL
          ===================================================================== */}
      <section className="surface-card p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div
              className="text-xs font-semibold tracking-wide"
              style={{ color: 'var(--text-soft)' }}
            >
              Índice Cognitivo Global
            </div>
            <div className="flex items-baseline gap-2.5 mt-1.5 flex-wrap">
              <span className="text-5xl font-extrabold tracking-tight tabular leading-none">
                {globalPct}%
              </span>
              {globalPct === 0 ? (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                >
                  Faça o teste inicial
                </span>
              ) : (
                hasBaseline &&
                deltaPct !== 0 && (
                  <span
                    className="text-xs font-bold tabular px-2.5 py-1 rounded-full"
                    style={{
                      background:
                        deltaPct > 0 ? 'rgba(16, 185, 129, 0.13)' : 'rgba(239, 68, 68, 0.12)',
                      color: deltaPct > 0 ? 'var(--ok)' : 'var(--err)',
                    }}
                  >
                    {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`} vs. base
                  </span>
                )
              )}
            </div>
          </div>

          {/* Anel SVG do Protocolo Hoje */}
          <div className="relative w-[78px] h-[78px] shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
              <circle
                cx="38"
                cy="38"
                r={ringRadius}
                fill="none"
                stroke="var(--bg-subtle)"
                strokeWidth="7"
              />
              <circle
                cx="38"
                cy="38"
                r={ringRadius}
                fill="none"
                stroke={allCompleted ? 'var(--ok)' : 'var(--accent)'}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                className="text-[15px] font-extrabold tabular leading-none"
                style={{ color: allCompleted ? 'var(--ok)' : 'var(--text)' }}
              >
                {completedCount}/{totalTasks}
              </span>
              <span className="text-xs font-medium mt-0.5 leading-none" style={{ color: 'var(--text-soft)' }}>
                hoje
              </span>
            </div>
          </div>
        </div>

        {/* Barra suave e gordinha do Índice Global */}
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${globalPct}%`, background: 'var(--accent-grad)' }}
          />
        </div>

        {/* Consistência e Meta Diária em dois blocos aconchegantes */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl p-3.5 flex items-center gap-3"
            style={{ background: 'var(--bg-subtle)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245, 158, 11, 0.16)', color: 'var(--warn)' }}
            >
              <Flame size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                Consistência
              </div>
              <div className="text-[15px] font-bold tabular truncate">
                {profile.current_streak} {profile.current_streak === 1 ? 'dia' : 'dias'}
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl p-3.5 flex items-center gap-3"
            style={{ background: 'var(--bg-subtle)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
            >
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                Meta Diária
              </div>
              <div className="text-[15px] font-bold tabular truncate">
                {profile.daily_goal_minutes} min · {totalTasks}x
              </div>
            </div>
          </div>
        </div>

        {/* Faixa semanal ampla e confortável (S T Q Q S S D) */}
        <div
          className="pt-4 flex flex-col gap-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
            <span>Semana atual</span>
            <span className="tabular font-bold" style={{ color: 'var(--text-muted)' }}>
              {weekly.activeDaysThisWeek} de 7 dias
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekly.days.map((d) => (
              <div key={d.dateIso} className="flex flex-col items-center">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all"
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
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* =====================================================================
          1.5. BOTÃO MODO FLOW (RITMO CONTÍNUO INTELIGENTE)
          ===================================================================== */}
      <button
        type="button"
        onClick={onStartFlow}
        className="w-full rounded-[24px] p-5 text-left cursor-pointer transition-transform active:scale-[0.985] flex items-center justify-between gap-4"
        style={{
          background: 'var(--accent-grad)',
          color: '#FFFFFF',
          boxShadow: '0 12px 28px var(--accent-shadow)',
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-white/18">
            <Zap size={13} fill="currentColor" />
            <span>Modo Flow</span>
          </div>
          <div className="text-lg font-extrabold leading-tight mt-2">
            Jogar no automático
          </div>
          <div className="text-xs font-medium mt-1 opacity-90 truncate">
            Próximo: <strong>{flowGameMeta.name}</strong> · {flowPreview.reasonLabel}
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          <Play size={22} fill="currentColor" />
        </div>
      </button>

      {/* =====================================================================
          2. SESSÃO GUIADA DO DIA (CARDS AMPLOS E CONFORTÁVEIS)
          ===================================================================== */}
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Sessão Guiada do Dia</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {unplayedGames.length > 0
                ? 'Vamos experimentar todos os jogos antes de montar treinos focados'
                : 'Treino personalizado focado nos seus pontos mais fracos'}
            </p>
          </div>
          {allCompleted && (
            <span
              className="px-3 py-1 rounded-full text-xs font-bold shrink-0"
              style={{ background: 'rgba(16, 185, 129, 0.14)', color: 'var(--ok)' }}
            >
              Completo
            </span>
          )}
        </div>

        {/* Barra de descoberta dos jogos enquanto ainda faltam jogos inéditos */}
        {unplayedGames.length > 0 && (
          <div
            className="rounded-2xl px-4 py-3 flex flex-col gap-2"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                <Compass size={15} />
                <span>Descoberta do catálogo</span>
              </span>
              <span className="tabular" style={{ color: 'var(--text-muted)' }}>
                {discoveredCount}/{totalCatalogGames} jogos jogados
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${discoveryPct}%`, background: 'var(--accent-grad)' }}
              />
            </div>
            <div className="text-[11px] leading-snug" style={{ color: 'var(--text-soft)' }}>
              Faltam <strong>{unplayedGames.length}</strong> jogos novos. Jogue todos para o app conhecer 100% da sua mente.
            </div>
          </div>
        )}

        {/* Ação principal de 1 toque */}
        {nextPendingTask && !allCompleted && (
          <button
            type="button"
            onClick={() => onStartGame(nextPendingTask.slug, 'guided', queueSlugs)}
            className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer flex items-center justify-center gap-2.5"
          >
            <Play size={18} fill="currentColor" />
            <span className="truncate">
              {completedCount === 0
                ? `Iniciar Sessão · ${nextPendingTask.game.name}`
                : `Próximo (${completedCount + 1}/${totalTasks}) · ${nextPendingTask.game.name}`}
            </span>
          </button>
        )}

        {/* Lista direta dos exercícios recomendados */}
        <div className="flex flex-col gap-3">
          {sessionTasks.map((task) => (
            <button
              key={task.slug}
              type="button"
              onClick={() => onStartGame(task.slug, 'guided', queueSlugs)}
              className="surface-card surface-card-click p-4 sm:p-5 flex items-center gap-4 text-left cursor-pointer"
              style={
                task.done
                  ? { opacity: 0.78, borderColor: 'rgba(16, 185, 129, 0.34)' }
                  : undefined
              }
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: task.done ? 'rgba(16, 185, 129, 0.14)' : `${task.domain.color}16`,
                  color: task.done ? 'var(--ok)' : task.domain.color,
                }}
              >
                {task.done ? (
                  <Check size={22} strokeWidth={2.8} />
                ) : (
                  <GameIcon slug={task.slug} size={22} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-bold leading-snug truncate">
                    {task.game.name}
                  </span>
                  <span
                    className="text-xs font-semibold tabular px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                  >
                    {getIntensityLabel(task.stage)}
                  </span>
                </div>

                <div className="text-xs font-semibold mt-0.5" style={{ color: task.domain.color }}>
                  {task.domain.name}
                </div>

                <div className="text-sm mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {task.reason}
                </div>
              </div>

              <ChevronRight size={20} className="shrink-0" style={{ color: 'var(--text-soft)' }} />
            </button>
          ))}
        </div>
      </section>

      {/* =====================================================================
          3. RESUMO SIMPLES: PONTOS FORTES E PONTOS A MELHORAR
          ===================================================================== */}
      <section className="flex flex-col gap-3">
        <div className="px-0.5">
          <h2 className="text-base font-extrabold tracking-tight">Resumo da sua mente</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Veja rapidinho onde você está indo bem e o que vale treinar agora
          </p>
        </div>

        {/* Card 1: Pontos Fortes */}
        <div className="surface-card p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(16, 185, 129, 0.14)', color: 'var(--ok)' }}
            >
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="text-sm font-extrabold" style={{ color: 'var(--ok)' }}>
                Pontos fortes
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {strongDomains.length > 0
                  ? 'Habilidades em que você está se saindo melhor'
                  : 'Jogue sua primeira sessão para descobrir seus pontos fortes'}
              </div>
            </div>
          </div>

          {strongDomains.length > 0 && (
            <div className="flex flex-col gap-2">
              {strongDomains.map((item) => (
                <div
                  key={item.meta.key}
                  className="rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2"
                  style={{ background: 'var(--bg-subtle)' }}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-bold">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.meta.color }} />
                    <span>{item.meta.name}</span>
                  </span>
                  <span className="text-xs font-extrabold tabular px-2.5 py-1 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.14)', color: 'var(--ok)' }}>
                    {item.pct}% · Mandando bem
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Pontos a Melhorar */}
        <div className="surface-card p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warn)' }}
            >
              <Target size={18} />
            </div>
            <div>
              <div className="text-sm font-extrabold" style={{ color: 'var(--warn)' }}>
                Pontos a melhorar
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {weakDomains.length > 0
                  ? 'Áreas com mais espaço para evoluir agora'
                  : 'Continue jogando exercícios diferentes para mapear todas as áreas'}
              </div>
            </div>
          </div>

          {weakDomains.length > 0 && (
            <div className="flex flex-col gap-2">
              {weakDomains.map((item) => {
                const domainGames = GAME_REGISTRY.filter((g) => g.domain === item.meta.key);
                const suggested =
                  domainGames.find((g) => (progress[g.slug]?.total_plays ?? 0) === 0) ?? domainGames[0];
                return (
                  <div
                    key={item.meta.key}
                    className="rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2"
                    style={{ background: 'var(--bg-subtle)' }}
                  >
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 text-sm font-bold">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.meta.color }} />
                        <span className="truncate">{item.meta.name}</span>
                      </div>
                      <div className="text-xs font-semibold tabular mt-0.5" style={{ color: 'var(--text-soft)' }}>
                        Atual: {item.pct}% · vale reforçar
                      </div>
                    </div>
                    {suggested && (
                      <button
                        type="button"
                        onClick={() => onStartGame(suggested.slug, 'free')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold btn-accent shrink-0 cursor-pointer"
                      >
                        Treinar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          4. DICA RÁPIDA DO DIA
          ===================================================================== */}
      <aside className="surface-card p-5 flex items-start gap-3.5">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
        >
          <Brain size={20} />
        </div>
        <div className="min-w-0">
          <div
            className="text-xs font-bold tracking-wide"
            style={{ color: 'var(--accent)' }}
          >
            Dica do dia · {neuroInsight.tag}
          </div>
          <p className="text-sm leading-relaxed mt-1" style={{ color: 'var(--text-muted)' }}>
            {neuroInsight.text}
          </p>
        </div>
      </aside>
    </div>
  );
}

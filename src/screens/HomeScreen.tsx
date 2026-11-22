import { useMemo } from 'react';
import {
  AlertCircle,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Flame,
  Play,
} from 'lucide-react';
import type { AppDataState } from '../lib/dataService';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import {
  getDailyNeuroInsight,
  getProtocolReason,
  scoreToPercent,
} from '../engine/psychometricEngine';
import type { GameSlug, SessionMode } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface HomeScreenProps {
  data: AppDataState;
  onStartGame: (slug: GameSlug, mode: SessionMode, queue?: GameSlug[]) => void;
  onOpenCalibration: () => void;
}

export function HomeScreen({
  data,
  onStartGame,
  onOpenCalibration,
}: HomeScreenProps) {
  const { profile, scores, progress, dailyProtocol } = data;

  const globalPct = scoreToPercent(profile.global_cognitive_index);
  const basePct = useMemo(() => {
    const sum = DOMAIN_LIST.reduce((acc, d) => acc + (scores.baseline_scores?.[d.key] ?? 500), 0);
    return scoreToPercent(Math.round(sum / DOMAIN_LIST.length));
  }, [scores]);
  const deltaPct = globalPct - basePct;

  const completedSet = useMemo(
    () => new Set<GameSlug>(dailyProtocol.completed_games ?? []),
    [dailyProtocol.completed_games]
  );

  // Ordena priorizando os domínios com menor percentual atual (treino de déficit), mantendo manutenção ao final
  const sessionTasks = useMemo(() => {
    const items = dailyProtocol.recommended_games ?? [];
    const sorted = [...items].sort((a, b) => {
      if (a.role === 'maintenance' && b.role !== 'maintenance') return 1;
      if (b.role === 'maintenance' && a.role !== 'maintenance') return -1;
      return (scores[a.domain] ?? 500) - (scores[b.domain] ?? 500);
    });
    return sorted.map((item, idx) => {
      const game = GAME_MAP[item.slug];
      const domain = DOMAIN_MAP[item.domain];
      const stage = progress[item.slug]?.current_stage ?? 0;
      const done = completedSet.has(item.slug);
      const reason = getProtocolReason(item.role, idx, scores[item.domain] ?? 500);
      return { ...item, game, domain, stage, done, reason };
    });
  }, [dailyProtocol.recommended_games, scores, progress, completedSet]);

  const completedCount = sessionTasks.filter((t) => t.done).length;
  const totalTasks = sessionTasks.length;
  const allCompleted = totalTasks > 0 && completedCount === totalTasks;
  const nextPendingTask = sessionTasks.find((t) => !t.done) ?? sessionTasks[0];
  const queueSlugs = useMemo(() => sessionTasks.map((t) => t.slug), [sessionTasks]);

  const neuroInsight = useMemo(
    () =>
      getDailyNeuroInsight(
        sessionTasks.map((t) => t.domain.key),
        dailyProtocol.protocol_date
      ),
    [sessionTasks, dailyProtocol.protocol_date]
  );

  return (
    <div className="flex flex-col gap-5 animate-pop">
      {/* =====================================================================
          1. CABEÇALHO DE ESTADO COGNITIVO (ICG %, Consistência e Meta Diária)
          ===================================================================== */}
      <section className="surface-card p-5 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-soft)' }}
            >
              Índice Cognitivo Global
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black tracking-tight tabular leading-none">
                {globalPct}%
              </span>
              {deltaPct !== 0 && (
                <span
                  className="text-xs font-semibold tabular"
                  style={{ color: deltaPct > 0 ? 'var(--ok)' : 'var(--err)' }}
                >
                  {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`} vs. base
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-soft)' }}
            >
              Protocolo Hoje
            </div>
            <div className="text-sm font-bold tabular mt-1" style={{ color: allCompleted ? 'var(--ok)' : 'var(--accent)' }}>
              {completedCount}/{totalTasks} concluídos
            </div>
          </div>
        </div>

        {/* Barra limpa do Índice Global */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${globalPct}%`, background: 'var(--accent)' }}
          />
        </div>

        {/* Consistência e Meta Diária */}
        <div
          className="grid grid-cols-2 gap-3 pt-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--bg-subtle)', color: 'var(--warn)' }}
            >
              <Flame size={15} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                Consistência
              </div>
              <div className="text-sm font-bold tabular">
                {profile.current_streak} {profile.current_streak === 1 ? 'dia ativo' : 'dias ativos'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
            >
              <Clock size={15} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                Meta Diária
              </div>
              <div className="text-sm font-bold tabular">
                {profile.daily_goal_minutes} min · {totalTasks} exercícios
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Aviso discreto se o rastreio inicial foi pulado */}
      {profile.calibration_skipped && (
        <button
          type="button"
          onClick={onOpenCalibration}
          className="w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle size={14} style={{ color: 'var(--warn)' }} />
            <span>Avaliação inicial pendente (linha de base estimada)</span>
          </span>
          <span style={{ color: 'var(--accent)' }}>Calibrar →</span>
        </button>
      )}

      {/* =====================================================================
          2. SESSÃO GUIADA DO DIA (CARDS LIMPOS E DIRETOS)
          ===================================================================== */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-0.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Sessão Guiada do Dia
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-soft)' }}>
              Priorizando domínios com maior margem de evolução
            </p>
          </div>
          {allCompleted && (
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(16,185,129,0.14)', color: 'var(--ok)' }}
            >
              Completo
            </span>
          )}
        </div>

        {/* Ação principal de 1 toque */}
        {nextPendingTask && !allCompleted && (
          <button
            type="button"
            onClick={() => onStartGame(nextPendingTask.slug, 'guided', queueSlugs)}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm btn-accent cursor-pointer flex items-center justify-center gap-2"
          >
            <Play size={15} fill="currentColor" />
            <span>
              {completedCount === 0
                ? `Iniciar Sessão · ${nextPendingTask.game.name}`
                : `Próximo · ${nextPendingTask.game.name}`}
            </span>
          </button>
        )}

        {/* Lista direta dos 2 a 5 exercícios recomendados */}
        <div className="flex flex-col gap-2.5">
          {sessionTasks.map((task) => (
            <button
              key={task.slug}
              type="button"
              onClick={() => onStartGame(task.slug, 'guided', queueSlugs)}
              className="surface-card surface-card-click p-4 flex items-center gap-3.5 text-left cursor-pointer"
              style={
                task.done
                  ? { opacity: 0.72, borderColor: 'rgba(16, 185, 129, 0.3)' }
                  : undefined
              }
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: task.done ? 'rgba(16,185,129,0.14)' : `${task.domain.color}18`,
                  color: task.done ? 'var(--ok)' : task.domain.color,
                }}
              >
                {task.done ? <Check size={18} strokeWidth={2.5} /> : <GameIcon slug={task.slug} size={19} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold truncate">{task.game.name}</span>
                  <span
                    className="text-[11px] font-semibold tabular px-2 py-0.5 rounded-md shrink-0"
                    style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                  >
                    Nível {task.stage}
                  </span>
                </div>

                <div className="text-xs font-medium mt-0.5" style={{ color: task.domain.color }}>
                  {task.domain.name}
                </div>

                <div className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--text-soft)' }}>
                  {task.reason}
                </div>
              </div>

              <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--text-soft)' }} />
            </button>
          ))}
        </div>
      </section>

      {/* =====================================================================
          3. INSIGHT CURTO DE NEUROCIÊNCIA (MICRO-CARD DISCRETO)
          ===================================================================== */}
      <aside
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent)',
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
        >
          <Brain size={15} />
        </div>
        <div className="min-w-0">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-soft)' }}
          >
            Nota de Neurociência · {neuroInsight.tag}
          </div>
          <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--text-muted)' }}>
            {neuroInsight.text}
          </p>
        </div>
      </aside>
    </div>
  );
}

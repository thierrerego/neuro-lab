import { Check, Play, Zap } from 'lucide-react';
import type { AppDataState } from '../lib/dataService';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import type { GameSlug, SessionMode } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface HomeScreenProps {
  data: AppDataState;
  onStartGame: (slug: GameSlug, mode: SessionMode) => void;
  onGoStats: () => void;
}

export function HomeScreen({ data, onStartGame, onGoStats }: HomeScreenProps) {
  const { profile, dailyProtocol, progress } = data;
  const completedSet = new Set(dailyProtocol.completed_games);
  const completedCount = dailyProtocol.recommended_games.filter((g) => completedSet.has(g.slug)).length;
  const nextGame =
    dailyProtocol.recommended_games.find((g) => !completedSet.has(g.slug)) ??
    dailyProtocol.recommended_games[0];

  const level = Math.floor(profile.xp / 600) + 1;
  const xpInLevel = profile.xp % 600;
  const xpPct = Math.min(100, Math.round((xpInLevel / 600) * 100));

  return (
    <div className="flex flex-col gap-4 animate-pop">
      {/* Barra de XP (tema Gamificado) */}
      {profile.theme_preference === 'gamified' && (
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(6,182,212,0.12))',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="inline-flex items-center gap-1.5">
              <Zap size={14} style={{ color: 'var(--warn)' }} />
              Nível {level}
            </span>
            <span className="tabular" style={{ color: 'var(--warn)' }}>
              {xpInLevel} / 600 XP
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, #f59e0b, #ec4899, #06b6d4)' }}
            />
          </div>
        </div>
      )}

      {/* Hero ICG + Botão 1 toque */}
      <div className="surface-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              ICG
            </div>
            <div
              className="text-5xl font-black tabular leading-none mt-1"
              style={{
                background: 'var(--accent-grad)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {profile.global_cognitive_index}
            </div>
          </div>

          <button
            onClick={onGoStats}
            className="px-3.5 py-2 rounded-xl text-xs font-bold btn-soft cursor-pointer"
          >
            Radar
          </button>
        </div>

        <button
          onClick={() => onStartGame(nextGame.slug, 'guided')}
          className="w-full py-4 rounded-2xl font-extrabold text-base btn-accent flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play size={18} fill="currentColor" />
          <span>{completedCount >= 4 ? 'Treinar de novo' : 'Treinar agora'}</span>
        </button>
      </div>

      {/* Treino Diário (4 jogos) */}
      <div className="flex items-center justify-between px-1 mt-1">
        <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Hoje
        </span>
        <span className="text-xs font-extrabold tabular" style={{ color: 'var(--accent)' }}>
          {completedCount}/4
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {dailyProtocol.recommended_games.map((item) => {
          const game = GAME_MAP[item.slug];
          const dom = DOMAIN_MAP[item.domain];
          const prog = progress[item.slug];
          const done = completedSet.has(item.slug);

          return (
            <button
              key={item.slug}
              onClick={() => onStartGame(item.slug, 'guided')}
              className="surface-card surface-card-click px-4 py-3.5 flex items-center gap-3.5 text-left cursor-pointer"
              style={{ opacity: done ? 0.65 : 1 }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `${dom.color}20`, color: dom.color }}
              >
                <GameIcon slug={item.slug} size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold truncate">{game.name}</div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  <span>{dom.shortName}</span>
                  {item.role === 'weak' && !done && (
                    <span style={{ color: 'var(--warn)' }}>+20% XP</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-extrabold tabular"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
                >
                  F{prog.current_stage}
                </span>
                {done ? (
                  <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.18)', color: 'var(--ok)' }}>
                    <Check size={15} strokeWidth={3} />
                  </span>
                ) : (
                  <Play size={16} style={{ color: 'var(--text-soft)' }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import type { AppDataState } from '../lib/dataService';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_REGISTRY } from '../engine/gameRegistry';
import { getWeakestDomains } from '../engine/psychometricEngine';
import type { DomainKey, GameSlug, SessionMode } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface CatalogScreenProps {
  data: AppDataState;
  onStartGame: (slug: GameSlug, mode: SessionMode) => void;
}

export function CatalogScreen({ data, onStartGame }: CatalogScreenProps) {
  const [filter, setFilter] = useState<'all' | DomainKey>('all');
  const weakest2 = getWeakestDomains(data.scores, 2);

  const visibleGames =
    filter === 'all' ? GAME_REGISTRY : GAME_REGISTRY.filter((g) => g.domain === filter);

  return (
    <div className="flex flex-col gap-4 animate-pop">
      {/* Filtros horizontais enxutos */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${filter === 'all' ? 'btn-accent' : 'btn-soft'}`}
        >
          Todos (12)
        </button>
        {DOMAIN_LIST.map((d) => (
          <button
            key={d.key}
            onClick={() => setFilter(d.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${filter === d.key ? 'btn-accent' : 'btn-soft'}`}
          >
            {d.shortName}
          </button>
        ))}
      </div>

      {/* Grade limpa 2 colunas */}
      <div className="grid grid-cols-2 gap-2.5">
        {visibleGames.map((g) => {
          const dom = DOMAIN_MAP[g.domain];
          const prog = data.progress[g.slug];
          const isBonus = weakest2.includes(g.domain);

          return (
            <button
              key={g.slug}
              onClick={() => onStartGame(g.slug, 'free')}
              className="surface-card surface-card-click p-4 flex flex-col justify-between gap-3 text-left cursor-pointer relative"
            >
              <div className="flex items-start justify-between w-full">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${dom.color}20`, color: dom.color }}
                >
                  <GameIcon slug={g.slug} size={20} />
                </div>
                <span
                  className="px-2 py-0.5 rounded-lg text-[11px] font-black tabular"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
                >
                  F{prog.current_stage}
                </span>
              </div>

              <div>
                <div className="text-sm font-extrabold leading-snug">{g.name}</div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1 tabular" style={{ color: 'var(--text-soft)' }}>
                    <Trophy size={11} />
                    {prog.highest_score > 0 ? prog.highest_score.toLocaleString('pt-BR') : '—'}
                  </span>
                  {isBonus && (
                    <span className="font-extrabold" style={{ color: 'var(--warn)' }}>
                      +20% XP
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

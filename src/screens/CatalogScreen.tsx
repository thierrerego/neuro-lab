import { useEffect, useMemo, useState } from 'react';
import type { AppDataState } from '../lib/dataService';
import { fetchPopulationBenchmarks } from '../lib/dataService';
import { DOMAIN_LIST, GAMES_BY_DOMAIN } from '../engine/gameRegistry';
import { getWeakestDomains } from '../engine/psychometricEngine';
import { buildGameMasteryList, NORMATIVE_BENCHMARKS } from '../engine/cognitiveProfiler';
import type { DomainKey, GameSlug, PopulationBenchmarks, SessionMode } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface CatalogScreenProps {
  data: AppDataState;
  backendOnline: boolean;
  onStartGame: (slug: GameSlug, mode: SessionMode) => void;
}

export function CatalogScreen({ data, backendOnline, onStartGame }: CatalogScreenProps) {
  const [filter, setFilter] = useState<'all' | DomainKey>('all');
  const [benchmarks, setBenchmarks] = useState<PopulationBenchmarks>(NORMATIVE_BENCHMARKS);

  useEffect(() => {
    let active = true;
    void fetchPopulationBenchmarks(backendOnline).then((res) => {
      if (active) setBenchmarks(res);
    });
    return () => {
      active = false;
    };
  }, [backendOnline, data.sessions.length]);

  const weakest2 = useMemo(() => getWeakestDomains(data.scores, 2), [data.scores]);

  const masteryMap = useMemo(() => {
    const list = buildGameMasteryList(
      data.progress,
      data.sessions,
      benchmarks,
      data.profile.age_bracket
    );
    return list.reduce(
      (acc, item) => {
        acc[item.slug] = item;
        return acc;
      },
      {} as Record<GameSlug, (typeof list)[number]>
    );
  }, [data.progress, data.sessions, benchmarks, data.profile.age_bracket]);

  const visibleDomains =
    filter === 'all' ? DOMAIN_LIST : DOMAIN_LIST.filter((d) => d.key === filter);

  return (
    <div className="flex flex-col gap-5 animate-pop">
      {/* Cabeçalho enxuto */}
      <div>
        <h1 className="text-base font-bold tracking-tight">Explorar Exercícios</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
          12 protocolos distribuídos nos 6 domínios cognitivos
        </p>
      </div>

      {/* Filtros horizontais por domínio */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
            filter === 'all' ? 'btn-accent' : 'btn-soft'
          }`}
        >
          Todos (12)
        </button>
        {DOMAIN_LIST.map((d) => {
          const isPriority = weakest2.includes(d.key);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setFilter(d.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 ${
                filter === d.key ? 'btn-accent' : 'btn-soft'
              }`}
            >
              <span>{d.shortName}</span>
              {isPriority && filter !== d.key && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--warn)' }}
                  title="Domínio prioritário"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Grid minimalista organizado pelos 6 Domínios Cognitivos */}
      <div className="flex flex-col gap-5">
        {visibleDomains.map((dom) => {
          const isPriority = weakest2.includes(dom.key);
          const games = GAMES_BY_DOMAIN[dom.key];

          return (
            <section key={dom.key} className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: dom.color }}
                  />
                  <h2 className="text-xs font-bold uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
                    {dom.name}
                  </h2>
                </div>

                {isPriority && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: 'var(--warn)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    Prioritário
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {games.map((g) => {
                  const prog = data.progress[g.slug];
                  const mastery = masteryMap[g.slug];
                  const hasPercentile = (prog?.highest_score ?? 0) > 0;

                  return (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => onStartGame(g.slug, 'free')}
                      className="surface-card surface-card-click p-3.5 flex flex-col justify-between gap-3 text-left cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${dom.color}18`, color: dom.color }}
                        >
                          <GameIcon slug={g.slug} size={18} />
                        </div>

                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-semibold tabular"
                          style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                        >
                          Nível {prog?.current_stage ?? 0}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs font-bold leading-snug">{g.name}</div>
                        <div className="flex items-center justify-between mt-1.5 text-[11px] font-medium tabular">
                          <span style={{ color: hasPercentile ? 'var(--accent)' : 'var(--text-soft)' }}>
                            {hasPercentile ? `Top ${mastery.topPercent}%` : 'Não avaliado'}
                          </span>
                          {isPriority && (
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: 'var(--warn)' }}
                              title="Domínio prioritário"
                            />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

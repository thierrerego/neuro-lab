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
    <div className="flex flex-col gap-6 animate-pop">
      {/* Cabeçalho amplo e legível */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Explorar Exercícios</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          24 protocolos científicos nos 6 domínios cognitivos
        </p>
      </div>

      {/* Filtros horizontais em pílulas confortáveis */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer ${
            filter === 'all' ? 'btn-accent' : 'btn-soft'
          }`}
        >
          Todos (24)
        </button>
        {DOMAIN_LIST.map((d) => {
          const isPriority = weakest2.includes(d.key);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setFilter(d.key)}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer inline-flex items-center gap-2 ${
                filter === d.key ? 'btn-accent' : 'btn-soft'
              }`}
            >
              <span>{d.shortName}</span>
              {isPriority && filter !== d.key && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--warn)' }}
                  title="Domínio prioritário"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Grade espaçosa organizada pelos 6 Domínios Cognitivos */}
      <div className="flex flex-col gap-6">
        {visibleDomains.map((dom) => {
          const isPriority = weakest2.includes(dom.key);
          const games = GAMES_BY_DOMAIN[dom.key];

          return (
            <section key={dom.key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: dom.color }}
                  />
                  <h2 className="text-[15px] font-bold tracking-tight truncate">
                    {dom.name}
                  </h2>
                </div>

                {isPriority && (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{
                      background: 'rgba(245, 158, 11, 0.14)',
                      color: 'var(--warn)',
                    }}
                  >
                    Prioritário
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {games.map((g) => {
                  const prog = data.progress[g.slug];
                  const mastery = masteryMap[g.slug];
                  const hasPercentile = (prog?.highest_score ?? 0) > 0;

                  return (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => onStartGame(g.slug, 'free')}
                      className="surface-card surface-card-click p-4 flex flex-col justify-between gap-4 min-h-[148px] text-left cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                          style={{ background: `${dom.color}16`, color: dom.color }}
                        >
                          <GameIcon slug={g.slug} size={22} />
                        </div>

                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-semibold tabular"
                          style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                        >
                          Carga {Math.max(1, prog?.current_stage ?? 1)}
                        </span>
                      </div>

                      <div>
                        <div className="text-[15px] font-bold leading-snug">{g.name}</div>
                        <div className="flex items-center justify-between mt-2 text-xs font-semibold tabular">
                          <span style={{ color: hasPercentile ? 'var(--accent)' : 'var(--text-soft)' }}>
                            {hasPercentile ? `Top ${mastery.topPercent}%` : 'Não avaliado'}
                          </span>
                          {isPriority && (
                            <span
                              className="w-2 h-2 rounded-full"
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

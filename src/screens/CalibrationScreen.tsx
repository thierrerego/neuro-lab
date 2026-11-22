import { Check, Play } from 'lucide-react';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import { getCalibrationDomains } from '../engine/psychometricEngine';
import type { DomainKey, DomainScoresRecord, GameSlug } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface CalibrationScreenProps {
  selectedDomains: DomainKey[];
  scores: DomainScoresRecord;
  onStartGame: (slug: GameSlug) => void;
  onFinishCalibration: () => void;
}

export function CalibrationScreen({
  selectedDomains,
  scores,
  onStartGame,
  onFinishCalibration,
}: CalibrationScreenProps) {
  const activeDomains = getCalibrationDomains(selectedDomains);
  const doneCount = activeDomains.filter((d) => Boolean(scores.baseline_scores?.[d])).length;
  const totalCount = activeDomains.length;
  const nextPendingDomain = activeDomains.find((d) => !scores.baseline_scores?.[d]);
  const allDone = doneCount >= totalCount;

  return (
    <div className="flex flex-col gap-4 animate-pop">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">Calibração</h2>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Fase 1 · {totalCount} {totalCount === 1 ? 'área' : 'áreas'} escolhidas
          </div>
        </div>
        <div className="text-xl font-black tabular" style={{ color: 'var(--accent)' }}>
          {doneCount}/{totalCount}
        </div>
      </div>

      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(doneCount / totalCount) * 100}%`, background: 'var(--accent-grad)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {activeDomains.map((domKey) => {
          const dom = DOMAIN_MAP[domKey];
          const game = GAME_MAP[dom.calibrationGame];
          const doneScore = scores.baseline_scores?.[domKey];
          const done = Boolean(doneScore);

          return (
            <button
              key={domKey}
              onClick={() => onStartGame(game.slug)}
              className="surface-card surface-card-click p-4 flex flex-col items-start gap-3 text-left cursor-pointer"
              style={{ borderColor: done ? 'var(--ok)' : undefined }}
            >
              <div className="w-full flex items-center justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${dom.color}22`, color: dom.color }}
                >
                  <GameIcon slug={game.slug} size={20} />
                </div>
                {done ? (
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-black tabular inline-flex items-center gap-1"
                    style={{ background: 'rgba(52,211,153,0.18)', color: 'var(--ok)' }}
                  >
                    <Check size={12} strokeWidth={3} />
                    {doneScore}
                  </span>
                ) : (
                  <Play size={16} style={{ color: 'var(--text-soft)' }} />
                )}
              </div>
              <div>
                <div className="text-sm font-extrabold leading-tight">{game.name}</div>
                <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {dom.shortName}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!allDone && nextPendingDomain ? (
        <button
          onClick={() => onStartGame(DOMAIN_MAP[nextPendingDomain].calibrationGame)}
          className="w-full py-4 rounded-2xl font-extrabold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play size={16} fill="currentColor" />
          <span>Próximo: {GAME_MAP[DOMAIN_MAP[nextPendingDomain].calibrationGame].name}</span>
        </button>
      ) : (
        <button
          onClick={onFinishCalibration}
          className="w-full py-4 rounded-2xl font-extrabold text-sm btn-accent cursor-pointer"
        >
          Ir para o Painel
        </button>
      )}

      {!allDone && (
        <button
          onClick={onFinishCalibration}
          className="w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer"
          style={{ color: 'var(--text-soft)' }}
        >
          Pular restantes (score inicial 500)
        </button>
      )}
    </div>
  );
}

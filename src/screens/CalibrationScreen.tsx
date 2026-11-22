import { Check, Play } from 'lucide-react';
import { DOMAIN_LIST, GAME_MAP } from '../engine/gameRegistry';
import type { DomainScoresRecord, GameSlug } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface CalibrationScreenProps {
  scores: DomainScoresRecord;
  onStartGame: (slug: GameSlug) => void;
  onFinishCalibration: () => void;
}

export function CalibrationScreen({ scores, onStartGame, onFinishCalibration }: CalibrationScreenProps) {
  const doneKeys = Object.keys(scores.baseline_scores || {});
  const doneCount = doneKeys.length;

  return (
    <div className="flex flex-col gap-4 animate-pop">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">Calibração</h2>
          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Fase 1 · 6 domínios
          </div>
        </div>
        <div className="text-xl font-black tabular" style={{ color: 'var(--accent)' }}>
          {doneCount}/6
        </div>
      </div>

      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(doneCount / 6) * 100}%`, background: 'var(--accent-grad)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {DOMAIN_LIST.map((dom) => {
          const game = GAME_MAP[dom.calibrationGame];
          const done = Boolean(scores.baseline_scores?.[dom.key]);
          return (
            <button
              key={dom.key}
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
                  <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.2)', color: 'var(--ok)' }}>
                    <Check size={14} strokeWidth={3} />
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

      <button
        onClick={onFinishCalibration}
        className={`w-full py-3.5 rounded-2xl font-extrabold text-sm cursor-pointer ${doneCount >= 6 ? 'btn-accent' : 'btn-soft'}`}
      >
        {doneCount >= 6 ? 'Ir para o Painel' : 'Ir direto ao Painel'}
      </button>
    </div>
  );
}

import { Check, Play, ShieldCheck } from 'lucide-react';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import { getCalibrationDomains, scoreToPercent } from '../engine/psychometricEngine';
import type { DomainKey, DomainScoresRecord, GameSlug } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface CalibrationScreenProps {
  selectedDomains: DomainKey[];
  scores: DomainScoresRecord;
  onStartGame: (slug: GameSlug, idx: number, total: number, domainName: string) => void;
  onSkipCalibration: () => void;
  onFinishCalibration: () => void;
}

export function CalibrationScreen({
  selectedDomains,
  scores,
  onStartGame,
  onSkipCalibration,
  onFinishCalibration,
}: CalibrationScreenProps) {
  const activeDomains = getCalibrationDomains(selectedDomains);
  const doneCount = activeDomains.filter((d) => Boolean(scores.baseline_scores?.[d])).length;
  const totalCount = activeDomains.length;
  const nextIndex = activeDomains.findIndex((d) => !scores.baseline_scores?.[d]);
  const allDone = nextIndex === -1;

  const launchNext = () => {
    if (allDone) {
      onFinishCalibration();
      return;
    }
    const domKey = activeDomains[nextIndex];
    const dom = DOMAIN_MAP[domKey];
    onStartGame(dom.calibrationGame, nextIndex + 1, totalCount, dom.shortName);
  };

  return (
    <div className="flex flex-col gap-5 py-2 animate-pop">
      <div className="surface-card p-5 text-center flex flex-col items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-strong)', color: 'var(--accent)' }}
        >
          <ShieldCheck size={24} />
        </div>

        <h2 className="text-lg font-extrabold tracking-tight">Avaliação de Linha de Base</h2>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Bateria objetiva com <strong>{totalCount} exercícios curtos</strong> (1 por domínio) para medir seu estado inicial, tempo de reação e definir as prioridades do protocolo diário.
        </p>

        <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(doneCount / totalCount) * 100}%`, background: 'var(--accent)' }}
          />
        </div>
        <div className="text-[11px] font-semibold tabular" style={{ color: 'var(--accent)' }}>
          {doneCount} de {totalCount} concluídos
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {activeDomains.map((domKey, i) => {
          const dom = DOMAIN_MAP[domKey];
          const game = GAME_MAP[dom.calibrationGame];
          const doneScore = scores.baseline_scores?.[domKey];
          const done = Boolean(doneScore);

          return (
            <button
              key={domKey}
              type="button"
              onClick={() => onStartGame(game.slug, i + 1, totalCount, dom.shortName)}
              className="surface-card surface-card-click p-3 flex items-center gap-2.5 text-left cursor-pointer"
              style={{ borderColor: done ? 'rgba(16, 185, 129, 0.45)' : undefined }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${dom.color}1a`, color: dom.color }}
              >
                <GameIcon slug={game.slug} size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{dom.shortName}</div>
                <div className="text-[10px] font-medium truncate" style={{ color: done ? 'var(--ok)' : 'var(--text-soft)' }}>
                  {done && doneScore ? `Base ${scoreToPercent(doneScore)}%` : game.name}
                </div>
              </div>
              {done && <Check size={14} strokeWidth={2.5} style={{ color: 'var(--ok)' }} />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={launchNext}
        className="w-full py-3.5 rounded-xl font-bold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
      >
        <Play size={15} fill="currentColor" />
        <span>
          {allDone
            ? 'Abrir Dossiê Cognitivo'
            : doneCount === 0
              ? 'Iniciar Avaliação Inicial'
              : `Continuar (${doneCount + 1}/${totalCount})`}
        </span>
      </button>

      {!allDone && (
        <button
          type="button"
          onClick={onSkipCalibration}
          className="mx-auto py-1.5 px-3 text-[11px] font-medium cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-soft)' }}
        >
          Pular por agora (iniciar no Nível 0)
        </button>
      )}
    </div>
  );
}

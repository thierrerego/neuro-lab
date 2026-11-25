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
    <div className="flex flex-col gap-6 py-2 animate-pop">
      <div className="surface-card p-6 text-center flex flex-col items-center gap-3.5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
        >
          <ShieldCheck size={28} />
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight">Avaliação de Linha de Base</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Bateria objetiva com <strong style={{ color: 'var(--text)' }}>{totalCount} exercícios de 30s</strong> (1 por domínio) para medir sua linha de base real e personalizar seu protocolo diário.
        </p>

        <div className="w-full h-2.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(doneCount / totalCount) * 100}%`, background: 'var(--accent-grad)' }}
          />
        </div>
        <div className="text-xs font-bold tabular" style={{ color: 'var(--accent)' }}>
          {doneCount} de {totalCount} concluídos
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
              className="surface-card surface-card-click p-4 flex items-center gap-3 text-left cursor-pointer"
              style={{ borderColor: done ? 'rgba(16, 185, 129, 0.45)' : undefined }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `${dom.color}16`, color: dom.color }}
              >
                <GameIcon slug={game.slug} size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate">{dom.shortName}</div>
                <div
                  className="text-xs font-medium truncate mt-0.5"
                  style={{ color: done ? 'var(--ok)' : 'var(--text-soft)' }}
                >
                  {done && doneScore ? `Base ${scoreToPercent(doneScore)}%` : game.name}
                </div>
              </div>
              {done && <Check size={17} strokeWidth={2.8} style={{ color: 'var(--ok)' }} className="shrink-0" />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={launchNext}
        className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent flex items-center justify-center gap-2.5 cursor-pointer"
      >
        <Play size={18} fill="currentColor" />
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
          className="mx-auto py-2 px-4 text-xs font-semibold cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-soft)' }}
        >
          Pular por agora (iniciar no modo adaptativo)
        </button>
      )}
    </div>
  );
}

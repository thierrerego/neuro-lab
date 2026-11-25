import { Check, Play, ShieldCheck } from 'lucide-react';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import { getCalibrationPlan, getCalibrationProgress, scoreToPercent } from '../engine/psychometricEngine';
import type { CognitiveSessionRecord, DomainKey, DomainScoresRecord, GameSlug } from '../types/cognitive';
import { GameIcon } from '../components/DomainIcon';

interface CalibrationScreenProps {
  selectedDomains: DomainKey[];
  bottlenecks?: string[];
  scores: DomainScoresRecord;
  sessions: CognitiveSessionRecord[];
  calibrationResetAt?: string | null;
  onStartGame: (slug: GameSlug, idx: number, total: number, domainName: string) => void;
  onSkipCalibration: () => void;
  onFinishCalibration: () => void;
}

/**
 * Teste inicial: 2 jogos diferentes por habilidade escolhida no questionário.
 * Dá para sair a qualquer momento e continuar depois de onde parou.
 */
export function CalibrationScreen({
  selectedDomains,
  bottlenecks,
  scores,
  sessions,
  calibrationResetAt,
  onStartGame,
  onSkipCalibration,
  onFinishCalibration,
}: CalibrationScreenProps) {
  const plan = getCalibrationPlan(selectedDomains, bottlenecks);
  const progress = getCalibrationProgress(plan, sessions, calibrationResetAt ?? null);
  const { doneCount, total, next, nextIndex } = progress;
  const allDone = next === null;
  const domainsInPlan = Array.from(new Set(plan.map((s) => s.domain)));

  const launchNext = () => {
    if (!next) {
      onFinishCalibration();
      return;
    }
    onStartGame(next.slug, nextIndex + 1, total, DOMAIN_MAP[next.domain].shortName);
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

        <h2 className="text-2xl font-extrabold tracking-tight">Teste Inicial</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text)' }}>{total} jogos curtos</strong>, 2 para cada habilidade que você escolheu.
          A nota de cada habilidade é a média dos dois. Pode sair quando quiser e continuar depois.
        </p>

        <div className="w-full h-2.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%`, background: 'var(--accent-grad)' }}
          />
        </div>
        <div className="text-xs font-bold tabular" style={{ color: 'var(--accent)' }}>
          {doneCount} de {total} concluídos
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {domainsInPlan.map((domKey) => {
          const dom = DOMAIN_MAP[domKey];
          const steps = plan.filter((s) => s.domain === domKey);
          const domScore = scores[domKey] ?? 0;
          const domDone = steps.every((s) => progress.isDone(s));
          return (
            <div key={domKey} className="surface-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold" style={{ color: dom.color }}>
                  {dom.shortName}
                </div>
                <div className="text-xs font-semibold tabular" style={{ color: domDone ? 'var(--ok)' : 'var(--text-soft)' }}>
                  {domDone && domScore > 0 ? `Base ${scoreToPercent(domScore)}%` : `${steps.filter((s) => progress.isDone(s)).length}/2`}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {steps.map((step) => {
                  const game = GAME_MAP[step.slug];
                  const done = progress.isDone(step);
                  const idx = plan.indexOf(step);
                  return (
                    <button
                      key={step.slug}
                      type="button"
                      onClick={() => onStartGame(step.slug, idx + 1, total, dom.shortName)}
                      className="rounded-2xl p-3 flex items-center gap-2.5 text-left cursor-pointer btn-soft"
                      style={{ borderColor: done ? 'rgba(16, 185, 129, 0.45)' : undefined }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${dom.color}16`, color: dom.color }}
                      >
                        <GameIcon slug={game.slug} size={18} />
                      </div>
                      <div className="min-w-0 flex-1 text-xs font-semibold truncate">{game.name}</div>
                      {done && <Check size={15} strokeWidth={2.8} style={{ color: 'var(--ok)' }} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
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
              ? 'Começar teste inicial'
              : `Continuar (${doneCount + 1}/${total})`}
        </span>
      </button>

      {!allDone && (
        <button
          type="button"
          onClick={onSkipCalibration}
          className="mx-auto py-2 px-4 text-xs font-semibold cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-soft)' }}
        >
          Voltar ao início (continuo depois)
        </button>
      )}
    </div>
  );
}

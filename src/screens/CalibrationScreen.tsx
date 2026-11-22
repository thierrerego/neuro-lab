import { Check, Play, ShieldCheck } from 'lucide-react';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import { getCalibrationDomains } from '../engine/psychometricEngine';
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
      {/* Tela limpa de transição para o Teste de Rastreio */}
      <div className="surface-card p-5 text-center flex flex-col items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-strong)', color: 'var(--accent)' }}
        >
          <ShieldCheck size={28} />
        </div>

        <h2 className="text-xl font-black tracking-tight">Iniciar Teste de Rastreio Cognitivo</h2>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Bateria rápida com <strong>{totalCount} jogos curtos</strong> (1 por área escolhida) para medir seu nível atual, tempo de reação e alertar seus pontos mais fracos.
        </p>

        <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--bg)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(doneCount / totalCount) * 100}%`, background: 'var(--accent-grad)' }}
          />
        </div>
        <div className="text-[11px] font-extrabold tabular" style={{ color: 'var(--accent)' }}>
          {doneCount} de {totalCount} concluídos
        </div>
      </div>

      {/* Lista enxuta das áreas da bateria */}
      <div className="grid grid-cols-2 gap-2">
        {activeDomains.map((domKey, i) => {
          const dom = DOMAIN_MAP[domKey];
          const game = GAME_MAP[dom.calibrationGame];
          const doneScore = scores.baseline_scores?.[domKey];
          const done = Boolean(doneScore);

          return (
            <button
              key={domKey}
              onClick={() => onStartGame(game.slug, i + 1, totalCount, dom.shortName)}
              className="surface-card surface-card-click p-3.5 flex items-center gap-2.5 text-left cursor-pointer"
              style={{ borderColor: done ? 'var(--ok)' : undefined }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${dom.color}20`, color: dom.color }}
              >
                <GameIcon slug={game.slug} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold truncate">{dom.shortName}</div>
                <div className="text-[10px] font-semibold truncate" style={{ color: done ? 'var(--ok)' : 'var(--text-soft)' }}>
                  {done ? `Score ${doneScore}` : game.name}
                </div>
              </div>
              {done && <Check size={14} strokeWidth={3} style={{ color: 'var(--ok)' }} />}
            </button>
          );
        })}
      </div>

      {/* Botão principal em destaque */}
      <button
        onClick={launchNext}
        className="w-full py-4 rounded-2xl font-extrabold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
      >
        <Play size={16} fill="currentColor" />
        <span>
          {allDone
            ? 'Ver Perfil Inicial'
            : doneCount === 0
              ? 'Começar Rastreio Agora'
              : `Continuar (${doneCount + 1}/${totalCount})`}
        </span>
      </button>

      {/* Botão bem sutil para pular (começa nos níveis mais baixos) */}
      {!allDone && (
        <button
          onClick={onSkipCalibration}
          className="mx-auto py-1.5 px-3 text-[11px] font-semibold cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-soft)' }}
        >
          Pular rastreio (começar do nível mais baixo)
        </button>
      )}
    </div>
  );
}

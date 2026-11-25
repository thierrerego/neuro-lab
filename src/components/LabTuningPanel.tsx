import { Minus, Plus, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { GameSlug } from '../types/cognitive';
import { getStageConfig } from '../engine/stageEngine';
import {
  getDefaultLabTuning,
  isLabTuningModified,
  MAX_PLATEAU_ATTEMPTS,
  type LabLevelTuning,
  type PlateauAttempt,
} from '../lib/labTuning';
import { sound } from '../lib/audio';

interface LabTuningPanelProps {
  slug: GameSlug;
  stage: number;
  tuning: LabLevelTuning;
  onChange: (next: LabLevelTuning) => void;
  onReset: () => void;
  plateauAttempts?: PlateauAttempt[];
  onResetPlateauAttempts?: () => void;
  compact?: boolean;
}

export function LabTuningPanel({
  slug,
  stage,
  tuning,
  onChange,
  onReset,
  plateauAttempts,
  onResetPlateauAttempts,
  compact = false,
}: LabTuningPanelProps) {
  const defaults = getDefaultLabTuning(slug, stage);
  const modified = isLabTuningModified(slug, stage, tuning);

  const previewCfg = getStageConfig(slug, tuning.effectiveLevel, false);
  const previewStimulusMs = Math.max(
    250,
    Math.min(4500, Math.round(previewCfg.stimulusMs / tuning.speedScale))
  );

  const update = (patch: Partial<LabLevelTuning>) => {
    onChange({ ...tuning, ...patch });
  };

  const stepLevel = (delta: number) => {
    sound.tap();
    const next = Math.max(1, Math.min(30, Math.round((tuning.effectiveLevel + delta) * 2) / 2));
    update({ effectiveLevel: Number(next.toFixed(1)) });
  };

  const stepSpeed = (delta: number) => {
    sound.tap();
    const next = Math.max(0.5, Math.min(1.5, Math.round((tuning.speedScale + delta) * 20) / 20));
    update({ speedScale: Number(next.toFixed(2)) });
  };

  const stepHits = (delta: number) => {
    sound.tap();
    const next = Math.max(2, Math.min(25, Math.round(tuning.targetHits + delta)));
    update({ targetHits: next });
  };

  const anchorLabel =
    stage === 1 ? 'Piso (Nv. 1)' : stage === 13 ? 'Platô (Nv. 13)' : `Nível ${stage}`;
  const isPlateau = stage === 13 && plateauAttempts !== undefined;
  const attemptCount = plateauAttempts?.length ?? 0;
  const lastAttempt = attemptCount > 0 ? plateauAttempts![attemptCount - 1] : null;

  const plateauHint =
    attemptCount === 0
      ? 'Jogue até 3×: as barras ajustam sozinhas pro seu limiar.'
      : attemptCount < MAX_PLATEAU_ATTEMPTS
        ? lastAttempt?.direction === 'up'
          ? `Média (${attemptCount}/${MAX_PLATEAU_ATTEMPTS}): puxou pra cima · faça mais ${MAX_PLATEAU_ATTEMPTS - attemptCount} teste(s).`
          : lastAttempt?.direction === 'down'
            ? `Média (${attemptCount}/${MAX_PLATEAU_ATTEMPTS}): aliviou um pouco · faça mais ${MAX_PLATEAU_ATTEMPTS - attemptCount} teste(s).`
            : `Média (${attemptCount}/${MAX_PLATEAU_ATTEMPTS}): bem no limiar! Faça mais ${MAX_PLATEAU_ATTEMPTS - attemptCount} teste(s).`
        : 'Platô calibrado pela média das últimas 3 tentativas!';

  return (
    <div
      className={`rounded-2xl flex flex-col text-left ${compact ? 'p-3.5 gap-3' : 'p-4 gap-3.5'}`}
      style={{
        background: modified ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-subtle)',
        border: modified
          ? '1.5px solid rgba(139, 92, 246, 0.42)'
          : '1px solid var(--border-strong)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <SlidersHorizontal size={14} style={{ color: '#7C3AED' }} className="shrink-0" />
          <span className="text-xs font-extrabold truncate" style={{ color: '#7C3AED' }}>
            Calibrar {anchorLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {modified ? (
            <button
              type="button"
              onClick={() => {
                sound.tap();
                onReset();
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold btn-soft cursor-pointer inline-flex items-center gap-1"
              title="Voltar ao padrão deste nível"
            >
              <RotateCcw size={11} />
              <span>Padrão</span>
            </button>
          ) : (
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-soft)' }}>
              No padrão
            </span>
          )}
        </div>
      </div>

      {/* Faixa do Auto-Platô (média das últimas 3 tentativas no Nv. 13) */}
      {isPlateau && (
        <div
          className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
          style={{
            background:
              attemptCount >= MAX_PLATEAU_ATTEMPTS
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(139, 92, 246, 0.10)',
            border:
              attemptCount >= MAX_PLATEAU_ATTEMPTS
                ? '1px solid rgba(16, 185, 129, 0.32)'
                : '1px solid rgba(139, 92, 246, 0.25)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles
                size={13}
                style={{
                  color: attemptCount >= MAX_PLATEAU_ATTEMPTS ? 'var(--ok)' : '#7C3AED',
                }}
                className="shrink-0"
              />
              <span
                className="text-[11px] font-extrabold"
                style={{
                  color: attemptCount >= MAX_PLATEAU_ATTEMPTS ? 'var(--ok)' : '#7C3AED',
                }}
              >
                Auto-Platô · {attemptCount}/{MAX_PLATEAU_ATTEMPTS}
              </span>
              <div className="flex items-center gap-1 ml-0.5">
                {Array.from({ length: MAX_PLATEAU_ATTEMPTS }, (_, i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background:
                        i < attemptCount
                          ? attemptCount >= MAX_PLATEAU_ATTEMPTS
                            ? 'var(--ok)'
                            : '#7C3AED'
                          : 'var(--border-strong)',
                    }}
                  />
                ))}
              </div>
            </div>

            {attemptCount > 0 && onResetPlateauAttempts && (
              <button
                type="button"
                onClick={() => {
                  sound.tap();
                  onResetPlateauAttempts();
                }}
                className="px-2 py-1 rounded-lg text-[11px] font-bold btn-soft cursor-pointer inline-flex items-center gap-1 shrink-0"
              >
                <RotateCcw size={10} />
                <span>Zerar tentativas</span>
              </button>
            )}
          </div>
          <div className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            {plateauHint}
          </div>
        </div>
      )}

      {/* 1. Dificuldade real (1..20, passo 0.5) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
            1. Dificuldade real
          </span>
          <span className="font-extrabold tabular" style={{ color: 'var(--text)' }}>
            Nv. {tuning.effectiveLevel.toFixed(1).replace(/\.0$/, '')}
            {Math.abs(tuning.effectiveLevel - defaults.effectiveLevel) > 0.001 && (
              <span className="font-normal ml-1" style={{ color: 'var(--text-soft)' }}>
                (padrão {defaults.effectiveLevel})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepLevel(-0.5)}
            className="w-8 h-8 rounded-xl btn-soft flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Diminuir dificuldade"
          >
            <Minus size={14} />
          </button>
          <input
            type="range"
            min={1}
            max={30}
            step={0.5}
            value={tuning.effectiveLevel}
            onChange={(e) => update({ effectiveLevel: Number(e.target.value) })}
            style={{ accentColor: '#7C3AED' }}
            className="w-full cursor-pointer"
          />
          <button
            type="button"
            onClick={() => stepLevel(0.5)}
            className="w-8 h-8 rounded-xl btn-soft flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Aumentar dificuldade"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* 2. Velocidade do estímulo (0.5x..1.5x) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
            2. Velocidade
          </span>
          <span className="font-extrabold tabular" style={{ color: 'var(--text)' }}>
            {tuning.speedScale.toFixed(2)}×{' '}
            <span className="font-normal" style={{ color: 'var(--text-soft)' }}>
              ({previewStimulusMs}ms)
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepSpeed(-0.05)}
            className="w-8 h-8 rounded-xl btn-soft flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Deixar mais lento"
          >
            <Minus size={14} />
          </button>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={tuning.speedScale}
            onChange={(e) => update({ speedScale: Number(e.target.value) })}
            style={{ accentColor: '#7C3AED' }}
            className="w-full cursor-pointer"
          />
          <button
            type="button"
            onClick={() => stepSpeed(0.05)}
            className="w-8 h-8 rounded-xl btn-soft flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Deixar mais rápido"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] px-10" style={{ color: 'var(--text-soft)' }}>
          <span>Mais lento</span>
          <span>Padrão (1×)</span>
          <span>Mais rápido</span>
        </div>
      </div>

      {/* 3. Meta de acertos em 30s (2..25) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
            3. Meta de acertos (30s)
          </span>
          <span className="font-extrabold tabular" style={{ color: 'var(--text)' }}>
            {tuning.targetHits}
            {tuning.targetHits !== defaults.targetHits && (
              <span className="font-normal ml-1" style={{ color: 'var(--text-soft)' }}>
                (padrão {defaults.targetHits})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepHits(-1)}
            className="w-8 h-8 rounded-xl btn-soft flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Diminuir meta de acertos"
          >
            <Minus size={14} />
          </button>
          <input
            type="range"
            min={2}
            max={25}
            step={1}
            value={tuning.targetHits}
            onChange={(e) => update({ targetHits: Number(e.target.value) })}
            style={{ accentColor: '#7C3AED' }}
            className="w-full cursor-pointer"
          />
          <button
            type="button"
            onClick={() => stepHits(1)}
            className="w-8 h-8 rounded-xl btn-soft flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Aumentar meta de acertos"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type ArrowDir = 'left' | 'right' | 'up' | 'down';

interface FlankerTrial {
  center: ArrowDir;
  flankers: ArrowDir;
  congruent: boolean;
  fourWay: boolean;
}

function getConflictRate(stage: number): number {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 1) return 0.2;
  if (lvl <= 3) return 0.45;
  if (lvl <= 6) return 0.65;
  if (lvl <= 10) return 0.78;
  if (lvl <= 15) return 0.85;
  return 0.92;
}

function makeTrial(stage: number, prevCenter?: ArrowDir): FlankerTrial {
  const lvl = Math.max(1, Math.floor(stage));
  const fourWay = lvl >= 11;
  const dirs: ArrowDir[] = fourWay ? ['left', 'right', 'up', 'down'] : ['left', 'right'];
  const conflictRate = getConflictRate(lvl);

  let center: ArrowDir = dirs[Math.floor(Math.random() * dirs.length)];
  if (prevCenter && center === prevCenter && Math.random() < 0.5) {
    const others = dirs.filter((d) => d !== prevCenter);
    center = others[Math.floor(Math.random() * others.length)];
  }
  const congruent = Math.random() >= conflictRate;
  const otherDirs = dirs.filter((d) => d !== center);
  const flankers: ArrowDir = congruent
    ? center
    : otherDirs[Math.floor(Math.random() * otherDirs.length)];
  return { center, flankers, congruent, fourWay };
}

function ArrowGlyph({ dir, size = 34 }: { dir: ArrowDir; size?: number }) {
  const rot =
    dir === 'left' ? 'rotate(180deg)' : dir === 'up' ? 'rotate(-90deg)' : dir === 'down' ? 'rotate(90deg)' : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      style={{ transform: rot }}
    >
      <path
        d="M5 14H22M22 14L15 7M22 14L15 21"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlankerFocusGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [trial, setTrial] = useState<FlankerTrial>(() => makeTrial(config.stage));
  const [trialId, setTrialId] = useState(0);
  const [flash, setFlash] = useState<{ dir: ArrowDir; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const flashRef = useRef(flash);
  flashRef.current = flash;
  const trialRef = useRef(trial);
  trialRef.current = trial;

  const pauseStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
    finished: false,
  });

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const finishNow = () => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    clearTimer();
    onFinish({
      correct: statsRef.current.correct,
      commissionErrors: statsRef.current.commission,
      omissionErrors: 0,
      reactionTimesMs: statsRef.current.rts,
      rawPoints: statsRef.current.rawPoints,
    });
  };

  useEffect(() => {
    if (finishRequested) finishNow();
  }, [finishRequested]);

  useEffect(() => {
    if (paused) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
    } else if (pauseStartedAtRef.current !== null) {
      statsRef.current.shownAt += performance.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handlePick = (dir: ArrowDir) => {
    if (flashRef.current || pausedRef.current || statsRef.current.finished) return;
    const rt = Math.max(80, performance.now() - statsRef.current.shownAt);
    const currentTrial = trialRef.current;
    const ok = dir === currentTrial.center;
    let clearedAll = false;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(85, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      clearedAll = onWaveHit();
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 50);
      sound.miss();
      onWaveError?.();
    }

    const total = statsRef.current.correct + statsRef.current.commission;
    onLiveUpdate({
      score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: Math.round((statsRef.current.correct / total) * 100),
      combo: statsRef.current.combo,
    });

    if (clearedAll) {
      finishNow();
      return;
    }

    setFlash({ dir, ok });
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setFlash(null);
      setTrial(makeTrial(configRef.current.stage, currentTrial.center));
      setTrialId((n) => n + 1);
      statsRef.current.shownAt = performance.now();
    }, ok ? 130 : 185);
  };

  const handlePickRef = useRef(handlePick);
  handlePickRef.current = handlePick;

  // Suporte às setas do teclado (4 direções a partir do Nível 11)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current || statsRef.current.finished) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handlePickRef.current('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handlePickRef.current('right');
      } else if (trialRef.current.fourWay && (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        handlePickRef.current('up');
      } else if (trialRef.current.fourWay && (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handlePickRef.current('down');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const lvl = Math.max(1, Math.floor(config.stage));
  const useGrid3x3 = trial.fourWay; // Nível 11..20: matriz 3x3 cercando o centro com 4 direções
  const lineCount = lvl >= 6 ? 7 : 5;
  const centerIdx = Math.floor(lineCount / 2);
  const arrows: ArrowDir[] = useGrid3x3
    ? Array.from({ length: 9 }, (_, i) => (i === 4 ? trial.center : trial.flankers))
    : Array.from({ length: lineCount }, (_, i) => (i === centerIdx ? trial.center : trial.flankers));

  // Destaque sutil na seta central no Nível 1..2 (some nos níveis mais altos)
  const strongCenterCue = lvl <= 1;
  const subtleCenterCue = lvl === 2;
  const hideDotCue = lvl >= 15;

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: 'var(--bg-subtle)',
          color: 'var(--accent)',
          border: '1px solid var(--border)',
        }}
      >
        {useGrid3x3 ? 'Siga só a seta do centro (4 direções)' : 'Olhe a seta do meio'}
      </div>

      {/* Card com setas (5 -> 7 em linha, ou matriz 3x3 nos níveis 11..20) */}
      <div
        key={trialId}
        className={`w-full max-w-[356px] ${useGrid3x3 ? 'py-6' : 'py-10'} px-4 rounded-3xl flex flex-col items-center justify-center gap-2 animate-pop ${
          flash && !flash.ok ? 'animate-shake' : ''
        }`}
        style={{
          background: 'var(--bg-card)',
          border: flash
            ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
            : '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {useGrid3x3 ? (
          <div className="grid grid-cols-3 gap-2">
            {arrows.map((dir, idx) => {
              const isCenter = idx === 4;
              return (
                <div
                  key={idx}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: isCenter && !hideDotCue ? 'var(--bg-subtle)' : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  <ArrowGlyph dir={dir} size={30} />
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`flex items-center justify-center ${
              lineCount >= 7 ? 'gap-0.5' : lvl >= 4 ? 'gap-1.5' : 'gap-2.5'
            }`}
          >
            {arrows.map((dir, idx) => {
              const isCenter = idx === centerIdx;
              return (
                <div
                  key={idx}
                  className={`${lineCount >= 7 ? 'w-10 h-10' : 'w-12 h-12'} rounded-2xl flex items-center justify-center transition-transform`}
                  style={{
                    background: isCenter && strongCenterCue ? 'var(--accent-glow)' : 'transparent',
                    border:
                      isCenter && strongCenterCue
                        ? '1.5px solid var(--border-strong)'
                        : '1.5px solid transparent',
                    color: isCenter
                      ? strongCenterCue || subtleCenterCue
                        ? 'var(--accent)'
                        : 'var(--text)'
                      : 'var(--text)',
                    opacity: isCenter ? 1 : strongCenterCue ? 0.62 : subtleCenterCue ? 0.8 : 0.95,
                    transform: isCenter && strongCenterCue ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  <ArrowGlyph dir={dir} size={lineCount >= 7 ? 28 : 34} />
                </div>
              );
            })}
          </div>
        )}

        {/* Marcador discreto alinhado sob a seta central (some nos níveis 15+) */}
        {!hideDotCue && !useGrid3x3 && (
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: strongCenterCue || subtleCenterCue ? 'var(--accent)' : 'var(--text-soft)',
              opacity: strongCenterCue ? 0.95 : 0.45,
            }}
          />
        )}
      </div>

      {/* Botões de resposta (2 direções até Nv.10, 4 direções no Nv.11..20) */}
      {useGrid3x3 ? (
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[270px]">
          <div />
          {(['up'] as const).map((dir) => {
            const isFb = flash?.dir === dir;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => handlePick(dir)}
                className={`h-14 rounded-2xl font-extrabold flex items-center justify-center cursor-pointer surface-card-click ${
                  isFb && !flash.ok ? 'animate-shake' : ''
                }`}
                style={{
                  background: isFb ? (flash.ok ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)') : 'var(--bg-card)',
                  border: isFb ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}` : '1px solid var(--border)',
                  color: isFb ? (flash.ok ? 'var(--ok)' : 'var(--err)') : 'var(--text)',
                }}
              >
                <ArrowGlyph dir="up" size={24} />
              </button>
            );
          })}
          <div />
          {(['left', 'down', 'right'] as const).map((dir) => {
            const isFb = flash?.dir === dir;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => handlePick(dir)}
                className={`h-14 rounded-2xl font-extrabold flex items-center justify-center cursor-pointer surface-card-click ${
                  isFb && !flash.ok ? 'animate-shake' : ''
                }`}
                style={{
                  background: isFb ? (flash.ok ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)') : 'var(--bg-card)',
                  border: isFb ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}` : '1px solid var(--border)',
                  color: isFb ? (flash.ok ? 'var(--ok)' : 'var(--err)') : 'var(--text)',
                }}
              >
                <ArrowGlyph dir={dir} size={24} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 w-full max-w-[356px]">
          {(
            [
              { dir: 'left' as const, label: 'Esquerda' },
              { dir: 'right' as const, label: 'Direita' },
            ] as const
          ).map(({ dir, label }) => {
            const isFb = flash?.dir === dir;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => handlePick(dir)}
                className={`min-h-[64px] py-4 px-4 rounded-2xl font-extrabold text-base tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 surface-card-click ${
                  isFb && !flash.ok ? 'animate-shake' : ''
                }`}
                style={{
                  background: isFb
                    ? flash.ok
                      ? 'rgba(16, 185, 129, 0.22)'
                      : 'rgba(239, 68, 68, 0.22)'
                    : 'var(--bg-card)',
                  border: isFb
                    ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                    : '1px solid var(--border)',
                  color: isFb ? (flash.ok ? 'var(--ok)' : 'var(--err)') : 'var(--text)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                {dir === 'left' && <ArrowGlyph dir="left" size={22} />}
                <span>{label}</span>
                {dir === 'right' && <ArrowGlyph dir="right" size={22} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

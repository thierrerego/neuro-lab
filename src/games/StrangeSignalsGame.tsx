import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

function getSpec(stage: number): { size: number; seqLen: number; stepMs: number } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return { size: 3, seqLen: 3, stepMs: 560 };
  if (lvl <= 5) return { size: 3, seqLen: 4, stepMs: 500 };
  if (lvl <= 9) return { size: 4, seqLen: 5, stepMs: 460 };
  if (lvl <= 14) return { size: 4, seqLen: 6, stepMs: 420 };
  return { size: 5, seqLen: 7, stepMs: 390 };
}

function makeSignalSequence(cells: number, len: number): number[] {
  const pool = Array.from({ length: cells }, (_, i) => i);
  const seq: number[] = [];
  for (let i = 0; i < len && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    seq.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return seq;
}

export function StrangeSignalsGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const initSpec = getSpec(config.stage);
  const [size, setSize] = useState(initSpec.size);
  const [sequence, setSequence] = useState<number[]>(() =>
    makeSignalSequence(initSpec.size * initSpec.size, initSpec.seqLen)
  );
  const [phase, setPhase] = useState<'transmit' | 'input'>('transmit');
  const [litCell, setLitCell] = useState<number | null>(null);
  const [inputStep, setInputStep] = useState(0);
  const [flashCell, setFlashCell] = useState<{ id: number; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    stepStart: performance.now(),
    finished: false,
  });

  const finishNow = () => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
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
    if (phase !== 'transmit' || paused) return;
    const { stepMs } = getSpec(configRef.current.stage);
    const timers: number[] = [];

    sequence.forEach((cellId, idx) => {
      timers.push(
        window.setTimeout(() => {
          setLitCell(cellId);
          sound.tap();
        }, 280 + idx * (stepMs + 140))
      );
      timers.push(
        window.setTimeout(() => {
          setLitCell(null);
        }, 280 + idx * (stepMs + 140) + stepMs)
      );
    });

    timers.push(
      window.setTimeout(() => {
        setLitCell(null);
        setInputStep(0);
        statsRef.current.stepStart = performance.now();
        setPhase('input');
      }, 280 + sequence.length * (stepMs + 140) + 100)
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, sequence, paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const spawnNext = () => {
    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      const spec = getSpec(configRef.current.stage);
      setSize(spec.size);
      setSequence(makeSignalSequence(spec.size * spec.size, spec.seqLen));
      setPhase('transmit');
    }, 360);
  };

  const handleTap = (cellId: number) => {
    if (paused || phase !== 'input' || statsRef.current.finished) return;
    const now = performance.now();
    const rt = Math.max(100, now - statsRef.current.stepStart);
    statsRef.current.stepStart = now;

    if (cellId === sequence[inputStep]) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(80, statsRef.current.combo * 15);
      sound.hit(statsRef.current.combo);
      setFlashCell({ id: cellId, ok: true });
      window.setTimeout(() => setFlashCell(null), 200);
      emitLive();

      if (inputStep + 1 >= sequence.length) {
        const clearedAll = onWaveHit();
        if (clearedAll) {
          window.setTimeout(() => finishNow(), 180);
          return;
        }
        spawnNext();
      } else {
        setInputStep(inputStep + 1);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      setFlashCell({ id: cellId, ok: false });
      window.setTimeout(() => setFlashCell(null), 280);
      emitLive();
      onWaveError?.();
      spawnNext();
    }
  };

  const maxW = size <= 3 ? 'max-w-[285px]' : size === 4 ? 'max-w-[325px]' : 'max-w-[350px]';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: phase === 'transmit' ? 'rgba(14, 165, 233, 0.14)' : 'var(--bg-subtle)',
          color: phase === 'transmit' ? '#0EA5E9' : 'var(--accent)',
          border: '1px solid var(--border)',
        }}
      >
        {phase === 'transmit' ? 'Recebendo sinais 📡' : `Repita o sinal (${inputStep}/${sequence.length})`}
      </div>

      <div
        className={`grid gap-2.5 w-full ${maxW}`}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: size * size }, (_, id) => {
          const isLit = litCell === id;
          const isFlash = flashCell?.id === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTap(id)}
              disabled={phase !== 'input'}
              className="aspect-square rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none"
              style={{
                background: isLit
                  ? 'linear-gradient(135deg, #0EA5E9, #6366F1)'
                  : isFlash
                    ? flashCell.ok
                      ? 'rgba(16, 185, 129, 0.35)'
                      : 'rgba(239, 68, 68, 0.38)'
                    : 'var(--bg-card)',
                border: isLit
                  ? '2px solid #FFFFFF'
                  : isFlash
                    ? `2px solid ${flashCell.ok ? 'var(--ok)' : 'var(--err)'}`
                    : '1.5px solid var(--border)',
                boxShadow: isLit ? '0 0 22px rgba(14, 165, 233, 0.5)' : 'none',
                transform: isLit ? 'scale(0.95)' : 'scale(1)',
                fontSize: size >= 5 ? '1.25rem' : '1.5rem',
              }}
            >
              {isLit ? '📡' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

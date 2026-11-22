import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

function makeSequence(cells: number, length: number): number[] {
  const pool = Array.from({ length: cells }, (_, i) => i);
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    seq.push(pool[idx]);
    pool.splice(idx, 1);
    if (pool.length === 0) break;
  }
  return seq;
}

export function SpatialSpanGame({ config, wave, finishRequested, onWaveHit, onLiveUpdate, onFinish }: MinigameProps) {
  const getGrid = (g: number) => Math.min(4, Math.max(3, g));
  const [grid, setGrid] = useState(() => getGrid(config.gridSize));
  const [reverseRound, setReverseRound] = useState(() => config.reverseOrder);
  const [sequence, setSequence] = useState<number[]>(() =>
    makeSequence(getGrid(config.gridSize) ** 2, Math.max(2, wave.waveQuota))
  );
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [litCell, setLitCell] = useState<number | null>(null);
  const [inputStep, setInputStep] = useState(0);
  const [flashCell, setFlashCell] = useState<{ id: number; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const waveRef = useRef(wave);
  waveRef.current = wave;

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
    if (phase !== 'show') return;
    const stepMs = Math.max(360, Math.round(configRef.current.stimulusMs * 0.44));
    const timers: number[] = [];

    sequence.forEach((cellId, idx) => {
      timers.push(
        window.setTimeout(() => {
          setLitCell(cellId);
          sound.tap();
        }, 280 + idx * (stepMs + 130))
      );
      timers.push(
        window.setTimeout(() => {
          setLitCell(null);
        }, 280 + idx * (stepMs + 130) + stepMs)
      );
    });

    timers.push(
      window.setTimeout(() => {
        setLitCell(null);
        setInputStep(0);
        statsRef.current.stepStart = performance.now();
        setPhase('input');
      }, 280 + sequence.length * (stepMs + 130) + 100)
    );

    return () => timers.forEach((t) => clearTimeout(t));
  }, [phase, sequence]);

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const spawnNextRound = () => {
    setTimeout(() => {
      if (statsRef.current.finished) return;
      const nextGrid = getGrid(configRef.current.gridSize);
      const nextLen = Math.min(6, Math.max(2, waveRef.current.waveQuota));
      setGrid(nextGrid);
      setReverseRound(configRef.current.reverseOrder);
      setSequence(makeSequence(nextGrid * nextGrid, nextLen));
      setPhase('show');
    }, 340);
  };

  const expectedOrder = reverseRound ? [...sequence].reverse() : sequence;

  const handleTap = (cellId: number) => {
    if (phase !== 'input' || statsRef.current.finished) return;
    const now = performance.now();
    const rt = now - statsRef.current.stepStart;
    statsRef.current.stepStart = now;

    if (cellId === expectedOrder[inputStep]) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 120 + statsRef.current.combo * 15;
      sound.hit(statsRef.current.combo);
      setFlashCell({ id: cellId, ok: true });
      setTimeout(() => setFlashCell(null), 200);

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        setTimeout(() => finishNow(), 180);
        return;
      }

      if (inputStep + 1 >= expectedOrder.length) {
        spawnNextRound();
      } else {
        setInputStep(inputStep + 1);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      setFlashCell({ id: cellId, ok: false });
      setTimeout(() => setFlashCell(null), 260);
      emitLive();
      spawnNextRound();
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: reverseRound ? 'var(--warn)' : 'var(--accent)' }}>
        {phase === 'show' ? 'Observe' : reverseRound ? 'Ordem INVERSA ↺' : 'Repita a ordem'}
      </div>

      <div
        className="grid gap-2.5 w-full max-w-[295px]"
        style={{ gridTemplateColumns: `repeat(${grid}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: grid * grid }, (_, id) => {
          const isLit = litCell === id;
          const isFlash = flashCell?.id === id;
          return (
            <button
              key={id}
              onClick={() => handleTap(id)}
              disabled={phase !== 'input'}
              className="aspect-square rounded-2xl transition-all duration-150 cursor-pointer"
              style={{
                background: isLit
                  ? 'var(--accent-grad)'
                  : isFlash
                    ? flashCell.ok
                      ? 'rgba(52, 211, 153, 0.4)'
                      : 'rgba(251, 113, 133, 0.45)'
                    : 'var(--bg-card)',
                border: isLit
                  ? '2px solid #fff'
                  : isFlash
                    ? `2px solid ${flashCell.ok ? 'var(--ok)' : 'var(--err)'}`
                    : '1px solid var(--border)',
                transform: isLit ? 'scale(0.95)' : 'scale(1)',
                boxShadow: isLit ? '0 0 22px var(--accent-glow)' : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

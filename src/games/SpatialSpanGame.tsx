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

export function SpatialSpanGame({ config, finishRequested, onLiveUpdate, onFinish }: MinigameProps) {
  const grid = Math.min(4, Math.max(3, config.gridSize));
  const totalCells = grid * grid;
  const baseLen = Math.min(7, 2 + Math.ceil(config.stage / 2));

  const [round, setRound] = useState(1);
  const [seqLen, setSeqLen] = useState(baseLen);
  const [sequence, setSequence] = useState<number[]>(() => makeSequence(totalCells, baseLen));
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [litCell, setLitCell] = useState<number | null>(null);
  const [inputStep, setInputStep] = useState(0);
  const [flashCell, setFlashCell] = useState<{ id: number; ok: boolean } | null>(null);

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

  // Exibe a sequência bloco por bloco
  useEffect(() => {
    if (phase !== 'show') return;
    const stepMs = Math.max(420, Math.round(config.stimulusMs * 0.52));
    const timers: number[] = [];

    sequence.forEach((cellId, idx) => {
      timers.push(
        window.setTimeout(() => {
          setLitCell(cellId);
          sound.tap();
        }, 350 + idx * (stepMs + 160))
      );
      timers.push(
        window.setTimeout(() => {
          setLitCell(null);
        }, 350 + idx * (stepMs + 160) + stepMs)
      );
    });

    timers.push(
      window.setTimeout(() => {
        setLitCell(null);
        setInputStep(0);
        statsRef.current.stepStart = performance.now();
        setPhase('input');
      }, 350 + sequence.length * (stepMs + 160) + 120)
    );

    return () => timers.forEach((t) => clearTimeout(t));
  }, [phase, sequence, config.stimulusMs]);

  const emitLive = (r: number) => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * config.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
      statusTag: `${r}/${config.roundsTarget}`,
    });
  };

  const advanceRound = (grow: boolean) => {
    if (round >= config.roundsTarget) {
      setTimeout(() => finishNow(), 340);
      return;
    }
    const nextLen = grow ? Math.min(8, seqLen + 1) : seqLen;
    setTimeout(() => {
      setRound((r) => r + 1);
      setSeqLen(nextLen);
      setSequence(makeSequence(totalCells, nextLen));
      setPhase('show');
    }, 450);
  };

  const expectedOrder = config.reverseOrder ? [...sequence].reverse() : sequence;

  const handleTap = (cellId: number) => {
    if (phase !== 'input' || statsRef.current.finished) return;
    const now = performance.now();
    const rt = now - statsRef.current.stepStart;
    statsRef.current.stepStart = now;

    const expected = expectedOrder[inputStep];
    if (cellId === expected) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 120 + statsRef.current.combo * 15;
      sound.hit(statsRef.current.combo);
      setFlashCell({ id: cellId, ok: true });
      setTimeout(() => setFlashCell(null), 220);

      if (inputStep + 1 >= expectedOrder.length) {
        statsRef.current.rawPoints += 100;
        emitLive(round);
        advanceRound(true);
      } else {
        setInputStep(inputStep + 1);
        emitLive(round);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      setFlashCell({ id: cellId, ok: false });
      setTimeout(() => setFlashCell(null), 280);
      emitLive(round);
      advanceRound(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: config.reverseOrder ? 'var(--warn)' : 'var(--accent)' }}>
        <span>{phase === 'show' ? 'Observe' : config.reverseOrder ? 'Ordem INVERSA ↺' : 'Sua vez'}</span>
        <span style={{ color: 'var(--text-soft)' }}>· {round}/{config.roundsTarget}</span>
      </div>

      <div
        className="grid gap-2.5 w-full max-w-[300px]"
        style={{ gridTemplateColumns: `repeat(${grid}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalCells }, (_, id) => {
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

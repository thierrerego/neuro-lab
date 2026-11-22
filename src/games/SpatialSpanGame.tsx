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

function getGrid(gridSize: number, stage: number): number {
  if (stage < 2) return 3;
  return Math.min(4, Math.max(3, gridSize));
}

function getSequenceLength(stage: number, roundsCleared: number): number {
  if (stage < 2) {
    // Nível 1 ultrabásico: começa com 2 quadrados e nunca passa de 3
    const startLen = 2;
    return Math.min(3, startLen + (roundsCleared >= 3 ? 1 : 0));
  }
  // Progressão suave nos Níveis 2+
  const lvl = Math.floor(stage);
  const startLen = lvl <= 3 ? 3 : lvl <= 6 ? 4 : 5;
  const maxLen = lvl <= 2 ? 4 : lvl <= 5 ? 5 : 6;
  return Math.min(maxLen, startLen + (roundsCleared >= 2 ? 1 : 0));
}

export function SpatialSpanGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [grid, setGrid] = useState(() => getGrid(config.gridSize, config.stage));
  const [reverseRound, setReverseRound] = useState(() => (config.stage < 2 ? false : config.reverseOrder));
  const [sequence, setSequence] = useState<number[]>(() =>
    makeSequence(getGrid(config.gridSize, config.stage) ** 2, getSequenceLength(config.stage, 0))
  );
  const [phase, setPhase] = useState<'show' | 'input'>('show');
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
    roundsCleared: 0,
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
    if (phase !== 'show' || paused) return;
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
  }, [phase, sequence, paused]);

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
      const nextGrid = getGrid(configRef.current.gridSize, configRef.current.stage);
      const nextLen = getSequenceLength(configRef.current.stage, statsRef.current.roundsCleared);
      setGrid(nextGrid);
      setReverseRound(configRef.current.stage < 2 ? false : configRef.current.reverseOrder);
      setSequence(makeSequence(nextGrid * nextGrid, nextLen));
      setPhase('show');
    }, 340);
  };

  const expectedOrder = reverseRound ? [...sequence].reverse() : sequence;

  const handleTap = (cellId: number) => {
    if (phase !== 'input' || paused || statsRef.current.finished) return;
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

      emitLive();

      // Progresso só avança quando completa a etapa (sequência inteira), não a cada clique!
      if (inputStep + 1 >= expectedOrder.length) {
        statsRef.current.roundsCleared++;
        const clearedAll = onWaveHit();
        if (clearedAll) {
          setTimeout(() => finishNow(), 180);
          return;
        }
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
      onWaveError?.();
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

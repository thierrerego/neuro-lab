import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface CodeBoard {
  size: number;
  cellValues: Map<number, number>;
  orderedCells: number[];
  previewMs: number;
}

function getSpec(stage: number): { size: number; count: number; previewMs: number } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return { size: 3, count: 3, previewMs: 1800 };
  if (lvl <= 5) return { size: 3, count: 4, previewMs: 2100 };
  if (lvl <= 9) return { size: 4, count: 5, previewMs: 2300 };
  if (lvl <= 14) return { size: 4, count: 6, previewMs: 2500 };
  if (lvl <= 20) return { size: 5, count: 7, previewMs: 2700 };
  // Fases 21–30: sequências mais longas com menos tempo para memorizar
  if (lvl <= 25) return { size: 5, count: 8, previewMs: 2500 };
  return { size: 5, count: 9, previewMs: 2300 };
}

function createCodeBoard(stage: number): CodeBoard {
  const { size, count, previewMs } = getSpec(stage);
  const cells = Array.from({ length: size * size }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const chosenCells = cells.slice(0, count);

  const nums = new Set<number>();
  while (nums.size < count) {
    nums.add(Math.floor(1 + Math.random() * 49));
  }
  const numList = Array.from(nums);

  const cellValues = new Map<number, number>();
  chosenCells.forEach((cell, i) => cellValues.set(cell, numList[i]));

  const orderedCells = [...chosenCells].sort(
    (a, b) => (cellValues.get(a) ?? 0) - (cellValues.get(b) ?? 0)
  );

  return { size, cellValues, orderedCells, previewMs };
}

export function SecretCodeGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [board, setBoard] = useState<CodeBoard>(() => createCodeBoard(config.stage));
  const [phase, setPhase] = useState<'memorize' | 'play' | 'feedback'>('memorize');
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [wrongCell, setWrongCell] = useState<number | null>(null);

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
    if (phase !== 'memorize' || paused) return;
    const id = window.setTimeout(() => {
      if (statsRef.current.finished) return;
      statsRef.current.stepStart = performance.now();
      setPhase('play');
    }, board.previewMs);
    return () => window.clearTimeout(id);
  }, [phase, board, paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const spawnNext = (delayMs: number) => {
    setPhase('feedback');
    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setBoard(createCodeBoard(configRef.current.stage));
      setStep(0);
      setRevealed([]);
      setWrongCell(null);
      setPhase('memorize');
    }, delayMs);
  };

  const handleTap = (idx: number) => {
    if (paused || phase !== 'play' || statsRef.current.finished) return;
    if (!board.cellValues.has(idx) || revealed.includes(idx)) return;

    const now = performance.now();
    const rt = Math.max(100, now - statsRef.current.stepStart);
    statsRef.current.stepStart = now;

    if (idx === board.orderedCells[step]) {
      const nextRevealed = [...revealed, idx];
      setRevealed(nextRevealed);
      setStep(step + 1);
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(80, statsRef.current.combo * 15);
      sound.hit(statsRef.current.combo);
      emitLive();

      if (step + 1 >= board.orderedCells.length) {
        const clearedAll = onWaveHit();
        if (clearedAll) {
          window.setTimeout(() => finishNow(), 200);
          return;
        }
        spawnNext(420);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      setWrongCell(idx);
      emitLive();
      onWaveError?.();
      spawnNext(700);
    }
  };

  const maxW = board.size <= 3 ? 'max-w-[285px]' : board.size === 4 ? 'max-w-[325px]' : 'max-w-[350px]';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: phase === 'memorize' ? 'var(--accent-glow)' : 'var(--bg-subtle)',
          color: phase === 'memorize' ? 'var(--accent)' : 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
      >
        {phase === 'memorize' ? 'Memorize as posições' : 'Toque na ordem CRESCENTE'}
      </div>

      <div
        className={`grid gap-2.5 w-full ${maxW}`}
        style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: board.size * board.size }, (_, idx) => {
          const val = board.cellValues.get(idx);
          const hasNum = val !== undefined;
          const isFound = revealed.includes(idx);
          const isWrong = wrongCell === idx;
          const showNum = hasNum && (phase === 'memorize' || isFound || wrongCell !== null);

          if (!hasNum) {
            return (
              <div
                key={idx}
                className="aspect-square rounded-2xl"
                style={{ background: 'var(--bg-subtle)', opacity: 0.35 }}
              />
            );
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleTap(idx)}
              disabled={phase !== 'play' || isFound}
              className={`aspect-square rounded-2xl flex items-center justify-center font-extrabold tabular transition-all duration-150 cursor-pointer ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                fontSize: board.size >= 5 ? '1.15rem' : '1.45rem',
                background: isWrong
                  ? 'rgba(239, 68, 68, 0.22)'
                  : isFound
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'var(--bg-card)',
                border: isWrong
                  ? '2px solid var(--err)'
                  : isFound
                    ? '2px solid var(--ok)'
                    : '2px solid var(--border-strong)',
                color: isWrong ? 'var(--err)' : isFound ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {showNum ? val : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

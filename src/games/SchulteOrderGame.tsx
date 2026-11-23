import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface SchulteBoard {
  cols: number;
  total: number;
  numbers: number[];
}

function getLayoutForStage(stage: number): { cols: number; total: number } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 1) return { cols: 2, total: 4 };
  if (lvl <= 3) return { cols: 3, total: 6 };
  if (lvl <= 6) return { cols: 3, total: 9 };
  return { cols: 4, total: 16 };
}

function buildBoard(stage: number): SchulteBoard {
  const { cols, total } = getLayoutForStage(stage);
  const numbers = Array.from({ length: total }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return { cols, total, numbers };
}

export function SchulteOrderGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [board, setBoard] = useState<SchulteBoard>(() => buildBoard(config.stage));
  const [boardId, setBoardId] = useState(0);
  const [nextNum, setNextNum] = useState(1);
  const [wrongNum, setWrongNum] = useState<number | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const wrongTimerRef = useRef<number | null>(null);
  const prevPausedRef = useRef(paused);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    lastTapAt: performance.now(),
    finished: false,
  });

  const finishNow = useCallback(() => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    onFinish({
      correct: statsRef.current.correct,
      commissionErrors: statsRef.current.commission,
      omissionErrors: 0,
      reactionTimesMs: statsRef.current.rts,
      rawPoints: statsRef.current.rawPoints,
    });
  }, [onFinish]);

  useEffect(() => {
    if (finishRequested) finishNow();
  }, [finishRequested, finishNow]);

  useEffect(() => {
    if (prevPausedRef.current && !paused) {
      // Zera a marca de tempo ao despausar para não inflar o tempo de reação
      statsRef.current.lastTapAt = performance.now();
    }
    prevPausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    return () => {
      if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
    };
  }, []);

  const emitLive = (expected: number) => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    const acc = total > 0 ? Math.round((s.correct / total) * 100) : 100;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: acc,
      combo: s.combo,
      statusTag: `Próximo: ${expected}`,
    });
  };

  const handleTap = (num: number) => {
    if (num < nextNum || paused || statsRef.current.finished) return;
    const now = performance.now();

    if (num === nextNum) {
      const rt = now - statsRef.current.lastTapAt;
      statsRef.current.lastTapAt = now;
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 110 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);

      if (wrongTimerRef.current !== null) {
        window.clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = null;
      }
      setWrongNum(null);

      if (nextNum >= board.total) {
        const clearedAll = onWaveHit();
        if (clearedAll) {
          emitLive(num);
          finishNow();
          return;
        }
        const nextBoard = buildBoard(configRef.current.stage);
        setBoard(nextBoard);
        setBoardId((id) => id + 1);
        setNextNum(1);
        emitLive(1);
      } else {
        const upcoming = nextNum + 1;
        setNextNum(upcoming);
        emitLive(upcoming);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      onWaveError?.();

      setWrongNum(num);
      if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = window.setTimeout(() => {
        setWrongNum(null);
        wrongTimerRef.current = null;
      }, 200);

      emitLive(nextNum);
    }
  };

  const maxGridWidth = board.cols === 2 ? 'max-w-[260px]' : board.cols === 3 ? 'max-w-[310px]' : 'max-w-[340px]';
  const fontSize =
    board.total <= 4 ? 'text-4xl' : board.total <= 6 ? 'text-3xl' : board.total <= 9 ? 'text-2xl' : 'text-xl';

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="flex items-center gap-3 px-5 py-2 rounded-full"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
      >
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Próximo
        </span>
        <span className="text-2xl font-black leading-none tabular" style={{ color: 'var(--accent)' }}>
          {nextNum}
        </span>
        <span className="text-xs font-semibold tabular" style={{ color: 'var(--text-soft)' }}>
          de {board.total}
        </span>
      </div>

      <div
        key={boardId}
        className={`grid gap-2.5 w-full ${maxGridWidth} animate-pop`}
        style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
      >
        {board.numbers.map((num) => {
          const isDone = num < nextNum;
          const isWrong = wrongNum === num;
          return (
            <button
              key={`${boardId}-${num}`}
              type="button"
              onClick={() => handleTap(num)}
              className={`aspect-square rounded-2xl font-black tabular flex items-center justify-center transition-all cursor-pointer active:scale-95 ${fontSize} ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                background: isDone
                  ? 'rgba(16, 185, 129, 0.2)'
                  : isWrong
                    ? 'rgba(239, 68, 68, 0.22)'
                    : 'var(--bg-card)',
                border: isDone
                  ? '2px solid var(--ok)'
                  : isWrong
                    ? '2px solid var(--err)'
                    : '1px solid var(--border-strong)',
                color: isDone ? 'var(--ok)' : isWrong ? 'var(--err)' : 'var(--text)',
                opacity: isDone ? 0.55 : 1,
                boxShadow: isDone ? 'none' : 'var(--card-shadow)',
              }}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}

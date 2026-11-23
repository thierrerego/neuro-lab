import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface GoldBoard {
  size: number;
  goldMap: Map<number, '🪙' | '💎'>;
  previewMs: number;
}

function getSpec(stage: number): { size: number; count: number; previewMs: number } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return { size: 3, count: 3, previewMs: 1600 };
  if (lvl <= 5) return { size: 4, count: 4, previewMs: 1800 };
  if (lvl <= 9) return { size: 4, count: 5, previewMs: 1900 };
  if (lvl <= 14) return { size: 5, count: 6, previewMs: 2100 };
  return { size: 5, count: 7, previewMs: 2200 };
}

function createBoard(stage: number): GoldBoard {
  const { size, count, previewMs } = getSpec(stage);
  const pool = Array.from({ length: size * size }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const goldMap = new Map<number, '🪙' | '💎'>();
  pool.slice(0, count).forEach((cell, idx) => {
    goldMap.set(cell, idx % 3 === 0 ? '💎' : '🪙');
  });
  return { size, goldMap, previewMs };
}

export function HiddenGoldGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [board, setBoard] = useState<GoldBoard>(() => createBoard(config.stage));
  const [phase, setPhase] = useState<'memorize' | 'play' | 'next'>('memorize');
  const [found, setFound] = useState<number[]>([]);
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

  const handleTap = (idx: number) => {
    if (paused || phase !== 'play' || statsRef.current.finished) return;
    if (found.includes(idx)) return;

    const now = performance.now();
    const rt = Math.max(100, now - statsRef.current.stepStart);
    statsRef.current.stepStart = now;

    if (board.goldMap.has(idx)) {
      const nextFound = [...found, idx];
      setFound(nextFound);
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      emitLive();

      if (nextFound.length >= board.goldMap.size) {
        const clearedAll = onWaveHit();
        if (clearedAll) {
          window.setTimeout(() => finishNow(), 200);
          return;
        }
        setPhase('next');
        window.setTimeout(() => {
          if (statsRef.current.finished) return;
          setBoard(createBoard(configRef.current.stage));
          setFound([]);
          setWrongCell(null);
          setPhase('memorize');
        }, 380);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setWrongCell(idx);
      window.setTimeout(() => setWrongCell(null), 320);
      emitLive();
      onWaveError?.();
    }
  };

  const maxW = board.size <= 3 ? 'max-w-[280px]' : board.size === 4 ? 'max-w-[325px]' : 'max-w-[350px]';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex items-center gap-2.5">
        <div
          className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
          style={{
            background: phase === 'memorize' ? 'rgba(245, 158, 11, 0.16)' : 'var(--bg-subtle)',
            color: phase === 'memorize' ? 'var(--warn)' : 'var(--accent)',
            border: '1px solid var(--border)',
          }}
        >
          {phase === 'memorize' ? 'Memorize o ouro 🪙' : 'Onde estava o ouro?'}
        </div>
        <div
          className="text-xs font-extrabold tabular px-3 py-1.5 rounded-full"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
        >
          {found.length}/{board.goldMap.size}
        </div>
      </div>

      <div
        className={`grid gap-2.5 w-full ${maxW}`}
        style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: board.size * board.size }, (_, idx) => {
          const emoji = board.goldMap.get(idx);
          const isRevealed = phase === 'memorize' || found.includes(idx);
          const isWrong = wrongCell === idx;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleTap(idx)}
              disabled={phase !== 'play' || found.includes(idx)}
              className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                fontSize: board.size >= 5 ? '1.6rem' : '2.1rem',
                background: isWrong
                  ? 'rgba(239, 68, 68, 0.18)'
                  : found.includes(idx)
                    ? 'rgba(16, 185, 129, 0.18)'
                    : isRevealed && emoji
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'var(--bg-card)',
                border: isWrong
                  ? '2px solid var(--err)'
                  : found.includes(idx)
                    ? '2px solid var(--ok)'
                    : isRevealed && emoji
                      ? '2px solid var(--warn)'
                      : '1.5px solid var(--border)',
              }}
            >
              {isRevealed && emoji ? emoji : isWrong ? '✕' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

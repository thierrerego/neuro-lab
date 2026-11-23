import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

const ITEM_POOL = [
  '🍎', '🚀', '🎸', '🦊', '🌵', '🍩', '⚽', '🎯',
  '🧭', '🍄', '🦋', '👑', '🎨', '🚲', '📷', '🧩',
  '🍉', '🦉', '🔔', '🎁',
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface IdenticalRound {
  items: { uid: number; emoji: string; isPair: boolean }[];
  cols: number;
}

function createRound(stage: number): IdenticalRound {
  const lvl = Math.max(1, Math.floor(stage));
  const total = lvl <= 2 ? 6 : lvl <= 6 ? 9 : lvl <= 11 ? 12 : 16;
  const cols = total <= 9 ? 3 : 4;

  const chosen = shuffle(ITEM_POOL).slice(0, total - 1);
  const dup = chosen[0];
  const uniques = chosen.slice(1);

  const items = shuffle([
    { emoji: dup, isPair: true },
    { emoji: dup, isPair: true },
    ...uniques.map((emoji) => ({ emoji, isPair: false })),
  ]).map((it, uid) => ({ ...it, uid }));

  return { items, cols };
}

export function IdenticalItemsGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<IdenticalRound>(() => createRound(config.stage));
  const [feedback, setFeedback] = useState<{ uid: number; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    roundStart: performance.now(),
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

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleTap = (item: { uid: number; isPair: boolean }) => {
    if (paused || feedback !== null || statsRef.current.finished) return;

    const now = performance.now();
    const rt = Math.max(100, now - statsRef.current.roundStart);

    if (item.isPair) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 135 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      setFeedback({ uid: item.uid, ok: true });

      const clearedAll = onWaveHit();
      emitLive();

      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }

      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.roundStart = performance.now();
      }, 240);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setFeedback({ uid: item.uid, ok: false });
      emitLive();
      onWaveError?.();
      window.setTimeout(() => setFeedback(null), 280);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Toque em UM dos 2 itens repetidos ✨
      </div>

      <div
        className={`grid gap-2.5 w-full ${round.cols === 3 ? 'max-w-[300px]' : 'max-w-[350px]'}`}
        style={{ gridTemplateColumns: `repeat(${round.cols}, minmax(0, 1fr))` }}
      >
        {round.items.map((item) => {
          const isFb = feedback?.uid === item.uid;
          return (
            <button
              key={item.uid}
              type="button"
              onClick={() => handleTap(item)}
              className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                isFb && !feedback.ok ? 'animate-shake' : ''
              }`}
              style={{
                fontSize: round.items.length >= 16 ? '1.85rem' : '2.25rem',
                background: isFb
                  ? feedback.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.22)'
                  : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${feedback.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1.5px solid var(--border)',
              }}
            >
              {item.emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}

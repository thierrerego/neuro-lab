import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface ChangeRound {
  itemEmoji: string;
  itemName: string;
  price: number;
  paid: number;
  change: number;
  options: number[];
}

const SHOP_ITEMS = [
  { emoji: '☕', name: 'Café' },
  { emoji: '🥐', name: 'Pão' },
  { emoji: '🍔', name: 'Lanche' },
  { emoji: '🧃', name: 'Suco' },
  { emoji: '🍕', name: 'Pizza' },
  { emoji: '📚', name: 'Livro' },
  { emoji: '🎧', name: 'Fone' },
  { emoji: '⛽', name: 'Combustível' },
];

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createChangeRound(stage: number): ChangeRound {
  const lvl = Math.max(1, Math.floor(stage));
  const item = SHOP_ITEMS[Math.floor(Math.random() * SHOP_ITEMS.length)];

  let paid = 10;
  let price = 4;

  if (lvl <= 3) {
    paid = [10, 20][Math.floor(Math.random() * 2)];
    price = rnd(2, paid - 2);
  } else if (lvl <= 7) {
    paid = [20, 50][Math.floor(Math.random() * 2)];
    price = rnd(7, paid - 4);
  } else if (lvl <= 12) {
    paid = [50, 100][Math.floor(Math.random() * 2)];
    price = rnd(13, paid - 7);
  } else {
    paid = [100, 200][Math.floor(Math.random() * 2)];
    price = rnd(23, paid - 11);
  }

  const change = paid - price;
  const distractors = new Set<number>([change]);
  const offsets = lvl <= 4 ? [-4, -2, -1, 1, 2, 4, 5] : [-10, -2, -1, 1, 2, 10];

  while (distractors.size < 4) {
    const off = offsets[Math.floor(Math.random() * offsets.length)];
    const candidate = Math.max(1, change + off);
    if (candidate !== change && candidate < paid) {
      distractors.add(candidate);
    }
  }

  return {
    itemEmoji: item.emoji,
    itemName: item.name,
    price,
    paid,
    change,
    options: shuffle(Array.from(distractors)),
  };
}

export function ExactChangeGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<ChangeRound>(() => createChangeRound(config.stage));
  const [feedback, setFeedback] = useState<{ val: number; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
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
    if (!paused) statsRef.current.shownAt = performance.now();
  }, [paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const handlePick = (val: number) => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(120, performance.now() - statsRef.current.shownAt);

    if (val === round.change) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 135 + Math.min(85, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      setFeedback({ val, ok: true });

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createChangeRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 210);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setFeedback({ val, ok: false });
      onWaveError?.();
      emitLive();
      window.setTimeout(() => setFeedback(null), 260);
    }
  };

  return (
    <div className="w-full max-w-[350px] flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Qual é o troco exato?
      </div>

      <div
        className="w-full rounded-3xl p-5 flex items-center justify-between gap-3"
        style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-strong)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex flex-col items-center flex-1">
          <span className="text-3xl">{round.itemEmoji}</span>
          <span className="text-[11px] font-bold mt-1" style={{ color: 'var(--text-soft)' }}>
            {round.itemName}
          </span>
          <span className="text-2xl font-black tabular mt-0.5" style={{ color: 'var(--text)' }}>
            R$ {round.price}
          </span>
        </div>

        <div className="w-px h-14" style={{ background: 'var(--border)' }} />

        <div className="flex flex-col items-center flex-1">
          <span className="text-3xl">💵</span>
          <span className="text-[11px] font-bold mt-1" style={{ color: 'var(--text-soft)' }}>
            Pagou com
          </span>
          <span className="text-2xl font-black tabular mt-0.5" style={{ color: 'var(--ok)' }}>
            R$ {round.paid}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {round.options.map((opt) => {
          const isFb = feedback?.val === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handlePick(opt)}
              className={`min-h-[60px] rounded-2xl font-extrabold text-xl tabular cursor-pointer transition-all ${
                isFb && !feedback.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isFb
                  ? feedback.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.20)'
                  : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${feedback.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1.5px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              R$ {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

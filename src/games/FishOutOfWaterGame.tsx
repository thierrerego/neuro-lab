import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface CategoryDef {
  name: string;
  items: string[];
}

const CATEGORIES: CategoryDef[] = [
  { name: 'Frutas', items: ['🍎', '🍌', '🍇', '🍓', '🍉', '🍐', '🍒', '🥭'] },
  { name: 'Veículos', items: ['🚗', '🚌', '🚲', '✈️', '🚢', '🚂', '🛵', '🚁'] },
  { name: 'Marinhos', items: ['🐟', '🐙', '🐳', '🦀', '🐬', '🦈', '🦞', '🐢'] },
  { name: 'Instrumentos', items: ['🎸', '🎹', '🥁', '🎺', '🎻', '🎷', '🪕', '🪗'] },
  { name: 'Esportes', items: ['⚽', '🏀', '🎾', '🏐', '⚾', '🏈', '🎱', '🏓'] },
  { name: 'Clima', items: ['☀️', '🌧️', '❄️', '⚡', '🌈', '🌪️', '☁️', '🌙'] },
  { name: 'Ferramentas', items: ['🔨', '🔧', '🪛', '🪚', '🪓', '⚙️', '🧲', '🪜'] },
  { name: 'Doces', items: ['🍩', '🍪', '🧁', '🍫', '🍬', '🍰', '🍦', '🍮'] },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface IntruderItem {
  uid: number;
  emoji: string;
  rotateDeg?: number;
  isIntruder: boolean;
}

interface FishRound {
  items: IntruderItem[];
  mode: 'semantic' | 'rotation';
}

const ROTATE_EMOJIS = ['🚀', '✈️', '🔑', '🎸', '☂️', '🧭', '🖍️', '📌'];

function createRound(stage: number): FishRound {
  const lvl = Math.max(1, Math.floor(stage));
  const total = lvl <= 4 ? 4 : 6;
  const useRotation = lvl >= 4 && Math.random() < 0.35;

  if (useRotation) {
    const emoji = ROTATE_EMOJIS[Math.floor(Math.random() * ROTATE_EMOJIS.length)];
    const baseRot = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
    const altRot = (baseRot + 90 * (Math.random() < 0.5 ? 1 : 2)) % 360;

    const items = shuffle([
      { emoji, rotateDeg: altRot, isIntruder: true },
      ...Array.from({ length: total - 1 }, () => ({
        emoji,
        rotateDeg: baseRot,
        isIntruder: false,
      })),
    ]).map((it, uid) => ({ ...it, uid }));

    return { items, mode: 'rotation' };
  }

  const cats = shuffle(CATEGORIES);
  const mainCat = cats[0];
  const intruderCat = cats[1];

  const mainItems = shuffle(mainCat.items).slice(0, total - 1);
  const intruderEmoji = intruderCat.items[Math.floor(Math.random() * intruderCat.items.length)];

  const items = shuffle([
    { emoji: intruderEmoji, isIntruder: true },
    ...mainItems.map((emoji) => ({ emoji, isIntruder: false })),
  ]).map((it, uid) => ({ ...it, uid }));

  return { items, mode: 'semantic' };
}

export function FishOutOfWaterGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<FishRound>(() => createRound(config.stage));
  const [picked, setPicked] = useState<{ uid: number; ok: boolean } | null>(null);

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

  const handleTap = (item: IntruderItem) => {
    if (paused || picked !== null || statsRef.current.finished) return;

    const now = performance.now();
    const rt = Math.max(120, now - statsRef.current.roundStart);
    setPicked({ uid: item.uid, ok: item.isIntruder });

    if (item.isIntruder) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 140 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      onWaveError?.();
      emitLive();
    }

    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setRound(createRound(configRef.current.stage));
      setPicked(null);
      statsRef.current.roundStart = performance.now();
    }, 260);
  };

  const cols = round.items.length === 4 ? 2 : 3;

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Toque no INTRUSO que não combina 🐠
      </div>

      <div
        className={`grid gap-3 w-full ${cols === 2 ? 'max-w-[260px]' : 'max-w-[336px]'}`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {round.items.map((item) => {
          const isPicked = picked?.uid === item.uid;
          return (
            <button
              key={item.uid}
              type="button"
              onClick={() => handleTap(item)}
              className={`aspect-square rounded-3xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                isPicked && !picked.ok ? 'animate-shake' : ''
              }`}
              style={{
                fontSize: cols === 2 ? '3.25rem' : '2.75rem',
                background: isPicked
                  ? picked.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.22)'
                  : 'var(--bg-card)',
                border: isPicked
                  ? `2px solid ${picked.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1.5px solid var(--border-strong)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: item.rotateDeg ? `rotate(${item.rotateDeg}deg)` : undefined,
                }}
              >
                {item.emoji}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

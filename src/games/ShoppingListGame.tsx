import { useEffect, useRef, useState } from 'react';
import {
  Apple,
  Banana,
  Beef,
  CakeSlice,
  Candy,
  Carrot,
  Check,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  Egg,
  Fish,
  Grape,
  IceCreamCone,
  Milk,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
} from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface MarketItem {
  emoji: string; // id único
  label: string;
  color: string;
  render: (size: number) => JSX.Element;
}

const MARKET_POOL: MarketItem[] = [
  { emoji: 'apple', label: 'Maçã', color: '#E11D48', render: (s) => <Apple size={s} /> },
  { emoji: 'croissant', label: 'Croissant', color: '#D97706', render: (s) => <Croissant size={s} /> },
  { emoji: 'milk', label: 'Leite', color: '#0EA5E9', render: (s) => <Milk size={s} /> },
  { emoji: 'egg', label: 'Ovos', color: '#CA8A04', render: (s) => <Egg size={s} /> },
  { emoji: 'banana', label: 'Banana', color: '#EAB308', render: (s) => <Banana size={s} /> },
  { emoji: 'carrot', label: 'Cenoura', color: '#EA580C', render: (s) => <Carrot size={s} /> },
  { emoji: 'grape', label: 'Uva', color: '#7C3AED', render: (s) => <Grape size={s} /> },
  { emoji: 'citrus', label: 'Limão', color: '#65A30D', render: (s) => <Citrus size={s} /> },
  { emoji: 'cookie', label: 'Biscoito', color: '#B45309', render: (s) => <Cookie size={s} /> },
  { emoji: 'fish', label: 'Peixe', color: '#2563EB', render: (s) => <Fish size={s} /> },
  { emoji: 'pizza', label: 'Pizza', color: '#DC2626', render: (s) => <Pizza size={s} /> },
  { emoji: 'coffee', label: 'Café', color: '#78350F', render: (s) => <Coffee size={s} /> },
  { emoji: 'cherry', label: 'Cereja', color: '#BE123C', render: (s) => <Cherry size={s} /> },
  { emoji: 'cake', label: 'Bolo', color: '#DB2777', render: (s) => <CakeSlice size={s} /> },
  { emoji: 'candy', label: 'Doce', color: '#EC4899', render: (s) => <Candy size={s} /> },
  { emoji: 'soda', label: 'Suco', color: '#0891B2', render: (s) => <CupSoda size={s} /> },
  { emoji: 'donut', label: 'Rosquinha', color: '#F59E0B', render: (s) => <Donut size={s} /> },
  { emoji: 'icecream', label: 'Sorvete', color: '#8B5CF6', render: (s) => <IceCreamCone size={s} /> },
  { emoji: 'popcorn', label: 'Pipoca', color: '#D97706', render: (s) => <Popcorn size={s} /> },
  { emoji: 'salad', label: 'Salada', color: '#059669', render: (s) => <Salad size={s} /> },
  { emoji: 'sandwich', label: 'Lanche', color: '#EA580C', render: (s) => <Sandwich size={s} /> },
  { emoji: 'soup', label: 'Sopa', color: '#DC2626', render: (s) => <Soup size={s} /> },
  { emoji: 'beef', label: 'Carne', color: '#991B1B', render: (s) => <Beef size={s} /> },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface ShoppingRound {
  targets: MarketItem[];
  shelf: MarketItem[];
  cols: number;
  previewMs: number;
}

function createRound(stage: number): ShoppingRound {
  const lvl = Math.max(1, Math.floor(stage));
  const listSize = lvl <= 2 ? 3 : lvl <= 5 ? 4 : lvl <= 9 ? 5 : lvl <= 13 ? 6 : lvl <= 17 ? 7 : lvl <= 20 ? 8 : lvl <= 25 ? 9 : 10;
  const shelfSize = lvl <= 2 ? 9 : lvl <= 6 ? 12 : lvl <= 12 ? 16 : 20;
  const cols = shelfSize <= 9 ? 3 : 4;
  const previewMs = 1900 + listSize * 360;

  const picked = shuffle(MARKET_POOL).slice(0, shelfSize);
  const targets = picked.slice(0, listSize);
  const shelf = shuffle(picked);

  return { targets, shelf, cols, previewMs };
}

export function ShoppingListGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<ShoppingRound>(() => createRound(config.stage));
  const [phase, setPhase] = useState<'memorize' | 'play' | 'next'>('memorize');
  const [pickedEmojis, setPickedEmojis] = useState<string[]>([]);
  const [wrongEmoji, setWrongEmoji] = useState<string | null>(null);

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
    }, round.previewMs);
    return () => window.clearTimeout(id);
  }, [phase, round, paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const targetSet = new Set(round.targets.map((t) => t.emoji));

  const handleShelfTap = (item: MarketItem) => {
    if (paused || phase !== 'play' || statsRef.current.finished) return;
    if (pickedEmojis.includes(item.emoji)) return;

    const now = performance.now();
    const rt = Math.max(100, now - statsRef.current.stepStart);
    statsRef.current.stepStart = now;

    if (targetSet.has(item.emoji)) {
      const nextPicked = [...pickedEmojis, item.emoji];
      setPickedEmojis(nextPicked);
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      emitLive();

      if (nextPicked.length >= round.targets.length) {
        const clearedAll = onWaveHit();
        if (clearedAll) {
          window.setTimeout(() => finishNow(), 200);
          return;
        }
        setPhase('next');
        window.setTimeout(() => {
          if (statsRef.current.finished) return;
          setRound(createRound(configRef.current.stage));
          setPickedEmojis([]);
          setWrongEmoji(null);
          setPhase('memorize');
        }, 380);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setWrongEmoji(item.emoji);
      window.setTimeout(() => setWrongEmoji(null), 320);
      emitLive();
      onWaveError?.();
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex items-center gap-2.5">
        <div
          className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
          style={{
            background: phase === 'memorize' ? 'var(--accent-glow)' : 'var(--bg-subtle)',
            color: phase === 'memorize' ? 'var(--accent)' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {phase === 'memorize' ? 'Memorize a lista 🛒' : 'Pegue os itens da lista'}
        </div>
        {phase === 'play' && (
          <div
            className="text-xs font-extrabold tabular px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          >
            {pickedEmojis.length}/{round.targets.length}
          </div>
        )}
      </div>

      {phase === 'memorize' ? (
        <div
          className="w-full max-w-[340px] rounded-3xl p-4 flex flex-wrap items-center justify-center gap-3 animate-pop"
          style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)' }}
        >
          {round.targets.map((item) => (
            <div
              key={item.emoji}
              className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl min-w-[78px]"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
            >
              <div style={{ color: item.color }}>{item.render(34)}</div>
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="grid gap-2.5 w-full max-w-[430px] animate-pop"
          style={{ gridTemplateColumns: `repeat(${round.cols}, minmax(0, 1fr))` }}
        >
          {round.shelf.map((item) => {
            const isPicked = pickedEmojis.includes(item.emoji);
            const isWrong = wrongEmoji === item.emoji;

            return (
              <button
                key={item.emoji}
                type="button"
                onClick={() => handleShelfTap(item)}
                disabled={phase !== 'play' || isPicked}
                aria-label={item.label}
                className={`aspect-square rounded-2xl relative flex items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                  isWrong ? 'animate-shake' : ''
                }`}
                style={{
                  color: item.color,
                  background: isWrong
                    ? 'rgba(239, 68, 68, 0.18)'
                    : isPicked
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'var(--bg-card)',
                  border: isWrong
                    ? '2px solid var(--err)'
                    : isPicked
                      ? '2px solid var(--ok)'
                      : '1.5px solid var(--border)',
                }}
              >
                {item.render(round.shelf.length >= 16 ? 26 : 32)}
                {isPicked && (
                  <span
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--ok)', color: '#fff' }}
                  >
                    <Check size={10} strokeWidth={3.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

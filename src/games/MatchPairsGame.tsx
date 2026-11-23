import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

const EMOJI_DECK = [
  '🦊', '🐼', '🦁', '🐸', '🐙', '🦋', '🌵', '🍄',
  '🎸', '🚀', '🎯', '🧭', '🍩', '🍉', '⚽', '👑',
];

interface EmojiCard {
  uid: number;
  emoji: string;
  matched: boolean;
}

interface BoardSpec {
  pairs: number;
  cols: number;
  previewMs: number;
}

function getSpec(stage: number): BoardSpec {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 1) return { pairs: 3, cols: 3, previewMs: 1700 };
  if (lvl <= 3) return { pairs: 4, cols: 4, previewMs: 1600 };
  if (lvl <= 7) return { pairs: 6, cols: 4, previewMs: 1400 };
  return { pairs: 8, cols: 4, previewMs: 1200 };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildBoard(stage: number): { cards: EmojiCard[]; spec: BoardSpec } {
  const spec = getSpec(stage);
  const chosen = shuffle(EMOJI_DECK).slice(0, spec.pairs);
  const doubled = shuffle([...chosen, ...chosen]);
  return {
    spec,
    cards: doubled.map((emoji, uid) => ({ uid, emoji, matched: false })),
  };
}

export function MatchPairsGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const initial = useRef<{ cards: EmojiCard[]; spec: BoardSpec } | null>(null);
  if (!initial.current) initial.current = buildBoard(config.stage);

  const [cards, setCards] = useState<EmojiCard[]>(initial.current.cards);
  const [spec, setSpec] = useState<BoardSpec>(initial.current.spec);
  const [phase, setPhase] = useState<'preview' | 'play' | 'locked'>('preview');
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [mismatchIds, setMismatchIds] = useState<number[]>([]);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    pairStartAt: performance.now(),
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
    if (phase !== 'preview' || paused) return;
    const id = window.setTimeout(() => {
      if (statsRef.current.finished) return;
      statsRef.current.pairStartAt = performance.now();
      setPhase('play');
    }, spec.previewMs);
    return () => window.clearTimeout(id);
  }, [phase, spec, paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleTap = (card: EmojiCard) => {
    if (paused || phase !== 'play' || statsRef.current.finished) return;
    if (card.matched || flippedIds.includes(card.uid)) return;

    sound.tap();
    const nextFlipped = [...flippedIds, card.uid];
    setFlippedIds(nextFlipped);

    if (nextFlipped.length < 2) return;

    const first = cards.find((c) => c.uid === nextFlipped[0]);
    if (!first) return;

    if (first.emoji === card.emoji) {
      const now = performance.now();
      const rt = Math.max(120, now - statsRef.current.pairStartAt);
      statsRef.current.pairStartAt = now;
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 140 + Math.min(90, statsRef.current.combo * 16);
      sound.hit(statsRef.current.combo);

      const updated = cards.map((c) =>
        c.uid === first.uid || c.uid === card.uid ? { ...c, matched: true } : c
      );
      setCards(updated);
      setFlippedIds([]);

      const clearedAll = onWaveHit();
      emitLive();

      if (clearedAll) {
        finishNow();
        return;
      }

      if (updated.every((c) => c.matched)) {
        setPhase('locked');
        window.setTimeout(() => {
          if (statsRef.current.finished) return;
          const next = buildBoard(configRef.current.stage);
          setCards(next.cards);
          setSpec(next.spec);
          setFlippedIds([]);
          setMismatchIds([]);
          setPhase('preview');
        }, 360);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      onWaveError?.();
      emitLive();

      setMismatchIds(nextFlipped);
      setPhase('locked');
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setFlippedIds([]);
        setMismatchIds([]);
        setPhase('play');
        statsRef.current.pairStartAt = performance.now();
      }, 460);
    }
  };

  const matchedPairs = cards.filter((c) => c.matched).length / 2;

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex items-center gap-2.5">
        <div
          className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
          style={{
            background: phase === 'preview' ? 'var(--accent-glow)' : 'var(--bg-subtle)',
            color: phase === 'preview' ? 'var(--accent)' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {phase === 'preview' ? 'Memorize os pares' : 'Combine os pares iguais'}
        </div>
        <div
          className="text-xs font-extrabold tabular px-3 py-1.5 rounded-full"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
        >
          {matchedPairs}/{spec.pairs}
        </div>
      </div>

      <div
        className={`grid gap-2.5 w-full ${spec.cols === 3 ? 'max-w-[300px]' : 'max-w-[345px]'}`}
        style={{ gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))` }}
      >
        {cards.map((card) => {
          const isMismatch = mismatchIds.includes(card.uid);
          const isOpen = phase === 'preview' || card.matched || flippedIds.includes(card.uid);

          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => handleTap(card)}
              disabled={phase !== 'play' || card.matched}
              className={`aspect-square rounded-2xl relative flex items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                isMismatch ? 'animate-shake' : ''
              }`}
              style={{
                fontSize: spec.pairs >= 8 ? '1.8rem' : '2.2rem',
                background: card.matched
                  ? 'rgba(16, 185, 129, 0.14)'
                  : isMismatch
                    ? 'rgba(239, 68, 68, 0.18)'
                    : isOpen
                      ? 'var(--bg-card)'
                      : 'var(--bg-subtle)',
                border: card.matched
                  ? '2px solid var(--ok)'
                  : isMismatch
                    ? '2px solid var(--err)'
                    : isOpen
                      ? '2px solid var(--border-strong)'
                      : '1.5px solid var(--border)',
              }}
            >
              {isOpen ? (
                <>
                  <span>{card.emoji}</span>
                  {card.matched && (
                    <span
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--ok)', color: '#fff' }}
                    >
                      <Check size={10} strokeWidth={3.5} />
                    </span>
                  )}
                </>
              ) : (
                <span className="text-lg font-black" style={{ color: 'var(--text-soft)' }}>
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

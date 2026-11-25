import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type SymbolId =
  | 'star'
  | 'heart'
  | 'diamond'
  | 'triangle'
  | 'circle'
  | 'bolt'
  | 'moon'
  | 'flower'
  | 'sun'
  | 'clover';

interface CardSymbol {
  id: SymbolId;
  label: string;
  color: string;
}

const SYMBOLS: CardSymbol[] = [
  { id: 'star', label: 'Estrela', color: '#D97706' },
  { id: 'heart', label: 'Coração', color: '#E11D48' },
  { id: 'diamond', label: 'Losango', color: '#2563EB' },
  { id: 'triangle', label: 'Triângulo', color: '#059669' },
  { id: 'circle', label: 'Círculo', color: '#7C3AED' },
  { id: 'bolt', label: 'Raio', color: '#EA580C' },
  { id: 'moon', label: 'Lua', color: '#0891B2' },
  { id: 'flower', label: 'Flor', color: '#DB2777' },
  { id: 'sun', label: 'Sol', color: '#CA8A04' },
  { id: 'clover', label: 'Trevo', color: '#16A34A' },
];

interface MemoryCard {
  uid: number;
  symbol: CardSymbol;
  matched: boolean;
}

interface BoardSpec {
  pairs: number;
  cols: number;
  previewMs: number;
}

function getBoardSpec(stage: number): BoardSpec {
  const lvl = Math.max(1, Math.floor(stage));
  // Nível 1: 3 pares (3x2) com preview de 1.4s — fácil de gabaritar
  if (lvl <= 1) return { pairs: 3, cols: 3, previewMs: 1400 };
  // Nível 2–3: 4 pares (4x2), preview 1.2s
  if (lvl <= 3) return { pairs: 4, cols: 4, previewMs: 1200 };
  // Nível 4–6: 6 pares (4x3), preview 1.0s no N4 e 0.7s no N5–6
  if (lvl <= 6) return { pairs: 6, cols: 4, previewMs: lvl === 4 ? 1000 : 700 };
  // Nível 7+: 8 pares (4x4), sem preview
  if (lvl <= 20) return { pairs: 8, cols: 4, previewMs: 0 };
  // Fases 21–30: tabuleiro maior (4×5, todos os 10 símbolos)
  return { pairs: 10, cols: 4, previewMs: 0 };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck(stage: number): { cards: MemoryCard[]; spec: BoardSpec } {
  const spec = getBoardSpec(stage);
  const chosen = shuffle(SYMBOLS).slice(0, spec.pairs);
  const doubled = shuffle([...chosen, ...chosen]);
  const cards: MemoryCard[] = doubled.map((symbol, uid) => ({
    uid,
    symbol,
    matched: false,
  }));
  return { cards, spec };
}

function PairIcon({ id, color, size = 34 }: { id: SymbolId; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {id === 'star' && (
        <path
          d="M20 4.5L24.5 13.8L34.8 15.2L27.3 22.4L29.1 32.6L20 27.8L10.9 32.6L12.7 22.4L5.2 15.2L15.5 13.8L20 4.5Z"
          fill={color}
        />
      )}
      {id === 'heart' && (
        <path
          d="M20 34.5C20 34.5 6 25.6 6 15.2C6 10.6 9.5 7 13.8 7C16.5 7 18.8 8.4 20 10.6C21.2 8.4 23.5 7 26.2 7C30.5 7 34 10.6 34 15.2C34 25.6 20 34.5 20 34.5Z"
          fill={color}
        />
      )}
      {id === 'diamond' && <polygon points="20,4 35,20 20,36 5,20" fill={color} />}
      {id === 'triangle' && <polygon points="20,6 35,33 5,33" fill={color} strokeLinejoin="round" />}
      {id === 'circle' && <circle cx="20" cy="20" r="13.5" fill={color} />}
      {id === 'bolt' && (
        <path d="M22.5 4L8.5 22H19.5L17.5 36L31.5 18H20.5L22.5 4Z" fill={color} />
      )}
      {id === 'moon' && (
        <path
          d="M28.5 24.8A12.5 12.5 0 0 1 15.2 11.5C15.2 9.4 15.7 7.5 16.6 5.8A14 14 0 1 0 34.2 23.4C32.5 24.3 30.6 24.8 28.5 24.8Z"
          fill={color}
        />
      )}
      {id === 'flower' && (
        <g fill={color}>
          <circle cx="20" cy="10.5" r="6" />
          <circle cx="29.5" cy="20" r="6" />
          <circle cx="20" cy="29.5" r="6" />
          <circle cx="10.5" cy="20" r="6" />
          <circle cx="20" cy="20" r="5" fill="#FFFFFF" opacity="0.88" />
        </g>
      )}
      {id === 'sun' && (
        <g stroke={color} strokeWidth="3.2" strokeLinecap="round">
          <circle cx="20" cy="20" r="7.5" fill={color} stroke="none" />
          <line x1="20" y1="4.5" x2="20" y2="8.5" />
          <line x1="20" y1="31.5" x2="20" y2="35.5" />
          <line x1="4.5" y1="20" x2="8.5" y2="20" />
          <line x1="31.5" y1="20" x2="35.5" y2="20" />
          <line x1="9" y1="9" x2="11.8" y2="11.8" />
          <line x1="28.2" y1="28.2" x2="31" y2="31" />
          <line x1="31" y1="9" x2="28.2" y2="11.8" />
          <line x1="11.8" y1="28.2" x2="9" y2="31" />
        </g>
      )}
      {id === 'clover' && (
        <g fill={color}>
          <circle cx="20" cy="12" r="6.5" />
          <circle cx="13" cy="22" r="6.5" />
          <circle cx="27" cy="22" r="6.5" />
          <path d="M20 23V35" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

type PendingAction = 'preview' | 'mismatch' | 'nextBoard' | null;

export function MemoryPairsGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const initial = useRef<{ cards: MemoryCard[]; spec: BoardSpec } | null>(null);
  if (!initial.current) {
    initial.current = buildDeck(config.stage);
  }

  const [boardNum, setBoardNum] = useState(0);
  const [cards, setCards] = useState<MemoryCard[]>(initial.current.cards);
  const [spec, setSpec] = useState<BoardSpec>(initial.current.spec);
  const [phase, setPhase] = useState<'preview' | 'play'>(() =>
    initial.current!.spec.previewMs > 0 ? 'preview' : 'play'
  );
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [mismatchIds, setMismatchIds] = useState<number[]>([]);

  // Controle de timers pausáveis (preview, desvirar erro, próximo tabuleiro)
  const [pendingAction, setPendingAction] = useState<PendingAction>(() =>
    initial.current!.spec.previewMs > 0 ? 'preview' : null
  );
  const pendingRemainingRef = useRef<number>(initial.current.spec.previewMs);
  const pendingStartedAtRef = useRef<number>(performance.now());
  const pauseStartedAtRef = useRef<number | null>(null);

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
    setPendingAction(null);
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

  // Desconta tempo pausado da medição de RT
  useEffect(() => {
    if (paused) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
    } else if (pauseStartedAtRef.current !== null) {
      statsRef.current.pairStartAt += performance.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [paused]);

  // Executa e congela com precisão qualquer timer ativo quando paused muda
  useEffect(() => {
    if (!pendingAction || statsRef.current.finished) return;

    if (paused) {
      const elapsed = performance.now() - pendingStartedAtRef.current;
      pendingRemainingRef.current = Math.max(0, pendingRemainingRef.current - elapsed);
      return;
    }

    pendingStartedAtRef.current = performance.now();
    const waitMs = Math.max(0, pendingRemainingRef.current);

    const id = window.setTimeout(() => {
      if (statsRef.current.finished) return;

      if (pendingAction === 'preview') {
        setPhase('play');
        setPendingAction(null);
        statsRef.current.pairStartAt = performance.now();
      } else if (pendingAction === 'mismatch') {
        setFlippedIds([]);
        setMismatchIds([]);
        setPendingAction(null);
        statsRef.current.pairStartAt = performance.now();
      } else if (pendingAction === 'nextBoard') {
        const next = buildDeck(configRef.current.stage);
        setBoardNum((n) => n + 1);
        setCards(next.cards);
        setSpec(next.spec);
        setFlippedIds([]);
        setMismatchIds([]);
        if (next.spec.previewMs > 0) {
          setPhase('preview');
          pendingRemainingRef.current = next.spec.previewMs;
          pendingStartedAtRef.current = performance.now();
          setPendingAction('preview');
        } else {
          setPhase('play');
          setPendingAction(null);
          statsRef.current.pairStartAt = performance.now();
        }
      }
    }, waitMs);

    return () => window.clearTimeout(id);
  }, [pendingAction, paused, boardNum]);

  const scheduleAction = (action: Exclude<PendingAction, null>, durationMs: number) => {
    pendingRemainingRef.current = durationMs;
    pendingStartedAtRef.current = performance.now();
    setPendingAction(action);
  };

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleCardTap = (card: MemoryCard) => {
    if (
      paused ||
      phase !== 'play' ||
      pendingAction !== null ||
      statsRef.current.finished ||
      card.matched ||
      flippedIds.includes(card.uid)
    ) {
      return;
    }

    sound.tap();
    const nextFlipped = [...flippedIds, card.uid];
    setFlippedIds(nextFlipped);

    if (nextFlipped.length < 2) return;

    const first = cards.find((c) => c.uid === nextFlipped[0]);
    const second = card;
    if (!first) return;

    if (first.symbol.id === second.symbol.id) {
      const now = performance.now();
      const rt = Math.max(120, now - statsRef.current.pairStartAt);
      statsRef.current.pairStartAt = now;
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 140 + Math.min(90, statsRef.current.combo * 16);
      sound.hit(statsRef.current.combo);

      const clearedAll = onWaveHit();
      emitLive();

      const updated = cards.map((c) =>
        c.uid === first.uid || c.uid === second.uid ? { ...c, matched: true } : c
      );
      setCards(updated);
      setFlippedIds([]);

      if (clearedAll) {
        finishNow();
        return;
      }

      if (updated.every((c) => c.matched)) {
        scheduleAction('nextBoard', 320);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      onWaveError?.();
      emitLive();

      setMismatchIds(nextFlipped);
      scheduleAction('mismatch', 420);
    }
  };

  const matchedPairs = cards.filter((c) => c.matched).length / 2;
  const iconSize = spec.pairs >= 8 ? 28 : spec.pairs >= 6 ? 32 : 38;
  const maxWidthClass = spec.cols === 3 ? 'max-w-[306px]' : 'max-w-[348px]';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex items-center gap-2.5">
        <div
          className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
          style={{
            background: phase === 'preview' ? 'var(--accent-glow)' : 'var(--bg-subtle)',
            color: phase === 'preview' ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${phase === 'preview' ? 'var(--border-strong)' : 'var(--border)'}`,
          }}
        >
          {phase === 'preview' ? 'Memorize os pares' : 'Encontre os pares'}
        </div>

        <div
          className="text-xs font-extrabold tabular px-3 py-1.5 rounded-full"
          style={{
            background: 'var(--bg-subtle)',
            color: matchedPairs === spec.pairs ? 'var(--ok)' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {matchedPairs}/{spec.pairs}
        </div>
      </div>

      <div
        key={boardNum}
        className={`grid gap-2.5 w-full ${maxWidthClass} animate-pop`}
        style={{ gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))` }}
      >
        {cards.map((card) => {
          const isMismatch = mismatchIds.includes(card.uid);
          const isOpen = phase === 'preview' || card.matched || flippedIds.includes(card.uid);

          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => handleCardTap(card)}
              disabled={phase !== 'play' || card.matched}
              aria-label={isOpen ? card.symbol.label : 'Carta virada'}
              className={`aspect-square rounded-2xl relative flex items-center justify-center transition-all duration-150 cursor-pointer ${
                isMismatch ? 'animate-shake' : ''
              }`}
              style={{
                background: card.matched
                  ? 'rgba(16, 185, 129, 0.14)'
                  : isMismatch
                    ? 'rgba(239, 68, 68, 0.16)'
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
                boxShadow: isOpen ? 'var(--card-shadow)' : 'none',
                opacity: card.matched ? 0.76 : 1,
                transform: isOpen && !card.matched ? 'scale(1.01)' : 'scale(1)',
              }}
            >
              {isOpen ? (
                <>
                  <div
                    className="w-4/5 h-4/5 rounded-xl flex items-center justify-center"
                    style={{ background: `${card.symbol.color}18` }}
                  >
                    <PairIcon id={card.symbol.id} color={card.symbol.color} size={iconSize} />
                  </div>
                  {card.matched && (
                    <span
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--ok)', color: '#FFFFFF' }}
                    >
                      <Check size={10} strokeWidth={3.5} />
                    </span>
                  )}
                </>
              ) : (
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'var(--accent)', opacity: 0.65 }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

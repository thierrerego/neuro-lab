import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type PhotoSymbolId = 'star' | 'heart' | 'diamond' | 'triangle' | 'circle' | 'moon' | 'bolt' | 'flower';

interface PhotoSymbol {
  id: PhotoSymbolId;
  label: string;
  color: string;
}

const SYMBOLS: PhotoSymbol[] = [
  { id: 'star', label: 'a estrela', color: '#D97706' },
  { id: 'heart', label: 'o coração', color: '#E11D48' },
  { id: 'diamond', label: 'o losango', color: '#2563EB' },
  { id: 'triangle', label: 'o triângulo', color: '#059669' },
  { id: 'circle', label: 'o círculo', color: '#7C3AED' },
  { id: 'moon', label: 'a lua', color: '#0891B2' },
  { id: 'bolt', label: 'o raio', color: '#EA580C' },
  { id: 'flower', label: 'a flor', color: '#DB2777' },
];

interface PlacedIcon {
  cellId: number;
  symbol: PhotoSymbol;
}

interface PhotoRound {
  gridSize: number;
  memorizeMs: number;
  placed: PlacedIcon[];
  queries: PlacedIcon[];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRound(stage: number): PhotoRound {
  const lvl = Math.max(1, Math.floor(stage));

  // Grade 3×3 nos Níveis 1–4; 4×4 a partir do Nível 5
  const gridSize = lvl <= 4 ? 3 : 4;
  // Nível 1: só 2 ícones bem distintos na grade 3×3 (ultrabásico e gostoso!)
  const iconCount =
    lvl <= 1 ? 2 : lvl === 2 ? 3 : lvl <= 6 ? 4 : 5;
  // Nos níveis mais altos pergunta 2 ícones em sequência no mesmo tabuleiro
  const queryCount = lvl <= 2 ? 1 : 2;
  // Tempo confortável de memorização (1.6s a 2.2s)
  const memorizeMs =
    lvl <= 1
      ? 1900
      : lvl === 2
        ? 1950
        : lvl === 3
          ? 2050
          : lvl === 4
            ? 1850
            : lvl === 5
              ? 2150
              : lvl === 6
                ? 1900
                : 1700;

  const totalCells = gridSize * gridSize;
  const cells = shuffle(Array.from({ length: totalCells }, (_, i) => i)).slice(0, iconCount);
  const chosenSymbols = shuffle(SYMBOLS).slice(0, iconCount);

  const placed: PlacedIcon[] = cells.map((cellId, idx) => ({
    cellId,
    symbol: chosenSymbols[idx],
  }));

  const queries = shuffle(placed).slice(0, queryCount);

  return {
    gridSize,
    memorizeMs,
    placed,
    queries,
  };
}

function PhotoIcon({ id, color, size = 34 }: { id: PhotoSymbolId; color: string; size?: number }) {
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
      {id === 'moon' && (
        <path
          d="M28.5 24.8A12.5 12.5 0 0 1 15.2 11.5C15.2 9.4 15.7 7.5 16.6 5.8A14 14 0 1 0 34.2 23.4C32.5 24.3 30.6 24.8 28.5 24.8Z"
          fill={color}
        />
      )}
      {id === 'bolt' && (
        <path d="M22.5 4L8.5 22H19.5L17.5 36L31.5 18H20.5L22.5 4Z" fill={color} />
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
    </svg>
  );
}

type PendingTimer = 'memorize' | 'nextQuery' | 'nextRound' | null;

export function PhotoRecallGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const initialRound = useRef<PhotoRound | null>(null);
  if (!initialRound.current) {
    initialRound.current = buildRound(config.stage);
  }

  const [roundNum, setRoundNum] = useState(0);
  const [round, setRound] = useState<PhotoRound>(initialRound.current);
  const [phase, setPhase] = useState<'memorize' | 'recall'>('memorize');
  const [queryIdx, setQueryIdx] = useState(0);
  const [foundCellIds, setFoundCellIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{
    tappedId: number;
    targetId: number;
    ok: boolean;
  } | null>(null);

  // Timers pausáveis
  const [pendingTimer, setPendingTimer] = useState<PendingTimer>('memorize');
  const pendingRemainingRef = useRef<number>(initialRound.current.memorizeMs);
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
    shownAt: performance.now(),
    finished: false,
  });

  const finishNow = () => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    setPendingTimer(null);
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
    if (paused) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
    } else if (pauseStartedAtRef.current !== null) {
      statsRef.current.shownAt += performance.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [paused]);

  const scheduleTimer = (kind: Exclude<PendingTimer, null>, durationMs: number) => {
    pendingRemainingRef.current = durationMs;
    pendingStartedAtRef.current = performance.now();
    setPendingTimer(kind);
  };

  useEffect(() => {
    if (!pendingTimer || statsRef.current.finished) return;

    if (paused) {
      const elapsed = performance.now() - pendingStartedAtRef.current;
      pendingRemainingRef.current = Math.max(0, pendingRemainingRef.current - elapsed);
      return;
    }

    pendingStartedAtRef.current = performance.now();
    const waitMs = Math.max(0, pendingRemainingRef.current);

    const id = window.setTimeout(() => {
      if (statsRef.current.finished) return;

      if (pendingTimer === 'memorize') {
        setPhase('recall');
        setPendingTimer(null);
        statsRef.current.shownAt = performance.now();
      } else if (pendingTimer === 'nextQuery') {
        setFeedback(null);
        setQueryIdx((q) => q + 1);
        setPendingTimer(null);
        statsRef.current.shownAt = performance.now();
      } else if (pendingTimer === 'nextRound') {
        const next = buildRound(configRef.current.stage);
        setRound(next);
        setRoundNum((n) => n + 1);
        setQueryIdx(0);
        setFoundCellIds([]);
        setFeedback(null);
        setPhase('memorize');
        pendingRemainingRef.current = next.memorizeMs;
        pendingStartedAtRef.current = performance.now();
        setPendingTimer('memorize');
      }
    }, waitMs);

    return () => window.clearTimeout(id);
  }, [pendingTimer, paused, roundNum, queryIdx]);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const currentTarget = round.queries[queryIdx];

  const handleCellTap = (cellId: number) => {
    if (
      paused ||
      phase !== 'recall' ||
      pendingTimer !== null ||
      statsRef.current.finished ||
      !currentTarget ||
      foundCellIds.includes(cellId)
    ) {
      return;
    }

    const rt = Math.max(80, performance.now() - statsRef.current.shownAt);
    const ok = cellId === currentTarget.cellId;
    let clearedAll = false;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 135 + Math.min(85, statsRef.current.combo * 15);
      sound.hit(statsRef.current.combo);
      clearedAll = onWaveHit();
      setFoundCellIds((prev) => [...prev, cellId]);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      onWaveError?.();
    }

    emitLive();

    if (clearedAll) {
      finishNow();
      return;
    }

    setFeedback({ tappedId: cellId, targetId: currentTarget.cellId, ok });

    if (ok && queryIdx + 1 < round.queries.length) {
      scheduleTimer('nextQuery', 180);
    } else {
      scheduleTimer('nextRound', ok ? 210 : 240);
    }
  };

  const placedByCell = new Map<number, PhotoSymbol>();
  round.placed.forEach((p) => placedByCell.set(p.cellId, p.symbol));

  const cellIconSize = round.gridSize >= 4 ? 30 : 38;

  return (
    <div className="w-full flex flex-col items-center gap-5">
      {/* Cabeçalho dinâmico: Memorize vs Onde estava [ícone]? */}
      {phase === 'memorize' ? (
        <div
          className="h-[52px] px-5 rounded-2xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider"
          style={{
            background: 'var(--accent-glow)',
            color: 'var(--accent)',
            border: '1px solid var(--border-strong)',
          }}
        >
          Memorize as posições
        </div>
      ) : (
        <div
          key={`q-${roundNum}-${queryIdx}`}
          className="h-[52px] px-4 rounded-2xl flex items-center justify-center gap-3 animate-pop"
          style={{
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border-strong)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <span className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
            Onde estava
          </span>
          {currentTarget && (
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${currentTarget.symbol.color}1C` }}
            >
              <PhotoIcon
                id={currentTarget.symbol.id}
                color={currentTarget.symbol.color}
                size={24}
              />
            </span>
          )}
          <span className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
            ?
          </span>
        </div>
      )}

      {/* Grade de cartões */}
      <div
        key={roundNum}
        className="grid gap-2.5 w-full max-w-[324px] animate-pop"
        style={{ gridTemplateColumns: `repeat(${round.gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: round.gridSize * round.gridSize }, (_, cellId) => {
          const sym = placedByCell.get(cellId);
          const isFound = foundCellIds.includes(cellId);
          const isWrongTap = feedback && !feedback.ok && feedback.tappedId === cellId;
          const isMissedHint = feedback && !feedback.ok && feedback.targetId === cellId;
          const isHitFlash = feedback && feedback.ok && feedback.tappedId === cellId;

          const showSymbol =
            Boolean(sym) && (phase === 'memorize' || isFound || isMissedHint);

          return (
            <button
              key={cellId}
              type="button"
              onClick={() => handleCellTap(cellId)}
              disabled={phase !== 'recall' || isFound}
              className={`aspect-square rounded-2xl relative flex items-center justify-center transition-all duration-150 cursor-pointer ${
                isWrongTap ? 'animate-shake' : ''
              }`}
              style={{
                background:
                  isHitFlash || isFound
                    ? 'rgba(16, 185, 129, 0.16)'
                    : isWrongTap
                      ? 'rgba(239, 68, 68, 0.2)'
                      : isMissedHint
                        ? 'var(--accent-glow)'
                        : phase === 'memorize' && sym
                          ? 'var(--bg-card)'
                          : 'var(--bg-card)',
                border:
                  isHitFlash || isFound
                    ? '2px solid var(--ok)'
                    : isWrongTap
                      ? '2px solid var(--err)'
                      : isMissedHint
                        ? '2px dashed var(--accent)'
                        : phase === 'memorize' && sym
                          ? '1.5px solid var(--border-strong)'
                          : '1px solid var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {showSymbol && sym ? (
                <>
                  <div
                    className="w-4/5 h-4/5 rounded-xl flex items-center justify-center"
                    style={{ background: `${sym.color}18` }}
                  >
                    <PhotoIcon id={sym.id} color={sym.color} size={cellIconSize} />
                  </div>
                  {isFound && (
                    <span
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--ok)', color: '#FFFFFF' }}
                    >
                      <Check size={10} strokeWidth={3.5} />
                    </span>
                  )}
                </>
              ) : phase === 'recall' ? (
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: 'var(--bg-subtle)' }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

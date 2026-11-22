import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface SymbolOption {
  glyph: string;
  color?: string;
}

interface OddPair {
  key: string;
  common: SymbolOption;
  odd: SymbolOption;
}

interface OddBoard {
  gridSize: number;
  cells: Array<{ id: number; glyph: string; color?: string; isOdd: boolean }>;
  oddIndex: number;
  pairKey: string;
}

// Nível 1: contraste super óbvio de forma e cor (praticamente 100% de acerto, foco em velocidade)
const EASY_PAIRS: OddPair[] = [
  { key: 'e1', common: { glyph: '●', color: '#2563EB' }, odd: { glyph: '▲', color: '#EA580C' } },
  { key: 'e2', common: { glyph: '■', color: '#059669' }, odd: { glyph: '★', color: '#D97706' } },
  { key: 'e3', common: { glyph: '◆', color: '#7C3AED' }, odd: { glyph: '●', color: '#E11D48' } },
  { key: 'e4', common: { glyph: '▲', color: '#0891B2' }, odd: { glyph: '♥', color: '#E11D48' } },
  { key: 'e5', common: { glyph: '★', color: '#D97706' }, odd: { glyph: '■', color: '#2563EB' } },
  { key: 'e6', common: { glyph: '●', color: '#059669' }, odd: { glyph: '◆', color: '#DB2777' } },
  { key: 'e7', common: { glyph: '■', color: '#4F46E5' }, odd: { glyph: '▲', color: '#16A34A' } },
];

// Nível 2–3: símbolos parecidos na mesma cor neutra de alto contraste
const MEDIUM_PAIRS: OddPair[] = [
  { key: 'm1', common: { glyph: 'O' }, odd: { glyph: 'Q' } },
  { key: 'm2', common: { glyph: 'b' }, odd: { glyph: 'd' } },
  { key: 'm3', common: { glyph: 'E' }, odd: { glyph: 'F' } },
  { key: 'm4', common: { glyph: 'M' }, odd: { glyph: 'W' } },
  { key: 'm5', common: { glyph: 'p' }, odd: { glyph: 'q' } },
  { key: 'm6', common: { glyph: 'C' }, odd: { glyph: 'G' } },
  { key: 'm7', common: { glyph: '5' }, odd: { glyph: 'S' } },
  { key: 'm8', common: { glyph: '▲' }, odd: { glyph: '▼' } },
  { key: 'm9', common: { glyph: '◆' }, odd: { glyph: '■' } },
  { key: 'm10', common: { glyph: '8' }, odd: { glyph: 'B' } },
];

// Nível 4+: distratores muito próximos e variações sutis
const HARD_PAIRS: OddPair[] = [
  { key: 'h1', common: { glyph: 'O' }, odd: { glyph: '0' } },
  { key: 'h2', common: { glyph: 'b' }, odd: { glyph: 'd' } },
  { key: 'h3', common: { glyph: 'E' }, odd: { glyph: 'F' } },
  { key: 'h4', common: { glyph: 'n' }, odd: { glyph: 'h' } },
  { key: 'h5', common: { glyph: 'c' }, odd: { glyph: 'e' } },
  { key: 'h6', common: { glyph: 'v' }, odd: { glyph: 'u' } },
  { key: 'h7', common: { glyph: '◆' }, odd: { glyph: '◇' } },
  { key: 'h8', common: { glyph: '●' }, odd: { glyph: '○' } },
  { key: 'h9', common: { glyph: '◀' }, odd: { glyph: '▶' } },
  { key: 'h10', common: { glyph: '6' }, odd: { glyph: '9' } },
  { key: 'h11', common: { glyph: '3' }, odd: { glyph: '8' } },
  { key: 'h12', common: { glyph: 'P' }, odd: { glyph: 'R' } },
];

// Paleta de cores sutis de alto contraste para níveis 4+ (tom próximo, boa legibilidade nos dois temas)
const SUBTLE_COLORS = ['#2563EB', '#059669', '#7C3AED', '#0891B2', '#D97706', '#E11D48'];

function getGridSizeForLevel(lvl: number): number {
  if (lvl <= 2) return 3;
  if (lvl <= 6) return 4;
  if (lvl <= 11) return 5;
  if (lvl <= 16) return 6;
  return 7;
}

function buildBoard(stage: number, prevPairKey?: string, prevOddIndex?: number): OddBoard {
  const lvl = Math.max(1, Math.floor(stage));
  const gridSize = getGridSizeForLevel(lvl);
  const total = gridSize * gridSize;

  const basePool = lvl <= 1 ? EASY_PAIRS : lvl <= 3 ? MEDIUM_PAIRS : HARD_PAIRS;
  const filtered = basePool.filter((p) => p.key !== prevPairKey);
  const pair = filtered[Math.floor(Math.random() * filtered.length)] ?? basePool[0];

  // Em níveis 2+, sorteia se inverte comum/diferente para variar mais ainda
  const swap = lvl >= 2 && Math.random() < 0.5;
  const commonSym = swap ? pair.odd : pair.common;
  const oddSym = swap ? pair.common : pair.odd;

  // Nos níveis 4+, aplica uma mesma cor elegante em toda a grade (em metade das rodadas)
  const sharedColor =
    lvl >= 4 && Math.random() < 0.55
      ? SUBTLE_COLORS[Math.floor(Math.random() * SUBTLE_COLORS.length)]
      : undefined;

  let oddIndex = Math.floor(Math.random() * total);
  if (prevOddIndex !== undefined && total > 1 && oddIndex === prevOddIndex) {
    oddIndex = (oddIndex + 1 + Math.floor(Math.random() * (total - 1))) % total;
  }

  const cells = Array.from({ length: total }, (_, id) => {
    const isOdd = id === oddIndex;
    const sym = isOdd ? oddSym : commonSym;
    return {
      id,
      glyph: sym.glyph,
      color: sym.color ?? sharedColor,
      isOdd,
    };
  });

  return {
    gridSize,
    cells,
    oddIndex,
    pairKey: pair.key,
  };
}

export function OddOneOutGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [roundId, setRoundId] = useState(0);
  const [board, setBoard] = useState<OddBoard>(() => buildBoard(config.stage));
  const [hitCellId, setHitCellId] = useState<number | null>(null);
  const [wrongCellId, setWrongCellId] = useState<number | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const pauseStartedAtRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
    finished: false,
  });

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const finishNow = () => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    clearTimers();
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
      const pausedMs = performance.now() - pauseStartedAtRef.current;
      statsRef.current.shownAt += pausedMs;
      pauseStartedAtRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleTap = (cellId: number, isOdd: boolean) => {
    if (hitCellId !== null || paused || statsRef.current.finished) return;

    if (isOdd) {
      const now = performance.now();
      const rt = Math.max(80, now - statsRef.current.shownAt);
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 120 + Math.min(85, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);

      const clearedAll = onWaveHit();
      emitLive();

      if (clearedAll) {
        finishNow();
        return;
      }

      setHitCellId(cellId);
      setWrongCellId(null);
      const t = window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setHitCellId(null);
        setBoard((prev) => buildBoard(configRef.current.stage, prev.pairKey, prev.oddIndex));
        setRoundId((n) => n + 1);
        statsRef.current.shownAt = performance.now();
      }, 115);
      timersRef.current.push(t);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      onWaveError?.();
      emitLive();

      setWrongCellId(cellId);
      const t = window.setTimeout(() => {
        setWrongCellId((cur) => (cur === cellId ? null : cur));
      }, 200);
      timersRef.current.push(t);
    }
  };

  const glyphSizeClass =
    board.gridSize >= 7
      ? 'text-base'
      : board.gridSize === 6
        ? 'text-xl'
        : board.gridSize === 5
          ? 'text-2xl'
          : board.gridSize === 4
            ? 'text-3xl'
            : 'text-4xl';

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: 'var(--bg-subtle)',
          color: 'var(--accent)',
          border: '1px solid var(--border)',
        }}
      >
        Toque no diferente
      </div>

      <div
        key={roundId}
        className={`grid ${board.gridSize >= 6 ? 'gap-1.5' : 'gap-2.5'} w-full max-w-[344px] animate-pop`}
        style={{ gridTemplateColumns: `repeat(${board.gridSize}, minmax(0, 1fr))` }}
      >
        {board.cells.map((cell) => {
          const isHit = hitCellId === cell.id;
          const isWrong = wrongCellId === cell.id;
          return (
            <button
              key={cell.id}
              type="button"
              onClick={() => handleTap(cell.id, cell.isOdd)}
              className={`aspect-square rounded-2xl font-black flex items-center justify-center transition-all cursor-pointer surface-card-click ${glyphSizeClass} ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                background: isHit
                  ? 'rgba(16, 185, 129, 0.22)'
                  : isWrong
                    ? 'rgba(239, 68, 68, 0.22)'
                    : 'var(--bg-card)',
                border: isHit
                  ? '2px solid var(--ok)'
                  : isWrong
                    ? '2px solid var(--err)'
                    : '1px solid var(--border)',
                color: isHit ? 'var(--ok)' : isWrong ? 'var(--err)' : cell.color ?? 'var(--text)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {cell.glyph}
            </button>
          );
        })}
      </div>
    </div>
  );
}

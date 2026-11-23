import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface SymbolSet {
  target: string;
  distractors: string[];
}

/** Pares de alto contraste visual para o Nível 1 ultrabásico */
const EASY_SETS: SymbolSet[] = [
  { target: '★', distractors: ['●'] },
  { target: '▲', distractors: ['■'] },
  { target: '◆', distractors: ['○'] },
  { target: '●', distractors: ['✕'] },
  { target: '■', distractors: ['●'] },
  { target: '✚', distractors: ['●'] },
];

/** Pares com similaridade visual para Níveis 2..10 */
const SETS: SymbolSet[] = [
  { target: 'b', distractors: ['d', 'p', 'q'] },
  { target: 'O', distractors: ['Q', 'C', '0'] },
  { target: 'E', distractors: ['F', '3', 'B'] },
  { target: '▲', distractors: ['▼', '◀', '▶'] },
  { target: 'M', distractors: ['W', 'N', 'H'] },
  { target: '5', distractors: ['S', '2', '8'] },
  { target: '◆', distractors: ['◇', '■', '●'] },
];

/** Pares de altíssima similaridade (justos e legíveis) para Níveis 13..20 */
const HARD_SETS: SymbolSet[] = [
  { target: 'b', distractors: ['d', 'p', 'q', '6'] },
  { target: 'O', distractors: ['0', 'Q', 'D', 'C'] },
  { target: 'n', distractors: ['m', 'h', 'u', 'r'] },
  { target: 'E', distractors: ['F', 'B', '3', '8'] },
  { target: '6', distractors: ['9', '8', '0', 'b'] },
  { target: 'c', distractors: ['e', 'o', 'a', 's'] },
  { target: '◀', distractors: ['▶', '▲', '▼', '◁'] },
  { target: 'M', distractors: ['W', 'N', 'H', 'V'] },
];

interface Cell {
  id: number;
  char: string;
  isTarget: boolean;
  found: boolean;
}

function buildBoard(
  stage: number,
  gridSize: number,
  targetCount: number,
  boardNum: number,
  prevTarget?: string
): { target: string; gridSize: number; cells: Cell[] } {
  const lvl = Math.max(1, Math.floor(stage));
  const isEasy = lvl <= 2;
  const effectiveGrid = lvl <= 2 ? 3 : lvl <= 6 ? 4 : lvl <= 12 ? 5 : lvl <= 16 ? 6 : Math.max(gridSize, 7);
  const total = effectiveGrid * effectiveGrid;
  // Nv.1: apenas 1 alvo em grade 3×3 (ultrabásico e prazeroso) | Nv.18-20: 5 alvos em 7×7
  const count =
    lvl <= 1 ? 1 : lvl <= 3 ? 2 : lvl <= 10 ? 3 : lvl <= 16 ? 4 : Math.min(5, Math.max(4, targetCount));

  const pool = isEasy ? EASY_SETS : lvl <= 12 ? SETS : HARD_SETS;
  const candidates = pool.filter((s) => s.target !== prevTarget);
  const pickFrom = candidates.length > 0 ? candidates : pool;
  const set = pickFrom[(boardNum + Math.floor(Math.random() * pickFrom.length)) % pickFrom.length];

  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const targetIdx = new Set(indices.slice(0, count));

  const cells: Cell[] = Array.from({ length: total }, (_, i) => {
    const isTarget = targetIdx.has(i);
    return {
      id: i,
      char: isTarget
        ? set.target
        : set.distractors[Math.floor(Math.random() * set.distractors.length)],
      isTarget,
      found: false,
    };
  });

  return { target: set.target, gridSize: effectiveGrid, cells };
}

export function VisualSearchGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [boardNum, setBoardNum] = useState(0);
  const [board, setBoard] = useState(() => buildBoard(config.stage, config.gridSize, config.targetCount, 0));
  const [wrongId, setWrongId] = useState<number | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    lastTapAt: performance.now(),
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

  const emitLive = (remaining: number) => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    const acc = total > 0 ? Math.round((s.correct / total) * 100) : 100;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: acc,
      combo: s.combo,
      statusTag: `Alvos: ${remaining}`,
    });
  };

  const handleTap = (cell: Cell) => {
    if (cell.found || paused || statsRef.current.finished) return;
    const now = performance.now();
    const rt = now - statsRef.current.lastTapAt;
    statsRef.current.lastTapAt = now;

    if (cell.isTarget) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 100 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);

      const nextCells = board.cells.map((c) => (c.id === cell.id ? { ...c, found: true } : c));
      const remaining = nextCells.filter((c) => c.isTarget && !c.found).length;

      if (remaining === 0) {
        const clearedAll = onWaveHit();
        if (clearedAll) {
          emitLive(0);
          finishNow();
          return;
        }
        const nextNum = boardNum + 1;
        setBoardNum(nextNum);
        // Usa a grade/alvos da onda atual (escala intra-partida!)
        const nb = buildBoard(
          configRef.current.stage,
          configRef.current.gridSize,
          configRef.current.targetCount,
          nextNum,
          board.target
        );
        setBoard(nb);
        emitLive(nb.cells.filter((c) => c.isTarget).length);
      } else {
        setBoard({ ...board, cells: nextCells });
        emitLive(remaining);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      setWrongId(cell.id);
      setTimeout(() => setWrongId(null), 260);
      emitLive(board.cells.filter((c) => c.isTarget && !c.found).length);
      onWaveError?.();
    }
  };

  const remaining = board.cells.filter((c) => c.isTarget && !c.found).length;

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex items-center gap-3 px-4 py-2 rounded-full" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Alvo</span>
        <span className="text-2xl font-black leading-none" style={{ color: 'var(--accent)' }}>{board.target}</span>
        <span className="text-xs font-bold tabular" style={{ color: 'var(--warn)' }}>×{remaining}</span>
      </div>

      <div
        className="grid gap-2 w-full max-w-[330px]"
        style={{ gridTemplateColumns: `repeat(${board.gridSize}, minmax(0, 1fr))` }}
      >
        {board.cells.map((cell) => {
          const isWrong = wrongId === cell.id;
          return (
            <button
              key={`${boardNum}-${cell.id}`}
              onClick={() => handleTap(cell)}
              className={`aspect-square rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer ${
                board.gridSize >= 7 ? 'text-base' : board.gridSize === 6 ? 'text-lg' : board.gridSize === 5 ? 'text-xl' : 'text-2xl'
              } ${isWrong ? 'animate-shake' : ''}`}
              style={{
                background: cell.found
                  ? 'rgba(52, 211, 153, 0.22)'
                  : isWrong
                    ? 'rgba(251, 113, 133, 0.25)'
                    : 'var(--bg-card)',
                border: cell.found
                  ? '2px solid var(--ok)'
                  : isWrong
                    ? '2px solid var(--err)'
                    : '1px solid var(--border)',
                color: cell.found ? 'var(--ok)' : 'var(--text)',
                opacity: cell.found ? 0.55 : 1,
              }}
            >
              {cell.char}
            </button>
          );
        })}
      </div>
    </div>
  );
}

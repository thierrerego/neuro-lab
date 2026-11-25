import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface ShapeDef {
  id: string;
  symbol: string;
  label: string;
}

interface ColorDef {
  id: string;
  hex: string;
  label: string;
}

const SHAPES: ShapeDef[] = [
  { id: 'circle', symbol: '●', label: 'Círculo' },
  { id: 'square', symbol: '■', label: 'Quadrado' },
  { id: 'triangle', symbol: '▲', label: 'Triângulo' },
  { id: 'diamond', symbol: '◆', label: 'Losango' },
  { id: 'star', symbol: '★', label: 'Estrela' },
  { id: 'hex', symbol: '⬢', label: 'Hexágono' },
];

const COLORS: ColorDef[] = [
  { id: 'blue', hex: '#2563EB', label: 'Azul' },
  { id: 'red', hex: '#E11D48', label: 'Vermelho' },
  { id: 'green', hex: '#059669', label: 'Verde' },
  { id: 'amber', hex: '#D97706', label: 'Amarelo' },
  { id: 'purple', hex: '#7C3AED', label: 'Roxo' },
];

interface Cell {
  id: number;
  shape: ShapeDef;
  color: ColorDef;
  isTarget: boolean;
  found: boolean;
}

function buildBoard(stage: number) {
  const lvl = Math.max(1, Math.min(20, Math.floor(stage)));
  // Grade vertical otimizada para celular: no máximo 5 colunas, crescendo em altura (até 5x7 = 35 itens)
  // Assim os símbolos continuam grandes e confortáveis para o dedo mesmo no ritmo máximo!
  const cols = lvl <= 2 ? 3 : lvl <= 8 ? 4 : 5;
  const rows = lvl <= 2 ? 3 : lvl <= 5 ? 4 : lvl <= 8 ? 5 : lvl <= 13 ? 5 : lvl <= 17 ? 6 : 7;
  const total = cols * rows;
  const targetCount = lvl <= 2 ? 1 : lvl <= 7 ? 2 : lvl <= 14 ? 3 : 4;

  const shapePool = SHAPES.slice(0, lvl <= 3 ? 3 : lvl <= 9 ? 4 : lvl <= 15 ? 5 : 6);
  const colorPool = COLORS.slice(0, lvl <= 3 ? 3 : lvl <= 9 ? 4 : 5);

  const targetShape = shapePool[Math.floor(Math.random() * shapePool.length)];
  const targetColor = colorPool[Math.floor(Math.random() * colorPool.length)];

  const otherShapes = shapePool.filter((s) => s.id !== targetShape.id);
  const otherColors = colorPool.filter((c) => c.id !== targetColor.id);

  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const targetSet = new Set(indices.slice(0, targetCount));

  // Conjunção: distratores compartilham OU a forma OU a cor do alvo (mais difícil em níveis altos)
  const conjProb = Math.min(0.95, 0.45 + (lvl - 1) * 0.028);

  const cells: Cell[] = Array.from({ length: total }, (_, i) => {
    if (targetSet.has(i)) {
      return { id: i, shape: targetShape, color: targetColor, isTarget: true, found: false };
    }
    const r = Math.random();
    if (r < conjProb * 0.5) {
      // Mesma forma, outra cor
      return {
        id: i,
        shape: targetShape,
        color: otherColors[Math.floor(Math.random() * otherColors.length)],
        isTarget: false,
        found: false,
      };
    }
    if (r < conjProb) {
      // Mesma cor, outra forma
      return {
        id: i,
        shape: otherShapes[Math.floor(Math.random() * otherShapes.length)],
        color: targetColor,
        isTarget: false,
        found: false,
      };
    }
    return {
      id: i,
      shape: otherShapes[Math.floor(Math.random() * otherShapes.length)],
      color: otherColors[Math.floor(Math.random() * otherColors.length)],
      isTarget: false,
      found: false,
    };
  });

  return { targetShape, targetColor, gridSize: cols, cols, rows, cells };
}

export function ConjunctionSearchGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [board, setBoard] = useState(() => buildBoard(config.stage));
  const [wrongId, setWrongId] = useState<number | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    boardStart: performance.now(),
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
    if (!paused) statsRef.current.boardStart = performance.now();
  }, [paused]);

  const emitLive = (remaining: number) => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
      statusTag: `Alvos: ${remaining}`,
    });
  };

  const handleTap = (cell: Cell) => {
    if (paused || cell.found || statsRef.current.finished) return;

    if (cell.isTarget) {
      const now = performance.now();
      const rt = now - statsRef.current.boardStart;
      statsRef.current.boardStart = now;
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 120 + Math.min(80, statsRef.current.combo * 12);
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
        const nb = buildBoard(configRef.current.stage);
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
      onWaveError?.();
      setWrongId(cell.id);
      setTimeout(() => setWrongId(null), 240);
      emitLive(board.cells.filter((c) => c.isTarget && !c.found).length);
    }
  };

  const remainingCount = board.cells.filter((c) => c.isTarget && !c.found).length;
  const fontSize =
    board.cols >= 5 ? 'text-2xl sm:text-3xl' : board.cols === 4 ? 'text-3xl' : 'text-4xl';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="flex items-center gap-3 px-5 py-2.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
      >
        <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
          Alvo exato
        </span>
        <span
          className="text-3xl leading-none font-black"
          style={{ color: board.targetColor.hex }}
        >
          {board.targetShape.symbol}
        </span>
        <span className="text-sm font-extrabold tabular" style={{ color: 'var(--accent)' }}>
          ×{remainingCount}
        </span>
      </div>

      <div
        className="grid gap-2 w-full max-w-[430px]"
        style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
      >
        {board.cells.map((cell) => {
          const isWrong = wrongId === cell.id;
          return (
            <button
              key={cell.id}
              type="button"
              onClick={() => handleTap(cell)}
              disabled={cell.found}
              className={`aspect-square rounded-xl flex items-center justify-center font-black transition-all cursor-pointer select-none ${fontSize} ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                background: cell.found
                  ? 'rgba(16, 185, 129, 0.16)'
                  : isWrong
                    ? 'rgba(239, 68, 68, 0.18)'
                    : 'var(--bg-subtle)',
                border: cell.found
                  ? '1.5px solid var(--ok)'
                  : isWrong
                    ? '1.5px solid var(--err)'
                    : '1px solid var(--border)',
                color: cell.color.hex,
                opacity: cell.found ? 0.35 : 1,
              }}
            >
              {cell.shape.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, CircleDot, Flag, Flame } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface BoardData {
  size: number;
  start: number;
  goal: number;
  hazards: Set<number>;
  previewMs: number;
}

function getSpec(stage: number): { size: number; hazardRatio: number; previewMs: number } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return { size: 3, hazardRatio: 0.28, previewMs: 1900 };
  if (lvl <= 5) return { size: 4, hazardRatio: 0.34, previewMs: 2100 };
  if (lvl <= 10) return { size: 5, hazardRatio: 0.38, previewMs: 2300 };
  return { size: 6, hazardRatio: 0.42, previewMs: 2500 };
}

function generateBoard(stage: number): BoardData {
  const { size, hazardRatio, previewMs } = getSpec(stage);
  const start = 0;
  const goal = size * size - 1;

  // Gera uma rota segura garantida de (0,0) até (size-1, size-1)
  const safePath = new Set<number>([start]);
  let r = 0;
  let c = 0;
  while (r < size - 1 || c < size - 1) {
    const canDown = r < size - 1;
    const canRight = c < size - 1;
    if (canDown && canRight) {
      if (Math.random() < 0.5) r++;
      else c++;
    } else if (canDown) {
      r++;
    } else {
      c++;
    }
    safePath.add(r * size + c);
  }

  // Preenche armadilhas apenas fora da rota segura
  const candidates: number[] = [];
  for (let i = 0; i < size * size; i++) {
    if (!safePath.has(i)) candidates.push(i);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const desiredHazards = Math.max(
    2,
    Math.min(candidates.length, Math.round(size * size * hazardRatio))
  );
  const hazards = new Set<number>(candidates.slice(0, desiredHazards));

  return { size, start, goal, hazards, previewMs };
}

function isAdjacent(a: number, b: number, size: number): boolean {
  const r1 = Math.floor(a / size);
  const c1 = a % size;
  const r2 = Math.floor(b / size);
  const c2 = b % size;
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

export function PassTheBallGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [board, setBoard] = useState<BoardData>(() => generateBoard(config.stage));
  const [phase, setPhase] = useState<'memorize' | 'play' | 'feedback'>('memorize');
  const [currentCell, setCurrentCell] = useState<number>(0);
  const [visited, setVisited] = useState<number[]>([0]);
  const [hitHazard, setHitHazard] = useState<number | null>(null);

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
    }, board.previewMs);
    return () => window.clearTimeout(id);
  }, [phase, board, paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const spawnNext = (delayMs: number) => {
    setPhase('feedback');
    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      const next = generateBoard(configRef.current.stage);
      setBoard(next);
      setCurrentCell(next.start);
      setVisited([next.start]);
      setHitHazard(null);
      setPhase('memorize');
    }, delayMs);
  };

  const handleCellTap = (idx: number) => {
    if (paused || phase !== 'play' || statsRef.current.finished) return;
    if (!isAdjacent(currentCell, idx, board.size)) return;

    const now = performance.now();
    const rt = Math.max(100, now - statsRef.current.stepStart);
    statsRef.current.stepStart = now;

    if (board.hazards.has(idx)) {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      setHitHazard(idx);
      emitLive();
      onWaveError?.();
      spawnNext(650);
      return;
    }

    statsRef.current.correct++;
    statsRef.current.combo++;
    statsRef.current.rts.push(rt);
    statsRef.current.rawPoints += 110 + Math.min(80, statsRef.current.combo * 12);
    sound.hit(statsRef.current.combo);

    setCurrentCell(idx);
    setVisited((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
    emitLive();

    if (idx === board.goal) {
      const clearedAll = onWaveHit();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 200);
        return;
      }
      spawnNext(420);
    }
  };

  // Arrastar o dedo: ao passar por uma casa vizinha, a bola anda (o toque casa a casa continua valendo)
  const draggingRef = useRef(false);
  const lastDragCellRef = useRef<number | null>(null);
  const cellFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = el?.closest('[data-cell]') as HTMLElement | null;
    if (!cell) return null;
    const idx = Number(cell.dataset.cell);
    return Number.isFinite(idx) ? idx : null;
  };
  const handlePointerDown = (e: ReactPointerEvent) => {
    if (phase !== 'play') return;
    draggingRef.current = true;
    lastDragCellRef.current = cellFromPoint(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!draggingRef.current || phase !== 'play') return;
    const idx = cellFromPoint(e.clientX, e.clientY);
    if (idx === null || idx === lastDragCellRef.current) return;
    lastDragCellRef.current = idx;
    if (idx !== currentCell && isAdjacent(currentCell, idx, board.size)) {
      handleCellTap(idx);
    }
  };
  const stopDrag = () => {
    draggingRef.current = false;
    lastDragCellRef.current = null;
  };

  const maxW = board.size <= 3 ? 'max-w-[280px]' : board.size <= 4 ? 'max-w-[320px]' : 'max-w-[356px]';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: phase === 'memorize' ? 'rgba(239, 68, 68, 0.14)' : 'var(--bg-subtle)',
          color: phase === 'memorize' ? 'var(--err)' : 'var(--accent)',
          border: '1px solid var(--border)',
        }}
      >
        {phase === 'memorize'
          ? 'Memorize os perigos'
          : hitHazard !== null
            ? 'Ops! Armadilha!'
            : 'Leve a bola até a bandeira'}
      </div>

      <div
        className={`grid gap-2 w-full ${maxW}`}
        style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))`, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onPointerLeave={stopDrag}
      >
        {Array.from({ length: board.size * board.size }, (_, idx) => {
          const isBall = idx === currentCell;
          const isGoal = idx === board.goal;
          const isHazard = board.hazards.has(idx);
          const showHazard = (phase === 'memorize' || hitHazard !== null) && isHazard;
          const isVisited = visited.includes(idx);
          const canMove = phase === 'play' && isAdjacent(currentCell, idx, board.size);

          return (
            <button
              key={idx}
              type="button"
              data-cell={idx}
              onClick={() => handleCellTap(idx)}
              disabled={phase !== 'play'}
              className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                hitHazard === idx ? 'animate-shake' : ''
              }`}
              style={{
                fontSize: board.size >= 6 ? '1.25rem' : board.size === 5 ? '1.5rem' : '1.9rem',
                background:
                  hitHazard === idx
                    ? 'rgba(239, 68, 68, 0.28)'
                    : showHazard
                      ? 'rgba(239, 68, 68, 0.14)'
                      : isBall
                        ? 'var(--accent-glow)'
                        : isVisited
                          ? 'rgba(16, 185, 129, 0.16)'
                          : isGoal
                            ? 'rgba(245, 158, 11, 0.14)'
                            : 'var(--bg-card)',
                border:
                  hitHazard === idx
                    ? '2px solid var(--err)'
                    : showHazard
                      ? '1.5px solid rgba(239, 68, 68, 0.5)'
                      : isBall
                        ? '2px solid var(--accent)'
                        : isVisited
                          ? '1.5px solid var(--ok)'
                          : canMove
                            ? '1.5px solid var(--border-strong)'
                            : '1px solid var(--border)',
              }}
            >
              {hitHazard === idx ? (
                <Flame size={22} style={{ color: 'var(--err)' }} fill="currentColor" />
              ) : isBall ? (
                <CircleDot size={24} style={{ color: 'var(--accent)' }} />
              ) : isGoal ? (
                <Flag size={22} style={{ color: '#D97706' }} fill="currentColor" />
              ) : showHazard ? (
                <AlertTriangle size={20} style={{ color: 'var(--err)' }} />
              ) : isVisited ? (
                <span className="w-3.5 h-3.5 rounded-full" style={{ background: 'var(--ok)' }} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

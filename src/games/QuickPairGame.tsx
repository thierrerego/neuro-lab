import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

const EASY_GLYPHS = ['★', '●', '▲', '■', '◆', '✚', '☀', '☾', '♥', '♠', '♣', '✿'];
const HARD_GLYPHS = [
  'b', 'd', 'p', 'q', 'O', '0', 'Q', 'C', 'E', 'F', 'B', '3',
  'M', 'W', 'N', 'H', 'n', 'm', 'u', 'v', '6', '9', '8', '5',
];

interface Tile {
  id: number;
  glyph: string;
  isPair: boolean;
}

function buildPairBoard(stage: number): { cols: number; tiles: Tile[] } {
  const lvl = Math.max(1, Math.min(20, Math.floor(stage)));
  const total = lvl <= 2 ? 6 : lvl <= 6 ? 9 : lvl <= 11 ? 12 : lvl <= 16 ? 16 : 20;
  const cols = total <= 6 ? 3 : total <= 9 ? 3 : 4;
  const pool = [...(lvl <= 6 ? EASY_GLYPHS : HARD_GLYPHS)].sort(() => Math.random() - 0.5);

  const pairGlyph = pool[0];
  const distractors = pool.slice(1, total - 1);
  const raw = [pairGlyph, pairGlyph, ...distractors];

  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }

  return {
    cols,
    tiles: raw.map((glyph, id) => ({ id, glyph, isPair: glyph === pairGlyph })),
  };
}

export function QuickPairGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [board, setBoard] = useState(() => buildPairBoard(config.stage));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [wrongIds, setWrongIds] = useState<number[]>([]);

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

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleTap = (tile: Tile) => {
    if (paused || statsRef.current.finished) return;
    if (selectedId === tile.id) {
      setSelectedId(null);
      return;
    }

    if (selectedId === null) {
      sound.tap();
      setSelectedId(tile.id);
      return;
    }

    const first = board.tiles.find((t) => t.id === selectedId);
    if (!first) {
      setSelectedId(tile.id);
      return;
    }

    if (first.glyph === tile.glyph) {
      const rt = performance.now() - statsRef.current.boardStart;
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      emitLive();

      const clearedAll = onWaveHit();
      setSelectedId(null);
      if (clearedAll) {
        finishNow();
        return;
      }
      setBoard(buildPairBoard(configRef.current.stage));
      statsRef.current.boardStart = performance.now();
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      onWaveError?.();
      emitLive();
      setWrongIds([first.id, tile.id]);
      setSelectedId(null);
      window.setTimeout(() => setWrongIds([]), 260);
    }
  };

  const fontSize = board.tiles.length >= 16 ? 'text-xl' : board.tiles.length >= 12 ? 'text-2xl' : 'text-3xl';

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
      >
        Toque nos 2 símbolos idênticos
      </div>

      <div
        className="grid gap-2 w-full max-w-[330px]"
        style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
      >
        {board.tiles.map((tile) => {
          const isSel = selectedId === tile.id;
          const isWrong = wrongIds.includes(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleTap(tile)}
              className={`aspect-square rounded-2xl flex items-center justify-center font-black cursor-pointer select-none transition-all ${fontSize} ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                background: isSel
                  ? 'var(--accent-glow)'
                  : isWrong
                    ? 'rgba(239, 68, 68, 0.18)'
                    : 'var(--bg-subtle)',
                border: isSel
                  ? '2px solid var(--accent)'
                  : isWrong
                    ? '2px solid var(--err)'
                    : '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              {tile.glyph}
            </button>
          );
        })}
      </div>
    </div>
  );
}

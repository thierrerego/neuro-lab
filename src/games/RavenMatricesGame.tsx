import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond';
type FillMode = 'solid' | 'outline' | 'striped';

interface Glyph {
  shape: ShapeKind;
  color: string;
  rotation: number;
  count: number;
  fill: FillMode;
}

interface MatrixPuzzle {
  cells: (Glyph | null)[];
  options: Glyph[];
  answerIdx: number;
}

const SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond'];
const COLORS = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24'];
const FILLS: FillMode[] = ['solid', 'outline', 'striped'];

function makePuzzle(effectiveDiff: number): MatrixPuzzle {
  const sOffset = Math.floor(Math.random() * SHAPES.length);
  const cOffset = Math.floor(Math.random() * COLORS.length);
  const fOffset = Math.floor(Math.random() * FILLS.length);
  const rotateRule = effectiveDiff >= 3;
  const countRule = effectiveDiff >= 4;
  const fillRule = effectiveDiff >= 2;

  const glyphAt = (r: number, c: number): Glyph => ({
    shape: SHAPES[(sOffset + r + (effectiveDiff >= 5 ? c : 0)) % SHAPES.length],
    color: COLORS[(cOffset + c) % COLORS.length],
    rotation: rotateRule ? (r * 90 + c * 45) % 360 : 0,
    count: countRule ? ((r + c) % 3) + 1 : 1,
    fill: fillRule ? FILLS[(fOffset + r + c) % FILLS.length] : 'solid',
  });

  const cells: (Glyph | null)[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push(r === 2 && c === 2 ? null : glyphAt(r, c));
    }
  }

  const answer = glyphAt(2, 2);
  const distractors: Glyph[] = [
    { ...answer, shape: SHAPES[(SHAPES.indexOf(answer.shape) + 1) % SHAPES.length] },
    { ...answer, color: COLORS[(COLORS.indexOf(answer.color) + 1) % COLORS.length] },
    {
      ...answer,
      fill: FILLS[(FILLS.indexOf(answer.fill) + 1) % FILLS.length],
      rotation: (answer.rotation + 90) % 360,
      count: answer.count === 3 ? 1 : answer.count + 1,
    },
  ];

  const tagged = [answer, ...distractors].map((g, idx) => ({ g, ok: idx === 0 }));
  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }

  return {
    cells,
    options: tagged.map((t) => t.g),
    answerIdx: tagged.findIndex((t) => t.ok),
  };
}

function GlyphSvg({ glyph }: { glyph: Glyph }) {
  const fillVal = glyph.fill === 'solid' ? glyph.color : glyph.fill === 'striped' ? `${glyph.color}55` : 'none';
  const offsets = glyph.count === 1 ? [0] : glyph.count === 2 ? [-13, 13] : [-17, 0, 17];
  const scale = glyph.count === 1 ? 1 : glyph.count === 2 ? 0.65 : 0.5;

  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12">
      {offsets.map((dx, i) => (
        <g key={i} transform={`translate(${32 + dx}, 32) rotate(${glyph.rotation}) scale(${scale})`}>
          {glyph.shape === 'circle' && (
            <circle cx="0" cy="0" r="18" fill={fillVal} stroke={glyph.color} strokeWidth="3.2" />
          )}
          {glyph.shape === 'square' && (
            <rect x="-16" y="-16" width="32" height="32" rx="4" fill={fillVal} stroke={glyph.color} strokeWidth="3.2" />
          )}
          {glyph.shape === 'triangle' && (
            <polygon points="0,-19 18,15 -18,15" fill={fillVal} stroke={glyph.color} strokeWidth="3.2" strokeLinejoin="round" />
          )}
          {glyph.shape === 'diamond' && (
            <polygon points="0,-19 18,0 0,19 -18,0" fill={fillVal} stroke={glyph.color} strokeWidth="3.2" strokeLinejoin="round" />
          )}
          {glyph.rotation !== 0 && <circle cx="0" cy="-12" r="2.6" fill="#ffffff" />}
        </g>
      ))}
    </svg>
  );
}

export function RavenMatricesGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [puzzle, setPuzzle] = useState(() => makePuzzle(config.stage));
  const [feedback, setFeedback] = useState<{ idx: number; ok: boolean } | null>(null);

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

  const handlePick = (idx: number) => {
    if (feedback || paused || statsRef.current.finished) return;
    const rt = performance.now() - statsRef.current.shownAt;
    const ok = idx === puzzle.answerIdx;
    let clearedAll = false;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 180 + statsRef.current.combo * 20;
      sound.hit(statsRef.current.combo);
      clearedAll = onWaveHit();
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      onWaveError?.();
    }

    const tot = statsRef.current.correct + statsRef.current.commission;
    onLiveUpdate({
      score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: Math.round((statsRef.current.correct / tot) * 100),
      combo: statsRef.current.combo,
    });

    if (clearedAll) {
      finishNow();
      return;
    }

    setFeedback({ idx, ok });
    setTimeout(() => {
      if (statsRef.current.finished) return;
      setFeedback(null);
      setPuzzle(makePuzzle(configRef.current.stage));
      statsRef.current.shownAt = performance.now();
    }, 240);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="grid grid-cols-3 gap-1.5 w-full max-w-[235px] p-2 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        {puzzle.cells.map((cell, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl flex items-center justify-center"
            style={{
              background: cell ? 'var(--bg-card)' : 'var(--accent-glow)',
              border: cell ? '1px solid var(--border)' : '2px dashed var(--accent)',
            }}
          >
            {cell ? <GlyphSvg glyph={cell} /> : <span className="text-2xl font-black" style={{ color: 'var(--accent)' }}>?</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 w-full max-w-[310px]">
        {puzzle.options.map((opt, idx) => {
          const isFb = feedback?.idx === idx;
          return (
            <button
              key={idx}
              onClick={() => handlePick(idx)}
              className="aspect-square rounded-2xl flex items-center justify-center transition-all cursor-pointer surface-card-click"
              style={{
                background: isFb
                  ? feedback.ok
                    ? 'rgba(52, 211, 153, 0.28)'
                    : 'rgba(251, 113, 133, 0.32)'
                  : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${feedback.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1px solid var(--border)',
              }}
            >
              <GlyphSvg glyph={opt} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

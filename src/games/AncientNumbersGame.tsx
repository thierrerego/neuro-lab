import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface PlacedNumber {
  val: number;
  xPct: number;
  yPct: number;
  scale: number;
  rotate: number;
  tint: string;
}

const TINTS = ['#0EA5E9', '#6366F1', '#8B5CF6', '#D97706', '#059669', '#E11D48'];

function getCount(stage: number): number {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return 6;
  if (lvl <= 5) return 8;
  if (lvl <= 9) return 10;
  if (lvl <= 14) return 12;
  return 15;
}

function createBoard(stage: number): PlacedNumber[] {
  const count = getCount(stage);
  const cols = count <= 6 ? 3 : count <= 12 ? 4 : 5;
  const rows = Math.ceil(count / cols);

  const slots: { r: number; c: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({ r, c });
    }
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  return Array.from({ length: count }, (_, idx) => {
    const slot = slots[idx];
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    const jitterX = (Math.random() - 0.5) * cellW * 0.28;
    const jitterY = (Math.random() - 0.5) * cellH * 0.28;
    return {
      val: idx + 1,
      xPct: Math.max(11, Math.min(89, (slot.c + 0.5) * cellW + jitterX)),
      yPct: Math.max(12, Math.min(88, (slot.r + 0.5) * cellH + jitterY)),
      scale: 0.9 + Math.random() * 0.26,
      rotate: Math.round((Math.random() - 0.5) * 16),
      tint: TINTS[idx % TINTS.length],
    };
  });
}

export function AncientNumbersGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [items, setItems] = useState<PlacedNumber[]>(() => createBoard(config.stage));
  const [nextExpected, setNextExpected] = useState(1);
  const [wrongVal, setWrongVal] = useState<number | null>(null);

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

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleTap = (val: number) => {
    if (paused || statsRef.current.finished || val < nextExpected) return;

    const now = performance.now();
    const rt = Math.max(90, now - statsRef.current.stepStart);
    statsRef.current.stepStart = now;

    if (val === nextExpected) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 110 + Math.min(70, statsRef.current.combo * 10);
      sound.hit(statsRef.current.combo);
      emitLive();

      if (val >= items.length) {
        const clearedAll = onWaveHit();
        if (clearedAll) {
          window.setTimeout(() => finishNow(), 160);
          return;
        }
        setItems(createBoard(configRef.current.stage));
        setNextExpected(1);
        statsRef.current.stepStart = performance.now();
      } else {
        setNextExpected(val + 1);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 30);
      sound.miss();
      setWrongVal(val);
      window.setTimeout(() => setWrongVal(null), 260);
      emitLive();
      onWaveError?.();
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-3.5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full tabular"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Próximo: <span className="text-base ml-1">{nextExpected}</span> / {items.length}
      </div>

      <div
        className="relative w-full max-w-[356px] h-[300px] rounded-3xl overflow-hidden"
        style={{ background: 'var(--bg-subtle)', border: '1.5px solid var(--border)' }}
      >
        {items.map((item) => {
          const isDone = item.val < nextExpected;
          const isWrong = wrongVal === item.val;

          return (
            <button
              key={item.val}
              type="button"
              disabled={isDone}
              onClick={() => handleTap(item.val)}
              className={`absolute w-12 h-12 rounded-2xl flex items-center justify-center font-black tabular transition-all duration-150 cursor-pointer select-none ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                left: `${item.xPct}%`,
                top: `${item.yPct}%`,
                transform: `translate(-50%, -50%) scale(${isDone ? 0.72 : item.scale}) rotate(${item.rotate}deg)`,
                fontSize: '1.25rem',
                opacity: isDone ? 0.22 : 1,
                background: isWrong ? 'rgba(239, 68, 68, 0.22)' : 'var(--bg-card)',
                border: isWrong ? '2px solid var(--err)' : `2px solid ${item.tint}66`,
                color: isWrong ? 'var(--err)' : item.tint,
                boxShadow: isDone ? 'none' : 'var(--card-shadow)',
              }}
            >
              {item.val}
            </button>
          );
        })}
      </div>
    </div>
  );
}

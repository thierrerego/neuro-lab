import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface Pair {
  leftLabel: string;
  leftVal: number;
  rightLabel: string;
  rightVal: number;
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genExpr(level: 1 | 2 | 3 | 4, easeBoost: boolean): { label: string; val: number } {
  if (level === 1) {
    if (easeBoost) {
      const a = rnd(5, 25);
      return { label: `${a}`, val: a };
    }
    const a = rnd(4, 18);
    const b = rnd(2, 12);
    return { label: `${a} + ${b}`, val: a + b };
  }
  if (level === 2) {
    if (Math.random() < 0.5) {
      const a = rnd(14, 42);
      const b = rnd(7, 28);
      return { label: `${a} + ${b}`, val: a + b };
    }
    const a = rnd(35, 78);
    const b = rnd(8, 28);
    return { label: `${a} − ${b}`, val: a - b };
  }
  if (Math.random() < 0.55) {
    const a = rnd(5, 12);
    const b = rnd(4, 9);
    return { label: `${a} × ${b}`, val: a * b };
  }
  const a = rnd(24, 62);
  const b = rnd(15, 42);
  return { label: `${a} + ${b}`, val: a + b };
}

function makePair(level: 1 | 2 | 3 | 4, easeBoost: boolean): Pair {
  for (let i = 0; i < 30; i++) {
    const l = genExpr(level, easeBoost);
    const r = genExpr(level, easeBoost);
    const diff = Math.abs(l.val - r.val);
    if (diff >= 1 && diff <= (level >= 3 ? 14 : 20)) {
      return { leftLabel: l.label, leftVal: l.val, rightLabel: r.label, rightVal: r.val };
    }
  }
  return { leftLabel: '14 + 5', leftVal: 19, rightLabel: '12 + 9', rightVal: 21 };
}

export function NumberComparisonGame({ config, finishRequested, onLiveUpdate, onFinish }: MinigameProps) {
  const [pair, setPair] = useState(() => makePair(config.mathComplexity, config.easeBoost));
  const [pId, setPId] = useState(0);
  const [flash, setFlash] = useState<{ side: 'left' | 'right'; ok: boolean } | null>(null);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
    finished: false,
  });

  useEffect(() => {
    if (finishRequested && !statsRef.current.finished) {
      statsRef.current.finished = true;
      onFinish({
        correct: statsRef.current.correct,
        commissionErrors: statsRef.current.commission,
        omissionErrors: 0,
        reactionTimesMs: statsRef.current.rts,
        rawPoints: statsRef.current.rawPoints,
      });
    }
  }, [finishRequested, onFinish]);

  const choose = useCallback(
    (side: 'left' | 'right') => {
      if (flash || statsRef.current.finished) return;
      const rt = performance.now() - statsRef.current.shownAt;
      const ok = side === 'left' ? pair.leftVal > pair.rightVal : pair.rightVal > pair.leftVal;

      if (ok) {
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rts.push(rt);
        statsRef.current.rawPoints += 120 + Math.min(80, statsRef.current.combo * 12);
        sound.hit(statsRef.current.combo);
      } else {
        statsRef.current.commission++;
        statsRef.current.combo = 0;
        statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
        sound.miss();
      }

      const tot = statsRef.current.correct + statsRef.current.commission;
      onLiveUpdate({
        score: Math.round(statsRef.current.rawPoints * config.scoreMultiplier),
        accuracyPct: Math.round((statsRef.current.correct / tot) * 100),
        combo: statsRef.current.combo,
      });

      setFlash({ side, ok });
      setTimeout(() => {
        setFlash(null);
        setPair(makePair(config.mathComplexity, config.easeBoost));
        setPId((id) => id + 1);
        statsRef.current.shownAt = performance.now();
      }, 170);
    },
    [flash, pair, config.mathComplexity, config.easeBoost, config.scoreMultiplier, onLiveUpdate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') choose('left');
      else if (e.key === 'ArrowRight') choose('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose]);

  const cardStyle = (side: 'left' | 'right') => {
    const isFb = flash?.side === side;
    return {
      background: isFb
        ? flash.ok
          ? 'rgba(52, 211, 153, 0.28)'
          : 'rgba(251, 113, 133, 0.32)'
        : 'var(--bg-card)',
      border: isFb
        ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
        : '1px solid var(--border-strong)',
    };
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}>
        Toque no maior
      </div>

      <div key={pId} className="grid grid-cols-2 gap-3 w-full max-w-[330px] animate-pop">
        <button
          onClick={() => choose('left')}
          className={`h-40 rounded-3xl flex items-center justify-center text-2xl font-black tabular cursor-pointer transition-all surface-card-click ${flash?.side === 'left' && !flash.ok ? 'animate-shake' : ''}`}
          style={cardStyle('left')}
        >
          {pair.leftLabel}
        </button>

        <button
          onClick={() => choose('right')}
          className={`h-40 rounded-3xl flex items-center justify-center text-2xl font-black tabular cursor-pointer transition-all surface-card-click ${flash?.side === 'right' && !flash.ok ? 'animate-shake' : ''}`}
          style={cardStyle('right')}
        >
          {pair.rightLabel}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface EstimateRound {
  leftExpr: string;
  rightExpr: string;
  winner: 'left' | 'right';
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeExpr(lvl: number): { text: string; value: number } {
  if (lvl <= 3) {
    const a = rnd(2, 9);
    const b = rnd(1, 8);
    return { text: `${a} + ${b}`, value: a + b };
  }
  if (lvl <= 8) {
    if (Math.random() < 0.5) {
      const a = rnd(12, 38);
      const b = rnd(6, 26);
      return { text: `${a} + ${b}`, value: a + b };
    }
    const a = rnd(28, 68);
    const b = rnd(8, 25);
    return { text: `${a} − ${b}`, value: a - b };
  }
  if (lvl <= 14) {
    if (Math.random() < 0.55) {
      const a = rnd(4, 14);
      const b = rnd(3, 9);
      return { text: `${a} × ${b}`, value: a * b };
    }
    const a = rnd(45, 110);
    const b = rnd(14, 42);
    return { text: `${a} − ${b}`, value: a - b };
  }
  // Nv. 15..20: multiplicações e expressões compostas com margens curtíssimas
  if (Math.random() < 0.5) {
    const a = rnd(7, 19);
    const b = rnd(6, 16);
    return { text: `${a} × ${b}`, value: a * b };
  }
  const a = rnd(6, 14);
  const b = rnd(5, 12);
  const c = rnd(9, 28);
  return { text: `${a} × ${b} + ${c}`, value: a * b + c };
}

function buildEstimateRound(stage: number): EstimateRound {
  const lvl = Math.max(1, Math.min(20, Math.floor(stage)));
  const maxGap = lvl <= 3 ? 12 : lvl <= 8 ? 10 : lvl <= 14 ? 7 : 4;
  const minGap = lvl <= 3 ? 3 : 1;

  for (let attempt = 0; attempt < 60; attempt++) {
    const left = makeExpr(lvl);
    const right = makeExpr(lvl);
    const diff = Math.abs(left.value - right.value);
    if (diff >= minGap && diff <= maxGap) {
      return {
        leftExpr: left.text,
        rightExpr: right.text,
        winner: left.value > right.value ? 'left' : 'right',
      };
    }
  }

  const base = rnd(10, 40);
  const delta = rnd(minGap, Math.max(minGap + 1, maxGap));
  const leftWins = Math.random() < 0.5;
  return {
    leftExpr: `${base} + ${leftWins ? delta + 3 : 3}`,
    rightExpr: `${base} + ${leftWins ? 3 : delta + 3}`,
    winner: leftWins ? 'left' : 'right',
  };
}

export function QuickEstimateGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<EstimateRound>(() => buildEstimateRound(config.stage));
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null);

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

  useEffect(() => {
    if (!paused) statsRef.current.shownAt = performance.now();
  }, [paused]);

  const handlePick = (side: 'left' | 'right') => {
    if (paused || flash !== null || statsRef.current.finished) return;
    const rt = performance.now() - statsRef.current.shownAt;
    let clearedAll = false;

    if (side === round.winner) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(85, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      setFlash('ok');
      clearedAll = onWaveHit();
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      setFlash('err');
      onWaveError?.();
    }

    const tot = statsRef.current.correct + statsRef.current.commission;
    onLiveUpdate({
      score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((statsRef.current.correct / tot) * 100) : 100,
      combo: statsRef.current.combo,
    });

    if (clearedAll) {
      window.setTimeout(() => finishNow(), 160);
      return;
    }

    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setFlash(null);
      setRound(buildEstimateRound(configRef.current.stage));
      statsRef.current.shownAt = performance.now();
    }, 180);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div
        className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
      >
        Qual expressão vale MAIS?
      </div>

      <div className="grid grid-cols-1 gap-3.5 w-full max-w-[320px]">
        <button
          type="button"
          onClick={() => handlePick('left')}
          className="min-h-[86px] rounded-3xl px-5 py-4 text-3xl font-black tabular cursor-pointer transition-all active:scale-97"
          style={{
            background:
              flash === 'ok'
                ? 'rgba(16, 185, 129, 0.14)'
                : flash === 'err'
                  ? 'rgba(239, 68, 68, 0.14)'
                  : 'var(--bg-subtle)',
            border: '1.5px solid var(--border-strong)',
            color: 'var(--text)',
          }}
        >
          {round.leftExpr}
        </button>

        <div className="text-center text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>
          ou
        </div>

        <button
          type="button"
          onClick={() => handlePick('right')}
          className="min-h-[86px] rounded-3xl px-5 py-4 text-3xl font-black tabular cursor-pointer transition-all active:scale-97"
          style={{
            background:
              flash === 'ok'
                ? 'rgba(16, 185, 129, 0.14)'
                : flash === 'err'
                  ? 'rgba(239, 68, 68, 0.14)'
                  : 'var(--bg-subtle)',
            border: '1.5px solid var(--border-strong)',
            color: 'var(--text)',
          }}
        >
          {round.rightExpr}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface VerdictRound {
  equation: string;
  isTrue: boolean;
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createVerdictRound(stage: number): VerdictRound {
  const lvl = Math.max(1, Math.floor(stage));
  let a = 0;
  let b = 0;
  let op = '+';
  let correctVal = 0;

  if (lvl <= 3) {
    a = rnd(2, 12);
    b = rnd(2, 11);
    op = '+';
    correctVal = a + b;
  } else if (lvl <= 7) {
    if (Math.random() < 0.5) {
      a = rnd(11, 35);
      b = rnd(6, 24);
      op = '+';
      correctVal = a + b;
    } else {
      a = rnd(20, 55);
      b = rnd(6, 19);
      op = '−';
      correctVal = a - b;
    }
  } else if (lvl <= 12) {
    const r = Math.random();
    if (r < 0.45) {
      a = rnd(3, 11);
      b = rnd(3, 9);
      op = '×';
      correctVal = a * b;
    } else if (r < 0.75) {
      a = rnd(25, 78);
      b = rnd(12, 39);
      op = '+';
      correctVal = a + b;
    } else {
      a = rnd(40, 95);
      b = rnd(14, 38);
      op = '−';
      correctVal = a - b;
    }
  } else {
    if (Math.random() < 0.6) {
      a = rnd(6, 16);
      b = rnd(4, 12);
      op = '×';
      correctVal = a * b;
    } else {
      a = rnd(45, 130);
      b = rnd(18, 64);
      op = Math.random() < 0.5 ? '+' : '−';
      correctVal = op === '+' ? a + b : a - b;
    }
  }

  const isTrue = Math.random() < 0.5;
  let shownVal = correctVal;
  if (!isTrue) {
    const offsets = lvl <= 4 ? [-3, -2, -1, 1, 2, 3] : [-10, -2, -1, 1, 2, 10];
    const delta = offsets[Math.floor(Math.random() * offsets.length)];
    shownVal = Math.max(1, correctVal + delta);
    if (shownVal === correctVal) shownVal = correctVal + 1;
  }

  return {
    equation: `${a} ${op} ${b} = ${shownVal}`,
    isTrue,
  };
}

export function MathVerdictGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<VerdictRound>(() => createVerdictRound(config.stage));
  const [feedback, setFeedback] = useState<'ok' | 'err' | null>(null);

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

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleVerdict = (ans: boolean) => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(120, performance.now() - statsRef.current.shownAt);
    const ok = ans === round.isTrue;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(85, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      setFeedback('ok');

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createVerdictRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 190);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setFeedback('err');
      onWaveError?.();
      emitLive();
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createVerdictRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 280);
    }
  };

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center gap-6">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Esta conta está CERTA ou ERRADA?
      </div>

      <div
        className={`w-full rounded-3xl py-10 px-5 flex items-center justify-center text-4xl font-black tabular transition-all duration-150 ${
          feedback === 'err' ? 'animate-shake' : ''
        }`}
        style={{
          background:
            feedback === 'ok'
              ? 'rgba(16, 185, 129, 0.16)'
              : feedback === 'err'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'var(--bg-card)',
          border:
            feedback === 'ok'
              ? '2px solid var(--ok)'
              : feedback === 'err'
                ? '2px solid var(--err)'
                : '1.5px solid var(--border-strong)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {round.equation}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <button
          type="button"
          onClick={() => handleVerdict(false)}
          className="min-h-[64px] rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
          style={{
            background: 'rgba(239, 68, 68, 0.13)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            color: 'var(--err)',
          }}
        >
          <X size={20} strokeWidth={3} />
          <span>ERRADA</span>
        </button>

        <button
          type="button"
          onClick={() => handleVerdict(true)}
          className="min-h-[64px] rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
          style={{
            background: 'rgba(16, 185, 129, 0.14)',
            border: '2px solid rgba(16, 185, 129, 0.45)',
            color: 'var(--ok)',
          }}
        >
          <Check size={20} strokeWidth={3} />
          <span>CERTA</span>
        </button>
      </div>
    </div>
  );
}

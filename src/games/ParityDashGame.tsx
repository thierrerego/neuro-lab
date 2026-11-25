import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface ParityRound {
  display: string;
  isEven: boolean;
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createRound(stage: number): ParityRound {
  const lvl = Math.max(1, Math.floor(stage));

  if (lvl <= 3) {
    const n = rnd(2, 49);
    return { display: String(n), isEven: n % 2 === 0 };
  }
  if (lvl <= 7) {
    const n = rnd(100, 999);
    return { display: String(n), isEven: n % 2 === 0 };
  }
  if (lvl <= 12) {
    if (Math.random() < 0.55) {
      const a = rnd(6, 39);
      const b = rnd(3, 29);
      return { display: `${a} + ${b}`, isEven: (a + b) % 2 === 0 };
    }
    const n = rnd(1000, 9999);
    return { display: String(n), isEven: n % 2 === 0 };
  }
  // Ritmos altos: somas e subtrações rápidas
  if (Math.random() < 0.5) {
    const a = rnd(14, 79);
    const b = rnd(7, 45);
    return { display: `${a} + ${b}`, isEven: (a + b) % 2 === 0 };
  }
  const a = rnd(35, 98);
  const b = rnd(11, 34);
  return { display: `${a} − ${b}`, isEven: (a - b) % 2 === 0 };
}

export function ParityDashGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<ParityRound>(() => createRound(config.stage));
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

  const handleChoose = (chooseEven: boolean) => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(100, performance.now() - statsRef.current.shownAt);
    const isCorrect = chooseEven === round.isEven;

    if (isCorrect) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 110 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);
      setFeedback('ok');

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 160);
        return;
      }
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 170);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 30);
      sound.miss();
      setFeedback('err');
      onWaveError?.();
      emitLive();
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 260);
    }
  };

  return (
    <div className="w-full max-w-[420px] flex flex-col items-center gap-6">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        O resultado é PAR ou ÍMPAR?
      </div>

      <div
        className={`w-full rounded-3xl py-10 px-6 flex items-center justify-center text-5xl font-black tabular transition-all duration-150 ${
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
        {round.display}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <button
          type="button"
          onClick={() => handleChoose(true)}
          className="min-h-[64px] rounded-2xl font-extrabold text-lg cursor-pointer transition-transform active:scale-95"
          style={{
            background: 'rgba(14, 165, 233, 0.14)',
            border: '2px solid rgba(14, 165, 233, 0.45)',
            color: '#0EA5E9',
          }}
        >
          PAR
        </button>
        <button
          type="button"
          onClick={() => handleChoose(false)}
          className="min-h-[64px] rounded-2xl font-extrabold text-lg cursor-pointer transition-transform active:scale-95"
          style={{
            background: 'rgba(217, 119, 6, 0.14)',
            border: '2px solid rgba(217, 119, 6, 0.45)',
            color: '#D97706',
          }}
        >
          ÍMPAR
        </button>
      </div>
    </div>
  );
}

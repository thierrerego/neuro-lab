import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface MathQuestion {
  expression: string;
  answer: number;
  options: number[];
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildQuestion(complexity: 1 | 2 | 3 | 4, easeBoost: boolean): MathQuestion {
  let expression = '';
  let answer = 0;

  if (complexity === 1) {
    const a = easeBoost ? rnd(2, 9) : rnd(3, 16);
    const b = easeBoost ? rnd(1, 8) : rnd(2, 14);
    expression = `${a} + ${b}`;
    answer = a + b;
  } else if (complexity === 2) {
    if (Math.random() < 0.5) {
      const a = rnd(12, 42);
      const b = rnd(7, 29);
      expression = `${a} + ${b}`;
      answer = a + b;
    } else {
      const a = rnd(24, 68);
      const b = rnd(7, a - 4);
      expression = `${a} − ${b}`;
      answer = a - b;
    }
  } else if (complexity === 3) {
    if (Math.random() < 0.5) {
      const a = rnd(4, 12);
      const b = rnd(3, 9);
      expression = `${a} × ${b}`;
      answer = a * b;
    } else {
      const a = rnd(4, 9);
      const b = rnd(3, 8);
      const c = rnd(3, 15);
      expression = `${a} × ${b} − ${c}`;
      answer = a * b - c;
    }
  } else {
    const a = rnd(6, 13);
    const b = rnd(4, 9);
    const c = rnd(6, 24);
    if (Math.random() < 0.5) {
      expression = `${a} × ${b} + ${c}`;
      answer = a * b + c;
    } else {
      expression = `${a} × ${b} − ${c}`;
      answer = a * b - c;
    }
  }

  const offsets = [-10, -3, -2, -1, 1, 2, 3, 10].sort(() => Math.random() - 0.5);
  const set = new Set<number>([answer]);
  for (const off of offsets) {
    if (set.size >= 4) break;
    const cand = answer + off;
    if (cand !== answer && cand >= 0) set.add(cand);
  }
  while (set.size < 4) set.add(answer + set.size + 1);

  return {
    expression,
    answer,
    options: Array.from(set).sort(() => Math.random() - 0.5),
  };
}

export function ChainArithmeticGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [q, setQ] = useState(() => buildQuestion(config.mathComplexity, config.easeBoost));
  const [qId, setQId] = useState(0);
  const [flash, setFlash] = useState<{ val: number; ok: boolean } | null>(null);

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

  const handlePick = (val: number) => {
    if (flash || paused || statsRef.current.finished) return;
    const rt = performance.now() - statsRef.current.shownAt;
    const ok = val === q.answer;
    let clearedAll = false;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(90, statsRef.current.combo * 15);
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

    setFlash({ val, ok });
    setTimeout(() => {
      if (statsRef.current.finished) return;
      setFlash(null);
      setQ(buildQuestion(configRef.current.mathComplexity, configRef.current.easeBoost));
      setQId((id) => id + 1);
      statsRef.current.shownAt = performance.now();
    }, 160);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div
        key={qId}
        className="w-full max-w-[310px] py-8 px-4 rounded-3xl text-center text-4xl font-black tabular animate-pop"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)' }}
      >
        {q.expression}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[310px]">
        {q.options.map((opt) => {
          const isFb = flash?.val === opt;
          return (
            <button
              key={opt}
              onClick={() => handlePick(opt)}
              className={`py-4 rounded-2xl font-black text-2xl tabular transition-all cursor-pointer ${isFb && !flash.ok ? 'animate-shake' : ''}`}
              style={{
                background: isFb
                  ? flash.ok
                    ? 'rgba(52, 211, 153, 0.3)'
                    : 'rgba(251, 113, 133, 0.32)'
                  : 'var(--bg-subtle)',
                border: isFb
                  ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1px solid var(--border)',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

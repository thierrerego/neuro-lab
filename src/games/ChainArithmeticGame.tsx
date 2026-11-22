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
    const a = easeBoost ? rnd(2, 10) : rnd(3, 18);
    const b = easeBoost ? rnd(1, 9) : rnd(2, 14);
    expression = `${a} + ${b}`;
    answer = a + b;
  } else if (complexity === 2) {
    if (Math.random() < 0.5) {
      const a = rnd(14, 48);
      const b = rnd(9, 36);
      expression = `${a} + ${b}`;
      answer = a + b;
    } else {
      const a = rnd(28, 75);
      const b = rnd(8, a - 5);
      expression = `${a} − ${b}`;
      answer = a - b;
    }
  } else if (complexity === 3) {
    const roll = Math.random();
    if (roll < 0.45) {
      const a = rnd(4, 12);
      const b = rnd(3, 9);
      expression = `${a} × ${b}`;
      answer = a * b;
    } else {
      const a = rnd(4, 9);
      const b = rnd(3, 9);
      const c = rnd(4, 18);
      expression = `${a} × ${b} − ${c}`;
      answer = a * b - c;
    }
  } else {
    const a = rnd(6, 14);
    const b = rnd(4, 9);
    const c = rnd(7, 25);
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

export function ChainArithmeticGame({ config, finishRequested, onLiveUpdate, onFinish }: MinigameProps) {
  const [q, setQ] = useState(() => buildQuestion(config.mathComplexity, config.easeBoost));
  const [qId, setQId] = useState(0);
  const [flash, setFlash] = useState<{ val: number; ok: boolean } | null>(null);

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

  const handlePick = (val: number) => {
    if (flash || statsRef.current.finished) return;
    const rt = performance.now() - statsRef.current.shownAt;
    const ok = val === q.answer;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(90, statsRef.current.combo * 15);
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

    setFlash({ val, ok });
    setTimeout(() => {
      setFlash(null);
      setQ(buildQuestion(config.mathComplexity, config.easeBoost));
      setQId((id) => id + 1);
      statsRef.current.shownAt = performance.now();
    }, 180);
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

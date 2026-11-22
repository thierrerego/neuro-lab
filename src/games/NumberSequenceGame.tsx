import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface SequencePuzzle {
  key: string;
  terms: [number, number, number, number];
  answer: number;
  options: number[];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildOptions(answer: number, stepScale: number, isEasy: boolean): number[] {
  const candidates: number[] = isEasy
    ? [
        answer + stepScale,
        answer - stepScale,
        answer + Math.max(2, stepScale * 2),
        answer + 1,
        answer - 1,
        answer + 3,
      ]
    : [
        answer + 1,
        answer - 1,
        answer + 2,
        answer - 2,
        answer + stepScale,
        answer - stepScale,
        answer + Math.max(3, Math.round(stepScale / 2)),
        answer - Math.max(3, Math.round(stepScale / 2)),
        answer + 4,
        answer - 4,
      ];

  const used = new Set<number>([answer]);
  const distractors: number[] = [];

  for (const val of shuffle(candidates)) {
    if (val >= 0 && !used.has(val)) {
      used.add(val);
      distractors.push(val);
      if (distractors.length === 3) break;
    }
  }

  let fallback = 1;
  while (distractors.length < 3) {
    const cand = answer + fallback;
    if (!used.has(cand)) {
      used.add(cand);
      distractors.push(cand);
    }
    fallback++;
  }

  return shuffle([answer, ...distractors]);
}

function makeSequence(stage: number, prevKey?: string): SequencePuzzle {
  const lvl = Math.max(1, Math.floor(stage));

  for (let attempt = 0; attempt < 8; attempt++) {
    let terms: [number, number, number, number];
    let answer: number;
    let stepScale = 2;

    if (lvl <= 1) {
      // Nível 1 ultraleve: apenas +1 e +2 com números pequenos (1..10)
      const step = pick([1, 2] as const);
      const start = step === 1 ? randInt(1, 6) : randInt(1, 4) * 2;
      terms = [start, start + step, start + step * 2, start + step * 3];
      answer = start + step * 4;
      stepScale = step;
    } else if (lvl <= 4) {
      // Nível 2–4: somas simples +2, +3, +5, +10
      const step = lvl === 2 ? pick([2, 3, 5, 10] as const) : pick([3, 4, 5, 6] as const);
      const start = step === 10 ? randInt(1, 4) * 10 : randInt(1, 12);
      terms = [start, start + step, start + step * 2, start + step * 3];
      answer = start + step * 4;
      stepScale = step;
    } else if (lvl <= 8) {
      // Nível 5–8: somas e subtrações simples
      const useSub = Math.random() < 0.45;
      if (useSub) {
        const step = pick([2, 3, 4, 5] as const);
        const start = randInt(step * 4 + 2, step * 4 + 14);
        terms = [start, start - step, start - step * 2, start - step * 3];
        answer = start - step * 4;
        stepScale = step;
      } else {
        const step = pick([4, 6, 7, 8] as const);
        const start = randInt(2, 16);
        terms = [start, start + step, start + step * 2, start + step * 3];
        answer = start + step * 4;
        stepScale = step;
      }
    } else if (lvl <= 13) {
      // Nível 4–6: passos crescentes (+1,+2,+3,+4 ou +2,+4,+6,+8) e dobro (×2)
      const kind = Math.random();
      if (kind < 0.45) {
        // Passo crescente +base, +2*base, +3*base, +4*base
        const base = lvl >= 5 && Math.random() < 0.45 ? 2 : 1;
        const start = randInt(1, 12);
        const t1 = start + base;
        const t2 = t1 + base * 2;
        const t3 = t2 + base * 3;
        terms = [start, t1, t2, t3];
        answer = t3 + base * 4;
        stepScale = base * 3;
      } else if (kind < 0.8) {
        // Dobro (×2)
        const start = pick([1, 2, 3, 4, 5, 6] as const);
        terms = [start, start * 2, start * 4, start * 8];
        answer = start * 16;
        stepScale = Math.max(4, start * 4);
      } else {
        // Passo crescente começando em +2 (+2,+3,+4,+5)
        const start = randInt(2, 12);
        const t1 = start + 2;
        const t2 = t1 + 3;
        const t3 = t2 + 4;
        terms = [start, t1, t2, t3];
        answer = t3 + 5;
        stepScale = 3;
      }
    } else {
      // Nível 7+: alternâncias (+p, -q, +p, -q) e sequências tipo Fibonacci (a + b)
      const roll = Math.random();
      if (roll < 0.45) {
        // Fibonacci (cada termo = soma dos dois anteriores)
        const a = randInt(1, 5);
        const b = randInt(a + 1, a + 5);
        const c = a + b;
        const d = b + c;
        terms = [a, b, c, d];
        answer = c + d;
        stepScale = Math.max(2, b);
      } else if (roll < 0.85) {
        // Alternância (+p, -q, +p -> próximo é -q)
        const pair = pick([
          { p: 3, q: 1 },
          { p: 4, q: 1 },
          { p: 4, q: 2 },
          { p: 5, q: 2 },
          { p: 6, q: 2 },
          { p: 5, q: 3 },
        ] as const);
        const start = randInt(3, 14);
        const t1 = start + pair.p;
        const t2 = t1 - pair.q;
        const t3 = t2 + pair.p;
        terms = [start, t1, t2, t3];
        answer = t3 - pair.q;
        stepScale = pair.p;
      } else {
        // Passo crescente +2,+4,+6,+8
        const start = randInt(2, 11);
        const t1 = start + 2;
        const t2 = t1 + 4;
        const t3 = t2 + 6;
        terms = [start, t1, t2, t3];
        answer = t3 + 8;
        stepScale = 4;
      }
    }

    const key = `${terms.join('-')}=${answer}`;
    if (key !== prevKey || attempt === 7) {
      return {
        key,
        terms,
        answer,
        options: buildOptions(answer, stepScale, lvl <= 1),
      };
    }
  }

  return {
    key: '2-4-6-8=10',
    terms: [2, 4, 6, 8],
    answer: 10,
    options: buildOptions(10, 2, true),
  };
}

export function NumberSequenceGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [puzzle, setPuzzle] = useState<SequencePuzzle>(() => makeSequence(config.stage));
  const [roundId, setRoundId] = useState(0);
  const [flash, setFlash] = useState<{ val: number; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const pauseStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
    finished: false,
  });

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const finishNow = () => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    clearTimer();
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
    if (paused) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
    } else if (pauseStartedAtRef.current !== null) {
      statsRef.current.shownAt += performance.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handlePick = (val: number) => {
    if (flash || paused || statsRef.current.finished) return;
    const rt = Math.max(80, performance.now() - statsRef.current.shownAt);
    const ok = val === puzzle.answer;
    let clearedAll = false;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 140 + Math.min(90, statsRef.current.combo * 16);
      sound.hit(statsRef.current.combo);
      clearedAll = onWaveHit();
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      onWaveError?.();
    }

    const total = statsRef.current.correct + statsRef.current.commission;
    onLiveUpdate({
      score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: Math.round((statsRef.current.correct / total) * 100),
      combo: statsRef.current.combo,
    });

    if (clearedAll) {
      finishNow();
      return;
    }

    setFlash({ val, ok });
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setFlash(null);
      setPuzzle((prev) => makeSequence(configRef.current.stage, prev.key));
      setRoundId((n) => n + 1);
      statsRef.current.shownAt = performance.now();
    }, ok ? 140 : 210);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: 'var(--bg-subtle)',
          color: 'var(--accent)',
          border: '1px solid var(--border)',
        }}
      >
        Qual número completa?
      </div>

      {/* Faixa com os 4 termos + ? */}
      <div
        key={roundId}
        className="w-full max-w-[356px] p-4 rounded-3xl flex items-center justify-between gap-1.5 animate-pop"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {puzzle.terms.map((num, idx) => (
          <div key={idx} className="flex items-center gap-1.5 flex-1 justify-center">
            <div
              className="w-full py-3.5 rounded-2xl text-center text-2xl font-black tabular"
              style={{
                background: 'var(--bg-subtle)',
                color: 'var(--text)',
              }}
            >
              {num}
            </div>
            <span className="text-sm font-black shrink-0" style={{ color: 'var(--text-soft)' }}>
              ·
            </span>
          </div>
        ))}

        <div
          className="flex-1 py-3.5 rounded-2xl text-center text-2xl font-black tabular"
          style={{
            background: 'var(--accent-glow)',
            border: '2px dashed var(--accent)',
            color: 'var(--accent)',
          }}
        >
          ?
        </div>
      </div>

      {/* 4 opções em grade 2×2 */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-[356px]">
        {puzzle.options.map((opt) => {
          const isFb = flash?.val === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handlePick(opt)}
              className={`min-h-[64px] py-4 rounded-2xl font-black text-2xl tabular transition-all cursor-pointer surface-card-click ${
                isFb && !flash.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isFb
                  ? flash.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.22)'
                  : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1px solid var(--border)',
                color: isFb ? (flash.ok ? 'var(--ok)' : 'var(--err)') : 'var(--text)',
                boxShadow: 'var(--card-shadow)',
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

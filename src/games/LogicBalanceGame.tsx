import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface BalancePuzzle {
  clues: string[];
  question: string;
  answer: number;
  options: number[];
}

const SYMS = [
  { ch: '●', color: '#2563EB' },
  { ch: '▲', color: '#E11D48' },
  { ch: '■', color: '#059669' },
];

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeOptions(answer: number): number[] {
  const offsets = [-4, -3, -2, -1, 1, 2, 3, 4, -6, 6].sort(() => Math.random() - 0.5);
  const set = new Set<number>([answer]);
  for (const off of offsets) {
    if (set.size >= 4) break;
    const cand = answer + off;
    if (cand > 0 && cand !== answer) set.add(cand);
  }
  while (set.size < 4) set.add(answer + set.size + 1);
  return Array.from(set).sort(() => Math.random() - 0.5);
}

function buildPuzzle(stage: number): BalancePuzzle {
  const lvl = Math.max(1, Math.min(20, Math.floor(stage)));
  const sA = SYMS[0].ch;
  const sB = SYMS[1].ch;
  const sC = SYMS[2].ch;

  if (lvl <= 3) {
    // Ultrabásico: ● + ● = 2a -> ● = ?
    const a = rnd(2, 7);
    return {
      clues: [`${sA} + ${sA} = ${a * 2}`],
      question: `${sA} = ?`,
      answer: a,
      options: makeOptions(a),
    };
  }

  if (lvl <= 8) {
    // 2 equações lineares simples
    const a = rnd(2, 9);
    const b = rnd(2, 9);
    return {
      clues: [`${sA} + ${sA} = ${a * 2}`, `${sA} + ${sB} = ${a + b}`],
      question: `${sB} = ?`,
      answer: b,
      options: makeOptions(b),
    };
  }

  if (lvl <= 14) {
    // 2 equações + pergunta composta (▲ + ▲ ou ▲ + ●)
    const a = rnd(3, 12);
    const b = rnd(3, 12);
    const c = rnd(2, 9);
    return {
      clues: [`${sA} + ${sA} = ${a * 2}`, `${sA} + ${sB} = ${a + b}`, `${sB} + ${sC} = ${b + c}`],
      question: `${sC} = ?`,
      answer: c,
      options: makeOptions(c),
    };
  }

  // Nv. 15..20: dedução algébrica com multiplicação/subtração e soma final
  const a = rnd(4, 14);
  const b = rnd(3, 13);
  const c = rnd(3, 12);
  const askDouble = lvl >= 18;
  const ans = askDouble ? c * 2 + a : a + c;
  return {
    clues: [
      `${sA} + ${sA} + ${sA} = ${a * 3}`,
      `${sA} + ${sB} = ${a + b}`,
      `${sB} × 2 + ${sC} = ${b * 2 + c}`,
    ],
    question: askDouble ? `${sC} + ${sC} + ${sA} = ?` : `${sA} + ${sC} = ?`,
    answer: ans,
    options: makeOptions(ans),
  };
}

export function LogicBalanceGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [puzzle, setPuzzle] = useState<BalancePuzzle>(() => buildPuzzle(config.stage));
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

  const handleAnswer = (val: number) => {
    if (paused || flash !== null || statsRef.current.finished) return;
    const rt = performance.now() - statsRef.current.shownAt;
    let clearedAll = false;

    if (val === puzzle.answer) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 150 + Math.min(90, statsRef.current.combo * 15);
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
      window.setTimeout(() => finishNow(), 180);
      return;
    }

    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setFlash(null);
      setPuzzle(buildPuzzle(configRef.current.stage));
      statsRef.current.shownAt = performance.now();
    }, 240);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="w-full max-w-[330px] rounded-3xl p-5 flex flex-col gap-2.5 text-center"
        style={{
          background:
            flash === 'ok'
              ? 'rgba(16, 185, 129, 0.14)'
              : flash === 'err'
                ? 'rgba(239, 68, 68, 0.14)'
                : 'var(--bg-subtle)',
          border: '1px solid var(--border)',
        }}
      >
        {puzzle.clues.map((line, idx) => (
          <div key={idx} className="text-xl font-extrabold tracking-wide tabular">
            {line}
          </div>
        ))}
        <div
          className="mt-1 pt-2.5 text-2xl font-black tabular"
          style={{ borderTop: '1px dashed var(--border-strong)', color: 'var(--accent)' }}
        >
          {puzzle.question}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
        {puzzle.options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => handleAnswer(opt)}
            className="h-14 rounded-2xl text-2xl font-black tabular btn-soft cursor-pointer active:scale-95 transition-transform"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

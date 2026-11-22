import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type OpSymbol = '+' | '−' | '×' | '÷';

interface OperatorQuestion {
  a: number;
  b: number;
  result: number;
  answer: OpSymbol;
  options: OpSymbol[];
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function evalOp(a: number, op: OpSymbol, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      if (b === 0 || a % b !== 0) return null;
      return a / b;
  }
}

function isUniqueSolution(a: number, b: number, result: number, allowedOps: OpSymbol[]): boolean {
  let matches = 0;
  for (const op of allowedOps) {
    if (evalOp(a, op, b) === result) matches++;
  }
  return matches === 1;
}

function getOpsForStage(stage: number): OpSymbol[] {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return ['+', '−'];
  if (lvl <= 4) return ['+', '−', '×'];
  return ['+', '−', '×', '÷'];
}

function buildQuestion(stage: number, prevSig?: string): OperatorQuestion {
  const lvl = Math.max(1, Math.floor(stage));
  const options = getOpsForStage(stage);

  for (let attempt = 0; attempt < 80; attempt++) {
    const op = options[Math.floor(Math.random() * options.length)];
    let a = 1;
    let b = 1;
    let result = 2;

    if (op === '+') {
      if (lvl <= 1) {
        a = rnd(1, 9);
        b = rnd(1, 9);
      } else if (lvl <= 2) {
        a = rnd(2, 10);
        b = rnd(1, 10);
      } else if (lvl <= 4) {
        a = rnd(3, 15);
        b = rnd(2, 12);
      } else {
        a = rnd(4, 24);
        b = rnd(3, 18);
      }
      result = a + b;
    } else if (op === '−') {
      if (lvl <= 1) {
        a = rnd(3, 10);
        b = rnd(1, a - 1);
      } else if (lvl <= 2) {
        a = rnd(4, 10);
        b = rnd(1, a - 1);
      } else if (lvl <= 4) {
        a = rnd(6, 20);
        b = rnd(2, a - 1);
      } else {
        a = rnd(8, 30);
        b = rnd(3, a - 2);
      }
      result = a - b;
    } else if (op === '×') {
      a = rnd(2, lvl >= 5 ? 11 : 9);
      b = rnd(2, 9);
      result = a * b;
    } else {
      // Divisão sempre exata
      const quotient = rnd(2, 10);
      b = rnd(2, 9);
      a = quotient * b;
      result = quotient;
    }

    const sig = `${a}|${b}|${result}`;
    if (sig === prevSig) continue;
    if (isUniqueSolution(a, b, result, options)) {
      return { a, b, result, answer: op, options };
    }
  }

  // Fallback garantido sem ambiguidade para qualquer nível
  return { a: 6, b: 2, result: 8, answer: '+', options };
}

export function MissingOperatorGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [question, setQuestion] = useState<OperatorQuestion>(() => buildQuestion(config.stage));
  const [qId, setQId] = useState(0);
  const [flash, setFlash] = useState<{ op: OpSymbol; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const timerRef = useRef<number | null>(null);
  const prevPausedRef = useRef(paused);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
    finished: false,
  });

  const finishNow = useCallback(() => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    onFinish({
      correct: statsRef.current.correct,
      commissionErrors: statsRef.current.commission,
      omissionErrors: 0,
      reactionTimesMs: statsRef.current.rts,
      rawPoints: statsRef.current.rawPoints,
    });
  }, [onFinish]);

  useEffect(() => {
    if (finishRequested) finishNow();
  }, [finishRequested, finishNow]);

  useEffect(() => {
    if (prevPausedRef.current && !paused) {
      statsRef.current.shownAt = performance.now();
    }
    prevPausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handlePick = useCallback(
    (op: OpSymbol) => {
      if (flash || paused || statsRef.current.finished) return;
      const rt = performance.now() - statsRef.current.shownAt;
      const ok = op === question.answer;
      let clearedAll = false;

      if (ok) {
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rts.push(rt);
        statsRef.current.rawPoints += 130 + Math.min(85, statsRef.current.combo * 14);
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

      setFlash({ op, ok });
      const prevSig = `${question.a}|${question.b}|${question.result}`;
      timerRef.current = window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setFlash(null);
        setQuestion(buildQuestion(configRef.current.stage, prevSig));
        setQId((id) => id + 1);
        statsRef.current.shownAt = performance.now();
        timerRef.current = null;
      }, ok ? 160 : 200);
    },
    [flash, paused, question, onWaveHit, onWaveError, onLiveUpdate, finishNow]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let mapped: OpSymbol | null = null;
      if (e.key === '+') mapped = '+';
      else if (e.key === '-') mapped = '−';
      else if (e.key === '*' || e.key.toLowerCase() === 'x') mapped = '×';
      else if (e.key === '/') mapped = '÷';

      if (mapped && question.options.includes(mapped)) {
        e.preventDefault();
        handlePick(mapped);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePick, question.options]);

  const gridColsClass = question.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
      >
        Qual sinal completa?
      </div>

      <div
        key={qId}
        className="w-full max-w-[320px] py-8 px-4 rounded-3xl flex items-center justify-center gap-3 text-4xl font-black tabular animate-pop"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--card-shadow)',
          color: 'var(--text)',
        }}
      >
        <span>{question.a}</span>
        <span
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black transition-all"
          style={{
            background: flash
              ? flash.ok
                ? 'rgba(16, 185, 129, 0.22)'
                : 'rgba(239, 68, 68, 0.22)'
              : 'var(--accent-glow)',
            border: flash
              ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
              : '2px dashed var(--accent)',
            color: flash ? (flash.ok ? 'var(--ok)' : 'var(--err)') : 'var(--accent)',
          }}
        >
          {flash ? flash.op : '?'}
        </span>
        <span>{question.b}</span>
        <span style={{ color: 'var(--text-muted)' }}>=</span>
        <span>{question.result}</span>
      </div>

      <div className={`grid ${gridColsClass} gap-3 w-full max-w-[320px]`}>
        {question.options.map((op) => {
          const isFb = flash?.op === op;
          return (
            <button
              key={op}
              type="button"
              onClick={() => handlePick(op)}
              className={`py-4 rounded-2xl font-black text-3xl leading-none transition-all cursor-pointer active:scale-95 ${
                isFb && !flash.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isFb
                  ? flash.ok
                    ? 'rgba(16, 185, 129, 0.26)'
                    : 'rgba(239, 68, 68, 0.26)'
                  : 'var(--bg-subtle)',
                border: isFb
                  ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1px solid var(--border)',
                color: isFb ? (flash.ok ? 'var(--ok)' : 'var(--err)') : 'var(--text)',
              }}
            >
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}

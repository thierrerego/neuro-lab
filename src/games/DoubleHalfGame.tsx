import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type OpMode = 'double' | 'half' | 'triple';

interface DoubleHalfRound {
  mode: OpMode;
  label: string;
  color: string;
  baseNum: number;
  answer: number;
  options: number[];
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createRound(stage: number): DoubleHalfRound {
  const lvl = Math.max(1, Math.floor(stage));
  const modes: OpMode[] = lvl >= 8 ? ['double', 'half', 'triple'] : ['double', 'half'];
  const mode = modes[Math.floor(Math.random() * modes.length)];

  let baseNum = 8;
  let answer = 16;
  let label = 'DOBRO (×2)';
  let color = '#059669';

  if (mode === 'double') {
    baseNum = lvl <= 3 ? rnd(3, 18) : lvl <= 8 ? rnd(12, 48) : rnd(24, 95);
    answer = baseNum * 2;
    label = 'DOBRO (×2)';
    color = '#059669';
  } else if (mode === 'half') {
    const halfVal = lvl <= 3 ? rnd(3, 18) : lvl <= 8 ? rnd(12, 48) : rnd(24, 95);
    baseNum = halfVal * 2;
    answer = halfVal;
    label = 'METADE (÷2)';
    color = '#2563EB';
  } else {
    baseNum = lvl <= 12 ? rnd(6, 28) : rnd(14, 55);
    answer = baseNum * 3;
    label = 'TRIPLO (×3)';
    color = '#7C3AED';
  }

  const opts = new Set<number>([answer]);
  const offsets = [-6, -4, -2, -1, 1, 2, 4, 6, 10, -10];
  while (opts.size < 4) {
    const d = offsets[Math.floor(Math.random() * offsets.length)];
    const cand = Math.max(2, answer + d);
    if (cand !== answer) opts.add(cand);
  }

  return {
    mode,
    label,
    color,
    baseNum,
    answer,
    options: shuffle(Array.from(opts)),
  };
}

export function DoubleHalfGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<DoubleHalfRound>(() => createRound(config.stage));
  const [feedback, setFeedback] = useState<{ val: number; ok: boolean } | null>(null);

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

  const handleTap = (val: number) => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(120, performance.now() - statsRef.current.shownAt);

    if (val === round.answer) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(85, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      setFeedback({ val, ok: true });

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 200);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setFeedback({ val, ok: false });
      onWaveError?.();
      emitLive();
      window.setTimeout(() => setFeedback(null), 250);
    }
  };

  return (
    <div className="w-full max-w-[340px] flex flex-col items-center gap-5">
      <div
        className="px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider"
        style={{
          background: `${round.color}1A`,
          border: `1.5px solid ${round.color}`,
          color: round.color,
        }}
      >
        Calcule: {round.label}
      </div>

      <div
        className="w-full rounded-3xl py-9 px-6 flex items-center justify-center text-6xl font-black tabular"
        style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-strong)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {round.baseNum}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {round.options.map((opt) => {
          const isFb = feedback?.val === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handleTap(opt)}
              className={`min-h-[60px] rounded-2xl font-extrabold text-2xl tabular cursor-pointer transition-all ${
                isFb && !feedback.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isFb
                  ? feedback.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.20)'
                  : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${feedback.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1.5px solid var(--border)',
                color: 'var(--text)',
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

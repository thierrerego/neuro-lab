import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface MissingRound {
  shown: number[];
  missing: number;
  maxNum: number;
  options: number[];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createRound(stage: number): MissingRound {
  const lvl = Math.max(1, Math.floor(stage));
  const maxNum = lvl <= 2 ? 6 : lvl <= 5 ? 8 : lvl <= 9 ? 10 : 12;
  const shouldShuffle = lvl >= 3;
  const optCount = lvl <= 3 ? 3 : 4;

  const missing = Math.floor(1 + Math.random() * maxNum);
  const full = Array.from({ length: maxNum }, (_, i) => i + 1).filter((n) => n !== missing);
  const shown = shouldShuffle ? shuffle(full) : full;

  const distractors = new Set<number>([missing]);
  while (distractors.size < optCount) {
    const candidate = Math.max(1, Math.min(maxNum + 2, missing + Math.floor(Math.random() * 5) - 2));
    distractors.add(candidate);
  }
  const options = shuffle(Array.from(distractors));

  return { shown, missing, maxNum, options };
}

export function MissingNumberGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<MissingRound>(() => createRound(config.stage));
  const [picked, setPicked] = useState<{ val: number; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    roundStart: performance.now(),
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

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleChoose = (val: number) => {
    if (paused || picked !== null || statsRef.current.finished) return;

    const now = performance.now();
    const rt = Math.max(120, now - statsRef.current.roundStart);
    const isOk = val === round.missing;

    setPicked({ val, ok: isOk });

    if (isOk) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 135 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      onWaveError?.();
      emitLive();
    }

    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setRound(createRound(configRef.current.stage));
      setPicked(null);
      statsRef.current.roundStart = performance.now();
    }, 280);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Qual número falta de 1 a {round.maxNum}?
      </div>

      <div
        className="w-full max-w-[348px] rounded-3xl p-4 flex flex-wrap items-center justify-center gap-2.5"
        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)' }}
      >
        {round.shown.map((num) => (
          <div
            key={num}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black tabular"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          >
            {num}
          </div>
        ))}
      </div>

      <div
        className="grid gap-2.5 w-full max-w-[348px]"
        style={{ gridTemplateColumns: `repeat(${round.options.length}, minmax(0, 1fr))` }}
      >
        {round.options.map((val) => {
          const isPicked = picked?.val === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => handleChoose(val)}
              className={`h-16 rounded-2xl text-2xl font-black tabular transition-all cursor-pointer ${
                isPicked && !picked.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isPicked
                  ? picked.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.22)'
                  : 'var(--bg-card)',
                border: isPicked
                  ? `2px solid ${picked.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1.5px solid var(--border-strong)',
              }}
            >
              {val}
            </button>
          );
        })}
      </div>
    </div>
  );
}

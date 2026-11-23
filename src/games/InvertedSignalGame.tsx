import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type Dir = 'left' | 'right' | 'up' | 'down';

const ARROWS: Record<Dir, string> = {
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
};

const OPPOSITE: Record<Dir, Dir> = {
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
};

interface SignalTrial {
  shown: Dir;
  inverted: boolean;
  expected: Dir;
  fourWay: boolean;
}

function buildTrial(stage: number): SignalTrial {
  const lvl = Math.max(1, Math.min(20, Math.floor(stage)));
  const fourWay = lvl >= 6;
  const dirs: Dir[] = fourWay ? ['left', 'right', 'up', 'down'] : ['left', 'right'];
  const shown = dirs[Math.floor(Math.random() * dirs.length)];
  const invertChance = lvl <= 2 ? 0.25 : lvl <= 7 ? 0.45 : 0.55;
  const inverted = Math.random() < invertChance;
  return {
    shown,
    inverted,
    expected: inverted ? OPPOSITE[shown] : shown,
    fourWay,
  };
}

export function InvertedSignalGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [trial, setTrial] = useState<SignalTrial>(() => buildTrial(config.stage));
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

  const handleAnswer = (dir: Dir) => {
    if (paused || flash !== null || statsRef.current.finished) return;
    const rt = performance.now() - statsRef.current.shownAt;
    let clearedAll = false;

    if (dir === trial.expected) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(85, statsRef.current.combo * 14);
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
      window.setTimeout(() => finishNow(), 150);
      return;
    }

    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setFlash(null);
      setTrial(buildTrial(configRef.current.stage));
      statsRef.current.shownAt = performance.now();
    }, 160);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider"
        style={{
          background: trial.inverted ? 'rgba(225, 29, 72, 0.14)' : 'rgba(16, 185, 129, 0.14)',
          color: trial.inverted ? '#E11D48' : '#059669',
          border: `1px solid ${trial.inverted ? 'rgba(225, 29, 72, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
        }}
      >
        {trial.inverted ? 'INVERTIDO · toque o oposto' : 'NORMAL · siga a seta'}
      </div>

      <div
        className="w-36 h-36 rounded-3xl flex items-center justify-center text-6xl font-black transition-all"
        style={{
          background:
            flash === 'ok'
              ? 'rgba(16, 185, 129, 0.18)'
              : flash === 'err'
                ? 'rgba(239, 68, 68, 0.18)'
                : trial.inverted
                  ? 'rgba(225, 29, 72, 0.08)'
                  : 'rgba(16, 185, 129, 0.08)',
          border: `3px solid ${trial.inverted ? '#E11D48' : '#059669'}`,
          color: trial.inverted ? '#E11D48' : '#059669',
        }}
      >
        {ARROWS[trial.shown]}
      </div>

      {trial.fourWay ? (
        <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
          <div />
          <button
            type="button"
            onClick={() => handleAnswer('up')}
            className="h-14 rounded-2xl text-2xl font-black btn-soft cursor-pointer active:scale-95"
          >
            ↑
          </button>
          <div />
          <button
            type="button"
            onClick={() => handleAnswer('left')}
            className="h-14 rounded-2xl text-2xl font-black btn-soft cursor-pointer active:scale-95"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => handleAnswer('down')}
            className="h-14 rounded-2xl text-2xl font-black btn-soft cursor-pointer active:scale-95"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => handleAnswer('right')}
            className="h-14 rounded-2xl text-2xl font-black btn-soft cursor-pointer active:scale-95"
          >
            →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 w-full max-w-[260px]">
          <button
            type="button"
            onClick={() => handleAnswer('left')}
            className="h-16 rounded-2xl text-3xl font-black btn-soft cursor-pointer active:scale-95"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => handleAnswer('right')}
            className="h-16 rounded-2xl text-3xl font-black btn-soft cursor-pointer active:scale-95"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

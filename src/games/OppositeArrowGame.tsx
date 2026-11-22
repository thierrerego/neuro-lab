import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type Direction = 'up' | 'down' | 'left' | 'right';
type ArrowRule = 'follow' | 'invert';

interface ArrowTrial {
  shownDir: Direction;
  rule: ArrowRule;
  fourWay: boolean;
}

const BLUE_HEX = '#0EA5E9';
const ORANGE_HEX = '#F59E0B';

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function makeTrial(stage: number, prev?: ArrowTrial): ArrowTrial {
  const lvl = Math.max(1, Math.floor(stage));
  const fourWay = lvl >= 7;
  const dirs: Direction[] = fourWay ? ['up', 'down', 'left', 'right'] : ['left', 'right'];
  // Nv.1: 85% azul (siga) | Nv.2-6: 60% -> 50% | Nv.13-20: maioria laranja (inversão forte)
  const followProb = lvl <= 1 ? 0.85 : lvl <= 5 ? 0.6 : lvl <= 12 ? 0.45 : 0.3;

  for (let i = 0; i < 12; i++) {
    const shownDir = dirs[Math.floor(Math.random() * dirs.length)];
    const rule: ArrowRule = Math.random() < followProb ? 'follow' : 'invert';
    if (!prev || shownDir !== prev.shownDir || rule !== prev.rule) {
      return { shownDir, rule, fourWay };
    }
  }
  return { shownDir: dirs[0], rule: 'follow', fourWay };
}

function renderDirectionIcon(dir: Direction, size: number) {
  switch (dir) {
    case 'up':
      return <ArrowUp size={size} strokeWidth={3} />;
    case 'down':
      return <ArrowDown size={size} strokeWidth={3} />;
    case 'left':
      return <ArrowLeft size={size} strokeWidth={3} />;
    case 'right':
      return <ArrowRight size={size} strokeWidth={3} />;
  }
}

export function OppositeArrowGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [trial, setTrial] = useState<ArrowTrial>(() => makeTrial(config.stage));
  const [tId, setTId] = useState(0);
  const [flash, setFlash] = useState<{ dir: Direction; ok: boolean } | null>(null);

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
    (dir: Direction) => {
      if (flash || paused || statsRef.current.finished) return;
      const rt = performance.now() - statsRef.current.shownAt;
      const expected = trial.rule === 'follow' ? trial.shownDir : OPPOSITE[trial.shownDir];
      const ok = dir === expected;
      let clearedAll = false;

      if (ok) {
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rts.push(rt);
        statsRef.current.rawPoints += 125 + Math.min(85, statsRef.current.combo * 14);
        sound.hit(statsRef.current.combo);
        clearedAll = onWaveHit();
      } else {
        statsRef.current.commission++;
        statsRef.current.combo = 0;
        statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 50);
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

      setFlash({ dir, ok });
      timerRef.current = window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setFlash(null);
        setTrial((prev) => makeTrial(configRef.current.stage, prev));
        setTId((id) => id + 1);
        statsRef.current.shownAt = performance.now();
        timerRef.current = null;
      }, ok ? 160 : 200);
    },
    [flash, paused, trial, onWaveHit, onWaveError, onLiveUpdate, finishNow]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePick('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePick('right');
      } else if (trial.fourWay && e.key === 'ArrowUp') {
        e.preventDefault();
        handlePick('up');
      } else if (trial.fourWay && e.key === 'ArrowDown') {
        e.preventDefault();
        handlePick('down');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePick, trial.fourWay]);

  const cueColor = trial.rule === 'follow' ? BLUE_HEX : ORANGE_HEX;
  const cueBg = trial.rule === 'follow' ? 'rgba(14, 165, 233, 0.10)' : 'rgba(245, 158, 11, 0.13)';

  const btnStyle = (dir: Direction) => {
    const isFb = flash?.dir === dir;
    return {
      background: isFb
        ? flash.ok
          ? 'rgba(16, 185, 129, 0.26)'
          : 'rgba(239, 68, 68, 0.26)'
        : 'var(--bg-subtle)',
      border: isFb
        ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
        : '1px solid var(--border)',
      color: isFb ? (flash.ok ? 'var(--ok)' : 'var(--err)') : 'var(--text)',
    };
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="flex items-center gap-3 px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wide"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: BLUE_HEX }} />
          Azul = Siga
        </span>
        <span style={{ color: 'var(--text-soft)' }}>·</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: ORANGE_HEX }} />
          Laranja = Inverta
        </span>
      </div>

      <div
        key={tId}
        className={`w-44 h-44 rounded-3xl flex flex-col items-center justify-center gap-2 animate-pop ${
          flash && !flash.ok ? 'animate-shake' : ''
        }`}
        style={{
          background: cueBg,
          border: `2px solid ${
            flash ? (flash.ok ? 'var(--ok)' : 'var(--err)') : cueColor
          }`,
          color: cueColor,
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {renderDirectionIcon(trial.shownDir, 76)}
      </div>

      {!trial.fourWay ? (
        <div className="grid grid-cols-2 gap-3 w-full max-w-[310px]">
          <button
            type="button"
            onClick={() => handlePick('left')}
            className={`py-4 px-3 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
              flash?.dir === 'left' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('left')}
          >
            <ArrowLeft size={22} strokeWidth={2.75} />
            <span>Esquerda</span>
          </button>
          <button
            type="button"
            onClick={() => handlePick('right')}
            className={`py-4 px-3 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
              flash?.dir === 'right' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('right')}
          >
            <span>Direita</span>
            <ArrowRight size={22} strokeWidth={2.75} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[246px]">
          <div />
          <button
            type="button"
            aria-label="Cima"
            onClick={() => handlePick('up')}
            className={`h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              flash?.dir === 'up' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('up')}
          >
            <ArrowUp size={28} strokeWidth={2.75} />
          </button>
          <div />

          <button
            type="button"
            aria-label="Esquerda"
            onClick={() => handlePick('left')}
            className={`h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              flash?.dir === 'left' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('left')}
          >
            <ArrowLeft size={28} strokeWidth={2.75} />
          </button>
          <div
            className="h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'transparent' }}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--border-strong)' }} />
          </div>
          <button
            type="button"
            aria-label="Direita"
            onClick={() => handlePick('right')}
            className={`h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              flash?.dir === 'right' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('right')}
          >
            <ArrowRight size={28} strokeWidth={2.75} />
          </button>

          <div />
          <button
            type="button"
            aria-label="Baixo"
            onClick={() => handlePick('down')}
            className={`h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              flash?.dir === 'down' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('down')}
          >
            <ArrowDown size={28} strokeWidth={2.75} />
          </button>
          <div />
        </div>
      )}
    </div>
  );
}

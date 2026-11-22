import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type SwitchRule = 'parity' | 'color';
type CardColor = 'blue' | 'green';
type AnswerKey = 'even' | 'odd' | 'blue' | 'green';

interface SwitchTrial {
  rule: SwitchRule;
  value: number;
  color: CardColor;
  remainingOnRule: number;
  ruleEpoch: number;
}

const COLOR_MAP: Record<CardColor, { label: string; hex: string; tint: string }> = {
  blue: { label: 'AZUL', hex: '#2563EB', tint: 'rgba(37, 99, 235, 0.10)' },
  green: { label: 'VERDE', hex: '#10B981', tint: 'rgba(16, 185, 129, 0.12)' },
};

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRunLength(stage: number): number {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 1) return 10; // Nível 1: regra única contínua (foco em fluidez inicial)
  if (lvl <= 4) return rnd(4, 5);
  if (lvl <= 10) return rnd(2, 3);
  return 1;
}

function pickStimulus(stage: number, prev?: SwitchTrial): { value: number; color: CardColor } {
  const lvl = Math.max(1, Math.floor(stage));
  const maxVal = lvl <= 4 ? 9 : lvl <= 12 ? 19 : 29;
  for (let i = 0; i < 12; i++) {
    const value = rnd(1, maxVal);
    const color: CardColor = Math.random() < 0.5 ? 'blue' : 'green';
    if (!prev || value !== prev.value || color !== prev.color) {
      return { value, color };
    }
  }
  return { value: 4, color: 'blue' };
}

function createInitialTrial(stage: number): SwitchTrial {
  const lvl = Math.max(1, Math.floor(stage));
  const rule: SwitchRule = lvl <= 1 ? 'color' : Math.random() < 0.5 ? 'parity' : 'color';
  const { value, color } = pickStimulus(stage);
  return {
    rule,
    value,
    color,
    remainingOnRule: getRunLength(stage),
    ruleEpoch: 0,
  };
}

function createNextTrial(stage: number, prev: SwitchTrial): SwitchTrial {
  const lvl = Math.max(1, Math.floor(stage));
  let nextRule = prev.rule;
  let remainingOnRule = prev.remainingOnRule - 1;
  let ruleEpoch = prev.ruleEpoch;

  if (lvl >= 11) {
    // Alternância aleatória rápida (60% de chance a cada rodada nos níveis altos)
    if (Math.random() < 0.6) {
      nextRule = prev.rule === 'parity' ? 'color' : 'parity';
      ruleEpoch = prev.ruleEpoch + 1;
    }
    remainingOnRule = 1;
  } else if (remainingOnRule <= 0) {
    nextRule = prev.rule === 'parity' ? 'color' : 'parity';
    remainingOnRule = getRunLength(stage);
    ruleEpoch = prev.ruleEpoch + 1;
  }

  const { value, color } = pickStimulus(stage, prev);
  return {
    rule: nextRule,
    value,
    color,
    remainingOnRule,
    ruleEpoch,
  };
}

export function RuleSwitchGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [trial, setTrial] = useState<SwitchTrial>(() => createInitialTrial(config.stage));
  const [tId, setTId] = useState(0);
  const [flash, setFlash] = useState<{ answer: AnswerKey; ok: boolean } | null>(null);

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
    (answer: AnswerKey) => {
      if (flash || paused || statsRef.current.finished) return;
      const rt = performance.now() - statsRef.current.shownAt;
      const expected: AnswerKey =
        trial.rule === 'parity'
          ? trial.value % 2 === 0
            ? 'even'
            : 'odd'
          : trial.color;
      const ok = answer === expected;
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

      setFlash({ answer, ok });
      timerRef.current = window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setFlash(null);
        setTrial((prev) => createNextTrial(configRef.current.stage, prev));
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
        handlePick(trial.rule === 'parity' ? 'even' : 'blue');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePick(trial.rule === 'parity' ? 'odd' : 'green');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePick, trial.rule]);

  const cardTheme = COLOR_MAP[trial.color];
  const isParityRule = trial.rule === 'parity';

  const btnStyle = (key: AnswerKey) => {
    const isFb = flash?.answer === key;
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
    <div className="w-full flex flex-col items-center gap-6">
      <div
        key={`rule-${trial.ruleEpoch}`}
        className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-black uppercase tracking-wider animate-pop"
        style={{
          background: isParityRule ? 'var(--accent-glow)' : 'rgba(245, 158, 11, 0.16)',
          color: isParityRule ? 'var(--accent)' : 'var(--warn)',
          border: `1.5px solid ${isParityRule ? 'var(--accent)' : 'var(--warn)'}`,
        }}
      >
        <span>{isParityRule ? 'PAR ou ÍMPAR' : 'AZUL ou VERDE'}</span>
      </div>

      <div
        key={tId}
        className={`w-44 h-44 rounded-3xl flex items-center justify-center text-6xl font-black tabular animate-pop ${
          flash && !flash.ok ? 'animate-shake' : ''
        }`}
        style={{
          background: cardTheme.tint,
          border: `2px solid ${
            flash ? (flash.ok ? 'var(--ok)' : 'var(--err)') : cardTheme.hex
          }`,
          color: cardTheme.hex,
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {trial.value}
      </div>

      {isParityRule ? (
        <div className="grid grid-cols-2 gap-3 w-full max-w-[310px]">
          <button
            type="button"
            onClick={() => handlePick('even')}
            className={`py-4 rounded-2xl font-extrabold text-base tracking-wide transition-all cursor-pointer active:scale-95 ${
              flash?.answer === 'even' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('even')}
          >
            PAR
          </button>
          <button
            type="button"
            onClick={() => handlePick('odd')}
            className={`py-4 rounded-2xl font-extrabold text-base tracking-wide transition-all cursor-pointer active:scale-95 ${
              flash?.answer === 'odd' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('odd')}
          >
            ÍMPAR
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 w-full max-w-[310px]">
          <button
            type="button"
            onClick={() => handlePick('blue')}
            className={`py-4 rounded-2xl font-extrabold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 ${
              flash?.answer === 'blue' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('blue')}
          >
            <span className="w-3.5 h-3.5 rounded-full" style={{ background: COLOR_MAP.blue.hex }} />
            <span>AZUL</span>
          </button>
          <button
            type="button"
            onClick={() => handlePick('green')}
            className={`py-4 rounded-2xl font-extrabold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 ${
              flash?.answer === 'green' && !flash.ok ? 'animate-shake' : ''
            }`}
            style={btnStyle('green')}
          >
            <span className="w-3.5 h-3.5 rounded-full" style={{ background: COLOR_MAP.green.hex }} />
            <span>VERDE</span>
          </button>
        </div>
      )}
    </div>
  );
}

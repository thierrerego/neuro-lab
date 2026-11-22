import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface TargetSumRound {
  cols: number;
  target: number;
  values: number[];
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

function getTierForStage(stage: number): { cols: number; count: number; min: number; max: number } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return { cols: 2, count: 4, min: 1, max: 5 };
  if (lvl <= 6) return { cols: 3, count: 6, min: 1, max: 10 };
  if (lvl <= 12) return { cols: 3, count: 6, min: 4, max: 22 };
  return { cols: 3, count: 9, min: 8, max: 45 };
}

function buildRound(stage: number, prevTarget?: number): TargetSumRound {
  const { cols, count, min, max } = getTierForStage(stage);

  let a = rnd(min, max);
  let b = rnd(min, max);
  for (let attempt = 0; attempt < 25; attempt++) {
    const ca = rnd(min, max);
    const cb = rnd(min, max);
    if (ca !== cb && ca + cb !== prevTarget) {
      a = ca;
      b = cb;
      break;
    }
  }
  if (a === b) {
    b = a < max ? a + 1 : a - 1;
  }

  const target = a + b;
  const values: number[] = [a, b];
  const used = new Set<number>([a, b]);

  // Tenta preencher os demais cartões com números distintos na faixa do nível
  let guard = 0;
  while (values.length < count && guard < 120) {
    guard++;
    const cand = rnd(min, max);
    if (!used.has(cand)) {
      used.add(cand);
      values.push(cand);
    }
  }
  while (values.length < count) {
    values.push(rnd(min, max));
  }

  return {
    cols,
    target,
    values: shuffle(values),
  };
}

export function TargetSumGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<TargetSumRound>(() => buildRound(config.stage));
  const [roundId, setRoundId] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ pair: [number, number]; ok: boolean } | null>(null);

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

  const handleCardTap = (idx: number) => {
    if (paused || statsRef.current.finished) return;

    // Durante flash de acerto aguarda a transição rápida; durante erro permite continuar na hora
    if (feedback?.ok) return;
    if (feedback && !feedback.ok) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setFeedback(null);
      setSelectedIdx(idx);
      sound.tap();
      return;
    }

    if (selectedIdx === null) {
      setSelectedIdx(idx);
      sound.tap();
      return;
    }

    if (selectedIdx === idx) {
      setSelectedIdx(null);
      sound.tap();
      return;
    }

    const sum = round.values[selectedIdx] + round.values[idx];
    const ok = sum === round.target;

    if (ok) {
      const rt = performance.now() - statsRef.current.shownAt;
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 135 + Math.min(90, statsRef.current.combo * 15);
      sound.hit(statsRef.current.combo);

      const clearedAll = onWaveHit();
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

      const pair: [number, number] = [selectedIdx, idx];
      setSelectedIdx(null);
      setFeedback({ pair, ok: true });
      timerRef.current = window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setFeedback(null);
        setRound((prev) => buildRound(configRef.current.stage, prev.target));
        setRoundId((id) => id + 1);
        statsRef.current.shownAt = performance.now();
        timerRef.current = null;
      }, 160);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      onWaveError?.();

      const tot = statsRef.current.correct + statsRef.current.commission;
      onLiveUpdate({
        score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
        accuracyPct: Math.round((statsRef.current.correct / tot) * 100),
        combo: statsRef.current.combo,
      });

      const pair: [number, number] = [selectedIdx, idx];
      setSelectedIdx(null);
      setFeedback({ pair, ok: false });
      timerRef.current = window.setTimeout(() => {
        setFeedback(null);
        timerRef.current = null;
      }, 210);
    }
  };

  const maxGridWidth = round.cols === 2 ? 'max-w-[260px]' : 'max-w-[310px]';
  const pickedVal = selectedIdx !== null ? round.values[selectedIdx] : null;

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        key={`target-${roundId}`}
        className="w-full max-w-[300px] py-4 px-5 rounded-3xl flex flex-col items-center gap-1 animate-pop"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Soma Alvo
        </span>
        <span className="text-5xl font-black tabular leading-tight" style={{ color: 'var(--accent)' }}>
          {round.target}
        </span>
        <span className="text-xs font-semibold tabular" style={{ color: 'var(--text-soft)' }}>
          {pickedVal !== null ? `${pickedVal} + ? = ${round.target}` : 'Toque em 2 números'}
        </span>
      </div>

      <div
        key={`grid-${roundId}`}
        className={`grid gap-2.5 w-full ${maxGridWidth} animate-pop`}
        style={{ gridTemplateColumns: `repeat(${round.cols}, minmax(0, 1fr))` }}
      >
        {round.values.map((val, idx) => {
          const isSelected = selectedIdx === idx;
          const inFeedback = feedback !== null && (feedback.pair[0] === idx || feedback.pair[1] === idx);
          const isOk = inFeedback && feedback.ok;
          const isErr = inFeedback && !feedback.ok;

          return (
            <button
              key={`${roundId}-${idx}`}
              type="button"
              onClick={() => handleCardTap(idx)}
              className={`h-20 rounded-2xl font-black tabular text-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                isErr ? 'animate-shake' : ''
              }`}
              style={{
                background: isOk
                  ? 'rgba(16, 185, 129, 0.24)'
                  : isErr
                    ? 'rgba(239, 68, 68, 0.24)'
                    : isSelected
                      ? 'var(--accent-glow)'
                      : 'var(--bg-subtle)',
                border: isOk
                  ? '2px solid var(--ok)'
                  : isErr
                    ? '2px solid var(--err)'
                    : isSelected
                      ? '2px solid var(--accent)'
                      : '1px solid var(--border)',
                color: isOk ? 'var(--ok)' : isErr ? 'var(--err)' : isSelected ? 'var(--accent)' : 'var(--text)',
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

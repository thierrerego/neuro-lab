import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

const ALL_SYMBOLS = ['◆', '▲', '●', '★', '✦', '✚', '⬟', '◈', '☾'];

export function SymbolDigitGame({ config, finishRequested, onWaveHit, onLiveUpdate, onFinish }: MinigameProps) {
  const [shuffledPool] = useState(() => [...ALL_SYMBOLS].sort(() => Math.random() - 0.5));
  const pairCount = config.easeBoost ? 3 : Math.min(9, 3 + config.stage);

  const legend = useMemo(
    () => shuffledPool.slice(0, pairCount).map((sym, i) => ({ sym, digit: i + 1 })),
    [shuffledPool, pairCount]
  );

  const [targetIdx, setTargetIdx] = useState(0);
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

  const safeIdx = targetIdx % legend.length;

  const pickDigit = useCallback(
    (digit: number) => {
      if (statsRef.current.finished) return;
      const rt = performance.now() - statsRef.current.shownAt;
      const expected = legend[safeIdx].digit;
      const ok = digit === expected;
      let clearedAll = false;

      if (ok) {
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rts.push(rt);
        statsRef.current.rawPoints += 110 + Math.min(70, statsRef.current.combo * 10);
        sound.hit(statsRef.current.combo);
        setFlash('ok');
        clearedAll = onWaveHit();
      } else {
        statsRef.current.commission++;
        statsRef.current.combo = 0;
        statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
        sound.miss();
        setFlash('err');
      }
      setTimeout(() => setFlash(null), 150);

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

      let next = Math.floor(Math.random() * legend.length);
      if (next === safeIdx) next = (next + 1) % legend.length;
      setTargetIdx(next);
      statsRef.current.shownAt = performance.now();
    },
    [legend, safeIdx, onWaveHit, onLiveUpdate, finishNow]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= legend.length) pickDigit(n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickDigit, legend.length]);

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="grid gap-1.5 w-full max-w-[330px] p-2 rounded-2xl"
        style={{
          gridTemplateColumns: `repeat(${Math.min(legend.length, 5)}, minmax(0, 1fr))`,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
        }}
      >
        {legend.map((item) => (
          <div key={item.digit} className="flex flex-col items-center py-1.5 rounded-xl" style={{ background: 'var(--bg-card)' }}>
            <span className="text-lg leading-none" style={{ color: 'var(--accent)' }}>{item.sym}</span>
            <span className="text-xs font-black mt-1 tabular" style={{ color: 'var(--text-muted)' }}>{item.digit}</span>
          </div>
        ))}
      </div>

      <div
        className={`w-28 h-28 rounded-3xl flex items-center justify-center text-5xl font-black transition-all ${flash === 'err' ? 'animate-shake' : ''}`}
        style={{
          background: 'var(--bg-card)',
          border:
            flash === 'ok'
              ? '2px solid var(--ok)'
              : flash === 'err'
                ? '2px solid var(--err)'
                : '2px solid var(--border-strong)',
          color: 'var(--text)',
        }}
      >
        {legend[safeIdx].sym}
      </div>

      <div
        className="grid gap-2 w-full max-w-[310px]"
        style={{ gridTemplateColumns: `repeat(${legend.length <= 4 ? legend.length : 3}, minmax(0, 1fr))` }}
      >
        {legend.map((item) => (
          <button
            key={item.digit}
            onClick={() => pickDigit(item.digit)}
            className="py-3.5 rounded-2xl font-black text-xl tabular btn-soft cursor-pointer"
          >
            {item.digit}
          </button>
        ))}
      </div>
    </div>
  );
}

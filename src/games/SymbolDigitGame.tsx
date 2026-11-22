import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

const ALL_SYMBOLS = ['◆', '▲', '●', '★', '✦', '✚', '⬟', '◈', '☾'];

export function SymbolDigitGame({ config, finishRequested, onLiveUpdate, onFinish }: MinigameProps) {
  const pairCount = Math.min(9, 4 + config.stage);
  const [legend] = useState(() => {
    const shuffled = [...ALL_SYMBOLS].sort(() => Math.random() - 0.5).slice(0, pairCount);
    return shuffled.map((sym, i) => ({ sym, digit: i + 1 }));
  });

  const [targetIdx, setTargetIdx] = useState(() => Math.floor(Math.random() * pairCount));
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
    finished: false,
  });

  useEffect(() => {
    if (finishRequested && !statsRef.current.finished) {
      statsRef.current.finished = true;
      onFinish({
        correct: statsRef.current.correct,
        commissionErrors: statsRef.current.commission,
        omissionErrors: 0,
        reactionTimesMs: statsRef.current.rts,
        rawPoints: statsRef.current.rawPoints,
      });
    }
  }, [finishRequested, onFinish]);

  const pickDigit = useCallback(
    (digit: number) => {
      if (statsRef.current.finished) return;
      const rt = performance.now() - statsRef.current.shownAt;
      const expected = legend[targetIdx].digit;
      const ok = digit === expected;

      if (ok) {
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rts.push(rt);
        statsRef.current.rawPoints += 110 + Math.min(70, statsRef.current.combo * 10);
        sound.hit(statsRef.current.combo);
        setFlash('ok');
      } else {
        statsRef.current.commission++;
        statsRef.current.combo = 0;
        statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
        sound.miss();
        setFlash('err');
      }
      setTimeout(() => setFlash(null), 160);

      const tot = statsRef.current.correct + statsRef.current.commission;
      onLiveUpdate({
        score: Math.round(statsRef.current.rawPoints * config.scoreMultiplier),
        accuracyPct: Math.round((statsRef.current.correct / tot) * 100),
        combo: statsRef.current.combo,
      });

      let next = Math.floor(Math.random() * pairCount);
      if (next === targetIdx) next = (next + 1) % pairCount;
      setTargetIdx(next);
      statsRef.current.shownAt = performance.now();
    },
    [legend, targetIdx, pairCount, config.scoreMultiplier, onLiveUpdate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= pairCount) pickDigit(n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickDigit, pairCount]);

  return (
    <div className="w-full flex flex-col items-center gap-5">
      {/* Tabela fixa símbolo -> número */}
      <div
        className="grid gap-1.5 w-full max-w-[330px] p-2 rounded-2xl"
        style={{
          gridTemplateColumns: `repeat(${Math.min(pairCount, 5)}, minmax(0, 1fr))`,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
        }}
      >
        {legend.map((item) => (
          <div
            key={item.digit}
            className="flex flex-col items-center py-1.5 rounded-xl"
            style={{ background: 'var(--bg-card)' }}
          >
            <span className="text-lg leading-none" style={{ color: 'var(--accent)' }}>{item.sym}</span>
            <span className="text-xs font-black mt-1 tabular" style={{ color: 'var(--text-muted)' }}>{item.digit}</span>
          </div>
        ))}
      </div>

      {/* Símbolo alvo */}
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
        {legend[targetIdx].sym}
      </div>

      {/* Teclado numérico */}
      <div
        className="grid gap-2 w-full max-w-[310px]"
        style={{ gridTemplateColumns: `repeat(${pairCount <= 4 ? 4 : pairCount <= 6 ? 3 : 3}, minmax(0, 1fr))` }}
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

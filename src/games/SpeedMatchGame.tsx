import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface CardItem {
  symbol: string;
  color: string;
}

const SYMBOLS = ['◆', '▲', '●', '■', '★', '⬟'];
const COLORS = ['#38bdf8', '#f472b6', '#34d399', '#fbbf24'];

function randomCard(effectiveDiff: number): CardItem {
  const symPool = SYMBOLS.slice(0, Math.min(SYMBOLS.length, 3 + Math.ceil(effectiveDiff / 2)));
  const colPool = COLORS.slice(0, effectiveDiff >= 2 ? COLORS.length : 2);
  return {
    symbol: symPool[Math.floor(Math.random() * symPool.length)],
    color: colPool[Math.floor(Math.random() * colPool.length)],
  };
}

function nextCardFrom(prev: CardItem, effectiveDiff: number): { card: CardItem; same: boolean } {
  const same = Math.random() < 0.48;
  if (same) return { card: { ...prev }, same: true };
  let candidate = randomCard(effectiveDiff);
  for (let i = 0; i < 12; i++) {
    if (candidate.symbol !== prev.symbol || candidate.color !== prev.color) break;
    candidate = randomCard(effectiveDiff);
  }
  return { card: candidate, same: candidate.symbol === prev.symbol && candidate.color === prev.color };
}

export function SpeedMatchGame({ config, finishRequested, onWaveHit, onLiveUpdate, onFinish }: MinigameProps) {
  const [prevCard, setPrevCard] = useState<CardItem>(() => randomCard(config.stage));
  const [current, setCurrent] = useState<CardItem | null>(null);
  const [isSame, setIsSame] = useState(false);
  const [cardId, setCardId] = useState(0);
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
    const t = window.setTimeout(() => {
      const n = nextCardFrom(prevCard, configRef.current.stage);
      setCurrent(n.card);
      setIsSame(n.same);
      setCardId(1);
      statsRef.current.shownAt = performance.now();
    }, 950);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (finishRequested) finishNow();
  }, [finishRequested, finishNow]);

  const answer = useCallback(
    (userSaysSame: boolean) => {
      if (!current || statsRef.current.finished) return;
      const rt = performance.now() - statsRef.current.shownAt;
      const ok = userSaysSame === isSame;
      let clearedAll = false;

      if (ok) {
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rts.push(rt);
        statsRef.current.rawPoints += 100 + Math.min(80, statsRef.current.combo * 10);
        sound.hit(statsRef.current.combo);
        setFlash('ok');
        clearedAll = onWaveHit();
      } else {
        statsRef.current.commission++;
        statsRef.current.combo = 0;
        statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
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

      const nxt = nextCardFrom(current, configRef.current.stage);
      setPrevCard(current);
      setCurrent(nxt.card);
      setIsSame(nxt.same);
      setCardId((id) => id + 1);
      statsRef.current.shownAt = performance.now();
    },
    [current, isSame, onWaveHit, onLiveUpdate, finishNow]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answer(false);
      else if (e.key === 'ArrowRight') answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  const display = current ?? prevCard;

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
        {current ? 'Igual à anterior?' : 'Memorize'}
      </div>

      <div
        key={cardId}
        className={`w-36 h-44 rounded-3xl flex items-center justify-center text-6xl font-black animate-pop ${flash === 'err' ? 'animate-shake' : ''}`}
        style={{
          background: 'var(--bg-card)',
          border:
            flash === 'ok'
              ? '2px solid var(--ok)'
              : flash === 'err'
                ? '2px solid var(--err)'
                : '2px solid var(--border-strong)',
          color: display.color,
          boxShadow: '0 14px 36px rgba(0,0,0,0.35)',
        }}
      >
        {display.symbol}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
        <button
          disabled={!current}
          onClick={() => answer(false)}
          className="py-4 rounded-2xl font-bold text-base btn-soft cursor-pointer disabled:opacity-35"
        >
          ✕ Diferente
        </button>
        <button
          disabled={!current}
          onClick={() => answer(true)}
          className="py-4 rounded-2xl font-bold text-base btn-accent cursor-pointer disabled:opacity-35"
        >
          ✓ Igual
        </button>
      </div>
    </div>
  );
}

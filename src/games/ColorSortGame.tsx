import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface BinColor {
  id: string;
  label: string;
  hex: string;
}

const PALETTE: BinColor[] = [
  { id: 'blue', label: 'Azul', hex: '#2563EB' },
  { id: 'green', label: 'Verde', hex: '#059669' },
  { id: 'amber', label: 'Amarelo', hex: '#D97706' },
  { id: 'rose', label: 'Vermelho', hex: '#E11D48' },
];

const SHAPES = ['●', '◆', '★', '▲', '⬟'];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function ColorSortGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [bins, setBins] = useState<BinColor[]>(() => PALETTE);
  const [current, setCurrent] = useState<{ color: BinColor; shape: string }>(() => ({
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    shape: SHAPES[0],
  }));
  const [feedback, setFeedback] = useState<{ binId: string; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const streakSinceShuffleRef = useRef(0);

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

  const nextItem = (prevId: string) => {
    const lvl = Math.max(1, Math.floor(configRef.current.stage));
    streakSinceShuffleRef.current += 1;
    // Em ritmos maiores, embaralha a posição dos cestos a cada 3-4 acertos para manter atenção viva
    if (lvl >= 6 && streakSinceShuffleRef.current >= (lvl >= 12 ? 3 : 4)) {
      streakSinceShuffleRef.current = 0;
      setBins((b) => shuffle(b));
    }
    const candidates = PALETTE.filter((c) => c.id !== prevId);
    const nextColor =
      Math.random() < 0.78
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    setCurrent({ color: nextColor, shape });
    statsRef.current.shownAt = performance.now();
  };

  const handleBinTap = (bin: BinColor) => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(100, performance.now() - statsRef.current.shownAt);
    const ok = bin.id === current.color.id;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 110 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);
      setFeedback({ binId: bin.id, ok: true });

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 160);
        return;
      }
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setFeedback(null);
        nextItem(current.color.id);
      }, 150);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 30);
      sound.miss();
      setFeedback({ binId: bin.id, ok: false });
      onWaveError?.();
      emitLive();
      window.setTimeout(() => setFeedback(null), 240);
    }
  };

  return (
    <div className="w-full max-w-[420px] flex flex-col items-center gap-6">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Jogue a peça na cor igual!
      </div>

      <div
        className="w-28 h-28 rounded-3xl flex items-center justify-center text-6xl shadow-lg animate-pop"
        style={{
          background: `${current.color.hex}18`,
          border: `3px solid ${current.color.hex}`,
          color: current.color.hex,
        }}
      >
        {current.shape}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {bins.map((bin) => {
          const isFb = feedback?.binId === bin.id;
          return (
            <button
              key={bin.id}
              type="button"
              onClick={() => handleBinTap(bin)}
              className={`min-h-[64px] rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95 ${
                isFb && !feedback.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isFb
                  ? feedback.ok
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(239, 68, 68, 0.25)'
                  : `${bin.hex}20`,
                border: `2.5px solid ${bin.hex}`,
                color: bin.hex,
              }}
            >
              <span className="w-4 h-4 rounded-full" style={{ background: bin.hex }} />
              <span>{bin.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

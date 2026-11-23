import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface GemColor {
  id: 'red' | 'blue' | 'green' | 'yellow';
  label: string;
  emoji: string;
  hex: string;
}

const GEM_COLORS: GemColor[] = [
  { id: 'red', label: 'Vermelho', emoji: '🔴', hex: '#EF4444' },
  { id: 'blue', label: 'Azul', emoji: '🔵', hex: '#3B82F6' },
  { id: 'green', label: 'Verde', emoji: '🟢', hex: '#10B981' },
  { id: 'yellow', label: 'Amarelo', emoji: '🟡', hex: '#F59E0B' },
];

interface TreasureRound {
  tokens: GemColor[];
  options: GemColor[];
  winnerId: GemColor['id'];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createRound(stage: number): TreasureRound {
  const lvl = Math.max(1, Math.floor(stage));
  const colorCount = lvl <= 3 ? 3 : 4;
  const options = shuffle(GEM_COLORS).slice(0, colorCount);
  const winner = options[0];
  const others = options.slice(1);

  const margin = lvl <= 2 ? 3 : lvl <= 6 ? 2 : 1;
  const baseOther = lvl <= 2 ? 3 : lvl <= 6 ? 4 : 5;
  const winnerCount = baseOther + margin;

  const tokens: GemColor[] = [];
  for (let i = 0; i < winnerCount; i++) tokens.push(winner);

  others.forEach((col, idx) => {
    const cnt = Math.max(2, baseOther - (idx % 2));
    for (let i = 0; i < cnt; i++) tokens.push(col);
  });

  return {
    tokens: shuffle(tokens),
    options: shuffle(options),
    winnerId: winner.id,
  };
}

export function TreasureHuntGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<TreasureRound>(() => createRound(config.stage));
  const [picked, setPicked] = useState<{ id: string; ok: boolean } | null>(null);

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

  const handleChoose = (opt: GemColor) => {
    if (paused || picked !== null || statsRef.current.finished) return;
    const now = performance.now();
    const rt = Math.max(120, now - statsRef.current.roundStart);
    const isOk = opt.id === round.winnerId;

    setPicked({ id: opt.id, ok: isOk });

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
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Qual cor aparece MAIS vezes? 💎
      </div>

      <div
        className="w-full max-w-[348px] min-h-[190px] rounded-3xl p-4 flex flex-wrap items-center justify-center gap-2.5"
        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)' }}
      >
        {round.tokens.map((tok, i) => (
          <span key={i} className="text-3xl leading-none select-none">
            {tok.emoji}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-full max-w-[348px]">
        {round.options.map((opt) => {
          const isPicked = picked?.id === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleChoose(opt)}
              className={`h-14 rounded-2xl px-4 font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                isPicked && !picked.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isPicked
                  ? picked.ok
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)'
                  : 'var(--bg-card)',
                border: isPicked
                  ? `2px solid ${picked.ok ? 'var(--ok)' : 'var(--err)'}`
                  : `1.5px solid ${opt.hex}55`,
              }}
            >
              <span className="text-2xl leading-none">{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

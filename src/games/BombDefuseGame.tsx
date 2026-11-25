import { useEffect, useRef, useState } from 'react';
import { Bomb, Flame, Gem, Gift, Skull, Sparkles, Star } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type PrizeId = 'star' | 'gem' | 'gift' | 'sparkles';
type BombId = 'bomb' | 'flame' | 'skull';

interface DropStimulus {
  id: number;
  lane: 0 | 1 | 2;
  kind: 'prize' | 'bomb';
  iconId: PrizeId | BombId;
  spawnedAt: number;
  ttlMs: number;
}

const PRIZES: PrizeId[] = ['star', 'gem', 'gift', 'sparkles'];
const BOMBS: BombId[] = ['bomb', 'flame', 'skull'];

function renderStimIcon(id: PrizeId | BombId) {
  switch (id) {
    case 'star':
      return <Star size={44} fill="currentColor" />;
    case 'gem':
      return <Gem size={44} strokeWidth={2.2} />;
    case 'gift':
      return <Gift size={44} strokeWidth={2.2} />;
    case 'sparkles':
      return <Sparkles size={44} strokeWidth={2.2} />;
    case 'bomb':
      return <Bomb size={44} strokeWidth={2.3} />;
    case 'flame':
      return <Flame size={44} fill="currentColor" />;
    case 'skull':
      return <Skull size={44} strokeWidth={2.2} />;
  }
}

function getSpec(stage: number): { ttlMs: number; bombChance: number } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return { ttlMs: 1450, bombChance: 0.28 };
  if (lvl <= 6) return { ttlMs: 1200, bombChance: 0.34 };
  if (lvl <= 11) return { ttlMs: 980, bombChance: 0.38 };
  if (lvl <= 16) return { ttlMs: 820, bombChance: 0.42 };
  return { ttlMs: 700, bombChance: 0.45 };
}

export function BombDefuseGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [stim, setStim] = useState<DropStimulus | null>(null);
  const [flash, setFlash] = useState<{ lane: number; ok: boolean; label: string } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const seqRef = useRef(0);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    omission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    finished: false,
  });

  const finishNow = () => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    onFinish({
      correct: statsRef.current.correct,
      commissionErrors: statsRef.current.commission,
      omissionErrors: statsRef.current.omission,
      reactionTimesMs: statsRef.current.rts,
      rawPoints: statsRef.current.rawPoints,
    });
  };

  useEffect(() => {
    if (finishRequested) finishNow();
  }, [finishRequested]);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission + s.omission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const spawnNext = () => {
    if (statsRef.current.finished) return;
    const { ttlMs, bombChance } = getSpec(configRef.current.stage);
    const isBomb = Math.random() < bombChance;
    const lane = Math.floor(Math.random() * 3) as 0 | 1 | 2;
    const iconId = isBomb
      ? BOMBS[Math.floor(Math.random() * BOMBS.length)]
      : PRIZES[Math.floor(Math.random() * PRIZES.length)];

    seqRef.current += 1;
    setStim({
      id: seqRef.current,
      lane,
      kind: isBomb ? 'bomb' : 'prize',
      iconId,
      spawnedAt: performance.now(),
      ttlMs,
    });
  };

  useEffect(() => {
    if (paused || statsRef.current.finished) return;
    if (!stim) {
      const id = window.setTimeout(spawnNext, 260);
      return () => window.clearTimeout(id);
    }

    const expireId = window.setTimeout(() => {
      if (statsRef.current.finished) return;
      if (stim.kind === 'bomb') {
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rawPoints += 115 + Math.min(70, statsRef.current.combo * 10);
        sound.hit(statsRef.current.combo);
        setFlash({ lane: stim.lane, ok: true, label: 'Segurou!' });
        const clearedAll = onWaveHit();
        emitLive();
        setStim(null);
        if (clearedAll) {
          window.setTimeout(() => finishNow(), 180);
          return;
        }
        window.setTimeout(() => setFlash(null), 220);
      } else {
        statsRef.current.omission++;
        statsRef.current.combo = 0;
        onWaveError?.();
        emitLive();
        setStim(null);
      }
    }, stim.ttlMs);

    return () => window.clearTimeout(expireId);
  }, [stim, paused]);

  const handleTapLane = (lane: 0 | 1 | 2) => {
    if (paused || !stim || statsRef.current.finished) return;
    if (stim.lane !== lane) return;

    const rt = Math.max(100, performance.now() - stim.spawnedAt);
    if (stim.kind === 'prize') {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 120 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);
      setFlash({ lane, ok: true, label: 'Pegou!' });
      setStim(null);
      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      window.setTimeout(() => setFlash(null), 200);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      setFlash({ lane, ok: false, label: 'Bomba!' });
      setStim(null);
      onWaveError?.();
      emitLive();
      window.setTimeout(() => setFlash(null), 280);
    }
  };

  return (
    <div className="w-full max-w-[430px] flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full text-center flex items-center gap-1.5"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        <Star size={14} />
        <span>Pegue os verdes · NÃO toque nos vermelhos</span>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full">
        {([0, 1, 2] as const).map((lane) => {
          const active = stim?.lane === lane;
          const isBomb = active && stim?.kind === 'bomb';
          const isPrize = active && stim?.kind === 'prize';
          const isFb = flash?.lane === lane;

          return (
            <button
              key={lane}
              type="button"
              onClick={() => handleTapLane(lane)}
              className={`h-[170px] rounded-3xl flex flex-col items-center justify-center gap-2 transition-all duration-100 cursor-pointer select-none ${
                isFb && !flash.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isFb
                  ? flash.ok
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)'
                  : isBomb
                    ? 'rgba(239, 68, 68, 0.14)'
                    : isPrize
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                  : isBomb
                    ? '2px solid var(--err)'
                    : isPrize
                      ? '2px solid var(--ok)'
                      : '1.5px solid var(--border)',
                color: isBomb ? 'var(--err)' : isPrize ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {active ? renderStimIcon(stim.iconId) : null}
              {isFb && (
                <span
                  className="text-[11px] font-extrabold"
                  style={{ color: flash.ok ? 'var(--ok)' : 'var(--err)' }}
                >
                  {flash.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

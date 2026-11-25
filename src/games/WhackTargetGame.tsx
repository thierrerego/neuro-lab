import { useEffect, useRef, useState } from 'react';
import { Ban, Gem, ShieldOff, Star, Target, Zap } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type HitIconId = 'zap' | 'target' | 'star' | 'gem';
type DecoyIconId = 'ban' | 'shield';

interface TargetSlot {
  cell: number;
  kind: 'hit' | 'decoy';
  iconId: HitIconId | DecoyIconId;
  spawnedAt: number;
  ttlMs: number;
}

function getSpec(stage: number): { gridSize: number; ttlMs: number; decoyChance: number } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 2) return { gridSize: 3, ttlMs: 1750, decoyChance: 0 };
  if (lvl <= 5) return { gridSize: 3, ttlMs: 1400, decoyChance: 0.12 };
  if (lvl <= 10) return { gridSize: 4, ttlMs: 1180, decoyChance: 0.22 };
  if (lvl <= 15) return { gridSize: 4, ttlMs: 960, decoyChance: 0.28 };
  return { gridSize: 4, ttlMs: 800, decoyChance: 0.32 };
}

const HIT_ICONS: HitIconId[] = ['zap', 'target', 'star', 'gem'];
const DECOY_ICONS: DecoyIconId[] = ['ban', 'shield'];

function renderSlotIcon(iconId: HitIconId | DecoyIconId, size: number) {
  switch (iconId) {
    case 'zap':
      return <Zap size={size} fill="currentColor" />;
    case 'target':
      return <Target size={size} strokeWidth={2.5} />;
    case 'star':
      return <Star size={size} fill="currentColor" />;
    case 'gem':
      return <Gem size={size} strokeWidth={2.3} />;
    case 'ban':
      return <Ban size={size} strokeWidth={2.5} />;
    case 'shield':
      return <ShieldOff size={size} strokeWidth={2.4} />;
  }
}

export function WhackTargetGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const spec = getSpec(config.stage);
  const [gridSize, setGridSize] = useState(spec.gridSize);
  const [slot, setSlot] = useState<TargetSlot | null>(null);
  const [flash, setFlash] = useState<{ cell: number; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const lastCellRef = useRef(-1);

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
    const cur = getSpec(configRef.current.stage);
    setGridSize(cur.gridSize);
    const totalCells = cur.gridSize * cur.gridSize;
    let cell = Math.floor(Math.random() * totalCells);
    if (cell === lastCellRef.current) cell = (cell + 1 + Math.floor(Math.random() * (totalCells - 1))) % totalCells;
    lastCellRef.current = cell;

    const isDecoy = Math.random() < cur.decoyChance;
    const iconId = isDecoy
      ? DECOY_ICONS[Math.floor(Math.random() * DECOY_ICONS.length)]
      : HIT_ICONS[Math.floor(Math.random() * HIT_ICONS.length)];

    setSlot({
      cell,
      kind: isDecoy ? 'decoy' : 'hit',
      iconId,
      spawnedAt: performance.now(),
      ttlMs: cur.ttlMs,
    });
  };

  useEffect(() => {
    if (paused || statsRef.current.finished) return;
    if (!slot) {
      const id = window.setTimeout(spawnNext, 220);
      return () => window.clearTimeout(id);
    }

    const expireId = window.setTimeout(() => {
      if (statsRef.current.finished) return;
      if (slot.kind === 'hit') {
        statsRef.current.omission++;
        statsRef.current.combo = 0;
        onWaveError?.();
        emitLive();
      }
      setSlot(null);
    }, slot.ttlMs);

    return () => window.clearTimeout(expireId);
  }, [slot, paused]);

  const handleTap = (idx: number) => {
    if (paused || statsRef.current.finished) return;

    if (slot && slot.cell === idx && slot.kind === 'hit') {
      const rt = Math.max(100, performance.now() - slot.spawnedAt);
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 120 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);
      setFlash({ cell: idx, ok: true });
      setSlot(null);

      const clearedAll = onWaveHit();
      emitLive();

      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      window.setTimeout(() => setFlash(null), 190);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 30);
      sound.miss();
      setFlash({ cell: idx, ok: false });
      if (slot && slot.cell === idx) setSlot(null);
      onWaveError?.();
      emitLive();
      window.setTimeout(() => setFlash(null), 240);
    }
  };

  const totalCells = gridSize * gridSize;

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full text-center flex items-center gap-1.5"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        <Zap size={14} />
        <span>
          {spec.decoyChance > 0
            ? 'Toque nos alvos dourados · Ignore bloqueios'
            : 'Toque no alvo assim que acender'}
        </span>
      </div>

      <div
        className={`grid gap-2.5 w-full ${gridSize === 3 ? 'max-w-[300px]' : 'max-w-[340px]'}`}
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalCells }, (_, idx) => {
          const isActive = slot?.cell === idx;
          const isHit = isActive && slot?.kind === 'hit';
          const isDecoy = isActive && slot?.kind === 'decoy';
          const isFb = flash?.cell === idx;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleTap(idx)}
              className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-100 cursor-pointer select-none ${
                isActive ? 'scale-[1.03]' : ''
              } ${isFb && !flash.ok ? 'animate-shake' : ''}`}
              style={{
                background: isFb
                  ? flash.ok
                    ? 'rgba(16, 185, 129, 0.24)'
                    : 'rgba(239, 68, 68, 0.22)'
                  : isHit
                    ? 'rgba(245, 158, 11, 0.22)'
                    : isDecoy
                      ? 'rgba(100, 116, 139, 0.22)'
                      : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                  : isHit
                    ? '2px solid #F59E0B'
                    : isDecoy
                      ? '2px solid #64748B'
                      : '1.5px solid var(--border)',
                color: isHit ? '#D97706' : isDecoy ? '#64748B' : 'var(--text)',
                boxShadow: isHit ? '0 0 18px rgba(245, 158, 11, 0.28)' : 'none',
              }}
            >
              {isActive ? renderSlotIcon(slot.iconId, gridSize === 3 ? 34 : 28) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

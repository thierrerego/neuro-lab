import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isTarget: boolean;
  picked: boolean;
}

type Phase = 'memorize' | 'move' | 'pick';

const ARENA = 300;
const RADIUS = 18;

function createBalls(total: number, targets: number, speed: number): Ball[] {
  const balls: Ball[] = [];
  for (let i = 0; i < total; i++) {
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      x = RADIUS + 12 + Math.random() * (ARENA - (RADIUS + 12) * 2);
      y = RADIUS + 12 + Math.random() * (ARENA - (RADIUS + 12) * 2);
      if (balls.every((b) => Math.hypot(b.x - x, b.y - y) > RADIUS * 2.6)) break;
    }
    const ang = Math.random() * Math.PI * 2;
    balls.push({
      id: i,
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      isTarget: i < targets,
      picked: false,
    });
  }
  return balls;
}

function getTrackingParams(stage: number) {
  const lvl = Math.max(1, Math.min(20, Math.floor(stage)));
  // Curva calibrada para 20 níveis:
  // Nv.1-2: 1 alvo entre 4 bolinhas calmas | Nv.3-6: 2 alvos (5-6 bolas)
  // Nv.7-12: 3 alvos (7-8 bolas) | Nv.13-17: 4 alvos (9-10 bolas) | Nv.18-20: 5 alvos (11 bolas)
  const targets = lvl <= 2 ? 1 : lvl <= 6 ? 2 : lvl <= 12 ? 3 : lvl <= 17 ? 4 : 5;
  const total =
    lvl <= 2 ? 4 : lvl <= 4 ? 5 : lvl <= 7 ? 6 : lvl <= 10 ? 7 : lvl <= 13 ? 8 : lvl <= 16 ? 9 : lvl <= 18 ? 10 : 11;
  const speed = Number(Math.min(2.35, 0.7 + (lvl - 1) * 0.085).toFixed(2));
  return { targets, total, speed };
}

export function SustainedTrackingGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const init = getTrackingParams(config.stage);

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('memorize');
  const [balls, setBalls] = useState<Ball[]>(() => createBalls(init.total, init.targets, init.speed));
  const [wrongPick, setWrongPick] = useState<number | null>(null);

  const ballsRef = useRef<Ball[]>(balls);
  ballsRef.current = balls;

  const configRef = useRef(config);
  configRef.current = config;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    pickStart: performance.now(),
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
    if (paused) return;
    if (phase === 'memorize') {
      const t = setTimeout(() => setPhase('move'), 1550);
      return () => clearTimeout(t);
    }
    if (phase === 'move') {
      let raf = 0;
      const moveDur = Math.min(3100, 2100 + configRef.current.stage * 110);
      const start = performance.now();

      const step = (now: number) => {
        if (pausedRef.current) return;
        const next = ballsRef.current.map((b) => {
          let nx = b.x + b.vx;
          let ny = b.y + b.vy;
          let nvx = b.vx;
          let nvy = b.vy;
          if (nx < RADIUS + 6 || nx > ARENA - RADIUS - 6) {
            nvx = -nvx;
            nx = Math.max(RADIUS + 6, Math.min(ARENA - RADIUS - 6, nx));
          }
          if (ny < RADIUS + 6 || ny > ARENA - RADIUS - 6) {
            nvy = -nvy;
            ny = Math.max(RADIUS + 6, Math.min(ARENA - RADIUS - 6, ny));
          }
          return { ...b, x: nx, y: ny, vx: nvx, vy: nvy };
        });

        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < RADIUS * 2.08) {
              const tvx = next[i].vx;
              const tvy = next[i].vy;
              next[i].vx = next[j].vx;
              next[i].vy = next[j].vy;
              next[j].vx = tvx;
              next[j].vy = tvy;
            }
          }
        }

        ballsRef.current = next;
        setBalls(next);

        if (now - start < moveDur) {
          raf = requestAnimationFrame(step);
        } else {
          statsRef.current.pickStart = performance.now();
          setPhase('pick');
        }
      };

      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }
  }, [phase, round, paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const spawnNextRound = () => {
    setTimeout(() => {
      if (statsRef.current.finished) return;
      const p = getTrackingParams(configRef.current.stage);
      setRound((r) => r + 1);
      setBalls(createBalls(p.total, p.targets, p.speed));
      setPhase('memorize');
    }, 320);
  };

  const handleBallClick = (ball: Ball) => {
    if (phase !== 'pick' || paused || ball.picked || statsRef.current.finished) return;
    const rt = performance.now() - statsRef.current.pickStart;
    statsRef.current.pickStart = performance.now();

    if (ball.isTarget) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 150 + statsRef.current.combo * 15;
      sound.hit(statsRef.current.combo);

      const clearedAll = onWaveHit();
      const updated = balls.map((b) => (b.id === ball.id ? { ...b, picked: true } : b));
      setBalls(updated);
      emitLive();

      if (clearedAll) {
        setTimeout(() => finishNow(), 180);
        return;
      }

      const left = updated.filter((b) => b.isTarget && !b.picked).length;
      if (left === 0) {
        spawnNextRound();
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 50);
      sound.miss();
      setWrongPick(ball.id);
      setTimeout(() => setWrongPick(null), 320);
      emitLive();
      onWaveError?.();
      spawnNextRound();
    }
  };

  const phaseLabel = phase === 'memorize' ? 'Memorize as amarelas' : phase === 'move' ? 'Acompanhe' : 'Toque nos alvos';

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: phase === 'pick' ? 'var(--ok)' : 'var(--accent)' }}>
        {phaseLabel}
      </div>

      <svg
        viewBox={`0 0 ${ARENA} ${ARENA}`}
        className="w-full max-w-[320px] aspect-square rounded-3xl touch-none"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
      >
        {balls.map((b) => {
          const highlight = (phase === 'memorize' && b.isTarget) || b.picked;
          const isWrong = wrongPick === b.id;
          return (
            <g
              key={b.id}
              onClick={() => handleBallClick(b)}
              style={{ cursor: phase === 'pick' ? 'pointer' : 'default' }}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r={RADIUS}
                fill={
                  b.picked
                    ? '#10B981'
                    : isWrong
                      ? '#EF4444'
                      : highlight
                        ? '#F59E0B'
                        : '#64748B'
                }
                stroke={highlight ? '#FEF3C7' : 'rgba(148,163,184,0.4)'}
                strokeWidth={highlight ? 3 : 1.5}
              />
              {highlight && <circle cx={b.x} cy={b.y} r={6} fill="#ffffff" opacity={0.9} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

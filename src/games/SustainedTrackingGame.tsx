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
      if (balls.every((b) => Math.hypot(b.x - x, b.y - y) > RADIUS * 2.5)) break;
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

export function SustainedTrackingGame({ config, wave, finishRequested, onWaveHit, onLiveUpdate, onFinish }: MinigameProps) {
  // Cada rodada acompanha a cota da onda atual (2, 3, 3, 4, 4 alvos!) e velocidade da effectiveDifficulty
  const initialTargets = Math.min(5, wave.waveQuota);
  const initialTotal = Math.min(10, initialTargets + 3 + (config.stage >= 4 ? 1 : 0));
  const initialSpeed = Math.min(3.5, 1.3 + config.stage * 0.25);

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('memorize');
  const [balls, setBalls] = useState<Ball[]>(() => createBalls(initialTotal, initialTargets, initialSpeed));
  const [wrongPick, setWrongPick] = useState<number | null>(null);

  const ballsRef = useRef<Ball[]>(balls);
  ballsRef.current = balls;

  const waveRef = useRef(wave);
  waveRef.current = wave;

  const configRef = useRef(config);
  configRef.current = config;

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
    if (phase === 'memorize') {
      const t = setTimeout(() => setPhase('move'), 1350);
      return () => clearTimeout(t);
    }
    if (phase === 'move') {
      let raf = 0;
      const moveDur = Math.min(3500, 2200 + configRef.current.stage * 180);
      const start = performance.now();

      const step = (now: number) => {
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
            if (dist > 0 && dist < RADIUS * 2.05) {
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
  }, [phase, round]);

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleBallClick = (ball: Ball) => {
    if (phase !== 'pick' || ball.picked || statsRef.current.finished) return;
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
        setTimeout(() => {
          if (statsRef.current.finished) return;
          const nxtTargets = Math.min(5, Math.max(2, waveRef.current.waveQuota));
          const nxtTotal = Math.min(10, nxtTargets + 3 + (configRef.current.stage >= 4 ? 1 : 0));
          const nxtSpeed = Math.min(3.6, 1.3 + configRef.current.stage * 0.26);
          setRound((r) => r + 1);
          setBalls(createBalls(nxtTotal, nxtTargets, nxtSpeed));
          setPhase('memorize');
        }, 320);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 50);
      sound.miss();
      setWrongPick(ball.id);
      setTimeout(() => setWrongPick(null), 320);
      emitLive();
    }
  };

  const phaseLabel = phase === 'memorize' ? 'Memorize' : phase === 'move' ? 'Acompanhe' : 'Toque nos alvos';

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: phase === 'pick' ? 'var(--ok)' : 'var(--accent)' }}>
        {phaseLabel}
      </div>

      <svg
        viewBox={`0 0 ${ARENA} ${ARENA}`}
        className="w-full max-w-[305px] aspect-square rounded-2xl touch-none"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
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
                    ? '#34d399'
                    : isWrong
                      ? '#fb7185'
                      : highlight
                        ? '#f59e0b'
                        : '#334155'
                }
                stroke={highlight ? '#fde68a' : 'rgba(255,255,255,0.2)'}
                strokeWidth={highlight ? 3 : 1.5}
              />
              {highlight && <circle cx={b.x} cy={b.y} r={6} fill="#ffffff" opacity={0.85} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

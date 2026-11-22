import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface TrailNode {
  order: number;
  label: string;
  x: number;
  y: number;
}

const LETTERS = 'ABCDEFGHIJKL'.split('');
const SIZE = 300;
const NODE_R = 20;

function buildTrail(count: number, alternating: boolean): TrailNode[] {
  const labels: string[] = [];
  if (alternating) {
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) labels.push(String(Math.floor(i / 2) + 1));
      else labels.push(LETTERS[Math.floor(i / 2)]);
    }
  } else {
    for (let i = 0; i < count; i++) labels.push(String(i + 1));
  }

  const nodes: TrailNode[] = [];
  for (let i = 0; i < labels.length; i++) {
    let x = 0;
    let y = 0;
    for (let t = 0; t < 60; t++) {
      x = NODE_R + 14 + Math.random() * (SIZE - (NODE_R + 14) * 2);
      y = NODE_R + 14 + Math.random() * (SIZE - (NODE_R + 14) * 2);
      if (nodes.every((n) => Math.hypot(n.x - x, n.y - y) > NODE_R * 2.7)) break;
    }
    nodes.push({ order: i, label: labels[i], x, y });
  }
  return nodes;
}

export function PathLogicGame({ config, finishRequested, onWaveHit, onLiveUpdate, onFinish }: MinigameProps) {
  const [alternating, setAlternating] = useState(() => config.stage >= 2);
  const [nodes, setNodes] = useState<TrailNode[]>(() => buildTrail(Math.min(10, 5 + config.stage), config.stage >= 2));
  const [nextOrder, setNextOrder] = useState(0);
  const [wrongOrder, setWrongOrder] = useState<number | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    lastTapAt: performance.now(),
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
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleNode = (node: TrailNode) => {
    if (node.order < nextOrder || statsRef.current.finished) return;
    const now = performance.now();
    const rt = now - statsRef.current.lastTapAt;
    statsRef.current.lastTapAt = now;

    if (node.order === nextOrder) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 110 + Math.min(70, statsRef.current.combo * 10);
      sound.hit(statsRef.current.combo);

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        finishNow();
        return;
      }

      if (nextOrder + 1 >= nodes.length) {
        const nextAlt = configRef.current.stage >= 2;
        const nextCount = Math.min(12, 5 + configRef.current.stage);
        setAlternating(nextAlt);
        setNodes(buildTrail(nextCount, nextAlt));
        setNextOrder(0);
      } else {
        setNextOrder(nextOrder + 1);
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      setWrongOrder(node.order);
      setTimeout(() => setWrongOrder(null), 260);
      emitLive();
    }
  };

  const connected = nodes.filter((n) => n.order < nextOrder).sort((a, b) => a.order - b.order);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}>
        {alternating ? '1 → A → 2 → B ...' : '1 → 2 → 3 ...'}
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[305px] aspect-square rounded-2xl touch-none"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
      >
        {connected.map((n, i) => {
          if (i === 0) return null;
          const prev = connected[i - 1];
          return (
            <line
              key={n.order}
              x1={prev.x}
              y1={prev.y}
              x2={n.x}
              y2={n.y}
              stroke="#34d399"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.75"
            />
          );
        })}

        {nodes.map((n) => {
          const done = n.order < nextOrder;
          const isWrong = wrongOrder === n.order;
          const isHint = n.order === 0 && nextOrder === 0;
          return (
            <g key={n.order} onClick={() => handleNode(n)} style={{ cursor: done ? 'default' : 'pointer' }}>
              <circle
                cx={n.x}
                cy={n.y}
                r={NODE_R}
                fill={
                  done
                    ? '#10b981'
                    : isWrong
                      ? '#f43f5e'
                      : isHint
                        ? '#a855f7'
                        : '#1e293b'
                }
                stroke={done ? '#a7f3d0' : isHint ? '#ffffff' : 'rgba(255,255,255,0.25)'}
                strokeWidth="2"
              />
              <text
                x={n.x}
                y={n.y + 5}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="14"
                fontWeight="800"
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

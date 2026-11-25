import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type GridPattern = number[]; // índices ativos na matriz size x size

function rotate90(cells: GridPattern, size: number): GridPattern {
  return cells
    .map((idx) => {
      const r = Math.floor(idx / size);
      const c = idx % size;
      const nr = c;
      const nc = size - 1 - r;
      return nr * size + nc;
    })
    .sort((a, b) => a - b);
}

function rotateBy(cells: GridPattern, size: number, turns: number): GridPattern {
  let cur = [...cells].sort((a, b) => a - b);
  for (let i = 0; i < turns; i++) cur = rotate90(cur, size);
  return cur;
}

function mirrorH(cells: GridPattern, size: number): GridPattern {
  return cells
    .map((idx) => {
      const r = Math.floor(idx / size);
      const c = idx % size;
      return r * size + (size - 1 - c);
    })
    .sort((a, b) => a - b);
}

function keyOf(cells: GridPattern): string {
  return [...cells].sort((a, b) => a - b).join(',');
}

function isSameUnderRotation(a: GridPattern, b: GridPattern, size: number): boolean {
  const kb = keyOf(b);
  for (let t = 0; t < 4; t++) {
    if (keyOf(rotateBy(a, size, t)) === kb) return true;
  }
  return false;
}

// Formas assimétricas pré-validadas (espelhamento nunca equivale a rotação)
const SHAPES_3X3: GridPattern[] = [
  [0, 3, 6, 7],       // L
  [1, 4, 7, 6],       // J
  [0, 1, 4, 5],       // Z
  [1, 2, 3, 4],       // S
  [0, 1, 3, 6, 7],    // C assimétrico
  [0, 3, 4, 7, 8],    // escada
  [0, 1, 2, 5, 7],    // gancho
];

const SHAPES_4X4: GridPattern[] = [
  [0, 4, 8, 12, 13],
  [1, 5, 9, 13, 12],
  [0, 1, 5, 6, 10],
  [2, 3, 5, 6, 9],
  [0, 4, 5, 9, 10, 11],
  [1, 2, 6, 10, 14, 15],
];

interface PatternRound {
  size: number;
  left: GridPattern;
  right: GridPattern;
  isMatch: boolean;
  rotationDeg: number; // quantos graus a direita está girada em relação à esquerda (90, 180, 270)
}

function createRound(stage: number): PatternRound {
  const lvl = Math.max(1, Math.floor(stage));
  const size = lvl <= 6 ? 3 : 4;
  const shapes = size === 3 ? SHAPES_3X3 : SHAPES_4X4;
  const base = shapes[Math.floor(Math.random() * shapes.length)];

  const isMatch = Math.random() < 0.52;
  const turns = [1, 2, 3][Math.floor(Math.random() * 3)]; // 90, 180, 270 graus

  if (isMatch) {
    return {
      size,
      left: base,
      right: rotateBy(base, size, turns),
      isMatch: true,
      rotationDeg: turns * 90,
    };
  }

  // Gera espelhamento rotacionado e garante que NÃO coincide sob nenhuma rotação
  let candidate = rotateBy(mirrorH(base, size), size, turns);
  if (isSameUnderRotation(base, candidate, size)) {
    // Fallback garantido: altera 1 célula para quebrar simetria
    const all = Array.from({ length: size * size }, (_, i) => i);
    const missing = all.find((i) => !candidate.includes(i));
    if (missing !== undefined) {
      candidate = [...candidate.slice(0, -1), missing].sort((a, b) => a - b);
    }
  }

  return {
    size,
    left: base,
    right: candidate,
    isMatch: false,
    rotationDeg: turns * 90,
  };
}

function PatternMiniGrid({
  size,
  active,
  rotateAnimDeg = 0,
  highlightOk = false,
}: {
  size: number;
  active: GridPattern;
  rotateAnimDeg?: number;
  highlightOk?: boolean;
}) {
  const set = new Set(active);
  return (
    <div
      className="p-2.5 rounded-2xl transition-transform duration-350 ease-out"
      style={{
        background: highlightOk ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-card)',
        border: highlightOk ? '2px solid var(--ok)' : '1.5px solid var(--border-strong)',
        transform: `rotate(${rotateAnimDeg}deg)`,
      }}
    >
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          width: size === 3 ? 116 : 124,
        }}
      >
        {Array.from({ length: size * size }, (_, idx) => {
          const on = set.has(idx);
          return (
            <div
              key={idx}
              className="aspect-square rounded-lg transition-colors"
              style={{
                background: on
                  ? highlightOk
                    ? 'var(--ok)'
                    : 'var(--accent)'
                  : 'var(--bg-subtle)',
                opacity: on ? 1 : 0.45,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ComplexPatternsGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<PatternRound>(() => createRound(config.stage));
  const [animDeg, setAnimDeg] = useState(0);
  const [feedback, setFeedback] = useState<{ answer: boolean; ok: boolean } | null>(null);

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

  const handleAnswer = (saysMatch: boolean) => {
    if (paused || feedback !== null || statsRef.current.finished) return;

    const now = performance.now();
    const rt = Math.max(150, now - statsRef.current.roundStart);
    const isOk = saysMatch === round.isMatch;
    setFeedback({ answer: saysMatch, ok: isOk });

    // Ao responder SIM corretamente, gira a matriz da direita de volta para encaixar visualmente
    const animateUnrotate = isOk && saysMatch;
    if (animateUnrotate) {
      setAnimDeg(-round.rotationDeg);
    }

    if (isOk) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 145 + Math.min(85, statsRef.current.combo * 15);
      sound.hit(statsRef.current.combo);
      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), animateUnrotate ? 460 : 220);
        return;
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      onWaveError?.();
      emitLive();
    }

    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setAnimDeg(0);
      setFeedback(null);
      setRound(createRound(configRef.current.stage));
      statsRef.current.roundStart = performance.now();
    }, animateUnrotate ? 520 : 320);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        É o mesmo padrão apenas girado?
      </div>

      <div className="flex items-center justify-center gap-4">
        <PatternMiniGrid
          size={round.size}
          active={round.left}
          highlightOk={Boolean(feedback?.ok && feedback.answer)}
        />
        <span className="text-lg font-black" style={{ color: 'var(--text-soft)' }}>
          ⇄
        </span>
        <PatternMiniGrid
          size={round.size}
          active={round.right}
          rotateAnimDeg={animDeg}
          highlightOk={Boolean(feedback?.ok && feedback.answer)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[330px]">
        <button
          type="button"
          onClick={() => handleAnswer(true)}
          className={`h-16 rounded-2xl font-extrabold text-base transition-all cursor-pointer ${
            feedback?.answer === true && !feedback.ok ? 'animate-shake' : ''
          }`}
          style={{
            background:
              feedback?.answer === true
                ? feedback.ok
                  ? 'rgba(16, 185, 129, 0.25)'
                  : 'rgba(239, 68, 68, 0.25)'
                : 'rgba(16, 185, 129, 0.14)',
            border:
              feedback?.answer === true
                ? `2px solid ${feedback.ok ? 'var(--ok)' : 'var(--err)'}`
                : '2px solid var(--ok)',
            color: 'var(--ok)',
          }}
        >
          ✓ SIM
        </button>

        <button
          type="button"
          onClick={() => handleAnswer(false)}
          className={`h-16 rounded-2xl font-extrabold text-base transition-all cursor-pointer ${
            feedback?.answer === false && !feedback.ok ? 'animate-shake' : ''
          }`}
          style={{
            background:
              feedback?.answer === false
                ? feedback.ok
                  ? 'rgba(16, 185, 129, 0.25)'
                  : 'rgba(239, 68, 68, 0.25)'
                : 'rgba(239, 68, 68, 0.14)',
            border:
              feedback?.answer === false
                ? `2px solid ${feedback.ok ? 'var(--ok)' : 'var(--err)'}`
                : '2px solid var(--err)',
            color: 'var(--err)',
          }}
        >
          ✕ NÃO
        </button>
      </div>
    </div>
  );
}

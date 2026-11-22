import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'arrow';
type FillKind = 'solid' | 'outline';

type IntruderCard =
  | {
      kind: 'shape';
      shape: ShapeKind;
      color: string;
      fill: FillKind;
      rotation: number;
      count: 1 | 2 | 3;
      isIntruder: boolean;
    }
  | {
      kind: 'number';
      value: number;
      isIntruder: boolean;
    };

interface IntruderPuzzle {
  key: string;
  cols: 2 | 3;
  cards: IntruderCard[];
}

const COLORS = ['#2563EB', '#059669', '#E11D48', '#D97706', '#7C3AED', '#0891B2'] as const;
const BASIC_SHAPES: ShapeKind[] = ['circle', 'square', 'triangle', 'diamond', 'star'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeShapeCards(
  total: number,
  buildNormal: (idx: number) => Omit<Extract<IntruderCard, { kind: 'shape' }>, 'kind' | 'isIntruder'>,
  buildIntruder: () => Omit<Extract<IntruderCard, { kind: 'shape' }>, 'kind' | 'isIntruder'>
): IntruderCard[] {
  const list: IntruderCard[] = [];
  for (let i = 0; i < total - 1; i++) {
    list.push({ kind: 'shape', ...buildNormal(i), isIntruder: false });
  }
  list.push({ kind: 'shape', ...buildIntruder(), isIntruder: true });
  return shuffle(list);
}

function makeNumberCards(normals: number[], intruder: number): IntruderCard[] {
  const list: IntruderCard[] = normals.map((value) => ({
    kind: 'number',
    value,
    isIntruder: false,
  }));
  list.push({ kind: 'number', value: intruder, isIntruder: true });
  return shuffle(list);
}

function makePuzzle(stage: number, prevRuleKey?: string): IntruderPuzzle {
  const lvl = Math.max(1, Math.floor(stage));
  const total = lvl >= 5 ? 6 : 4;
  const cols: 2 | 3 = lvl >= 5 ? 3 : 2;

  type RuleId =
    | 'easy_shape'
    | 'easy_color'
    | 'shape_mixed_color'
    | 'color_mixed_shape'
    | 'multiples_10'
    | 'arrows_dir'
    | 'fill_vs_outline'
    | 'parity'
    | 'multiples_5'
    | 'count_diff'
    | 'digits_count';

  let rules: RuleId[];
  if (lvl <= 1) {
    // Nível 1: regra visual super evidente (forma ou cor óbvia)
    rules = ['easy_shape', 'easy_color'];
  } else if (lvl <= 3) {
    // Nível 2–3: forma + cor combinadas, setas simples ou múltiplos de 10
    rules = ['shape_mixed_color', 'color_mixed_shape', 'multiples_10', 'arrows_dir'];
  } else if (lvl === 4) {
    // Nível 4: regras conceituais e numéricas em 2×2
    rules = ['fill_vs_outline', 'parity', 'multiples_5', 'arrows_dir', 'count_diff'];
  } else {
    // Nível 5+: 6 cartões em 3×2 com regras conceituais, visuais e numéricas
    rules = [
      'fill_vs_outline',
      'parity',
      'multiples_5',
      'arrows_dir',
      'shape_mixed_color',
      'count_diff',
      'digits_count',
    ];
  }

  const candidateRules = rules.filter((r) => r !== prevRuleKey);
  const rule = pick(candidateRules.length > 0 ? candidateRules : rules);

  let cards: IntruderCard[];

  switch (rule) {
    case 'easy_shape': {
      const [mainShape, oddShape] = shuffle(BASIC_SHAPES);
      const color = pick(COLORS);
      cards = makeShapeCards(
        total,
        () => ({ shape: mainShape, color, fill: 'solid', rotation: 0, count: 1 }),
        () => ({ shape: oddShape, color, fill: 'solid', rotation: 0, count: 1 })
      );
      break;
    }

    case 'easy_color': {
      const [mainColor, oddColor] = shuffle([...COLORS]);
      const shape = pick(BASIC_SHAPES);
      cards = makeShapeCards(
        total,
        () => ({ shape, color: mainColor, fill: 'solid', rotation: 0, count: 1 }),
        () => ({ shape, color: oddColor, fill: 'solid', rotation: 0, count: 1 })
      );
      break;
    }

    case 'shape_mixed_color': {
      // Todos têm a mesma forma (com cores variadas), exceto 1 intruso com outra forma
      const [mainShape, oddShape] = shuffle(BASIC_SHAPES);
      const palette = shuffle([...COLORS]);
      cards = makeShapeCards(
        total,
        (i) => ({ shape: mainShape, color: palette[i % palette.length], fill: 'solid', rotation: 0, count: 1 }),
        () => ({ shape: oddShape, color: palette[(total - 1) % palette.length], fill: 'solid', rotation: 0, count: 1 })
      );
      break;
    }

    case 'color_mixed_shape': {
      // Todos têm a mesma cor (com formas variadas), exceto 1 intruso de outra cor
      const [mainColor, oddColor] = shuffle([...COLORS]);
      const shapes = shuffle(BASIC_SHAPES);
      cards = makeShapeCards(
        total,
        (i) => ({ shape: shapes[i % shapes.length], color: mainColor, fill: 'solid', rotation: 0, count: 1 }),
        () => ({ shape: shapes[0], color: oddColor, fill: 'solid', rotation: 0, count: 1 })
      );
      break;
    }

    case 'multiples_10': {
      // Múltiplos de 10 vs 1 número que termina em 5
      const pool = shuffle([10, 20, 30, 40, 50, 60, 70, 80]);
      const normals = pool.slice(0, total - 1);
      const intruder = pick([15, 25, 35, 45, 55, 65]);
      cards = makeNumberCards(normals, intruder);
      break;
    }

    case 'arrows_dir': {
      // Todas as setas apontam para a mesma direção, exceto 1 invertida
      const dirs = [0, 90, 180, 270];
      const mainRot = pick(dirs);
      const oddRot = (mainRot + 180) % 360;
      const useMixedColors = lvl >= 4;
      const palette = shuffle([...COLORS]);
      const singleColor = palette[0];
      cards = makeShapeCards(
        total,
        (i) => ({
          shape: 'arrow',
          color: useMixedColors ? palette[i % palette.length] : singleColor,
          fill: 'solid',
          rotation: mainRot,
          count: 1,
        }),
        () => ({
          shape: 'arrow',
          color: useMixedColors ? palette[(total - 1) % palette.length] : singleColor,
          fill: 'solid',
          rotation: oddRot,
          count: 1,
        })
      );
      break;
    }

    case 'fill_vs_outline': {
      // Todos preenchidos vs 1 apenas contornado (ou inverso)
      const mainFill: FillKind = Math.random() < 0.7 ? 'solid' : 'outline';
      const oddFill: FillKind = mainFill === 'solid' ? 'outline' : 'solid';
      const shapes = shuffle(BASIC_SHAPES);
      const palette = shuffle([...COLORS]);
      cards = makeShapeCards(
        total,
        (i) => ({
          shape: shapes[i % shapes.length],
          color: palette[i % palette.length],
          fill: mainFill,
          rotation: 0,
          count: 1,
        }),
        () => ({
          shape: shapes[(total - 1) % shapes.length],
          color: palette[(total - 1) % palette.length],
          fill: oddFill,
          rotation: 0,
          count: 1,
        })
      );
      break;
    }

    case 'parity': {
      // Todos de 2 dígitos e sem múltiplos de 5, garantindo que apenas a paridade diferencia o intruso
      const evens = shuffle([12, 14, 16, 18, 22, 24, 26, 28, 32, 34, 36, 38]);
      const odds = shuffle([11, 13, 17, 19, 21, 23, 27, 29, 31, 33, 37, 39]);
      const mainEven = Math.random() < 0.65;
      const normals = (mainEven ? evens : odds).slice(0, total - 1);
      const intruder = (mainEven ? odds : evens)[0];
      cards = makeNumberCards(normals, intruder);
      break;
    }

    case 'multiples_5': {
      // Todos ímpares de 2 dígitos: os normais terminam em 5 (múltiplos de 5) e apenas o intruso não
      const mult5 = shuffle([15, 25, 35, 45, 55, 65, 75, 85]);
      const nonMult5 = shuffle([13, 17, 23, 27, 33, 37, 43, 47, 53]);
      const normals = mult5.slice(0, total - 1);
      const intruder = nonMult5[0];
      cards = makeNumberCards(normals, intruder);
      break;
    }

    case 'count_diff': {
      // Todos têm a mesma quantidade de figuras (ex: 2), exceto 1 cartão com outra quantidade (ex: 3)
      const [mainCount, oddCount] = shuffle([1, 2, 3] as const);
      const shape = pick(['circle', 'square', 'triangle', 'diamond'] as const);
      const palette = shuffle([...COLORS]);
      cards = makeShapeCards(
        total,
        (i) => ({
          shape,
          color: palette[i % palette.length],
          fill: 'solid',
          rotation: 0,
          count: mainCount,
        }),
        () => ({
          shape,
          color: palette[(total - 1) % palette.length],
          fill: 'solid',
          rotation: 0,
          count: oddCount,
        })
      );
      break;
    }

    case 'digits_count': {
      // Todos de 2 dígitos vs 1 de 1 dígito (ou inverso)
      const oneDigit = shuffle([2, 3, 4, 5, 6, 7, 8, 9]);
      const twoDigit = shuffle([14, 23, 37, 42, 58, 61, 74, 86]);
      const mainTwo = Math.random() < 0.5;
      const normals = (mainTwo ? twoDigit : oneDigit).slice(0, total - 1);
      const intruder = (mainTwo ? oneDigit : twoDigit)[0];
      cards = makeNumberCards(normals, intruder);
      break;
    }
  }

  return {
    key: `${rule}-${Date.now()}-${Math.random()}`,
    cols,
    cards,
  };
}

function ShapeSvg({ card }: { card: Extract<IntruderCard, { kind: 'shape' }> }) {
  const fillVal = card.fill === 'solid' ? card.color : 'none';
  const offsets = card.count === 1 ? [0] : card.count === 2 ? [-15, 15] : [-20, 0, 20];
  const scale = card.count === 1 ? 1 : card.count === 2 ? 0.64 : 0.46;

  return (
    <svg viewBox="0 0 80 60" className="w-16 h-12" aria-hidden="true">
      {offsets.map((dx, idx) => (
        <g key={idx} transform={`translate(${40 + dx}, 30) rotate(${card.rotation}) scale(${scale})`}>
          {card.shape === 'circle' && (
            <circle cx="0" cy="0" r="19" fill={fillVal} stroke={card.color} strokeWidth="3.8" />
          )}
          {card.shape === 'square' && (
            <rect
              x="-17"
              y="-17"
              width="34"
              height="34"
              rx="5"
              fill={fillVal}
              stroke={card.color}
              strokeWidth="3.8"
            />
          )}
          {card.shape === 'triangle' && (
            <polygon
              points="0,-20 20,16 -20,16"
              fill={fillVal}
              stroke={card.color}
              strokeWidth="3.8"
              strokeLinejoin="round"
            />
          )}
          {card.shape === 'diamond' && (
            <polygon
              points="0,-21 20,0 0,21 -20,0"
              fill={fillVal}
              stroke={card.color}
              strokeWidth="3.8"
              strokeLinejoin="round"
            />
          )}
          {card.shape === 'star' && (
            <path
              d="M0,-21 L5.6,-6.8 L20.8,-5.5 L9.2,4.4 L12.8,19.2 L0,11.2 L-12.8,19.2 L-9.2,4.4 L-20.8,-5.5 L-5.6,-6.8 Z"
              fill={fillVal}
              stroke={card.color}
              strokeWidth="3.4"
              strokeLinejoin="round"
            />
          )}
          {card.shape === 'arrow' && (
            <path
              d="M-18,0 H16 M16,0 L4,-12 M16,0 L4,12"
              fill="none"
              stroke={card.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      ))}
    </svg>
  );
}

export function LogicIntruderGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [puzzle, setPuzzle] = useState<IntruderPuzzle>(() => makePuzzle(config.stage));
  const [roundId, setRoundId] = useState(0);
  const [flash, setFlash] = useState<{ idx: number; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const lastRuleRef = useRef<string>(puzzle.key.split('-')[0]);

  const pauseStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
    finished: false,
  });

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const finishNow = () => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    clearTimer();
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
    if (paused) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
    } else if (pauseStartedAtRef.current !== null) {
      statsRef.current.shownAt += performance.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handlePick = (idx: number) => {
    if (flash || paused || statsRef.current.finished) return;
    const rt = Math.max(80, performance.now() - statsRef.current.shownAt);
    const chosen = puzzle.cards[idx];
    const ok = Boolean(chosen?.isIntruder);
    let clearedAll = false;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 140 + Math.min(90, statsRef.current.combo * 16);
      sound.hit(statsRef.current.combo);
      clearedAll = onWaveHit();
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      onWaveError?.();
    }

    const total = statsRef.current.correct + statsRef.current.commission;
    onLiveUpdate({
      score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: Math.round((statsRef.current.correct / total) * 100),
      combo: statsRef.current.combo,
    });

    if (clearedAll) {
      finishNow();
      return;
    }

    setFlash({ idx, ok });
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setFlash(null);
      const next = makePuzzle(configRef.current.stage, lastRuleRef.current);
      lastRuleRef.current = next.key.split('-')[0];
      setPuzzle(next);
      setRoundId((n) => n + 1);
      statsRef.current.shownAt = performance.now();
    }, ok ? 140 : 210);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: 'var(--bg-subtle)',
          color: 'var(--accent)',
          border: '1px solid var(--border)',
        }}
      >
        Toque no intruso
      </div>

      <div
        key={roundId}
        className={`grid gap-3 w-full ${
          puzzle.cols === 3 ? 'max-w-[356px]' : 'max-w-[320px]'
        } animate-pop`}
        style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))` }}
      >
        {puzzle.cards.map((card, idx) => {
          const isFb = flash?.idx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handlePick(idx)}
              className={`${
                puzzle.cols === 3 ? 'min-h-[92px]' : 'min-h-[112px]'
              } rounded-2xl flex items-center justify-center transition-all cursor-pointer surface-card-click ${
                isFb && !flash.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isFb
                  ? flash.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.22)'
                  : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1px solid var(--border)',
                color: isFb ? (flash.ok ? 'var(--ok)' : 'var(--err)') : 'var(--text)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {card.kind === 'number' ? (
                <span className="text-3xl font-black tabular">{card.value}</span>
              ) : (
                <ShapeSvg card={card} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

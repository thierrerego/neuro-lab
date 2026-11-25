import { useEffect, useRef, useState } from 'react';
import {
  Apple,
  Banana,
  CupSoda,
  Egg,
  FileText,
  FlaskConical,
  GlassWater,
  Leaf,
  Milk,
  Newspaper,
  Package,
  Recycle,
  ShoppingBag,
  Trash2,
  Wine,
} from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type BinId = 'paper' | 'plastic' | 'glass' | 'organic';

interface TrashItemDef {
  name: string;
  color: string;
  render: (size: number) => JSX.Element;
}

interface BinDef {
  id: BinId;
  label: string;
  color: string;
  bg: string;
  items: TrashItemDef[];
}

const BINS: BinDef[] = [
  {
    id: 'paper',
    label: 'Papel',
    color: '#2563EB',
    bg: 'rgba(37, 99, 235, 0.16)',
    items: [
      { name: 'Jornal', color: '#2563EB', render: (s) => <Newspaper size={s} /> },
      { name: 'Caixa de papelão', color: '#2563EB', render: (s) => <Package size={s} /> },
      { name: 'Folha de papel', color: '#2563EB', render: (s) => <FileText size={s} /> },
      { name: 'Sacola de papel', color: '#2563EB', render: (s) => <ShoppingBag size={s} /> },
    ],
  },
  {
    id: 'plastic',
    label: 'Plástico',
    color: '#DC2626',
    bg: 'rgba(220, 38, 38, 0.16)',
    items: [
      { name: 'Copo plástico', color: '#DC2626', render: (s) => <CupSoda size={s} /> },
      { name: 'Frasco plástico', color: '#DC2626', render: (s) => <Milk size={s} /> },
      { name: 'Garrafa PET', color: '#DC2626', render: (s) => <GlassWater size={s} /> },
    ],
  },
  {
    id: 'glass',
    label: 'Vidro',
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.16)',
    items: [
      { name: 'Taça de vidro', color: '#059669', render: (s) => <Wine size={s} /> },
      { name: 'Frasco de vidro', color: '#059669', render: (s) => <FlaskConical size={s} /> },
      { name: 'Copo de vidro', color: '#059669', render: (s) => <GlassWater size={s} /> },
    ],
  },
  {
    id: 'organic',
    label: 'Orgânico',
    color: '#92400E',
    bg: 'rgba(146, 64, 14, 0.18)',
    items: [
      { name: 'Casca de banana', color: '#92400E', render: (s) => <Banana size={s} /> },
      { name: 'Resto de maçã', color: '#92400E', render: (s) => <Apple size={s} /> },
      { name: 'Casca de ovo', color: '#92400E', render: (s) => <Egg size={s} /> },
      { name: 'Folhas secas', color: '#92400E', render: (s) => <Leaf size={s} /> },
    ],
  },
];

interface TrashRound {
  activeBins: BinDef[];
  targetBin: BinId;
  item: TrashItemDef;
}

function createRound(stage: number): TrashRound {
  const lvl = Math.max(1, Math.floor(stage));
  const binCount = lvl <= 3 ? 2 : lvl <= 7 ? 3 : 4;
  const activeBins =
    binCount === 2
      ? [BINS[0], BINS[3]] // Papel (Azul) e Orgânico (Marrom)
      : binCount === 3
        ? [BINS[0], BINS[1], BINS[3]]
        : BINS;

  const chosenBin = activeBins[Math.floor(Math.random() * activeBins.length)];
  const item = chosenBin.items[Math.floor(Math.random() * chosenBin.items.length)];

  return { activeBins, targetBin: chosenBin.id, item };
}

export function SortTrashGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<TrashRound>(() => createRound(config.stage));
  const [picked, setPicked] = useState<{ id: BinId; ok: boolean } | null>(null);

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

  const handleBinTap = (bin: BinDef) => {
    if (paused || picked !== null || statsRef.current.finished) return;

    const now = performance.now();
    const rt = Math.max(100, now - statsRef.current.roundStart);
    const isOk = bin.id === round.targetBin;
    setPicked({ id: bin.id, ok: isOk });

    if (isOk) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 160);
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
    }, 240);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full inline-flex items-center gap-1.5"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        <Recycle size={14} />
        <span>Jogue na lixeira certa</span>
      </div>

      <div
        className="w-44 h-44 rounded-3xl flex flex-col items-center justify-center gap-2.5 animate-pop"
        style={{ background: 'var(--bg-card)', border: '2px solid var(--border-strong)', boxShadow: 'var(--card-shadow)', color: round.item.color }}
      >
        {round.item.render(56)}
        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
          {round.item.name}
        </span>
      </div>

      <div
        className="grid gap-2.5 w-full max-w-[356px]"
        style={{ gridTemplateColumns: `repeat(${round.activeBins.length === 4 ? 2 : round.activeBins.length}, minmax(0, 1fr))` }}
      >
        {round.activeBins.map((bin) => {
          const isPicked = picked?.id === bin.id;
          return (
            <button
              key={bin.id}
              type="button"
              onClick={() => handleBinTap(bin)}
              className={`h-16 rounded-2xl px-3 font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isPicked && !picked.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isPicked
                  ? picked.ok
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(239, 68, 68, 0.25)'
                  : bin.bg,
                border: isPicked
                  ? `2px solid ${picked.ok ? 'var(--ok)' : 'var(--err)'}`
                  : `2px solid ${bin.color}`,
                color: bin.color,
              }}
            >
              <Trash2 size={18} />
              <span>{bin.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

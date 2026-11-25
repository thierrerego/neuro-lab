import { useEffect, useRef, useState } from 'react';
import {
  Anchor,
  Bell,
  Briefcase,
  Camera,
  Compass,
  Crown,
  Flashlight,
  Gem,
  Glasses,
  KeyRound,
  Magnet,
  Search,
  Smartphone,
  Umbrella,
  Watch,
  Wrench,
} from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface EvidenceDef {
  id: string;
  color: string;
  render: (size: number) => JSX.Element;
}

const EVIDENCE_POOL: EvidenceDef[] = [
  { id: 'key', color: '#D97706', render: (s) => <KeyRound size={s} /> },
  { id: 'watch', color: '#2563EB', render: (s) => <Watch size={s} /> },
  { id: 'glasses', color: '#7C3AED', render: (s) => <Glasses size={s} /> },
  { id: 'camera', color: '#0891B2', render: (s) => <Camera size={s} /> },
  { id: 'compass', color: '#059669', render: (s) => <Compass size={s} /> },
  { id: 'flashlight', color: '#EA580C', render: (s) => <Flashlight size={s} /> },
  { id: 'briefcase', color: '#4F46E5', render: (s) => <Briefcase size={s} /> },
  { id: 'gem', color: '#EC4899', render: (s) => <Gem size={s} /> },
  { id: 'phone', color: '#0EA5E9', render: (s) => <Smartphone size={s} /> },
  { id: 'magnet', color: '#E11D48', render: (s) => <Magnet size={s} /> },
  { id: 'bell', color: '#CA8A04', render: (s) => <Bell size={s} /> },
  { id: 'crown', color: '#F59E0B', render: (s) => <Crown size={s} /> },
  { id: 'anchor', color: '#0284C7', render: (s) => <Anchor size={s} /> },
  { id: 'umbrella', color: '#9333EA', render: (s) => <Umbrella size={s} /> },
  { id: 'wrench', color: '#64748B', render: (s) => <Wrench size={s} /> },
  { id: 'search', color: '#10B981', render: (s) => <Search size={s} /> },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface SceneRound {
  items: { uid: number; def: EvidenceDef; isLonely: boolean }[];
  cols: number;
  lonelyTotal: number;
}

function createScene(stage: number): SceneRound {
  const lvl = Math.max(1, Math.floor(stage));
  const lonelyTotal = lvl <= 3 ? 1 : lvl <= 9 ? 2 : 3;
  const pairCount = lvl <= 2 ? 4 : lvl <= 6 ? 5 : lvl <= 11 ? 6 : 7;
  const cols = pairCount * 2 + lonelyTotal <= 9 ? 3 : 4;

  const chosen = shuffle(EVIDENCE_POOL).slice(0, pairCount + lonelyTotal);
  const lonelyDefs = chosen.slice(0, lonelyTotal);
  const pairedDefs = chosen.slice(lonelyTotal);

  const list = shuffle([
    ...lonelyDefs.map((def) => ({ def, isLonely: true })),
    ...pairedDefs.flatMap((def) => [
      { def, isLonely: false },
      { def, isLonely: false },
    ]),
  ]).map((item, uid) => ({ ...item, uid }));

  return { items: list, cols, lonelyTotal };
}

export function CrimeSceneGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [scene, setScene] = useState<SceneRound>(() => createScene(config.stage));
  const [foundUids, setFoundUids] = useState<number[]>([]);
  const [wrongUid, setWrongUid] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);

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

  const handleTap = (item: { uid: number; isLonely: boolean }) => {
    if (paused || transitioning || statsRef.current.finished) return;
    if (foundUids.includes(item.uid)) return;

    const now = performance.now();
    const rt = Math.max(120, now - statsRef.current.roundStart);

    if (item.isLonely) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 140 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);

      const nextFound = [...foundUids, item.uid];
      setFoundUids(nextFound);
      statsRef.current.roundStart = now;

      if (nextFound.length >= scene.lonelyTotal) {
        setTransitioning(true);
        const clearedAll = onWaveHit();
        emitLive();

        if (clearedAll) {
          window.setTimeout(() => finishNow(), 200);
          return;
        }

        window.setTimeout(() => {
          if (statsRef.current.finished) return;
          setScene(createScene(configRef.current.stage));
          setFoundUids([]);
          setWrongUid(null);
          setTransitioning(false);
          statsRef.current.roundStart = performance.now();
        }, 280);
      } else {
        emitLive();
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setWrongUid(item.uid);
      emitLive();
      onWaveError?.();
      window.setTimeout(() => setWrongUid(null), 300);
    }
  };

  const remaining = Math.max(0, scene.lonelyTotal - foundUids.length);
  const iconSize = scene.items.length >= 15 ? 26 : 32;

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full text-center flex items-center gap-1.5"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        <Search size={14} />
        <span>
          {scene.lonelyTotal === 1
            ? 'Ache o único item SEM par'
            : `Ache os ${scene.lonelyTotal} itens SEM par · Faltam ${remaining}`}
        </span>
      </div>

      <div
        className={`grid gap-2.5 w-full ${scene.cols === 3 ? 'max-w-[370px]' : 'max-w-[430px]'}`}
        style={{ gridTemplateColumns: `repeat(${scene.cols}, minmax(0, 1fr))` }}
      >
        {scene.items.map((item) => {
          const isFound = foundUids.includes(item.uid);
          const isWrong = wrongUid === item.uid;
          return (
            <button
              key={item.uid}
              type="button"
              onClick={() => handleTap(item)}
              className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                background: isFound
                  ? 'rgba(16, 185, 129, 0.22)'
                  : isWrong
                    ? 'rgba(239, 68, 68, 0.22)'
                    : 'var(--bg-card)',
                border: isFound
                  ? '2px solid var(--ok)'
                  : isWrong
                    ? '2px solid var(--err)'
                    : '1.5px solid var(--border)',
                color: isFound ? 'var(--ok)' : isWrong ? 'var(--err)' : item.def.color,
                opacity: isFound ? 0.65 : 1,
              }}
            >
              {item.def.render(iconSize)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

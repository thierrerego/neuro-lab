import { useEffect, useRef, useState } from 'react';
import { Shirt } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface JerseyColor {
  id: 'blue' | 'red' | 'green' | 'yellow';
  labelPlural: string;
  hex: string;
  bg: string;
}

const JERSEYS: JerseyColor[] = [
  { id: 'blue', labelPlural: 'AZUIS', hex: '#2563EB', bg: 'rgba(37, 99, 235, 0.2)' },
  { id: 'red', labelPlural: 'VERMELHAS', hex: '#DC2626', bg: 'rgba(220, 38, 38, 0.2)' },
  { id: 'green', labelPlural: 'VERDES', hex: '#059669', bg: 'rgba(5, 150, 105, 0.2)' },
  { id: 'yellow', labelPlural: 'AMARELAS', hex: '#D97706', bg: 'rgba(217, 119, 6, 0.2)' },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface FanRound {
  crowd: JerseyColor[];
  target: JerseyColor;
  answer: number;
  options: number[];
  cols: number;
}

function createFanRound(stage: number): FanRound {
  const lvl = Math.max(1, Math.floor(stage));
  const totalFans = lvl <= 2 ? 9 : lvl <= 5 ? 12 : lvl <= 10 ? 16 : 20;
  const cols = totalFans <= 9 ? 3 : 4;
  const colorCount = lvl <= 3 ? 3 : 4;
  const optCount = lvl <= 3 ? 3 : 4;

  const palette = shuffle(JERSEYS).slice(0, colorCount);
  const target = palette[0];
  const others = palette.slice(1);

  const minTarget = Math.max(2, Math.floor(totalFans * 0.2));
  const maxTarget = Math.min(totalFans - 3, Math.ceil(totalFans * 0.45));
  const answer = Math.floor(minTarget + Math.random() * (maxTarget - minTarget + 1));

  const crowd: JerseyColor[] = [];
  for (let i = 0; i < answer; i++) crowd.push(target);
  for (let i = answer; i < totalFans; i++) {
    crowd.push(others[Math.floor(Math.random() * others.length)]);
  }

  const optSet = new Set<number>([answer]);
  const offsets = shuffle([-2, -1, 1, 2, 3, -3]);
  for (const off of offsets) {
    if (optSet.size >= optCount) break;
    const cand = answer + off;
    if (cand >= 1 && cand <= totalFans) optSet.add(cand);
  }

  return {
    crowd: shuffle(crowd),
    target,
    answer,
    options: shuffle(Array.from(optSet)),
    cols,
  };
}

export function FanCountGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<FanRound>(() => createFanRound(config.stage));
  const [picked, setPicked] = useState<{ val: number; ok: boolean } | null>(null);

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

  const handleChoose = (val: number) => {
    if (paused || picked !== null || statsRef.current.finished) return;

    const now = performance.now();
    const rt = Math.max(150, now - statsRef.current.roundStart);
    const isOk = val === round.answer;

    setPicked({ val, ok: isOk });

    if (isOk) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 140 + Math.min(80, statsRef.current.combo * 14);
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
      setRound(createFanRound(configRef.current.stage));
      setPicked(null);
      statsRef.current.roundStart = performance.now();
    }, 300);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-2 rounded-full flex items-center gap-2"
        style={{
          background: round.target.bg,
          color: round.target.hex,
          border: `1.5px solid ${round.target.hex}55`,
        }}
      >
        <span>Conte as camisas {round.target.labelPlural}</span>
      </div>

      <div
        className={`grid gap-2 w-full ${round.cols === 3 ? 'max-w-[270px]' : 'max-w-[336px]'}`}
        style={{ gridTemplateColumns: `repeat(${round.cols}, minmax(0, 1fr))` }}
      >
        {round.crowd.map((fan, idx) => (
          <div
            key={idx}
            className="aspect-square rounded-2xl flex items-center justify-center relative select-none"
            style={{
              background: fan.bg,
              border: `2px solid ${fan.hex}`,
            }}
          >
            <Shirt size={28} style={{ color: fan.hex }} fill={fan.hex} fillOpacity={0.25} />
            <span
              className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full"
              style={{ background: fan.hex }}
            />
          </div>
        ))}
      </div>

      <div
        className="grid gap-2.5 w-full max-w-[336px]"
        style={{ gridTemplateColumns: `repeat(${round.options.length}, minmax(0, 1fr))` }}
      >
        {round.options.map((val) => {
          const isPicked = picked?.val === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => handleChoose(val)}
              className={`h-14 rounded-2xl text-2xl font-black tabular transition-all cursor-pointer ${
                isPicked && !picked.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isPicked
                  ? picked.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.22)'
                  : 'var(--bg-card)',
                border: isPicked
                  ? `2px solid ${picked.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1.5px solid var(--border-strong)',
              }}
            >
              {val}
            </button>
          );
        })}
      </div>
    </div>
  );
}

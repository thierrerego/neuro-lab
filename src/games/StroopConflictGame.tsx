import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface ColorDef {
  id: string;
  label: string;
  hex: string;
}

const PALETTE: ColorDef[] = [
  { id: 'blue',   label: 'AZUL',     hex: '#38bdf8' },
  { id: 'green',  label: 'VERDE',    hex: '#34d399' },
  { id: 'red',    label: 'VERMELHO', hex: '#fb7185' },
  { id: 'yellow', label: 'AMARELO',  hex: '#fbbf24' },
];

interface StroopTrial {
  word: ColorDef;
  ink: ColorDef;
  rule: 'ink' | 'word';
}

function makeTrial(alternating: boolean): StroopTrial {
  const word = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const conflict = Math.random() < 0.78;
  const inkPool = conflict ? PALETTE.filter((c) => c.id !== word.id) : [word];
  const ink = inkPool[Math.floor(Math.random() * inkPool.length)];
  const rule: 'ink' | 'word' = alternating && Math.random() < 0.42 ? 'word' : 'ink';
  return { word, ink, rule };
}

export function StroopConflictGame({ config, finishRequested, onWaveHit, onLiveUpdate, onFinish }: MinigameProps) {
  const [trial, setTrial] = useState(() => makeTrial(config.alternatingRule));
  const [tId, setTId] = useState(0);
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
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

  const handlePick = (colorId: string) => {
    if (flash || statsRef.current.finished) return;
    const rt = performance.now() - statsRef.current.shownAt;
    const expected = trial.rule === 'ink' ? trial.ink.id : trial.word.id;
    const ok = colorId === expected;
    let clearedAll = false;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(85, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      clearedAll = onWaveHit();
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 55);
      sound.miss();
    }

    const tot = statsRef.current.correct + statsRef.current.commission;
    onLiveUpdate({
      score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: Math.round((statsRef.current.correct / tot) * 100),
      combo: statsRef.current.combo,
    });

    if (clearedAll) {
      finishNow();
      return;
    }

    setFlash({ id: colorId, ok });
    setTimeout(() => {
      if (statsRef.current.finished) return;
      setFlash(null);
      setTrial(makeTrial(configRef.current.alternatingRule));
      setTId((n) => n + 1);
      statsRef.current.shownAt = performance.now();
    }, 150);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: trial.rule === 'ink' ? 'var(--accent-glow)' : 'rgba(251, 191, 36, 0.2)',
          color: trial.rule === 'ink' ? 'var(--accent)' : 'var(--warn)',
          border: `1px solid ${trial.rule === 'ink' ? 'var(--border-strong)' : 'var(--warn)'}`,
        }}
      >
        {trial.rule === 'ink' ? 'Cor da tinta' : 'Palavra escrita'}
      </div>

      <div
        key={tId}
        className="w-full max-w-[310px] py-10 rounded-3xl text-center text-4xl font-black tracking-wide animate-pop"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: trial.ink.hex }}
      >
        {trial.word.label}
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-full max-w-[310px]">
        {PALETTE.map((c) => {
          const isFb = flash?.id === c.id;
          return (
            <button
              key={c.id}
              onClick={() => handlePick(c.id)}
              className={`py-4 rounded-2xl font-extrabold text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 ${isFb && !flash.ok ? 'animate-shake' : ''}`}
              style={{
                background: isFb
                  ? flash.ok
                    ? 'rgba(52, 211, 153, 0.28)'
                    : 'rgba(251, 113, 133, 0.34)'
                  : 'var(--bg-subtle)',
                border: isFb
                  ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1px solid var(--border)',
              }}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: c.hex }} />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

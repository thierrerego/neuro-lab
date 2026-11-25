import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface SimonRound {
  masterSaid: boolean;
  targetId: 'blue' | 'green' | 'amber';
  targetLabel: string;
}

const TARGETS = [
  { id: 'blue' as const, label: 'AZUL', hex: '#2563EB', icon: '●' },
  { id: 'green' as const, label: 'VERDE', hex: '#059669', icon: '▲' },
  { id: 'amber' as const, label: 'AMARELO', hex: '#D97706', icon: '★' },
];

function createSimonRound(stage: number): SimonRound {
  const lvl = Math.max(1, Math.floor(stage));
  const fakeChance = lvl <= 2 ? 0.3 : lvl <= 7 ? 0.42 : 0.48;
  const masterSaid = Math.random() >= fakeChance;
  const t = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  return {
    masterSaid,
    targetId: t.id,
    targetLabel: t.label,
  };
}

export function SimonSaysGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<SimonRound>(() => createSimonRound(config.stage));
  const [feedback, setFeedback] = useState<'ok' | 'err' | null>(null);

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

  useEffect(() => {
    if (!paused) statsRef.current.shownAt = performance.now();
  }, [paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const handleAction = (choice: 'blue' | 'green' | 'amber' | 'ignore') => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(120, performance.now() - statsRef.current.shownAt);
    const ok = round.masterSaid ? choice === round.targetId : choice === 'ignore';

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(85, statsRef.current.combo * 13);
      sound.hit(statsRef.current.combo);
      setFeedback('ok');

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createSimonRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 200);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setFeedback('err');
      onWaveError?.();
      emitLive();
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createSimonRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 280);
    }
  };

  return (
    <div className="w-full max-w-[350px] flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full text-center"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Só obedeça se tiver 👑 O MESTRE MANDOU
      </div>

      <div
        className={`w-full rounded-3xl p-6 text-center flex flex-col items-center gap-2 transition-all ${
          feedback === 'err' ? 'animate-shake' : ''
        }`}
        style={{
          background:
            feedback === 'ok'
              ? 'rgba(16, 185, 129, 0.16)'
              : feedback === 'err'
                ? 'rgba(239, 68, 68, 0.16)'
                : 'var(--bg-card)',
          border:
            feedback === 'ok'
              ? '2px solid var(--ok)'
              : feedback === 'err'
                ? '2px solid var(--err)'
                : '1.5px solid var(--border-strong)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {round.masterSaid ? (
          <span
            className="px-3 py-1 rounded-full text-xs font-black tracking-wide"
            style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#D97706' }}
          >
            👑 O MESTRE MANDOU
          </span>
        ) : (
          <span
            className="px-3 py-1 rounded-full text-xs font-bold tracking-wide"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-soft)' }}
          >
            Atenção...
          </span>
        )}
        <div className="text-2xl font-black mt-1">
          Toque no {round.targetLabel}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full">
        {TARGETS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleAction(t.id)}
            className="min-h-[68px] rounded-2xl flex flex-col items-center justify-center gap-1 font-extrabold text-xs cursor-pointer transition-transform active:scale-95"
            style={{
              background: `${t.hex}1C`,
              border: `2px solid ${t.hex}`,
              color: t.hex,
            }}
          >
            <span className="text-2xl leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => handleAction('ignore')}
        className="w-full min-h-[54px] rounded-2xl font-extrabold text-sm btn-soft cursor-pointer transition-transform active:scale-95"
        style={{ border: '1.5px solid var(--border-strong)' }}
      >
        ✋ IGNORAR (Mestre não mandou)
      </button>
    </div>
  );
}

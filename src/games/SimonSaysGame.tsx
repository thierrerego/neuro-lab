import { useEffect, useRef, useState } from 'react';
import { Circle, Crown, Hand, Star, Triangle } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type TargetId = 'blue' | 'green' | 'amber';

interface SimonRound {
  id: number;
  masterSaid: boolean;
  targetId: TargetId;
  targetLabel: string;
  holdMs: number;
}

const TARGETS = [
  { id: 'blue' as const, label: 'AZUL', hex: '#2563EB' },
  { id: 'green' as const, label: 'VERDE', hex: '#059669' },
  { id: 'amber' as const, label: 'AMARELO', hex: '#D97706' },
];

function renderShape(id: TargetId, size = 24) {
  if (id === 'blue') return <Circle size={size} fill="currentColor" />;
  if (id === 'green') return <Triangle size={size} fill="currentColor" />;
  return <Star size={size} fill="currentColor" />;
}

function createSimonRound(stage: number, seq: number): SimonRound {
  const lvl = Math.max(1, Math.floor(stage));
  const fakeChance = lvl <= 2 ? 0.32 : lvl <= 7 ? 0.42 : 0.48;
  const masterSaid = Math.random() >= fakeChance;
  const t = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  const holdMs = lvl <= 3 ? 1350 : lvl <= 8 ? 1150 : 980;
  return {
    id: seq,
    masterSaid,
    targetId: t.id,
    targetLabel: t.label,
    holdMs,
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
  const seqRef = useRef(1);
  const [round, setRound] = useState<SimonRound>(() => createSimonRound(config.stage, 1));
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [holdPct, setHoldPct] = useState(100);

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

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  };

  const advanceRound = (delayMs: number) => {
    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      seqRef.current += 1;
      setRound(createSimonRound(configRef.current.stage, seqRef.current));
      setFeedback(null);
      setHoldPct(100);
      statsRef.current.shownAt = performance.now();
    }, delayMs);
  };

  // Quando NÃO tem coroa (pegadinha), basta NÃO tocar em nada até o tempo acabar!
  useEffect(() => {
    if (paused || feedback !== null || statsRef.current.finished || round.masterSaid) return;

    const start = performance.now();
    setHoldPct(100);

    const tick = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.max(0, 100 - (elapsed / round.holdMs) * 100);
      setHoldPct(pct);
    }, 40);

    const doneId = window.setTimeout(() => {
      window.clearInterval(tick);
      if (statsRef.current.finished) return;
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rawPoints += 120 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);
      setFeedback({ ok: true, text: 'Segurou bem!' });
      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      advanceRound(260);
    }, round.holdMs);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(doneId);
    };
  }, [round, paused, feedback]);

  const handleTap = (choice: TargetId) => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(100, performance.now() - statsRef.current.shownAt);

    if (round.masterSaid && choice === round.targetId) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(85, statsRef.current.combo * 13);
      sound.hit(statsRef.current.combo);
      setFeedback({ ok: true, text: 'Correto!' });

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      advanceRound(210);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 35);
      sound.miss();
      setFeedback({
        ok: false,
        text: round.masterSaid ? 'Cor errada!' : 'Sem coroa: não toque!',
      });
      onWaveError?.();
      emitLive();
      advanceRound(360);
    }
  };

  return (
    <div className="w-full max-w-[350px] flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full text-center flex items-center gap-1.5"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        <Crown size={14} />
        <span>Com coroa: toque · Sem coroa: não toque</span>
      </div>

      <div
        className={`w-full rounded-3xl p-6 text-center flex flex-col items-center gap-2.5 transition-all ${
          feedback && !feedback.ok ? 'animate-shake' : ''
        }`}
        style={{
          background: feedback
            ? feedback.ok
              ? 'rgba(16, 185, 129, 0.16)'
              : 'rgba(239, 68, 68, 0.16)'
            : round.masterSaid
              ? 'rgba(245, 158, 11, 0.10)'
              : 'var(--bg-card)',
          border: feedback
            ? `2px solid ${feedback.ok ? 'var(--ok)' : 'var(--err)'}`
            : round.masterSaid
              ? '2px solid #D97706'
              : '1.5px solid var(--border-strong)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {round.masterSaid ? (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide"
            style={{ background: 'rgba(245, 158, 11, 0.22)', color: '#D97706' }}
          >
            <Crown size={14} />
            <span>O MESTRE MANDOU</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-soft)' }}
          >
            <Hand size={13} />
            <span>Sem coroa — aguarde</span>
          </span>
        )}

        <div className="text-2xl font-black mt-0.5">
          Toque no {round.targetLabel}
        </div>

        {feedback ? (
          <div
            className="text-xs font-extrabold"
            style={{ color: feedback.ok ? 'var(--ok)' : 'var(--err)' }}
          >
            {feedback.text}
          </div>
        ) : !round.masterSaid ? (
          <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--bg-subtle)' }}>
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{ width: `${holdPct}%`, background: 'var(--text-soft)' }}
            />
          </div>
        ) : (
          <div className="h-1.5" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full">
        {TARGETS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTap(t.id)}
            className="min-h-[78px] rounded-2xl flex flex-col items-center justify-center gap-1.5 font-extrabold text-xs cursor-pointer transition-transform active:scale-95"
            style={{
              background: `${t.hex}1C`,
              border: `2px solid ${t.hex}`,
              color: t.hex,
            }}
          >
            {renderShape(t.id, 26)}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

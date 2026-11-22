import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface GoTrial {
  id: number;
  isGo: boolean;
  shape: 'circle' | 'square';
}

export function GoNoGoReflexGame({ config, finishRequested, onLiveUpdate, onFinish }: MinigameProps) {
  const windowMs = Math.max(720, config.stimulusMs);
  const [trial, setTrial] = useState<GoTrial | null>(null);
  const [feedback, setFeedback] = useState<'ok' | 'impulsive' | 'missed' | null>(null);

  const trialRef = useRef({
    responded: false,
    shownAt: performance.now(),
    current: null as GoTrial | null,
  });

  const statsRef = useRef({
    correct: 0,
    commission: 0, // erro impulsivo (tocar em NO-GO)
    omission: 0,   // deixou passar um GO
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    finished: false,
  });

  const emitLive = useCallback(() => {
    const s = statsRef.current;
    const tot = s.correct + s.commission + s.omission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * config.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
    });
  }, [config.scoreMultiplier, onLiveUpdate]);

  useEffect(() => {
    if (finishRequested && !statsRef.current.finished) {
      statsRef.current.finished = true;
      onFinish({
        correct: statsRef.current.correct,
        commissionErrors: statsRef.current.commission,
        omissionErrors: statsRef.current.omission,
        reactionTimesMs: statsRef.current.rts,
        rawPoints: statsRef.current.rawPoints,
      });
    }
  }, [finishRequested, onFinish]);

  // Loop de estímulos: intervalo curto (380ms) -> estímulo visível por windowMs
  useEffect(() => {
    let cancelled = false;
    let seq = 0;
    let t1 = 0;
    let t2 = 0;

    const scheduleNext = () => {
      if (cancelled || statsRef.current.finished) return;
      setTrial(null);
      trialRef.current.current = null;

      t1 = window.setTimeout(() => {
        if (cancelled || statsRef.current.finished) return;
        seq++;
        // ~68% GO (verde), ~32% NO-GO (vermelho bloqueio)
        const isGo = Math.random() < 0.68;
        const next: GoTrial = { id: seq, isGo, shape: isGo ? 'circle' : 'square' };
        trialRef.current = { responded: false, shownAt: performance.now(), current: next };
        setTrial(next);
        setFeedback(null);

        t2 = window.setTimeout(() => {
          if (cancelled || statsRef.current.finished) return;
          if (!trialRef.current.responded) {
            if (next.isGo) {
              statsRef.current.omission++;
              statsRef.current.combo = 0;
              setFeedback('missed');
              sound.miss();
            } else {
              // Inibição bem-sucedida no NO-GO!
              statsRef.current.correct++;
              statsRef.current.combo++;
              statsRef.current.rawPoints += 110;
            }
            emitLive();
          }
          scheduleNext();
        }, windowMs);
      }, 360 + Math.floor(Math.random() * 260));
    };

    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [windowMs, emitLive]);

  const handleTap = useCallback(() => {
    const cur = trialRef.current.current;
    if (!cur || trialRef.current.responded || statsRef.current.finished) return;
    trialRef.current.responded = true;
    const rt = performance.now() - trialRef.current.shownAt;

    if (cur.isGo) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 130 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);
      setFeedback('ok');
    } else {
      // Penalização forte por erro impulsivo em NO-GO
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 120);
      sound.miss();
      setFeedback('impulsive');
    }
    emitLive();
  }, [emitLive]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTap]);

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)' }}>
        <span style={{ color: 'var(--ok)' }}>● Toque</span>
        <span style={{ color: 'var(--text-soft)' }}>|</span>
        <span style={{ color: 'var(--err)' }}>✕ Pare</span>
      </div>

      <button
        onClick={handleTap}
        className={`w-56 h-56 rounded-full flex items-center justify-center transition-all cursor-pointer ${feedback === 'impulsive' ? 'animate-shake' : ''}`}
        style={{
          background:
            feedback === 'ok'
              ? 'rgba(52, 211, 153, 0.25)'
              : feedback === 'impulsive'
                ? 'rgba(251, 113, 133, 0.35)'
                : trial
                  ? trial.isGo
                    ? 'rgba(52, 211, 153, 0.16)'
                    : 'rgba(251, 113, 133, 0.16)'
                  : 'var(--bg-card)',
          border:
            feedback === 'ok'
              ? '3px solid var(--ok)'
              : feedback === 'impulsive'
                ? '3px solid var(--err)'
                : trial
                  ? `3px solid ${trial.isGo ? 'var(--ok)' : 'var(--err)'}`
                  : '2px dashed var(--border)',
        }}
      >
        {trial ? (
          trial.isGo ? (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black animate-pop" style={{ background: '#10b981', color: '#052e16', boxShadow: '0 0 32px rgba(16,185,129,0.55)' }}>
              GO
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black animate-pop" style={{ background: '#f43f5e', color: '#fff', boxShadow: '0 0 32px rgba(244,63,94,0.55)' }}>
              ✕
            </div>
          )
        ) : (
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>
            {feedback === 'impulsive' ? 'Impulsivo!' : feedback === 'missed' ? 'Passou!' : 'Aguarde...'}
          </span>
        )}
      </button>
    </div>
  );
}

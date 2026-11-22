import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface Stimulus {
  pos: number;
  sym: string;
}

const SYMBOLS = ['◆', '▲', '●', '■', '★', '✦'];

function nextStimulus(history: Stimulus[], nBack: number): Stimulus {
  const canMatch = history.length >= nBack;
  const ref = canMatch ? history[history.length - nBack] : null;
  const prev = history.length > 0 ? history[history.length - 1] : null;
  const forceSame = Boolean(ref && Math.random() < 0.45);

  if (forceSame && ref) {
    return { pos: ref.pos, sym: ref.sym };
  }

  // Quando não é match, evita repetir tanto o alvo N atrás quanto a posição imediatamente anterior
  const forbidden = new Set<number>();
  if (ref) forbidden.add(ref.pos);
  if (prev) forbidden.add(prev.pos);

  const candidates = Array.from({ length: 9 }, (_, i) => i).filter((p) => !forbidden.has(p));
  const pos =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : Math.floor(Math.random() * 9);

  return {
    pos,
    sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
  };
}

/**
 * N-Back intuitivo e claro:
 * - No início (Estágios 0..4), usa 1-Back comparando com o imediatamente anterior.
 * - Mostra miniatura fantasma/dica visual na primeira rodada comparável ("Compare com o anterior").
 * - Botões claros: "✕ DIFERENTE" e "✓ IGUAL AO ANTERIOR" (ou "IGUAL A N ATRÁS" nos níveis avançados).
 */
export function DualNBackGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const n = config.nBackLevel;
  const [history, setHistory] = useState<Stimulus[]>(() => [nextStimulus([], n)]);
  const [flash, setFlash] = useState<{ kind: 'same' | 'diff'; ok: boolean } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    omission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    shownAt: performance.now(),
    finished: false,
  });

  const finishNow = useCallback(() => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    onFinish({
      correct: statsRef.current.correct,
      commissionErrors: statsRef.current.commission,
      omissionErrors: statsRef.current.omission,
      reactionTimesMs: statsRef.current.rts,
      rawPoints: statsRef.current.rawPoints,
    });
  }, [onFinish]);

  useEffect(() => {
    if (finishRequested) finishNow();
  }, [finishRequested, finishNow]);

  const stepIdx = history.length - 1;
  const current = history[stepIdx];
  const canCompare = stepIdx >= n;
  const refStimulus = canCompare ? history[stepIdx - n] : null;
  const showGhostHint = canCompare && stepIdx <= n + 1 && config.stage < 2;

  // Avança automaticamente os primeiros N quadros de memorização inicial
  useEffect(() => {
    if (canCompare || statsRef.current.finished || paused) return;
    const t = window.setTimeout(() => {
      if (statsRef.current.finished || pausedRef.current) return;
      setHistory((prev) => [...prev, nextStimulus(prev, configRef.current.nBackLevel)]);
      statsRef.current.shownAt = performance.now();
    }, 1250);
    return () => window.clearTimeout(t);
  }, [canCompare, stepIdx, paused]);

  const answer = useCallback(
    (userSaysSame: boolean) => {
      if (!canCompare || !refStimulus || flash || pausedRef.current || statsRef.current.finished) return;
      const rt = performance.now() - statsRef.current.shownAt;
      const isMatch = current.pos === refStimulus.pos;
      const ok = userSaysSame === isMatch;
      let clearedAll = false;

      if (ok) {
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rts.push(rt);
        statsRef.current.rawPoints += 140 + Math.min(80, statsRef.current.combo * 14);
        sound.hit(statsRef.current.combo);
        clearedAll = onWaveHit();
      } else {
        statsRef.current.commission++;
        statsRef.current.combo = 0;
        statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
        sound.miss();
        onWaveError?.();
      }

      const tot = statsRef.current.correct + statsRef.current.commission;
      onLiveUpdate({
        score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
        accuracyPct: tot > 0 ? Math.round((statsRef.current.correct / tot) * 100) : 100,
        combo: statsRef.current.combo,
      });

      if (clearedAll) {
        finishNow();
        return;
      }

      setFlash({ kind: userSaysSame ? 'same' : 'diff', ok });
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setFlash(null);
        setHistory((prev) => [...prev, nextStimulus(prev, configRef.current.nBackLevel)]);
        statsRef.current.shownAt = performance.now();
      }, 220);
    },
    [canCompare, refStimulus, flash, current, onWaveHit, onWaveError, onLiveUpdate, finishNow]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answer(false);
      else if (e.key === 'ArrowRight') answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <div
          className="text-xs font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-full"
          style={{ background: 'var(--bg-subtle)', color: canCompare ? 'var(--accent)' : 'var(--warn)' }}
        >
          {!canCompare
            ? 'Memorize esta posição...'
            : n === 1
              ? 'Compare com o anterior'
              : `Compare com ${n} atrás`}
        </div>
        {showGhostHint && (
          <span className="text-xs font-semibold text-center" style={{ color: 'var(--text-muted)' }}>
            A marca pontilhada mostra onde estava o anterior
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[248px]">
        {Array.from({ length: 9 }, (_, i) => {
          const active = current?.pos === i;
          const isGhost = showGhostHint && refStimulus?.pos === i;
          return (
            <div
              key={`${stepIdx}-${i}`}
              className="aspect-square rounded-2xl flex items-center justify-center text-3xl font-black transition-all relative"
              style={{
                background: active
                  ? 'var(--accent-grad)'
                  : isGhost
                    ? 'var(--accent-glow)'
                    : 'var(--bg-card)',
                border: active
                  ? '2px solid var(--accent)'
                  : isGhost
                    ? '2px dashed var(--accent)'
                    : '1px solid var(--border)',
                color: active ? '#ffffff' : 'var(--accent)',
                boxShadow: active ? '0 8px 20px var(--accent-shadow)' : 'var(--card-shadow)',
              }}
            >
              {active ? (
                current.sym
              ) : isGhost ? (
                <span className="text-xs font-extrabold uppercase opacity-80">Ant.</span>
              ) : (
                ''
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[340px]">
        <button
          disabled={!canCompare || paused}
          onClick={() => answer(false)}
          className="py-4 px-3 rounded-2xl font-bold text-sm transition-all cursor-pointer disabled:opacity-35"
          style={{
            background:
              flash?.kind === 'diff'
                ? flash.ok
                  ? 'rgba(52, 211, 153, 0.28)'
                  : 'rgba(251, 113, 133, 0.32)'
                : 'var(--bg-card)',
            border:
              flash?.kind === 'diff'
                ? `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`
                : '1.5px solid var(--border-strong)',
          }}
        >
          ✕ DIFERENTE
        </button>

        <button
          disabled={!canCompare || paused}
          onClick={() => answer(true)}
          className="py-4 px-3 rounded-2xl font-bold text-sm transition-all cursor-pointer disabled:opacity-35 btn-accent"
          style={
            flash?.kind === 'same'
              ? {
                  background: flash.ok ? 'rgba(52, 211, 153, 0.35)' : 'rgba(251, 113, 133, 0.4)',
                  border: `2px solid ${flash.ok ? 'var(--ok)' : 'var(--err)'}`,
                }
              : undefined
          }
        >
          {n === 1 ? '✓ IGUAL AO ANTERIOR' : `✓ IGUAL A ${n} ATRÁS`}
        </button>
      </div>
    </div>
  );
}

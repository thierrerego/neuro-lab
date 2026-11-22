import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface Stimulus {
  pos: number; // 0..8
  sym: string;
}

const SYMBOLS = ['◆', '▲', '●', '■', '★', '✦'];

function generateStream(count: number, nBack: number): Stimulus[] {
  const list: Stimulus[] = [];
  for (let i = 0; i < count; i++) {
    const forcePosMatch = i >= nBack && Math.random() < 0.36;
    const forceSymMatch = i >= nBack && Math.random() < 0.36;
    const pos = forcePosMatch ? list[i - nBack].pos : Math.floor(Math.random() * 9);
    const sym = forceSymMatch
      ? list[i - nBack].sym
      : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    list.push({ pos, sym });
  }
  return list;
}

export function DualNBackGame({ config, finishRequested, onLiveUpdate, onFinish }: MinigameProps) {
  const n = config.nBackLevel;
  const dualMode = config.stage >= 3; // Fase 1-2: posição apenas; Fase 3+: Dual (posição + símbolo)
  const totalSteps = config.roundsTarget;
  const stepMs = Math.max(1550, config.stimulusMs + 850);

  const [stream] = useState<Stimulus[]>(() => generateStream(totalSteps, n));
  const [stepIdx, setStepIdx] = useState(0);
  const [pressedPos, setPressedPos] = useState<null | 'ok' | 'err'>(null);
  const [pressedSym, setPressedSym] = useState<null | 'ok' | 'err'>(null);

  const stepStateRef = useRef({
    respondedPos: false,
    respondedSym: false,
    stepShownAt: performance.now(),
  });

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    omission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    finished: false,
  });

  const finishNow = () => {
    if (statsRef.current.finished) return;
    statsRef.current.finished = true;
    onFinish({
      correct: statsRef.current.correct,
      commissionErrors: statsRef.current.commission,
      omissionErrors: statsRef.current.omission,
      reactionTimesMs: statsRef.current.rts,
      rawPoints: statsRef.current.rawPoints,
    });
  };

  useEffect(() => {
    if (finishRequested) finishNow();
  }, [finishRequested]);

  const emitLive = (idx: number) => {
    const s = statsRef.current;
    const tot = s.correct + s.commission + s.omission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * config.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
      statusTag: `${n}-Back · ${idx + 1}/${totalSteps}`,
    });
  };

  // Avança automaticamente a cada stepMs e registra omissões (esquecer match real) ou rejeições corretas
  useEffect(() => {
    if (statsRef.current.finished) return;
    stepStateRef.current = {
      respondedPos: false,
      respondedSym: false,
      stepShownAt: performance.now(),
    };
    setPressedPos(null);
    setPressedSym(null);

    const timer = window.setTimeout(() => {
      if (stepIdx >= n) {
        const cur = stream[stepIdx];
        const prev = stream[stepIdx - n];
        const isPosMatch = cur.pos === prev.pos;
        const isSymMatch = cur.sym === prev.sym;

        if (isPosMatch && !stepStateRef.current.respondedPos) {
          statsRef.current.omission++;
          statsRef.current.combo = 0;
        } else if (!isPosMatch && !stepStateRef.current.respondedPos) {
          // Rejeição correta silenciosa conta positivamente para precisão justa
          statsRef.current.correct++;
          statsRef.current.rawPoints += 35;
        }

        if (dualMode) {
          if (isSymMatch && !stepStateRef.current.respondedSym) {
            statsRef.current.omission++;
            statsRef.current.combo = 0;
          } else if (!isSymMatch && !stepStateRef.current.respondedSym) {
            statsRef.current.correct++;
            statsRef.current.rawPoints += 35;
          }
        }
        emitLive(stepIdx);
      }

      if (stepIdx + 1 >= totalSteps) {
        finishNow();
      } else {
        setStepIdx(stepIdx + 1);
      }
    }, stepMs);

    return () => clearTimeout(timer);
  }, [stepIdx, stepMs, stream, n, dualMode, totalSteps]);

  const checkMatch = (kind: 'pos' | 'sym') => {
    if (stepIdx < n || statsRef.current.finished) return;
    if (kind === 'pos' && stepStateRef.current.respondedPos) return;
    if (kind === 'sym' && stepStateRef.current.respondedSym) return;

    const rt = performance.now() - stepStateRef.current.stepShownAt;
    const cur = stream[stepIdx];
    const prev = stream[stepIdx - n];
    const isMatch = kind === 'pos' ? cur.pos === prev.pos : cur.sym === prev.sym;

    if (kind === 'pos') stepStateRef.current.respondedPos = true;
    else stepStateRef.current.respondedSym = true;

    if (isMatch) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 150 + statsRef.current.combo * 15;
      sound.hit(statsRef.current.combo);
      if (kind === 'pos') setPressedPos('ok');
      else setPressedSym('ok');
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 50);
      sound.miss();
      if (kind === 'pos') setPressedPos('err');
      else setPressedSym('err');
    }
    emitLive(stepIdx);
  };

  const current = stream[stepIdx];

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}>
        <span>{n}-Back</span>
        <span style={{ color: 'var(--text-soft)' }}>· {stepIdx + 1}/{totalSteps}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
        {Array.from({ length: 9 }, (_, i) => {
          const active = current?.pos === i;
          return (
            <div
              key={`${stepIdx}-${i}`}
              className="aspect-square rounded-2xl flex items-center justify-center text-3xl font-black transition-all"
              style={{
                background: active ? 'var(--accent-grad)' : 'var(--bg-card)',
                border: active ? '2px solid #fff' : '1px solid var(--border)',
                color: '#ffffff',
                boxShadow: active ? '0 0 22px var(--accent-glow)' : 'none',
              }}
            >
              {active ? current.sym : ''}
            </div>
          );
        })}
      </div>

      <div className={`grid gap-2.5 w-full max-w-[300px] ${dualMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          disabled={stepIdx < n}
          onClick={() => checkMatch('pos')}
          className="py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer disabled:opacity-35"
          style={{
            background:
              pressedPos === 'ok'
                ? 'rgba(52, 211, 153, 0.3)'
                : pressedPos === 'err'
                  ? 'rgba(251, 113, 133, 0.35)'
                  : 'var(--bg-card)',
            border:
              pressedPos === 'ok'
                ? '2px solid var(--ok)'
                : pressedPos === 'err'
                  ? '2px solid var(--err)'
                  : '1px solid var(--border-strong)',
          }}
        >
          {dualMode ? 'Posição Igual' : `Igual a ${n} atrás`}
        </button>

        {dualMode && (
          <button
            disabled={stepIdx < n}
            onClick={() => checkMatch('sym')}
            className="py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer disabled:opacity-35"
            style={{
              background:
                pressedSym === 'ok'
                  ? 'rgba(52, 211, 153, 0.3)'
                  : pressedSym === 'err'
                    ? 'rgba(251, 113, 133, 0.35)'
                    : 'var(--bg-card)',
              border:
                pressedSym === 'ok'
                  ? '2px solid var(--ok)'
                  : pressedSym === 'err'
                    ? '2px solid var(--err)'
                    : '1px solid var(--border-strong)',
            }}
          >
            Símbolo Igual
          </button>
        )}
      </div>
    </div>
  );
}

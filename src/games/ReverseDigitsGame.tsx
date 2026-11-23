import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

function getSpanParams(stage: number) {
  const lvl = Math.max(1, Math.min(20, Math.floor(stage)));
  // Digit Span Inverso (WAIS-IV): Nv.1=2 dígitos | Nv.5=3 | Nv.9=4 | Nv.13=5 | Nv.16=6 | Nv.18=7 | Nv.20=8
  const length =
    lvl <= 2 ? 2 : lvl <= 6 ? 3 : lvl <= 10 ? 4 : lvl <= 14 ? 5 : lvl <= 17 ? 6 : lvl <= 19 ? 7 : 8;
  const showMs = Math.max(420, Math.round(1050 - (lvl - 1) * 32));
  return { length, showMs };
}

function buildDigits(length: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    let d = Math.floor(Math.random() * 9) + 1;
    if (i > 0 && d === out[i - 1]) {
      d = (d % 9) + 1;
    }
    out.push(d);
  }
  return out;
}

export function ReverseDigitsGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState(1);
  const [seq, setSeq] = useState<number[]>(() => buildDigits(getSpanParams(config.stage).length));
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [showIdx, setShowIdx] = useState(0);
  const [typed, setTyped] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<'ok' | 'err' | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const statsRef = useRef({
    correct: 0,
    commission: 0,
    rts: [] as number[],
    combo: 0,
    rawPoints: 0,
    inputStart: performance.now(),
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
    if (paused || phase !== 'show') return;
    const { showMs } = getSpanParams(configRef.current.stage);
    const id = window.setTimeout(() => {
      if (showIdx + 1 < seq.length) {
        setShowIdx((i) => i + 1);
      } else {
        statsRef.current.inputStart = performance.now();
        setPhase('input');
      }
    }, showMs);
    return () => window.clearTimeout(id);
  }, [paused, phase, showIdx, seq, round]);

  const emitLive = () => {
    const s = statsRef.current;
    const tot = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: tot > 0 ? Math.round((s.correct / tot) * 100) : 100,
      combo: s.combo,
      statusTag: `${seq.length} dígitos`,
    });
  };

  const nextRound = () => {
    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      const { length } = getSpanParams(configRef.current.stage);
      setSeq(buildDigits(length));
      setShowIdx(0);
      setTyped([]);
      setFeedback(null);
      setPhase('show');
      setRound((r) => r + 1);
    }, 360);
  };

  const expected = [...seq].reverse();

  const handleDigit = (digit: number) => {
    if (paused || phase !== 'input' || feedback !== null || statsRef.current.finished) return;
    const pos = typed.length;
    if (digit === expected[pos]) {
      const nextTyped = [...typed, digit];
      setTyped(nextTyped);
      sound.tap();

      if (nextTyped.length === expected.length) {
        const rt = performance.now() - statsRef.current.inputStart;
        statsRef.current.correct++;
        statsRef.current.combo++;
        statsRef.current.rts.push(rt);
        statsRef.current.rawPoints += 160 + seq.length * 25 + Math.min(80, statsRef.current.combo * 15);
        sound.hit(statsRef.current.combo);
        setFeedback('ok');
        emitLive();

        const clearedAll = onWaveHit();
        if (clearedAll) {
          window.setTimeout(() => finishNow(), 220);
          return;
        }
        nextRound();
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      onWaveError?.();
      setFeedback('err');
      emitLive();
      nextRound();
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
        style={{
          background: 'var(--bg-subtle)',
          color: phase === 'show' ? 'var(--accent)' : 'var(--ok)',
        }}
      >
        {phase === 'show' ? `Memorize (${showIdx + 1}/${seq.length})` : 'Digite de trás pra frente'}
      </div>

      {phase === 'show' ? (
        <div
          key={`${round}-${showIdx}`}
          className="w-32 h-32 rounded-3xl flex items-center justify-center text-6xl font-black tabular animate-pop"
          style={{
            background: 'var(--bg-subtle)',
            border: '2px solid var(--accent)',
            color: 'var(--text)',
          }}
        >
          {seq[showIdx]}
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-2 min-h-[48px]">
            {expected.map((_, i) => (
              <div
                key={i}
                className="w-10 h-12 rounded-xl flex items-center justify-center text-xl font-black tabular"
                style={{
                  background:
                    feedback === 'ok'
                      ? 'rgba(16, 185, 129, 0.16)'
                      : feedback === 'err'
                        ? 'rgba(239, 68, 68, 0.16)'
                        : 'var(--bg-subtle)',
                  border:
                    i === typed.length && feedback === null
                      ? '2px solid var(--accent)'
                      : '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                {typed[i] ?? '·'}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-14 rounded-2xl text-2xl font-black tabular btn-soft cursor-pointer active:scale-95 transition-transform"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

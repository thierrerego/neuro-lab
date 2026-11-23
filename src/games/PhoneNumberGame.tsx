import { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface PhoneRound {
  digits: string;
  previewMs: number;
}

function formatPhone(digits: string): string {
  const n = digits.length;
  if (n <= 4) return digits;
  if (n <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (n <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (n === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  if (n <= 11) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (rest.length <= 5) return `(${ddd}) ${rest}`;
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return digits;
}

function createPhoneRound(stage: number): PhoneRound {
  const lvl = Math.max(1, Math.floor(stage));
  const len =
    lvl <= 2 ? 4 : lvl <= 4 ? 5 : lvl <= 7 ? 6 : lvl <= 10 ? 8 : lvl <= 14 ? 9 : 11;
  let digits = '';
  if (len === 11) {
    const ddd = String(Math.floor(11 + Math.random() * 88));
    digits = ddd + '9';
    for (let i = 0; i < 8; i++) digits += String(Math.floor(Math.random() * 10));
  } else {
    for (let i = 0; i < len; i++) digits += String(Math.floor(Math.random() * 10));
  }
  const previewMs = 1500 + len * 290;
  return { digits, previewMs };
}

export function PhoneNumberGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<PhoneRound>(() => createPhoneRound(config.stage));
  const [phase, setPhase] = useState<'memorize' | 'input' | 'feedback'>('memorize');
  const [typed, setTyped] = useState('');
  const [lastResult, setLastResult] = useState<'ok' | 'err' | null>(null);

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
    if (phase !== 'memorize' || paused) return;
    const id = window.setTimeout(() => {
      if (statsRef.current.finished) return;
      statsRef.current.inputStart = performance.now();
      setPhase('input');
    }, round.previewMs);
    return () => window.clearTimeout(id);
  }, [phase, round, paused]);

  const emitLive = () => {
    const s = statsRef.current;
    const total = s.correct + s.commission;
    onLiveUpdate({
      score: Math.round(s.rawPoints * configRef.current.scoreMultiplier),
      accuracyPct: total > 0 ? Math.round((s.correct / total) * 100) : 100,
      combo: s.combo,
    });
  };

  const evaluateTyped = (candidate: string) => {
    const rt = Math.max(150, performance.now() - statsRef.current.inputStart);
    const isOk = candidate === round.digits;

    setPhase('feedback');
    setLastResult(isOk ? 'ok' : 'err');

    if (isOk) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 160 + Math.min(100, statsRef.current.combo * 18);
      sound.hit(statsRef.current.combo);
      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 260);
        return;
      }
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      onWaveError?.();
      emitLive();
    }

    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setRound(createPhoneRound(configRef.current.stage));
      setTyped('');
      setLastResult(null);
      setPhase('memorize');
    }, isOk ? 420 : 850);
  };

  const handleDigit = (d: string) => {
    if (paused || phase !== 'input' || statsRef.current.finished) return;
    if (typed.length >= round.digits.length) return;
    sound.tap();
    const next = typed + d;
    setTyped(next);
    if (next.length === round.digits.length) {
      evaluateTyped(next);
    }
  };

  const handleBackspace = () => {
    if (paused || phase !== 'input' || typed.length === 0) return;
    sound.tap();
    setTyped((prev) => prev.slice(0, -1));
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{
          background: phase === 'memorize' ? 'var(--accent-glow)' : 'var(--bg-subtle)',
          color: phase === 'memorize' ? 'var(--accent)' : 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
      >
        {phase === 'memorize' ? 'Memorize o número 📞' : 'Digite o número'}
      </div>

      <div
        className="w-full max-w-[330px] rounded-2xl px-4 py-5 text-center tabular font-extrabold tracking-wider"
        style={{
          fontSize: round.digits.length >= 10 ? '1.65rem' : '2.1rem',
          background:
            lastResult === 'ok'
              ? 'rgba(16, 185, 129, 0.14)'
              : lastResult === 'err'
                ? 'rgba(239, 68, 68, 0.14)'
                : 'var(--bg-card)',
          border:
            lastResult === 'ok'
              ? '2px solid var(--ok)'
              : lastResult === 'err'
                ? '2px solid var(--err)'
                : '1.5px solid var(--border-strong)',
          color:
            lastResult === 'ok'
              ? 'var(--ok)'
              : lastResult === 'err'
                ? 'var(--err)'
                : 'var(--text)',
        }}
      >
        {phase === 'memorize'
          ? formatPhone(round.digits)
          : lastResult === 'err'
            ? formatPhone(round.digits)
            : typed
              ? formatPhone(typed)
              : '•'.repeat(Math.min(round.digits.length, 11))}
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[270px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            disabled={phase !== 'input'}
            onClick={() => handleDigit(d)}
            className="h-14 rounded-2xl text-xl font-extrabold tabular cursor-pointer transition-transform active:scale-95"
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--border)',
              opacity: phase === 'input' ? 1 : 0.45,
            }}
          >
            {d}
          </button>
        ))}

        <div />

        <button
          type="button"
          disabled={phase !== 'input'}
          onClick={() => handleDigit('0')}
          className="h-14 rounded-2xl text-xl font-extrabold tabular cursor-pointer transition-transform active:scale-95"
          style={{
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            opacity: phase === 'input' ? 1 : 0.45,
          }}
        >
          0
        </button>

        <button
          type="button"
          disabled={phase !== 'input' || typed.length === 0}
          onClick={handleBackspace}
          aria-label="Apagar"
          className="h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          style={{
            background: 'var(--bg-subtle)',
            border: '1.5px solid var(--border)',
            opacity: phase === 'input' && typed.length > 0 ? 1 : 0.4,
          }}
        >
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}

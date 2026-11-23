import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

const WORDS_EASY = [
  'BRAIN', 'FOCUS', 'LOGIC', 'SMART', 'MIND', 'FAST', 'SOLVE', 'SKILL',
  'SPARK', 'SHARP', 'PULSE', 'QUEST', 'THINK', 'CLEAR', 'ALERT', 'AGILE',
];

const WORDS_MEDIUM = [
  'VISION', 'MEMORY', 'MENTAL', 'NEURAL', 'PUZZLE', 'REASON', 'WISDOM',
  'SIGNAL', 'TARGET', 'VECTOR', 'MATRIX', 'METHOD', 'ENERGY', 'PLANET',
];

const WORDS_HARD = [
  'INSIGHT', 'PATTERN', 'CLARITY', 'BALANCE', 'ANALYST', 'SYNAPSE',
  'CONCEPT', 'NETWORK', 'DYNAMIC', 'PROBLEM', 'PROCESS', 'COGNATE',
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scrambleDifferent(word: string): string {
  const chars = word.split('');
  for (let tries = 0; tries < 20; tries++) {
    const perm = shuffle(chars).join('');
    if (perm !== word) return perm;
  }
  return chars.reverse().join('');
}

function makeFakeAnagram(word: string): string {
  const chars = word.split('');
  const idx = Math.floor(Math.random() * chars.length);
  const orig = chars[idx];
  let replacement = orig;
  while (replacement === orig) {
    replacement = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  chars[idx] = replacement;
  return scrambleDifferent(chars.join(''));
}

interface AnagramRound {
  target: string;
  options: { text: string; isCorrect: boolean }[];
}

function createRound(stage: number): AnagramRound {
  const lvl = Math.max(1, Math.floor(stage));
  const pool = lvl <= 4 ? WORDS_EASY : lvl <= 10 ? WORDS_MEDIUM : WORDS_HARD;
  const target = pool[Math.floor(Math.random() * pool.length)];

  const correct = scrambleDifferent(target);
  const fakes = new Set<string>();
  const targetSorted = target.split('').sort().join('');

  let guard = 0;
  while (fakes.size < 3 && guard < 40) {
    guard++;
    const cand = makeFakeAnagram(target);
    const candSorted = cand.split('').sort().join('');
    if (cand !== correct && cand !== target && candSorted !== targetSorted) {
      fakes.add(cand);
    }
  }

  const options = shuffle([
    { text: correct, isCorrect: true },
    ...Array.from(fakes).map((text) => ({ text, isCorrect: false })),
  ]);

  return { target, options };
}

export function SecretAnagramsGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<AnagramRound>(() => createRound(config.stage));
  const [picked, setPicked] = useState<{ text: string; ok: boolean } | null>(null);

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

  const handleChoose = (opt: { text: string; isCorrect: boolean }) => {
    if (paused || picked !== null || statsRef.current.finished) return;

    const now = performance.now();
    const rt = Math.max(150, now - statsRef.current.roundStart);
    setPicked({ text: opt.text, ok: opt.isCorrect });

    if (opt.isCorrect) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 145 + Math.min(85, statsRef.current.combo * 15);
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
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 40);
      sound.miss();
      onWaveError?.();
      emitLive();
    }

    window.setTimeout(() => {
      if (statsRef.current.finished) return;
      setRound(createRound(configRef.current.stage));
      setPicked(null);
      statsRef.current.roundStart = performance.now();
    }, 300);
  };

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Qual opção tem exatamente as mesmas letras?
      </div>

      <div
        className="w-full max-w-[330px] rounded-3xl py-6 px-4 text-center"
        style={{ background: 'var(--bg-card)', border: '2px solid var(--border-strong)' }}
      >
        <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>
          Palavra-alvo
        </div>
        <div className="text-4xl font-black tracking-[0.18em] mt-1.5" style={{ color: 'var(--accent)' }}>
          {round.target}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[348px]">
        {round.options.map((opt) => {
          const isPicked = picked?.text === opt.text;
          return (
            <button
              key={opt.text}
              type="button"
              onClick={() => handleChoose(opt)}
              className={`h-16 rounded-2xl font-extrabold text-lg tracking-[0.14em] transition-all cursor-pointer ${
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
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

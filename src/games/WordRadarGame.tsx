import { useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

const WORD_CLUSTERS: string[][] = [
  ['SOL', 'SAL', 'SUL', 'SOM', 'SOB', 'SOU', 'SEL', 'SIL', 'CAL'],
  ['MAR', 'MAL', 'MAS', 'PAR', 'BAR', 'LAR', 'DAR', 'CAR', 'VAR'],
  ['CASA', 'CAMA', 'CAPA', 'CARA', 'CADA', 'CANA', 'CAÇA', 'CASO', 'CAVA'],
  ['PATO', 'PANO', 'PAGO', 'PAPO', 'PATA', 'MATO', 'GATO', 'RATO', 'FATO'],
  ['FOCO', 'FOTO', 'FOGO', 'FOFO', 'FORO', 'POCO', 'COCO', 'LOCO', 'TOCO'],
  ['VELA', 'VERA', 'VEDA', 'BELA', 'TELA', 'CELA', 'SALA', 'VALA', 'MELA'],
  ['LAGO', 'LADO', 'LAÇO', 'LAMA', 'LOGO', 'PAGO', 'MAGO', 'VAGO', 'SAGO'],
  ['BOLA', 'BOTA', 'BOCA', 'BODA', 'COLA', 'MOLA', 'SOLA', 'GOLA', 'ROLA'],
  ['LUZ', 'LUS', 'CRUZ', 'NUS', 'JUS', 'PAZ', 'FAZ', 'VAZ', 'TUS'],
  ['VIDA', 'VIGA', 'VILA', 'VISA', 'VIVA', 'MIDA', 'LIDA', 'SINA', 'VINA'],
  ['PLANO', 'PRATO', 'PRAZO', 'PRADO', 'PLACA', 'PLENA', 'PLUMA', 'PRETO', 'PONTO'],
  ['MENTE', 'PENTE', 'DENTE', 'LENTE', 'GENTE', 'SENTE', 'RENTE', 'MONTE', 'FONTE'],
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface WordRound {
  target: string;
  options: { id: number; word: string; isTarget: boolean }[];
  cols: number;
}

function createWordRound(stage: number): WordRound {
  const lvl = Math.max(1, Math.floor(stage));
  const count = lvl <= 2 ? 4 : lvl <= 6 ? 6 : 9;
  const cols = count === 4 ? 2 : 3;

  const cluster = WORD_CLUSTERS[Math.floor(Math.random() * WORD_CLUSTERS.length)];
  const picked = shuffle(cluster).slice(0, count);
  const target = picked[0];
  const options = shuffle(picked).map((word, id) => ({
    id,
    word,
    isTarget: word === target,
  }));

  return { target, options, cols };
}

export function WordRadarGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<WordRound>(() => createWordRound(config.stage));
  const [feedback, setFeedback] = useState<{ id: number; ok: boolean } | null>(null);

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

  const handleTap = (opt: { id: number; isTarget: boolean }) => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(120, performance.now() - statsRef.current.shownAt);

    if (opt.isTarget) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(80, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      setFeedback({ id: opt.id, ok: true });

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 180);
        return;
      }
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createWordRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 210);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 30);
      sound.miss();
      setFeedback({ id: opt.id, ok: false });
      onWaveError?.();
      emitLive();
      window.setTimeout(() => setFeedback(null), 260);
    }
  };

  return (
    <div className="w-full max-w-[430px] flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>
          Encontre a palavra exata
        </span>
        <div
          className="px-6 py-2.5 rounded-2xl text-2xl font-black tracking-wider"
          style={{
            background: 'var(--accent-glow)',
            border: '2px solid var(--accent)',
            color: 'var(--accent)',
          }}
        >
          {round.target}
        </div>
      </div>

      <div
        className="grid gap-2.5 w-full"
        style={{ gridTemplateColumns: `repeat(${round.cols}, minmax(0, 1fr))` }}
      >
        {round.options.map((opt) => {
          const isFb = feedback?.id === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleTap(opt)}
              className={`min-h-[62px] rounded-2xl font-extrabold text-base tracking-wide cursor-pointer transition-all select-none ${
                isFb && !feedback.ok ? 'animate-shake' : ''
              }`}
              style={{
                background: isFb
                  ? feedback.ok
                    ? 'rgba(16, 185, 129, 0.22)'
                    : 'rgba(239, 68, 68, 0.20)'
                  : 'var(--bg-card)',
                border: isFb
                  ? `2px solid ${feedback.ok ? 'var(--ok)' : 'var(--err)'}`
                  : '1.5px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              {opt.word}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

type Side = 'left' | 'right';

interface MirrorRound {
  word: Side;       // o que está ESCRITO (resposta certa!)
  position: Side;   // lado onde o cartão aparece (distração espacial!)
  arrowDecoy?: Side; // nos ritmos altos, mostra uma setinha oposta pra confundir ainda mais
}

function createMirrorRound(stage: number): MirrorRound {
  const lvl = Math.max(1, Math.floor(stage));
  const word: Side = Math.random() < 0.5 ? 'left' : 'right';
  const conflictChance = lvl <= 2 ? 0.45 : lvl <= 7 ? 0.65 : 0.75;
  const position: Side = Math.random() < conflictChance ? (word === 'left' ? 'right' : 'left') : word;
  const arrowDecoy: Side | undefined =
    lvl >= 7 ? (Math.random() < 0.7 ? (word === 'left' ? 'right' : 'left') : word) : undefined;
  return { word, position, arrowDecoy };
}

export function MirrorWordsGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [round, setRound] = useState<MirrorRound>(() => createMirrorRound(config.stage));
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

  const handleSide = (side: Side) => {
    if (paused || feedback !== null || statsRef.current.finished) return;
    const rt = Math.max(100, performance.now() - statsRef.current.shownAt);
    const ok = side === round.word;

    if (ok) {
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 120 + Math.min(80, statsRef.current.combo * 12);
      sound.hit(statsRef.current.combo);
      setFeedback('ok');

      const clearedAll = onWaveHit();
      emitLive();
      if (clearedAll) {
        window.setTimeout(() => finishNow(), 160);
        return;
      }
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createMirrorRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 175);
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 30);
      sound.miss();
      setFeedback('err');
      onWaveError?.();
      emitLive();
      window.setTimeout(() => {
        if (statsRef.current.finished) return;
        setRound(createMirrorRound(configRef.current.stage));
        setFeedback(null);
        statsRef.current.shownAt = performance.now();
      }, 260);
    }
  };

  return (
    <div className="w-full max-w-[420px] flex flex-col items-center gap-6">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full text-center"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        Obedeça a PALAVRA · Ignore o lado da tela
      </div>

      {/* Palco dividido em 2 colunas: o estímulo aparece de um lado, mas você lê a palavra */}
      <div
        className={`w-full grid grid-cols-2 gap-3 p-3 rounded-3xl min-h-[120px] items-center ${
          feedback === 'err' ? 'animate-shake' : ''
        }`}
        style={{
          background:
            feedback === 'ok'
              ? 'rgba(16, 185, 129, 0.14)'
              : feedback === 'err'
                ? 'rgba(239, 68, 68, 0.14)'
                : 'var(--bg-subtle)',
          border:
            feedback === 'ok'
              ? '2px solid var(--ok)'
              : feedback === 'err'
                ? '2px solid var(--err)'
                : '1.5px solid var(--border)',
        }}
      >
        {(['left', 'right'] as const).map((slot) => (
          <div key={slot} className="flex items-center justify-center">
            {round.position === slot && (
              <div
                className="w-full py-6 px-2 rounded-2xl text-center flex flex-col items-center gap-1 animate-pop"
                style={{
                  background: 'var(--bg-card)',
                  border: '2px solid var(--accent)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <span className="text-xl font-black tracking-wide" style={{ color: 'var(--text)' }}>
                  {round.word === 'left' ? 'ESQUERDA' : 'DIREITA'}
                </span>
                {round.arrowDecoy && (
                  <span className="text-xs font-bold opacity-60" style={{ color: 'var(--text-soft)' }}>
                    {round.arrowDecoy === 'left' ? '←←←' : '→→→'}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <button
          type="button"
          onClick={() => handleSide('left')}
          className="min-h-[64px] rounded-2xl font-extrabold text-base btn-soft flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
          style={{ border: '2px solid var(--border-strong)' }}
        >
          <ArrowLeft size={20} strokeWidth={3} />
          <span>ESQUERDA</span>
        </button>

        <button
          type="button"
          onClick={() => handleSide('right')}
          className="min-h-[64px] rounded-2xl font-extrabold text-base btn-soft flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-95"
          style={{ border: '2px solid var(--border-strong)' }}
        >
          <span>DIREITA</span>
          <ArrowRight size={20} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

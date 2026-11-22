import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/audio';
import type { MinigameProps } from './GameProps';

interface MatchCard {
  id: number;
  key: string;
  symbol: string;
  color: string;
}

interface FlashBoard {
  cols: number;
  cards: MatchCard[];
}

const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚', '⬟', '◈', '☾', '✦', '⬣', '▼'];
const COLORS = ['#2563EB', '#E11D48', '#059669', '#D97706', '#7C3AED', '#0891B2'];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getGridForStage(stage: number): { cols: number; total: number; distinctSymbolsOnly: boolean } {
  const lvl = Math.max(1, Math.floor(stage));
  if (lvl <= 1) return { cols: 2, total: 4, distinctSymbolsOnly: true };
  if (lvl <= 3) return { cols: 3, total: 6, distinctSymbolsOnly: true };
  if (lvl <= 6) return { cols: 3, total: 9, distinctSymbolsOnly: false };
  return { cols: 4, total: 12, distinctSymbolsOnly: false };
}

function buildFlashBoard(stage: number): FlashBoard {
  const { cols, total, distinctSymbolsOnly } = getGridForStage(stage);
  const uniqueNeeded = total - 1; // 1 chave para o par + (total - 2) chaves únicas

  const chosenItems: { symbol: string; color: string; key: string }[] = [];

  if (distinctSymbolsOnly) {
    // Nos níveis iniciais, cada carta distinta tem símbolo diferente para leitura instantânea
    const symPool = shuffle(SYMBOLS).slice(0, uniqueNeeded);
    const colPool = shuffle(COLORS);
    for (let i = 0; i < uniqueNeeded; i++) {
      const symbol = symPool[i];
      const color = colPool[i % colPool.length];
      chosenItems.push({ symbol, color, key: `${symbol}|${color}` });
    }
  } else {
    const combos: { symbol: string; color: string; key: string }[] = [];
    for (const symbol of SYMBOLS) {
      for (const color of COLORS) {
        combos.push({ symbol, color, key: `${symbol}|${color}` });
      }
    }
    const picked = shuffle(combos).slice(0, uniqueNeeded);
    chosenItems.push(...picked);
  }

  // O item 0 vira o único par idêntico do tabuleiro
  const pairItem = chosenItems[0];
  const rawList = [pairItem, pairItem, ...chosenItems.slice(1)];
  const cards: MatchCard[] = shuffle(rawList).map((item, idx) => ({
    id: idx,
    key: item.key,
    symbol: item.symbol,
    color: item.color,
  }));

  return { cols, cards };
}

export function FlashMatchGame({
  config,
  finishRequested,
  paused = false,
  onWaveHit,
  onWaveError,
  onLiveUpdate,
  onFinish,
}: MinigameProps) {
  const [board, setBoard] = useState<FlashBoard>(() => buildFlashBoard(config.stage));
  const [boardId, setBoardId] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [wrongPair, setWrongPair] = useState<[number, number] | null>(null);
  const [badgeFlash, setBadgeFlash] = useState<'ok' | 'err' | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const wrongTimerRef = useRef<number | null>(null);
  const badgeTimerRef = useRef<number | null>(null);
  const prevPausedRef = useRef(paused);

  const statsRef = useRef({
    correct: 0,
    commission: 0,
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
      omissionErrors: 0,
      reactionTimesMs: statsRef.current.rts,
      rawPoints: statsRef.current.rawPoints,
    });
  }, [onFinish]);

  useEffect(() => {
    if (finishRequested) finishNow();
  }, [finishRequested, finishNow]);

  useEffect(() => {
    if (prevPausedRef.current && !paused) {
      statsRef.current.shownAt = performance.now();
    }
    prevPausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    return () => {
      if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
      if (badgeTimerRef.current !== null) window.clearTimeout(badgeTimerRef.current);
    };
  }, []);

  const triggerBadge = (kind: 'ok' | 'err') => {
    setBadgeFlash(kind);
    if (badgeTimerRef.current !== null) window.clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = window.setTimeout(() => {
      setBadgeFlash(null);
      badgeTimerRef.current = null;
    }, 170);
  };

  const handleCardTap = (idx: number) => {
    if (paused || statsRef.current.finished) return;

    // Se houver erro piscando e o jogador já tocar outra carta, segue sem travar
    if (wrongPair !== null) {
      if (wrongTimerRef.current !== null) {
        window.clearTimeout(wrongTimerRef.current);
        wrongTimerRef.current = null;
      }
      setWrongPair(null);
      setSelectedIdx(idx);
      sound.tap();
      return;
    }

    if (selectedIdx === null) {
      setSelectedIdx(idx);
      sound.tap();
      return;
    }

    if (selectedIdx === idx) {
      setSelectedIdx(null);
      sound.tap();
      return;
    }

    const first = board.cards[selectedIdx];
    const second = board.cards[idx];
    const ok = first.key === second.key;

    if (ok) {
      const rt = performance.now() - statsRef.current.shownAt;
      statsRef.current.correct++;
      statsRef.current.combo++;
      statsRef.current.rts.push(rt);
      statsRef.current.rawPoints += 125 + Math.min(85, statsRef.current.combo * 14);
      sound.hit(statsRef.current.combo);
      triggerBadge('ok');

      const clearedAll = onWaveHit();
      const tot = statsRef.current.correct + statsRef.current.commission;
      onLiveUpdate({
        score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
        accuracyPct: Math.round((statsRef.current.correct / tot) * 100),
        combo: statsRef.current.combo,
      });

      if (clearedAll) {
        finishNow();
        return;
      }

      // Troca imediatamente para o próximo conjunto
      setSelectedIdx(null);
      setWrongPair(null);
      setBoard(buildFlashBoard(configRef.current.stage));
      setBoardId((id) => id + 1);
      statsRef.current.shownAt = performance.now();
    } else {
      statsRef.current.commission++;
      statsRef.current.combo = 0;
      statsRef.current.rawPoints = Math.max(0, statsRef.current.rawPoints - 45);
      sound.miss();
      triggerBadge('err');
      onWaveError?.();

      const tot = statsRef.current.correct + statsRef.current.commission;
      onLiveUpdate({
        score: Math.round(statsRef.current.rawPoints * configRef.current.scoreMultiplier),
        accuracyPct: Math.round((statsRef.current.correct / tot) * 100),
        combo: statsRef.current.combo,
      });

      setWrongPair([selectedIdx, idx]);
      setSelectedIdx(null);
      if (wrongTimerRef.current !== null) window.clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = window.setTimeout(() => {
        setWrongPair(null);
        wrongTimerRef.current = null;
      }, 210);
    }
  };

  const maxGridWidth = board.cols === 2 ? 'max-w-[260px]' : board.cols === 3 ? 'max-w-[310px]' : 'max-w-[340px]';
  const symSize =
    board.cards.length <= 4 ? 'text-5xl' : board.cards.length <= 6 ? 'text-4xl' : board.cards.length <= 9 ? 'text-4xl' : 'text-3xl';

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div
        className="text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full transition-colors"
        style={{
          background:
            badgeFlash === 'ok'
              ? 'rgba(16, 185, 129, 0.2)'
              : badgeFlash === 'err'
                ? 'rgba(239, 68, 68, 0.2)'
                : 'var(--bg-subtle)',
          color:
            badgeFlash === 'ok'
              ? 'var(--ok)'
              : badgeFlash === 'err'
                ? 'var(--err)'
                : 'var(--text-muted)',
          border:
            badgeFlash === 'ok'
              ? '1px solid var(--ok)'
              : badgeFlash === 'err'
                ? '1px solid var(--err)'
                : '1px solid var(--border)',
        }}
      >
        Toque nos 2 iguais
      </div>

      <div
        key={boardId}
        className={`grid gap-2.5 w-full ${maxGridWidth} animate-pop`}
        style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
      >
        {board.cards.map((card, idx) => {
          const isSelected = selectedIdx === idx;
          const isWrong = wrongPair !== null && (wrongPair[0] === idx || wrongPair[1] === idx);

          return (
            <button
              key={`${boardId}-${card.id}`}
              type="button"
              onClick={() => handleCardTap(idx)}
              className={`aspect-square rounded-2xl font-black flex items-center justify-center transition-all cursor-pointer active:scale-95 ${symSize} ${
                isWrong ? 'animate-shake' : ''
              }`}
              style={{
                background: isWrong
                  ? 'rgba(239, 68, 68, 0.2)'
                  : isSelected
                    ? 'var(--accent-glow)'
                    : 'var(--bg-card)',
                border: isWrong
                  ? '2px solid var(--err)'
                  : isSelected
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border-strong)',
                color: card.color,
                boxShadow: isSelected ? '0 0 0 2px var(--accent-glow)' : 'var(--card-shadow)',
              }}
            >
              {card.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}

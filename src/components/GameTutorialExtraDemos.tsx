import { useEffect, useState } from 'react';

function useLoopStep(totalSteps: number, stepMs: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % totalSteps);
    }, stepMs);
    return () => clearInterval(id);
  }, [totalSteps, stepMs]);
  return step;
}

function TapCursor({
  xPct,
  yPct,
  pressing = false,
  visible = true,
}: {
  xPct: number;
  yPct: number;
  pressing?: boolean;
  visible?: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 transition-all duration-450 ease-out"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        opacity: visible ? 1 : 0,
        transform: `translate(-50%, -50%) scale(${pressing ? 0.84 : 1})`,
      }}
    >
      {pressing && (
        <span
          className="absolute left-1/2 top-1/2 w-8 h-8 rounded-full animate-tap-ripple"
          style={{ border: '2.5px solid var(--ok)', background: 'rgba(52, 211, 153, 0.22)' }}
        />
      )}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: pressing ? 'var(--ok)' : 'var(--accent)',
          color: '#FFFFFF',
          border: '2px solid #ffffff',
          boxShadow: pressing
            ? '0 0 18px rgba(16, 185, 129, 0.55)'
            : '0 4px 14px rgba(15, 23, 42, 0.25)',
        }}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
          <path d="M9 11.24V7.5a1.5 1.5 0 0 1 3 0v3.25h.5a1.25 1.25 0 0 1 1.25 1.25v.25h.5A1.25 1.25 0 0 1 15.5 13.5v.25h.5a1.25 1.25 0 0 1 1.25 1.25v2.25A4.75 4.75 0 0 1 12.5 22h-1.2a4.5 4.5 0 0 1-3.52-1.7L5.1 16.95a1.3 1.3 0 0 1 1.98-1.68L9 16.9V11.24Z" />
        </svg>
      </div>
    </div>
  );
}

/* ============================================================================
   1. BUSCA CONJUNTA (FORMA + COR EXATAS)
   ============================================================================ */
export function ConjunctionSearchDemo() {
  const step = useLoopStep(6, 760);
  const cells = [
    { sym: '●', color: '#2563EB', target: false },
    { sym: '▲', color: '#2563EB', target: true },
    { sym: '▲', color: '#E11D48', target: false },
    { sym: '■', color: '#2563EB', target: false },
    { sym: '●', color: '#E11D48', target: false },
    { sym: '▲', color: '#059669', target: false },
    { sym: '■', color: '#059669', target: false },
    { sym: '●', color: '#2563EB', target: false },
    { sym: '▲', color: '#2563EB', target: true },
  ];
  const found1 = step >= 2;
  const found2 = step >= 4;
  const remaining = 2 - (found1 ? 1 : 0) - (found2 ? 1 : 0);

  const cursor =
    step === 1 || step === 2
      ? { x: 50, y: 40, press: step === 2, vis: true }
      : step === 3 || step === 4
        ? { x: 66, y: 80, press: step === 4, vis: true }
        : { x: 50, y: 58, press: false, vis: false };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
      >
        <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>
          Alvo exato
        </span>
        <span className="text-base font-black leading-none" style={{ color: '#2563EB' }}>
          ▲
        </span>
        <span className="text-[11px] font-extrabold tabular" style={{ color: remaining === 0 ? 'var(--ok)' : 'var(--warn)' }}>
          {remaining === 0 ? '✓' : `×${remaining}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[144px]">
        {cells.map((c, i) => {
          const isFound = (i === 1 && found1) || (i === 8 && found2);
          return (
            <div
              key={i}
              className="aspect-square rounded-lg flex items-center justify-center text-lg font-black transition-all"
              style={{
                background: isFound ? 'rgba(16, 185, 129, 0.22)' : 'var(--bg-card)',
                border: isFound ? '2px solid var(--ok)' : '1px solid var(--border)',
                color: isFound ? 'var(--ok)' : c.color,
              }}
            >
              {isFound ? '✓' : c.sym}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={cursor.x} yPct={cursor.y} pressing={cursor.press} visible={cursor.vis} />
    </div>
  );
}

/* ============================================================================
   2. DÍGITOS REVERSOS
   ============================================================================ */
export function ReverseDigitsDemo() {
  const step = useLoopStep(8, 720);
  const seq = [4, 7, 2];
  const expected = [2, 7, 4];
  const isShow = step <= 2;
  const typedCount = step >= 4 ? Math.min(3, step - 3) : 0;
  const activeDigit = step >= 4 && step <= 6 ? expected[step - 4] : null;

  const keyPos: Record<number, { x: number; y: number }> = {
    2: { x: 50, y: 65 },
    7: { x: 37, y: 86 },
    4: { x: 37, y: 76 },
  };
  const cursor = activeDigit ? { ...keyPos[activeDigit], press: true, vis: true } : { x: 50, y: 76, press: false, vis: false };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: isShow ? 'var(--accent)' : 'var(--ok)' }}
      >
        {isShow ? `1. Memorize (${step + 1}/3)` : '2. Digite ao contrário ↺'}
      </div>

      {isShow ? (
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black tabular"
          style={{ background: 'var(--bg-card)', border: '2px solid var(--accent)', color: 'var(--text)' }}
        >
          {seq[step]}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1.5">
            {expected.map((d, i) => (
              <div
                key={i}
                className="w-8 h-9 rounded-lg flex items-center justify-center text-base font-black tabular"
                style={{
                  background: i < typedCount ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)',
                  border: i < typedCount ? '1.5px solid var(--ok)' : '1px solid var(--border)',
                  color: i < typedCount ? 'var(--ok)' : 'var(--text-soft)',
                }}
              >
                {i < typedCount ? d : '·'}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1 w-[132px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
              const hit = activeDigit === d;
              return (
                <div
                  key={d}
                  className="h-7 rounded-lg flex items-center justify-center text-xs font-black tabular"
                  style={{
                    background: hit ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-card)',
                    border: hit ? '1.5px solid var(--ok)' : '1px solid var(--border)',
                    color: hit ? 'var(--ok)' : 'var(--text)',
                  }}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TapCursor xPct={cursor.x} yPct={cursor.y} pressing={cursor.press} visible={cursor.vis} />
    </div>
  );
}

/* ============================================================================
   3. BALANÇA LÓGICA (DEDUÇÃO DE SÍMBOLOS)
   ============================================================================ */
export function LogicBalanceDemo() {
  const step = useLoopStep(6, 820);
  const solved = step >= 3;
  const pressing = step === 3 || step === 4;
  const options = [2, 3, 4, 5];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="w-[196px] rounded-2xl px-3 py-2.5 text-center flex flex-col gap-1"
        style={{
          background: solved ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card)',
          border: solved ? '1.5px solid var(--ok)' : '1px solid var(--border)',
        }}
      >
        <div className="text-xs font-extrabold tabular">
          <span style={{ color: '#2563EB' }}>●</span> + <span style={{ color: '#2563EB' }}>●</span> = 10
        </div>
        <div className="text-xs font-extrabold tabular">
          <span style={{ color: '#2563EB' }}>●</span> + <span style={{ color: '#E11D48' }}>▲</span> = 8
        </div>
        <div
          className="pt-1 text-sm font-black tabular"
          style={{ borderTop: '1px dashed var(--border-strong)', color: solved ? 'var(--ok)' : 'var(--accent)' }}
        >
          <span style={{ color: '#E11D48' }}>▲</span> = {solved ? '3 ✓' : '?'}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 w-[196px]">
        {options.map((opt) => {
          const ok = pressing && opt === 3;
          return (
            <div
              key={opt}
              className="py-1.5 rounded-xl text-center text-sm font-black tabular"
              style={{
                background: ok ? 'rgba(16, 185, 129, 0.28)' : 'var(--bg-card)',
                border: ok ? '2px solid var(--ok)' : '1px solid var(--border)',
                color: ok ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {opt}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={42} yPct={82} pressing={pressing} visible={step >= 2 && step <= 4} />
    </div>
  );
}

/* ============================================================================
   4. PAR RÁPIDO (TOQUE NOS 2 SÍMBOLOS IGUAIS)
   ============================================================================ */
export function QuickPairDemo() {
  const step = useLoopStep(6, 760);
  const tiles = ['★', '●', '▲', '◆', '★', '■'];
  const firstSel = step >= 2;
  const secondSel = step >= 4;

  const cursor =
    step === 1 || step === 2
      ? { x: 34, y: 46, press: step === 2, vis: true }
      : step === 3 || step === 4
        ? { x: 50, y: 74, press: step === 4, vis: true }
        : { x: 50, y: 60, press: false, vis: false };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: secondSel ? 'var(--ok)' : 'var(--accent)' }}
      >
        {secondSel ? 'Par encontrado! ✓' : 'Toque nos 2 símbolos iguais'}
      </div>

      <div className="grid grid-cols-3 gap-2 w-[168px]">
        {tiles.map((sym, i) => {
          const isMatched = secondSel && (i === 0 || i === 4);
          const isFirst = !secondSel && firstSel && i === 0;
          return (
            <div
              key={i}
              className="aspect-square rounded-xl flex items-center justify-center text-xl font-black transition-all"
              style={{
                background: isMatched
                  ? 'rgba(16, 185, 129, 0.25)'
                  : isFirst
                    ? 'var(--accent-glow)'
                    : 'var(--bg-card)',
                border: isMatched
                  ? '2px solid var(--ok)'
                  : isFirst
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border)',
                color: isMatched ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {sym}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={cursor.x} yPct={cursor.y} pressing={cursor.press} visible={cursor.vis} />
    </div>
  );
}

/* ============================================================================
   5. ESTIMATIVA RÁPIDA (QUAL EXPRESSÃO VALE MAIS?)
   ============================================================================ */
export function QuickEstimateDemo() {
  const step = useLoopStep(6, 820);
  const second = step >= 3;
  const top = second ? { expr: '14 + 9', val: 23 } : { expr: '8 + 5', val: 13 };
  const bottom = second ? { expr: '12 + 7', val: 19 } : { expr: '9 + 7', val: 16 };
  const topWins = top.val > bottom.val;
  const pressing = step === 2 || step === 5;
  const showCursor = step === 1 || step === 2 || step === 4 || step === 5;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
      >
        Qual vale MAIS?
      </div>

      <div className="flex flex-col items-center gap-1.5 w-[186px]">
        <div
          className="w-full py-2.5 rounded-2xl text-center text-lg font-black tabular transition-all"
          style={{
            background: pressing && topWins ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
            border: pressing && topWins ? '2px solid var(--ok)' : '1.5px solid var(--border-strong)',
            color: pressing && topWins ? 'var(--ok)' : 'var(--text)',
          }}
        >
          {top.expr}
        </div>
        <span className="text-[10px] font-extrabold uppercase" style={{ color: 'var(--text-soft)' }}>
          ou
        </span>
        <div
          className="w-full py-2.5 rounded-2xl text-center text-lg font-black tabular transition-all"
          style={{
            background: pressing && !topWins ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
            border: pressing && !topWins ? '2px solid var(--ok)' : '1.5px solid var(--border-strong)',
            color: pressing && !topWins ? 'var(--ok)' : 'var(--text)',
          }}
        >
          {bottom.expr}
        </div>
      </div>

      <TapCursor
        xPct={50}
        yPct={topWins ? 42 : 78}
        pressing={pressing}
        visible={showCursor}
      />
    </div>
  );
}

/* ============================================================================
   6. SINAL INVERTIDO (VERDE = SIGA | VERMELHO = OPOSTO)
   ============================================================================ */
export function InvertedSignalDemo() {
  const step = useLoopStep(6, 860);
  const inverted = step >= 3;
  const pressing = step === 2 || step === 5;
  const showCursor = step === 1 || step === 2 || step === 4 || step === 5;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full"
        style={{
          background: inverted ? 'rgba(225, 29, 72, 0.14)' : 'rgba(16, 185, 129, 0.14)',
          color: inverted ? '#E11D48' : '#059669',
        }}
      >
        {inverted ? 'VERMELHO · toque o OPOSTO' : 'VERDE · siga a seta'}
      </div>

      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black transition-all"
        style={{
          background: inverted ? 'rgba(225, 29, 72, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          border: `2.5px solid ${inverted ? '#E11D48' : '#059669'}`,
          color: inverted ? '#E11D48' : '#059669',
        }}
      >
        →
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-[170px]">
        <div
          className="py-2 rounded-xl text-center text-lg font-black transition-all"
          style={{
            background: inverted && pressing ? 'rgba(16, 185, 129, 0.28)' : 'var(--bg-card)',
            border: inverted && pressing ? '2px solid var(--ok)' : '1px solid var(--border)',
            color: inverted && pressing ? 'var(--ok)' : 'var(--text)',
          }}
        >
          ←
        </div>
        <div
          className="py-2 rounded-xl text-center text-lg font-black transition-all"
          style={{
            background: !inverted && pressing ? 'rgba(16, 185, 129, 0.28)' : 'var(--bg-card)',
            border: !inverted && pressing ? '2px solid var(--ok)' : '1px solid var(--border)',
            color: !inverted && pressing ? 'var(--ok)' : 'var(--text)',
          }}
        >
          →
        </div>
      </div>

      <TapCursor
        xPct={inverted ? 34 : 66}
        yPct={82}
        pressing={pressing}
        visible={showCursor}
      />
    </div>
  );
}

/* ============================================================================
   7. PASSE A BOLA (MEMORIZE ARMADILHAS E LEVE ⚽ ATÉ 🏁)
   ============================================================================ */
export function PassTheBallDemo() {
  const step = useLoopStep(8, 700);
  const hazards = new Set([1, 6]);
  const path = [0, 3, 4, 5, 8];
  const isMemorize = step <= 1;
  const moveIdx = isMemorize ? 0 : Math.min(path.length - 1, step - 2);
  const ballCell = path[moveIdx];
  const reachedGoal = ballCell === 8;

  const cellCenter = (id: number) => ({
    x: 35 + (id % 3) * 15,
    y: 41 + Math.floor(id / 3) * 18,
  });
  const targetPos = cellCenter(ballCell);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{
          background: isMemorize ? 'rgba(239, 68, 68, 0.14)' : 'var(--bg-subtle)',
          color: isMemorize ? 'var(--err)' : reachedGoal ? 'var(--ok)' : 'var(--accent)',
        }}
      >
        {isMemorize ? '1. Memorize os perigos 🚧' : reachedGoal ? 'Chegou! 🏁' : '2. Leve ⚽ até 🏁'}
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[144px]">
        {Array.from({ length: 9 }, (_, id) => {
          const isBall = id === ballCell;
          const isGoal = id === 8;
          const showHazard = isMemorize && hazards.has(id);
          return (
            <div
              key={id}
              className="aspect-square rounded-xl flex items-center justify-center text-lg transition-all"
              style={{
                background: showHazard
                  ? 'rgba(239, 68, 68, 0.16)'
                  : isBall
                    ? 'var(--accent-glow)'
                    : isGoal
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'var(--bg-card)',
                border: showHazard
                  ? '1.5px solid var(--err)'
                  : isBall
                    ? '2px solid var(--accent)'
                    : isGoal
                      ? '1.5px solid var(--ok)'
                      : '1px solid var(--border)',
              }}
            >
              {isBall ? '⚽' : isGoal ? '🏁' : showHazard ? '🚧' : ''}
            </div>
          );
        })}
      </div>

      <TapCursor
        xPct={targetPos.x}
        yPct={targetPos.y}
        pressing={!isMemorize && moveIdx > 0}
        visible={!isMemorize && moveIdx > 0 && step <= 6}
      />
    </div>
  );
}

/* ============================================================================
   8. OURO ESCONDIDO (MEMORIZE E TOQUE NAS MOEDAS)
   ============================================================================ */
export function HiddenGoldDemo() {
  const step = useLoopStep(7, 720);
  const goldCells = [0, 4, 8];
  const isMemorize = step <= 1;
  const foundCount = isMemorize ? 0 : Math.min(3, Math.max(0, step - 2));
  const activeIdx = step >= 3 && step <= 5 ? step - 3 : -1;

  const cellCenter = (id: number) => ({
    x: 35 + (id % 3) * 15,
    y: 41 + Math.floor(id / 3) * 18,
  });
  const cursorPos = activeIdx >= 0 ? cellCenter(goldCells[activeIdx]) : { x: 50, y: 58 };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{
          background: isMemorize ? 'rgba(245, 158, 11, 0.16)' : 'var(--bg-subtle)',
          color: isMemorize ? 'var(--warn)' : 'var(--accent)',
        }}
      >
        {isMemorize ? '1. Memorize o ouro 🪙' : '2. Toque onde estava'}
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[144px]">
        {Array.from({ length: 9 }, (_, id) => {
          const goldIdx = goldCells.indexOf(id);
          const isGold = goldIdx !== -1;
          const isFound = isGold && goldIdx < foundCount;
          const show = isGold && (isMemorize || isFound);
          return (
            <div
              key={id}
              className="aspect-square rounded-xl flex items-center justify-center text-lg transition-all"
              style={{
                background: isFound
                  ? 'rgba(16, 185, 129, 0.22)'
                  : show
                    ? 'rgba(245, 158, 11, 0.18)'
                    : 'var(--bg-card)',
                border: isFound
                  ? '2px solid var(--ok)'
                  : show
                    ? '2px solid var(--warn)'
                    : '1px solid var(--border)',
              }}
            >
              {show ? (goldIdx === 0 ? '💎' : '🪙') : ''}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={cursorPos.x} yPct={cursorPos.y} pressing={activeIdx >= 0} visible={activeIdx >= 0} />
    </div>
  );
}

/* ============================================================================
   9. LISTA DE COMPRAS (MEMORIZE A LISTA E PEGUE NA PRATELEIRA)
   ============================================================================ */
export function ShoppingListDemo() {
  const step = useLoopStep(7, 760);
  const targets = ['🥑', '🧀', '🍓'];
  const shelf = ['🥑', '🍕', '🧀', '🍩', '🍓', '🥕'];
  const targetShelfIdx = [0, 2, 4];
  const isMemorize = step <= 1;
  const pickedCount = isMemorize ? 0 : Math.min(3, Math.max(0, step - 2));
  const activeStep = step >= 3 && step <= 5 ? step - 3 : -1;

  const shelfCenter = (i: number) => ({
    x: 34 + (i % 3) * 16,
    y: 48 + Math.floor(i / 3) * 26,
  });
  const pos = activeStep >= 0 ? shelfCenter(targetShelfIdx[activeStep]) : { x: 50, y: 55 };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: isMemorize ? 'var(--accent)' : 'var(--ok)' }}
      >
        {isMemorize ? '1. Memorize a lista 🛒' : '2. Pegue na prateleira'}
      </div>

      {isMemorize ? (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)' }}
        >
          {targets.map((e) => (
            <div
              key={e}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
            >
              {e}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 w-[168px]">
          {shelf.map((e, i) => {
            const tIdx = targetShelfIdx.indexOf(i);
            const isPicked = tIdx !== -1 && tIdx < pickedCount;
            return (
              <div
                key={i}
                className="aspect-square rounded-xl flex items-center justify-center text-2xl transition-all"
                style={{
                  background: isPicked ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
                  border: isPicked ? '2px solid var(--ok)' : '1px solid var(--border)',
                }}
              >
                {e}
              </div>
            );
          })}
        </div>
      )}

      <TapCursor xPct={pos.x} yPct={pos.y} pressing={activeStep >= 0} visible={activeStep >= 0} />
    </div>
  );
}

/* ============================================================================
   10. COMBINAR PARES (EMOJIS VIRAM E COMBINAM PARES)
   ============================================================================ */
export function MatchPairsDemo() {
  const step = useLoopStep(7, 760);
  const cards = ['🦊', '🚀', '🎸', '🚀', '🦊', '🎸'];
  const isPreview = step <= 1;
  const flipped1 = step >= 3;
  const matched = step >= 5;

  const cursor =
    step === 3
      ? { x: 34, y: 48, press: true, vis: true }
      : step === 4 || step === 5
        ? { x: 50, y: 74, press: step === 5, vis: true }
        : { x: 50, y: 60, press: false, vis: false };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: matched ? 'var(--ok)' : 'var(--accent)' }}
      >
        {isPreview ? '1. Memorize os pares' : matched ? 'Par combinado! ✓' : '2. Vire dois iguais'}
      </div>

      <div className="grid grid-cols-3 gap-2 w-[168px]">
        {cards.map((emoji, i) => {
          const isPairCell = i === 0 || i === 4;
          const isOpen = isPreview || (i === 0 && flipped1) || (i === 4 && matched);
          const isOk = matched && isPairCell;
          return (
            <div
              key={i}
              className="aspect-square rounded-xl flex items-center justify-center text-2xl transition-all"
              style={{
                background: isOk ? 'rgba(16, 185, 129, 0.24)' : isOpen ? 'var(--bg-card)' : 'var(--bg-subtle)',
                border: isOk ? '2px solid var(--ok)' : '1px solid var(--border)',
              }}
            >
              {isOpen ? emoji : '?'}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={cursor.x} yPct={cursor.y} pressing={cursor.press} visible={cursor.vis} />
    </div>
  );
}

/* ============================================================================
   11. NÚMERO DE TELEFONE (MEMORIZAR E DIGITAR NO TECLADO)
   ============================================================================ */
export function PhoneNumberDemo() {
  const step = useLoopStep(8, 700);
  const digits = ['4', '8', '2', '9'];
  const isMemorize = step <= 1;
  const typedCount = isMemorize ? 0 : Math.min(4, Math.max(0, step - 2));
  const activeDigit = step >= 3 && step <= 6 ? digits[step - 3] : null;
  const done = typedCount === 4;

  const keyPos: Record<string, { x: number; y: number }> = {
    '4': { x: 37, y: 76 },
    '8': { x: 50, y: 86 },
    '2': { x: 50, y: 66 },
    '9': { x: 63, y: 86 },
  };
  const pos = activeDigit ? { ...keyPos[activeDigit], press: true, vis: true } : { x: 50, y: 76, press: false, vis: false };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: done ? 'var(--ok)' : 'var(--accent)' }}
      >
        {isMemorize ? '1. Memorize o número 📞' : done ? 'Número correto! ✓' : '2. Digite no teclado'}
      </div>

      <div
        className="w-[156px] py-1.5 rounded-xl text-center text-lg font-black tracking-widest tabular"
        style={{
          background: done ? 'rgba(16, 185, 129, 0.18)' : 'var(--bg-card)',
          border: done ? '1.5px solid var(--ok)' : '1.5px solid var(--border-strong)',
          color: done ? 'var(--ok)' : 'var(--text)',
        }}
      >
        {isMemorize
          ? '4829'
          : typedCount > 0
            ? digits.slice(0, typedCount).join('') + '•'.repeat(4 - typedCount)
            : '••••'}
      </div>

      <div className="grid grid-cols-3 gap-1 w-[132px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => {
          const hit = activeDigit === d;
          return (
            <div
              key={d}
              className="h-7 rounded-lg flex items-center justify-center text-xs font-black tabular"
              style={{
                background: hit ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-card)',
                border: hit ? '1.5px solid var(--ok)' : '1px solid var(--border)',
                color: hit ? 'var(--ok)' : 'var(--text)',
                opacity: isMemorize ? 0.45 : 1,
              }}
            >
              {d}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={pos.x} yPct={pos.y} pressing={pos.press} visible={pos.vis} />
    </div>
  );
}

/* ============================================================================
   12. CÓDIGO SECRETO (MEMORIZE E TOQUE EM ORDEM CRESCENTE)
   ============================================================================ */
export function SecretCodeDemo() {
  const step = useLoopStep(7, 740);
  // 3 células com números espalhados: idx 2 -> 7, idx 6 -> 19, idx 4 -> 34
  const cellVals: Record<number, number> = { 2: 7, 6: 19, 4: 34 };
  const order = [2, 6, 4];
  const isMemorize = step <= 1;
  const foundCount = isMemorize ? 0 : Math.min(3, Math.max(0, step - 2));
  const activeStep = step >= 3 && step <= 5 ? step - 3 : -1;

  const cellCenter = (id: number) => ({
    x: 35 + (id % 3) * 15,
    y: 41 + Math.floor(id / 3) * 18,
  });
  const pos = activeStep >= 0 ? cellCenter(order[activeStep]) : { x: 50, y: 58 };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: isMemorize ? 'var(--accent)' : 'var(--ok)' }}
      >
        {isMemorize ? '1. Memorize as posições 🔐' : '2. Toque do menor ao maior'}
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[144px]">
        {Array.from({ length: 9 }, (_, id) => {
          const val = cellVals[id];
          if (val === undefined) {
            return (
              <div
                key={id}
                className="aspect-square rounded-xl"
                style={{ background: 'var(--bg-subtle)', opacity: 0.35 }}
              />
            );
          }
          const ordIdx = order.indexOf(id);
          const isFound = ordIdx < foundCount;
          const show = isMemorize || isFound;
          return (
            <div
              key={id}
              className="aspect-square rounded-xl flex items-center justify-center text-sm font-black tabular transition-all"
              style={{
                background: isFound ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
                border: isFound ? '2px solid var(--ok)' : '1.5px solid var(--border-strong)',
                color: isFound ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {show ? val : ''}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={pos.x} yPct={pos.y} pressing={activeStep >= 0} visible={activeStep >= 0} />
    </div>
  );
}

/* ============================================================================
   13. SINAIS ESTRANHOS (ANTENAS 📡 PISCAM E VOCÊ REPETE A ORDEM)
   ============================================================================ */
export function StrangeSignalsDemo() {
  const step = useLoopStep(8, 700);
  const seq = [0, 4, 7];
  const isTransmit = step <= 2;
  const litCell = isTransmit ? seq[step] : null;
  const inputIdx = step >= 4 && step <= 6 ? step - 4 : -1;
  const tappedSet = new Set(inputIdx >= 0 ? seq.slice(0, inputIdx + 1) : []);

  const cellCenter = (id: number) => ({
    x: 35 + (id % 3) * 15,
    y: 41 + Math.floor(id / 3) * 18,
  });
  const pos = inputIdx >= 0 ? cellCenter(seq[inputIdx]) : { x: 50, y: 58 };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{
          background: isTransmit ? 'rgba(14, 165, 233, 0.14)' : 'var(--bg-subtle)',
          color: isTransmit ? '#0EA5E9' : 'var(--ok)',
        }}
      >
        {isTransmit ? '1. Recebendo sinais 📡' : '2. Repita na mesma ordem'}
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[144px]">
        {Array.from({ length: 9 }, (_, id) => {
          const isLit = litCell === id;
          const isOk = tappedSet.has(id);
          return (
            <div
              key={id}
              className="aspect-square rounded-xl flex items-center justify-center text-base transition-all"
              style={{
                background: isLit
                  ? 'linear-gradient(135deg, #0EA5E9, #6366F1)'
                  : isOk
                    ? 'rgba(16, 185, 129, 0.28)'
                    : 'var(--bg-card)',
                border: isLit
                  ? '2px solid #ffffff'
                  : isOk
                    ? '2px solid var(--ok)'
                    : '1px solid var(--border)',
              }}
            >
              {isLit ? '📡' : isOk ? '✓' : ''}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={pos.x} yPct={pos.y} pressing={inputIdx >= 0} visible={inputIdx >= 0} />
    </div>
  );
}

/* ============================================================================
   14. NÚMEROS ANTIGOS (NÚMEROS ESPALHADOS EM ORDEM CRESCENTE)
   ============================================================================ */
export function AncientNumbersDemo() {
  const step = useLoopStep(6, 700);
  const items = [
    { val: 1, x: 24, y: 32, rot: -8, tint: '#0EA5E9' },
    { val: 2, x: 74, y: 72, rot: 7, tint: '#6366F1' },
    { val: 3, x: 70, y: 28, rot: -5, tint: '#D97706' },
    { val: 4, x: 28, y: 74, rot: 6, tint: '#059669' },
  ];
  const doneCount = Math.min(4, step);
  const activeIdx = step >= 1 && step <= 4 ? step - 1 : -1;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full tabular"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
      >
        {doneCount >= 4 ? 'Sequência completa! ✓' : `Próximo: ${doneCount + 1} / 4`}
      </div>

      <div
        className="relative w-[204px] h-[140px] rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {items.map((it, idx) => {
          const isDone = idx < doneCount;
          return (
            <div
              key={it.val}
              className="absolute w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black tabular transition-all"
              style={{
                left: `${it.x}%`,
                top: `${it.y}%`,
                transform: `translate(-50%, -50%) scale(${isDone ? 0.78 : 1}) rotate(${it.rot}deg)`,
                opacity: isDone ? 0.25 : 1,
                background: 'var(--bg-subtle)',
                border: `2px solid ${it.tint}`,
                color: it.tint,
              }}
            >
              {it.val}
            </div>
          );
        })}

        <TapCursor
          xPct={activeIdx >= 0 ? items[activeIdx].x : 24}
          yPct={activeIdx >= 0 ? items[activeIdx].y : 32}
          pressing={activeIdx >= 0}
          visible={activeIdx >= 0}
        />
      </div>
    </div>
  );
}

/* ============================================================================
   15. CENA DO CRIME (ACHE O ÚNICO ITEM SEM PAR)
   ============================================================================ */
export function CrimeSceneDemo() {
  const step = useLoopStep(5, 820);
  const items = ['🗝️', '⌚', '📷', '⌚', '🔍', '🗝️', '🧭', '📷', '🧭'];
  const solved = step >= 3;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: solved ? 'var(--ok)' : 'var(--accent)' }}
      >
        {solved ? 'Único sem par! ✓' : 'Ache o único item SEM par 🔍'}
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[144px]">
        {items.map((emoji, i) => {
          const isLonely = i === 4;
          const ok = solved && isLonely;
          return (
            <div
              key={i}
              className="aspect-square rounded-xl flex items-center justify-center text-xl transition-all"
              style={{
                background: ok ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
                border: ok ? '2px solid var(--ok)' : '1px solid var(--border)',
              }}
            >
              {emoji}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={50} yPct={59} pressing={step === 3} visible={step === 2 || step === 3} />
    </div>
  );
}

/* ============================================================================
   16. CAÇA AO TESOURO (QUAL COR APARECE MAIS VEZES?)
   ============================================================================ */
export function TreasureHuntDemo() {
  const step = useLoopStep(5, 840);
  const tokens = ['🔵', '🔴', '🔵', '🟢', '🔵', '🔴', '🔵', '🟢', '🔵'];
  const options = [
    { id: 'red', label: 'Vermelho', emoji: '🔴', hex: '#EF4444' },
    { id: 'blue', label: 'Azul', emoji: '🔵', hex: '#3B82F6' },
    { id: 'green', label: 'Verde', emoji: '🟢', hex: '#10B981' },
  ];
  const pressing = step === 3;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
      >
        Qual cor aparece MAIS? 💎
      </div>

      <div
        className="w-[186px] rounded-2xl p-2.5 flex flex-wrap items-center justify-center gap-2"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {tokens.map((t, i) => (
          <span key={i} className="text-lg leading-none">
            {t}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[216px]">
        {options.map((opt) => {
          const ok = pressing && opt.id === 'blue';
          return (
            <div
              key={opt.id}
              className="py-1.5 px-1 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all"
              style={{
                background: ok ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-card)',
                border: ok ? '2px solid var(--ok)' : `1px solid ${opt.hex}66`,
              }}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </div>
          );
        })}
      </div>

      <TapCursor xPct={50} yPct={82} pressing={pressing} visible={step === 2 || step === 3} />
    </div>
  );
}

/* ============================================================================
   17. ITENS IDÊNTICOS (TOQUE EM UM DOS 2 ITENS REPETIDOS)
   ============================================================================ */
export function IdenticalItemsDemo() {
  const step = useLoopStep(5, 820);
  const items = ['🍎', '🚀', '🎸', '🦊', '🚀', '🌵'];
  const solved = step >= 3;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: solved ? 'var(--ok)' : 'var(--accent)' }}
      >
        {solved ? 'Item repetido! ✓' : 'Toque em UM dos 2 repetidos ✨'}
      </div>

      <div className="grid grid-cols-3 gap-2 w-[168px]">
        {items.map((emoji, i) => {
          const isTarget = i === 1 || i === 4;
          const ok = solved && i === 1;
          return (
            <div
              key={i}
              className="aspect-square rounded-xl flex items-center justify-center text-2xl transition-all"
              style={{
                background: ok ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
                border: ok
                  ? '2px solid var(--ok)'
                  : solved && isTarget
                    ? '1.5px dashed var(--ok)'
                    : '1px solid var(--border)',
              }}
            >
              {emoji}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={50} yPct={48} pressing={step === 3} visible={step === 2 || step === 3} />
    </div>
  );
}

/* ============================================================================
   18. NÚMERO FALTANTE (QUAL FALTA DE 1 A 6?)
   ============================================================================ */
export function MissingNumberDemo() {
  const step = useLoopStep(5, 820);
  const shown = [1, 2, 3, 5, 6];
  const options = [3, 4, 5];
  const pressing = step === 3;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
      >
        Qual falta de 1 a 6?
      </div>

      <div
        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {shown.map((n) => (
          <div
            key={n}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black tabular"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          >
            {n}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 w-[168px]">
        {options.map((opt) => {
          const ok = pressing && opt === 4;
          return (
            <div
              key={opt}
              className="py-2 rounded-xl text-center text-base font-black tabular transition-all"
              style={{
                background: ok ? 'rgba(16, 185, 129, 0.28)' : 'var(--bg-card)',
                border: ok ? '2px solid var(--ok)' : '1px solid var(--border)',
                color: ok ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {opt}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={50} yPct={80} pressing={pressing} visible={step === 2 || step === 3} />
    </div>
  );
}

/* ============================================================================
   19. CONTAGEM DE FÃS (CONTE AS CAMISAS DA COR PEDIDA)
   ============================================================================ */
export function FanCountDemo() {
  const step = useLoopStep(5, 840);
  const fans = [
    { hex: '#2563EB', bg: 'rgba(37, 99, 235, 0.2)' },
    { hex: '#DC2626', bg: 'rgba(220, 38, 38, 0.2)' },
    { hex: '#2563EB', bg: 'rgba(37, 99, 235, 0.2)' },
    { hex: '#059669', bg: 'rgba(5, 150, 105, 0.2)' },
    { hex: '#2563EB', bg: 'rgba(37, 99, 235, 0.2)' },
    { hex: '#DC2626', bg: 'rgba(220, 38, 38, 0.2)' },
    { hex: '#059669', bg: 'rgba(5, 150, 105, 0.2)' },
    { hex: '#2563EB', bg: 'rgba(37, 99, 235, 0.2)' },
    { hex: '#DC2626', bg: 'rgba(220, 38, 38, 0.2)' },
  ];
  const options = [3, 4, 5];
  const pressing = step === 3;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'rgba(37, 99, 235, 0.16)', color: '#2563EB' }}
      >
        Conte as camisas AZUIS
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[124px]">
        {fans.map((f, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg flex items-center justify-center text-sm"
            style={{ background: f.bg, border: `1.5px solid ${f.hex}` }}
          >
            👕
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 w-[156px]">
        {options.map((opt) => {
          const ok = pressing && opt === 4;
          return (
            <div
              key={opt}
              className="py-1.5 rounded-xl text-center text-sm font-black tabular transition-all"
              style={{
                background: ok ? 'rgba(16, 185, 129, 0.28)' : 'var(--bg-card)',
                border: ok ? '2px solid var(--ok)' : '1px solid var(--border)',
                color: ok ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {opt}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={50} yPct={85} pressing={pressing} visible={step === 2 || step === 3} />
    </div>
  );
}

/* ============================================================================
   20. ANAGRAMAS SECRETOS (MESMAS LETRAS EMBARALHADAS)
   ============================================================================ */
export function SecretAnagramsDemo() {
  const step = useLoopStep(5, 840);
  const options = ['MINT', 'DNIM', 'DINE', 'NIMP'];
  const pressing = step === 3;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="w-[186px] py-2.5 rounded-2xl text-center"
        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)' }}
      >
        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>
          Palavra-alvo
        </div>
        <div className="text-xl font-black tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
          MIND
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 w-[186px]">
        {options.map((opt) => {
          const ok = pressing && opt === 'DNIM';
          return (
            <div
              key={opt}
              className="py-2 rounded-xl text-center text-xs font-extrabold tracking-widest transition-all"
              style={{
                background: ok ? 'rgba(16, 185, 129, 0.28)' : 'var(--bg-card)',
                border: ok ? '2px solid var(--ok)' : '1px solid var(--border)',
                color: ok ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {opt}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={64} yPct={63} pressing={pressing} visible={step === 2 || step === 3} />
    </div>
  );
}

/* ============================================================================
   21. PEIXE FORA D'ÁGUA (INTRUSO DA CATEGORIA)
   ============================================================================ */
export function FishOutOfWaterDemo() {
  const step = useLoopStep(5, 820);
  const items = ['🍎', '🍌', '🚗', '🍇'];
  const pressing = step === 3;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: pressing ? 'var(--ok)' : 'var(--accent)' }}
      >
        {pressing ? 'Não é fruta! ✓' : 'Toque no INTRUSO 🐠'}
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-[144px]">
        {items.map((emoji, i) => {
          const ok = pressing && i === 2;
          return (
            <div
              key={i}
              className="aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all"
              style={{
                background: ok ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
                border: ok ? '2px solid var(--ok)' : '1px solid var(--border)',
              }}
            >
              {emoji}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={40} yPct={74} pressing={pressing} visible={step === 2 || step === 3} />
    </div>
  );
}

/* ============================================================================
   22. SEPARAR LIXO (CLASSIFIQUE NA LIXEIRA CERTA)
   ============================================================================ */
export function SortTrashDemo() {
  const step = useLoopStep(6, 840);
  const second = step >= 3;
  const item = second ? { emoji: '🍌', name: 'Casca de banana' } : { emoji: '📰', name: 'Jornal' };
  const pressing = step === 2 || step === 5;
  const showCursor = step === 1 || step === 2 || step === 4 || step === 5;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="w-[126px] py-2.5 rounded-2xl flex flex-col items-center gap-1"
        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)' }}
      >
        <span className="text-3xl leading-none">{item.emoji}</span>
        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
          {item.name}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 w-[196px]">
        <div
          className="py-2 rounded-xl text-center text-xs font-extrabold transition-all"
          style={{
            background: !second && pressing ? 'rgba(16, 185, 129, 0.25)' : 'rgba(37, 99, 235, 0.14)',
            border: !second && pressing ? '2px solid var(--ok)' : '1.5px solid #2563EB',
            color: !second && pressing ? 'var(--ok)' : '#2563EB',
          }}
        >
          🗑️ Papel
        </div>
        <div
          className="py-2 rounded-xl text-center text-xs font-extrabold transition-all"
          style={{
            background: second && pressing ? 'rgba(16, 185, 129, 0.25)' : 'rgba(146, 64, 14, 0.16)',
            border: second && pressing ? '2px solid var(--ok)' : '1.5px solid #92400E',
            color: second && pressing ? 'var(--ok)' : '#92400E',
          }}
        >
          🗑️ Orgânico
        </div>
      </div>

      <TapCursor
        xPct={second ? 66 : 34}
        yPct={80}
        pressing={pressing}
        visible={showCursor}
      />
    </div>
  );
}

/* ============================================================================
   23. PADRÕES COMPLEXOS (ROTAÇÃO MENTAL: SIM / NÃO)
   ============================================================================ */
export function ComplexPatternsDemo() {
  const step = useLoopStep(6, 840);
  const leftShape = new Set([0, 3, 6, 7]); // L
  const rightShape = new Set([0, 1, 2, 3]); // L girado 90° horário
  const pressing = step === 3 || step === 4;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: pressing ? 'var(--ok)' : 'var(--accent)' }}
      >
        {pressing ? 'É o mesmo girado 90°! ✓' : 'É o mesmo padrão girado?'}
      </div>

      <div className="flex items-center gap-3">
        {[leftShape, rightShape].map((shape, sIdx) => (
          <div
            key={sIdx}
            className="grid grid-cols-3 gap-1 w-[68px] p-1.5 rounded-xl transition-all"
            style={{
              background: pressing ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-card)',
              border: pressing ? '1.5px solid var(--ok)' : '1px solid var(--border)',
            }}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="aspect-square rounded-sm"
                style={{
                  background: shape.has(i) ? (pressing ? 'var(--ok)' : 'var(--accent)') : 'var(--bg-subtle)',
                  opacity: shape.has(i) ? 1 : 0.45,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 w-[180px]">
        <div
          className="py-1.5 rounded-xl text-center text-xs font-extrabold"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          ✕ NÃO
        </div>
        <div
          className="py-1.5 rounded-xl text-center text-xs font-extrabold transition-all"
          style={{
            background: pressing ? 'rgba(16, 185, 129, 0.28)' : 'var(--bg-card)',
            border: pressing ? '2px solid var(--ok)' : '1px solid var(--border)',
            color: pressing ? 'var(--ok)' : 'var(--text)',
          }}
        >
          ✓ SIM
        </div>
      </div>

      <TapCursor xPct={65} yPct={82} pressing={pressing} visible={step >= 2 && step <= 4} />
    </div>
  );
}

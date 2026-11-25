import { useEffect, useState } from 'react';

function useStep(total: number, ms: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const id = window.setInterval(() => setStep((s) => (s + 1) % total), ms);
    return () => clearInterval(id);
  }, [total, ms]);
  return step;
}

/* 1. ALVO RELÂMPAGO */
export function WhackTargetDemo() {
  const step = useStep(6, 650);
  const activeIdx = step < 2 ? 4 : step < 4 ? 1 : 7;
  const hit = step === 1 || step === 3 || step === 5;
  return (
    <div className="flex flex-col items-center gap-2.5 w-full">
      <div className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
        Toque no alvo assim que acender ⚡
      </div>
      <div className="grid grid-cols-3 gap-2 w-[156px]">
        {Array.from({ length: 9 }, (_, i) => {
          const isTarget = i === activeIdx;
          return (
            <div
              key={i}
              className="aspect-square rounded-xl flex items-center justify-center text-xl transition-all"
              style={{
                background:
                  isTarget && hit
                    ? 'rgba(16, 185, 129, 0.25)'
                    : isTarget
                      ? 'rgba(245, 158, 11, 0.24)'
                      : 'var(--bg-card)',
                border:
                  isTarget && hit
                    ? '2px solid var(--ok)'
                    : isTarget
                      ? '2px solid #F59E0B'
                      : '1px solid var(--border)',
              }}
            >
              {isTarget ? (hit ? '✓' : '⚡') : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 2. PAR OU ÍMPAR */
export function ParityDashDemo() {
  const step = useStep(4, 850);
  const isSecond = step >= 2;
  const num = isSecond ? '17' : '24';
  const chooseEven = !isSecond;
  const pressed = step % 2 === 1;
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[230px]">
      <div
        className="w-full py-4 rounded-2xl text-center text-3xl font-black tabular"
        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)' }}
      >
        {num}
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        <div
          className="py-2.5 rounded-xl text-center text-xs font-extrabold transition-all"
          style={{
            background: pressed && chooseEven ? 'rgba(16, 185, 129, 0.25)' : 'rgba(14, 165, 233, 0.14)',
            border: pressed && chooseEven ? '2px solid var(--ok)' : '1.5px solid #0EA5E9',
            color: pressed && chooseEven ? 'var(--ok)' : '#0EA5E9',
          }}
        >
          PAR
        </div>
        <div
          className="py-2.5 rounded-xl text-center text-xs font-extrabold transition-all"
          style={{
            background: pressed && !chooseEven ? 'rgba(16, 185, 129, 0.25)' : 'rgba(217, 119, 6, 0.14)',
            border: pressed && !chooseEven ? '2px solid var(--ok)' : '1.5px solid #D97706',
            color: pressed && !chooseEven ? 'var(--ok)' : '#D97706',
          }}
        >
          ÍMPAR
        </div>
      </div>
    </div>
  );
}

/* 3. CAÇA-PALAVRA RELÂMPAGO */
export function WordRadarDemo() {
  const step = useStep(4, 800);
  const words = ['SAL', 'SUL', 'SOL', 'SOM'];
  const hit = step >= 2;
  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-[220px]">
      <div
        className="px-4 py-1.5 rounded-xl text-base font-black"
        style={{ background: 'var(--accent-glow)', border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
      >
        Alvo: SOL
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        {words.map((w) => {
          const isAns = w === 'SOL';
          return (
            <div
              key={w}
              className="py-2.5 rounded-xl text-center text-sm font-extrabold"
              style={{
                background: isAns && hit ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
                border: isAns && hit ? '2px solid var(--ok)' : '1px solid var(--border)',
              }}
            >
              {w}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 4. SEPARAR POR COR */
export function ColorSortDemo() {
  const step = useStep(4, 800);
  const isBlue = step < 2;
  const pressed = step % 2 === 1;
  const activeColor = isBlue ? '#2563EB' : '#059669';
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[220px]">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
        style={{ background: `${activeColor}18`, border: `2px solid ${activeColor}`, color: activeColor }}
      >
        ●
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        <div
          className="py-2 rounded-xl text-center text-xs font-extrabold"
          style={{
            background: pressed && isBlue ? 'rgba(16, 185, 129, 0.24)' : '#2563EB20',
            border: pressed && isBlue ? '2px solid var(--ok)' : '1.5px solid #2563EB',
            color: '#2563EB',
          }}
        >
          Azul
        </div>
        <div
          className="py-2 rounded-xl text-center text-xs font-extrabold"
          style={{
            background: pressed && !isBlue ? 'rgba(16, 185, 129, 0.24)' : '#05966920',
            border: pressed && !isBlue ? '2px solid var(--ok)' : '1.5px solid #059669',
            color: '#059669',
          }}
        >
          Verde
        </div>
      </div>
    </div>
  );
}

/* 5. CONTA CERTA OU ERRADA */
export function MathVerdictDemo() {
  const step = useStep(4, 900);
  const isSecond = step >= 2;
  const eq = isSecond ? '6 + 5 = 12' : '8 + 4 = 12';
  const pressed = step % 2 === 1;
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[230px]">
      <div
        className="w-full py-3.5 rounded-2xl text-center text-xl font-black tabular"
        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)' }}
      >
        {eq}
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        <div
          className="py-2 rounded-xl text-center text-xs font-extrabold"
          style={{
            background: pressed && isSecond ? 'rgba(16, 185, 129, 0.24)' : 'rgba(239, 68, 68, 0.14)',
            border: pressed && isSecond ? '2px solid var(--ok)' : '1.5px solid var(--err)',
            color: pressed && isSecond ? 'var(--ok)' : 'var(--err)',
          }}
        >
          ✕ ERRADA
        </div>
        <div
          className="py-2 rounded-xl text-center text-xs font-extrabold"
          style={{
            background: pressed && !isSecond ? 'rgba(16, 185, 129, 0.24)' : 'rgba(16, 185, 129, 0.12)',
            border: pressed && !isSecond ? '2px solid var(--ok)' : '1.5px solid var(--ok)',
            color: 'var(--ok)',
          }}
        >
          ✓ CERTA
        </div>
      </div>
    </div>
  );
}

/* 6. TROCO EXATO */
export function ExactChangeDemo() {
  const step = useStep(4, 850);
  const hit = step >= 2;
  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-[230px]">
      <div
        className="w-full rounded-xl px-3 py-2.5 flex items-center justify-between text-xs font-extrabold tabular"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)' }}
      >
        <span>☕ R$ 7</span>
        <span style={{ color: 'var(--ok)' }}>💵 Pagou R$ 20</span>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        {[11, 13].map((v) => (
          <div
            key={v}
            className="py-2 rounded-xl text-center text-sm font-black tabular"
            style={{
              background: v === 13 && hit ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
              border: v === 13 && hit ? '2px solid var(--ok)' : '1px solid var(--border)',
            }}
          >
            R$ {v}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 7. DOBRO OU METADE */
export function DoubleHalfDemo() {
  const step = useStep(4, 850);
  const hit = step >= 2;
  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-[220px]">
      <span
        className="px-3 py-1 rounded-full text-[11px] font-extrabold"
        style={{ background: 'rgba(5, 150, 105, 0.15)', color: '#059669' }}
      >
        DOBRO (×2)
      </span>
      <div
        className="w-full py-2.5 rounded-xl text-center text-2xl font-black tabular"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)' }}
      >
        14
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        {[7, 28].map((v) => (
          <div
            key={v}
            className="py-2 rounded-xl text-center text-sm font-black tabular"
            style={{
              background: v === 28 && hit ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
              border: v === 28 && hit ? '2px solid var(--ok)' : '1px solid var(--border)',
            }}
          >
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 8. TOQUE PROIBIDO */
export function BombDefuseDemo() {
  const step = useStep(4, 850);
  const isBomb = step >= 2;
  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-[220px]">
      <div className="grid grid-cols-3 gap-2 w-full">
        {[0, 1, 2].map((lane) => {
          const active = (isBomb && lane === 2) || (!isBomb && lane === 1);
          return (
            <div
              key={lane}
              className="h-[76px] rounded-xl flex flex-col items-center justify-center text-2xl"
              style={{
                background: active
                  ? isBomb
                    ? 'rgba(239, 68, 68, 0.18)'
                    : 'rgba(16, 185, 129, 0.2)'
                  : 'var(--bg-card)',
                border: active
                  ? isBomb
                    ? '2px solid var(--err)'
                    : '2px solid var(--ok)'
                  : '1px solid var(--border)',
              }}
            >
              <span>{active ? (isBomb ? '💣' : '⭐') : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] font-extrabold" style={{ color: isBomb ? 'var(--err)' : 'var(--ok)' }}>
        {isBomb ? '💣 Bomba: NÃO toque!' : '⭐ Prêmio: toque rápido!'}
      </div>
    </div>
  );
}

/* 9. MESTRE MANDOU */
export function SimonSaysDemo() {
  const step = useStep(4, 950);
  const master = step < 2;
  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-[230px]">
      <div
        className="w-full py-3 px-3 rounded-xl text-center"
        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)' }}
      >
        <div
          className="text-[10px] font-black"
          style={{ color: master ? '#D97706' : 'var(--text-soft)' }}
        >
          {master ? '👑 O MESTRE MANDOU' : 'Atenção...'}
        </div>
        <div className="text-sm font-black mt-0.5">Toque no AZUL</div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full text-[11px] font-extrabold">
        <div
          className="py-2 rounded-xl text-center"
          style={{
            background: master ? 'rgba(16, 185, 129, 0.24)' : 'rgba(37, 99, 235, 0.12)',
            border: master ? '2px solid var(--ok)' : '1px solid #2563EB',
            color: master ? 'var(--ok)' : '#2563EB',
          }}
        >
          ● AZUL
        </div>
        <div
          className="py-2 rounded-xl text-center"
          style={{
            background: !master ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-subtle)',
            border: !master ? '2px solid var(--ok)' : '1px solid var(--border)',
            color: !master ? 'var(--ok)' : 'var(--text-muted)',
          }}
        >
          ✋ IGNORAR
        </div>
      </div>
    </div>
  );
}

/* 10. PALAVRA OU POSIÇÃO (EFEITO SIMON) */
export function MirrorWordsDemo() {
  const step = useStep(4, 900);
  const hit = step >= 2;
  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-[230px]">
      <div
        className="w-full grid grid-cols-2 gap-2 p-2 rounded-xl"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
      >
        <div />
        <div
          className="py-2.5 px-1 rounded-lg text-center text-xs font-black"
          style={{ background: 'var(--bg-card)', border: '1.5px solid var(--accent)' }}
        >
          ESQUERDA
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full text-[11px] font-extrabold">
        <div
          className="py-2 rounded-xl text-center"
          style={{
            background: hit ? 'rgba(16, 185, 129, 0.24)' : 'var(--bg-card)',
            border: hit ? '2px solid var(--ok)' : '1px solid var(--border)',
            color: hit ? 'var(--ok)' : 'var(--text)',
          }}
        >
          ← ESQUERDA
        </div>
        <div
          className="py-2 rounded-xl text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-soft)' }}
        >
          DIREITA →
        </div>
      </div>
    </div>
  );
}

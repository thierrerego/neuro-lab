import { useEffect, useState } from 'react';
import { Check, Hand, Play } from 'lucide-react';
import type { GameSlug, StageConfig } from '../types/cognitive';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';

interface GameTutorialProps {
  slug: GameSlug;
  config: StageConfig;
  onConfirm: () => void;
}

/**
 * Hook simples de passos em loop para animar cada demonstração visual.
 */
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

/**
 * Indicador animado de toque (ponteiro/dedo + onda de clique).
 */
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
          color: '#0b0a14',
          border: '2px solid #ffffff',
          boxShadow: pressing
            ? '0 0 18px rgba(52, 211, 153, 0.7)'
            : '0 4px 14px rgba(0, 0, 0, 0.45)',
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
   1. VARREDURA VISUAL
   ============================================================================ */
function VisualSearchDemo() {
  const step = useLoopStep(6, 760);
  const cells = ['d', 'b', 'p', 'q', 'p', 'd', 'd', 'q', 'b'];
  const foundFirst = step >= 2;
  const foundSecond = step >= 4;
  const remaining = 2 - (foundFirst ? 1 : 0) - (foundSecond ? 1 : 0);

  const cursor =
    step === 0
      ? { x: 50, y: 58, press: false, vis: false }
      : step === 1
        ? { x: 50, y: 40, press: false, vis: true }
        : step === 2
          ? { x: 50, y: 40, press: true, vis: true }
          : step === 3
            ? { x: 74, y: 80, press: false, vis: true }
            : step === 4
              ? { x: 74, y: 80, press: true, vis: true }
              : { x: 74, y: 80, press: false, vis: false };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
      >
        <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>
          Alvo
        </span>
        <span className="text-base font-black leading-none" style={{ color: 'var(--accent)' }}>
          b
        </span>
        <span className="text-[11px] font-extrabold tabular" style={{ color: remaining === 0 ? 'var(--ok)' : 'var(--warn)' }}>
          {remaining === 0 ? '✓' : `×${remaining}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[150px]">
        {cells.map((char, i) => {
          const isFound = (i === 1 && foundFirst) || (i === 8 && foundSecond);
          return (
            <div
              key={i}
              className="aspect-square rounded-lg flex items-center justify-center text-base font-black transition-all duration-200"
              style={{
                background: isFound ? 'rgba(52, 211, 153, 0.25)' : 'var(--bg-card)',
                border: isFound ? '2px solid var(--ok)' : '1px solid var(--border)',
                color: isFound ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {char}
            </div>
          );
        })}
      </div>

      <TapCursor xPct={cursor.x} yPct={cursor.y} pressing={cursor.press} visible={cursor.vis} />
    </div>
  );
}

/* ============================================================================
   2. RASTREAMENTO SUSTENTADO (MOT)
   ============================================================================ */
const MOT_FRAMES: Array<Array<{ x: number; y: number }>> = [
  // Posição inicial (memorizar)
  [
    { x: 24, y: 34 },
    { x: 74, y: 68 },
    { x: 72, y: 30 },
    { x: 28, y: 74 },
    { x: 50, y: 50 },
  ],
  // Movimento 1
  [
    { x: 54, y: 26 },
    { x: 42, y: 72 },
    { x: 76, y: 56 },
    { x: 22, y: 48 },
    { x: 34, y: 36 },
  ],
  // Posição final (escolher)
  [
    { x: 74, y: 36 },
    { x: 28, y: 66 },
    { x: 54, y: 72 },
    { x: 26, y: 32 },
    { x: 64, y: 56 },
  ],
];

function SustainedTrackingDemo() {
  const step = useLoopStep(7, 880);
  const phase =
    step <= 1 ? 'memorize' : step <= 3 ? 'move' : 'pick';
  const frameIdx = step <= 1 ? 0 : step === 2 ? 1 : 2;
  const coords = MOT_FRAMES[frameIdx];

  const picked0 = step >= 4;
  const picked1 = step >= 5;

  const badgeText =
    phase === 'memorize'
      ? '1. Memorize os amarelos'
      : phase === 'move'
        ? '2. Acompanhe o movimento'
        : '3. Toque nos alvos';

  const cursor =
    step === 4
      ? { x: coords[0].x, y: coords[0].y + 8, press: true, vis: true }
      : step === 5
        ? { x: coords[1].x, y: coords[1].y + 8, press: true, vis: true }
        : { x: coords[0].x, y: coords[0].y + 8, press: false, vis: false };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full"
        style={{
          background: 'var(--bg-subtle)',
          color: phase === 'pick' ? 'var(--ok)' : phase === 'memorize' ? 'var(--warn)' : 'var(--accent)',
        }}
      >
        {badgeText}
      </div>

      <div
        className="relative w-[220px] h-[145px] rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {coords.map((pos, i) => {
          const isTarget = i < 2;
          const isPicked = (i === 0 && picked0) || (i === 1 && picked1);
          const showGold = phase === 'memorize' && isTarget;
          return (
            <div
              key={i}
              className="absolute w-7 h-7 rounded-full flex items-center justify-center transition-all duration-750 ease-in-out"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                background: isPicked ? '#34d399' : showGold ? '#f59e0b' : '#334155',
                border: showGold || isPicked ? '2.5px solid #fde68a' : '1.5px solid rgba(255,255,255,0.22)',
                boxShadow: showGold ? '0 0 14px rgba(245, 158, 11, 0.55)' : 'none',
              }}
            >
              {(showGold || isPicked) && (
                <span className="w-2 h-2 rounded-full bg-white opacity-90" />
              )}
            </div>
          );
        })}
        <TapCursor xPct={cursor.x} yPct={cursor.y} pressing={cursor.press} visible={cursor.vis} />
      </div>
    </div>
  );
}

/* ============================================================================
   3. MATRIZ ESPACIAL
   ============================================================================ */
function SpatialSpanDemo({ reverseOrder }: { reverseOrder: boolean }) {
  const step = useLoopStep(8, 700);
  const seq = [1, 5, 6];
  const expected = reverseOrder ? [...seq].reverse() : seq;
  const isShow = step <= 2;
  const litCell = isShow ? seq[step] : null;
  const inputIdx = step >= 4 && step <= 6 ? step - 4 : -1;
  const tappedSet = new Set(inputIdx >= 0 ? expected.slice(0, inputIdx + 1) : []);

  const cellCenter = (id: number) => {
    const col = id % 3;
    const row = Math.floor(id / 3);
    return { x: 35 + col * 15, y: 40 + row * 18 };
  };

  const activeTarget = inputIdx >= 0 ? cellCenter(expected[inputIdx]) : { x: 50, y: 58 };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full"
        style={{
          background: 'var(--bg-subtle)',
          color: isShow ? 'var(--accent)' : reverseOrder ? 'var(--warn)' : 'var(--ok)',
        }}
      >
        {isShow ? '1. Observe a ordem' : reverseOrder ? '2. Toque na ordem INVERSA ↺' : '2. Repita na mesma ordem'}
      </div>

      <div className="grid grid-cols-3 gap-1.5 w-[148px]">
        {Array.from({ length: 9 }, (_, id) => {
          const isLit = litCell === id;
          const isOk = tappedSet.has(id);
          const orderNum = isShow && isLit ? step + 1 : isOk ? expected.indexOf(id) + 1 : null;
          return (
            <div
              key={id}
              className="aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all duration-180"
              style={{
                background: isLit
                  ? 'var(--accent-grad)'
                  : isOk
                    ? 'rgba(52, 211, 153, 0.34)'
                    : 'var(--bg-card)',
                border: isLit
                  ? '2px solid #ffffff'
                  : isOk
                    ? '2px solid var(--ok)'
                    : '1px solid var(--border)',
                color: isLit ? '#ffffff' : 'var(--ok)',
                boxShadow: isLit ? '0 0 16px var(--accent-glow)' : 'none',
              }}
            >
              {orderNum ?? ''}
            </div>
          );
        })}
      </div>

      <TapCursor
        xPct={activeTarget.x}
        yPct={activeTarget.y}
        pressing={inputIdx >= 0}
        visible={inputIdx >= 0}
      />
    </div>
  );
}

/* ============================================================================
   4. DUAL N-BACK
   ============================================================================ */
function DualNBackDemo({ nBackLevel }: { nBackLevel: number }) {
  const step = useLoopStep(6, 860);
  // Passo 0: memorize pos 4 | Passo 1-2: pos 4 igual -> clica IGUAL | Passo 3-4: pos 2 diferente -> clica DIFERENTE
  const isDiffCycle = step >= 3;
  const activePos = isDiffCycle ? 2 : 4;
  const ghostPos = 4;
  const pressing = step === 2 || step === 4;
  const showGhost = step >= 1;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: step === 0 ? 'var(--warn)' : 'var(--accent)' }}
      >
        {step === 0 ? '1. Memorize a posição' : nBackLevel === 1 ? '2. Compare com o anterior' : `2. Compare com ${nBackLevel} atrás`}
      </div>

      <div className="grid grid-cols-3 gap-1 w-[108px]">
        {Array.from({ length: 9 }, (_, i) => {
          const active = activePos === i;
          const isGhost = showGhost && ghostPos === i && !active;
          return (
            <div
              key={i}
              className="aspect-square rounded-lg flex items-center justify-center text-sm font-black transition-all"
              style={{
                background: active ? 'var(--accent-grad)' : isGhost ? 'var(--accent-glow)' : 'var(--bg-card)',
                border: active ? '2px solid #fff' : isGhost ? '1.5px dashed var(--accent)' : '1px solid var(--border)',
                color: active ? '#ffffff' : 'var(--accent)',
              }}
            >
              {active ? '◆' : isGhost ? <span className="text-[8px]">Ant.</span> : ''}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-1.5 w-[224px]">
        <div
          className="py-1.5 px-1.5 rounded-xl text-center text-[10px] font-extrabold transition-all"
          style={{
            background: isDiffCycle && pressing ? 'rgba(52, 211, 153, 0.3)' : 'var(--bg-card)',
            border: isDiffCycle && pressing ? '2px solid var(--ok)' : '1px solid var(--border-strong)',
            color: isDiffCycle && pressing ? 'var(--ok)' : 'var(--text)',
          }}
        >
          ✕ DIFERENTE
        </div>
        <div
          className="py-1.5 px-1.5 rounded-xl text-center text-[10px] font-extrabold transition-all"
          style={{
            background: !isDiffCycle && pressing ? 'rgba(52, 211, 153, 0.3)' : 'var(--bg-card)',
            border: !isDiffCycle && pressing ? '2px solid var(--ok)' : '1px solid var(--border-strong)',
            color: !isDiffCycle && pressing ? 'var(--ok)' : 'var(--text)',
          }}
        >
          ✓ IGUAL
        </div>
      </div>

      <TapCursor
        xPct={isDiffCycle ? 32 : 68}
        yPct={84}
        pressing={pressing}
        visible={step >= 1 && step <= 4}
      />
    </div>
  );
}

/* ============================================================================
   5. MATRIZES LÓGICAS (RAVEN)
   ============================================================================ */
function MiniShape({ shape, color }: { shape: 'circle' | 'square' | 'triangle'; color: string }) {
  return (
    <svg viewBox="0 0 36 36" className="w-6 h-6">
      {shape === 'circle' && <circle cx="18" cy="18" r="10" fill={color} />}
      {shape === 'square' && <rect x="8" y="8" width="20" height="20" rx="3" fill={color} />}
      {shape === 'triangle' && <polygon points="18,6 30,28 6,28" fill={color} strokeLinejoin="round" />}
    </svg>
  );
}

function RavenMatricesDemo() {
  const step = useLoopStep(6, 850);
  const shapes: Array<'circle' | 'square' | 'triangle'> = ['circle', 'square', 'triangle'];
  const colors = ['#38bdf8', '#f472b6', '#34d399'];

  const highlightRow = step === 1;
  const highlightCol = step === 2;
  const solved = step >= 4;

  const hint =
    step === 1
      ? 'Linha 3 → só triângulos'
      : step === 2
        ? 'Coluna 3 → só verdes'
        : solved
          ? 'Triângulo verde completa!'
          : 'Encontre o padrão';

  const options: Array<{ shape: 'circle' | 'square' | 'triangle'; color: string; ok: boolean }> = [
    { shape: 'triangle', color: '#38bdf8', ok: false },
    { shape: 'triangle', color: '#34d399', ok: true },
    { shape: 'square', color: '#34d399', ok: false },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: solved ? 'var(--ok)' : 'var(--accent)' }}
      >
        {hint}
      </div>

      <div
        className="grid grid-cols-3 gap-1 w-[114px] p-1.5 rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {shapes.flatMap((sh, r) =>
          colors.map((col, c) => {
            const isMissing = r === 2 && c === 2;
            const emphasized = (highlightRow && r === 2) || (highlightCol && c === 2);
            return (
              <div
                key={`${r}-${c}`}
                className="aspect-square rounded-md flex items-center justify-center transition-all"
                style={{
                  background: isMissing
                    ? solved
                      ? 'rgba(52, 211, 153, 0.25)'
                      : 'var(--accent-glow)'
                    : 'var(--bg)',
                  border: isMissing
                    ? solved
                      ? '1.5px solid var(--ok)'
                      : '1.5px dashed var(--accent)'
                    : emphasized
                      ? '1.5px solid var(--warn)'
                      : '1px solid var(--border)',
                }}
              >
                {isMissing ? (
                  solved ? (
                    <MiniShape shape="triangle" color="#34d399" />
                  ) : (
                    <span className="text-sm font-black" style={{ color: 'var(--accent)' }}>?</span>
                  )
                ) : (
                  <MiniShape shape={sh} color={col} />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 w-[156px]">
        {options.map((opt, idx) => {
          const picked = opt.ok && solved;
          return (
            <div
              key={idx}
              className="h-10 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: picked ? 'rgba(52, 211, 153, 0.28)' : 'var(--bg-card)',
                border: picked ? '2px solid var(--ok)' : '1px solid var(--border)',
              }}
            >
              <MiniShape shape={opt.shape} color={opt.color} />
            </div>
          );
        })}
      </div>

      <TapCursor xPct={50} yPct={84} pressing={step === 4} visible={step === 3 || step === 4} />
    </div>
  );
}

/* ============================================================================
   6. CONEXÃO LÓGICA (TRAIL MAKING)
   ============================================================================ */
function PathLogicDemo({ alternating }: { alternating: boolean }) {
  const step = useLoopStep(6, 700);
  const labels = alternating ? ['1', 'A', '2', 'B'] : ['1', '2', '3', '4'];
  const pts = [
    { x: 46, y: 42 },
    { x: 174, y: 102 },
    { x: 170, y: 38 },
    { x: 56, y: 104 },
  ];

  const doneCount = Math.min(4, step);
  const activeIdx = step >= 1 && step <= 4 ? step - 1 : -1;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
      >
        {alternating ? '1 → A → 2 → B' : '1 → 2 → 3 → 4'}
      </div>

      <div
        className="relative w-[220px] h-[142px] rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <svg viewBox="0 0 220 142" className="w-full h-full">
          {pts.map((p, i) => {
            if (i === 0 || i >= doneCount) return null;
            const prev = pts[i - 1];
            return (
              <line
                key={i}
                x1={prev.x}
                y1={prev.y}
                x2={p.x}
                y2={p.y}
                stroke="#34d399"
                strokeWidth="3.5"
                strokeLinecap="round"
                opacity="0.85"
              />
            );
          })}
          {pts.map((p, i) => {
            const done = i < doneCount;
            const isStart = i === 0 && doneCount === 0;
            return (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={17}
                  fill={done ? '#10b981' : isStart ? '#a855f7' : '#1e293b'}
                  stroke={done ? '#a7f3d0' : isStart ? '#ffffff' : 'rgba(255,255,255,0.28)'}
                  strokeWidth="2"
                />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
                  {labels[i]}
                </text>
              </g>
            );
          })}
        </svg>

        <TapCursor
          xPct={activeIdx >= 0 ? (pts[activeIdx].x / 220) * 100 : 21}
          yPct={activeIdx >= 0 ? (pts[activeIdx].y / 142) * 100 : 30}
          pressing={activeIdx >= 0}
          visible={activeIdx >= 0}
        />
      </div>
    </div>
  );
}

/* ============================================================================
   7. COMPARAÇÃO RÁPIDA (SPEED MATCH)
   ============================================================================ */
function SpeedMatchDemo() {
  const step = useLoopStep(6, 860);
  const showPrev = step >= 1;
  const isDiffCycle = step >= 3;
  const currentCard = isDiffCycle
    ? { sym: '▲', color: '#f472b6' }
    : { sym: '◆', color: '#38bdf8' };
  const pressSame = step === 2;
  const pressDiff = step === 4;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1" style={{ opacity: showPrev ? 0.72 : 0.2 }}>
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-soft)' }}>
            Anterior
          </span>
          <div
            className="w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-black"
            style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', color: '#38bdf8' }}
          >
            ◆
          </div>
        </div>

        <span className="text-sm font-black" style={{ color: 'var(--text-soft)' }}>→</span>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--accent)' }}>
            {showPrev ? 'Atual' : 'Memorize'}
          </span>
          <div
            className="w-16 h-20 rounded-2xl flex items-center justify-center text-4xl font-black transition-all"
            style={{
              background: 'var(--bg-card)',
              border: pressSame || pressDiff ? '2px solid var(--ok)' : '2px solid var(--border-strong)',
              color: currentCard.color,
            }}
          >
            {currentCard.sym}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 w-[210px]">
        <div
          className="py-2 rounded-xl text-center text-xs font-extrabold transition-all"
          style={{
            background: pressDiff ? 'rgba(52, 211, 153, 0.28)' : 'var(--bg-subtle)',
            border: pressDiff ? '2px solid var(--ok)' : '1px solid var(--border)',
            color: pressDiff ? 'var(--ok)' : 'var(--text)',
          }}
        >
          ✕ Diferente
        </div>
        <div
          className="py-2 rounded-xl text-center text-xs font-extrabold transition-all"
          style={{
            background: pressSame ? 'rgba(52, 211, 153, 0.28)' : 'var(--bg-subtle)',
            border: pressSame ? '2px solid var(--ok)' : '1px solid var(--border)',
            color: pressSame ? 'var(--ok)' : 'var(--text)',
          }}
        >
          ✓ Igual
        </div>
      </div>

      <TapCursor
        xPct={isDiffCycle ? 32 : 68}
        yPct={80}
        pressing={pressSame || pressDiff}
        visible={step === 1 || step === 2 || step === 3 || step === 4}
      />
    </div>
  );
}

/* ============================================================================
   8. DECODIFICADOR SÍMBOLO-DÍGITO
   ============================================================================ */
function SymbolDigitDemo() {
  const step = useLoopStep(6, 780);
  const legend = [
    { sym: '◆', digit: 1 },
    { sym: '▲', digit: 2 },
    { sym: '●', digit: 3 },
    { sym: '★', digit: 4 },
  ];
  const isSecond = step >= 3;
  const target = isSecond ? legend[3] : legend[1]; // ▲ -> 2, depois ★ -> 4
  const highlightLegend = step === 1 || step === 2 || step === 4 || step === 5;
  const pressing = step === 2 || step === 5;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="grid grid-cols-4 gap-1 w-[205px] p-1.5 rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {legend.map((item) => {
          const lit = highlightLegend && item.digit === target.digit;
          return (
            <div
              key={item.digit}
              className="flex flex-col items-center py-1 rounded-lg transition-all"
              style={{
                background: lit ? 'var(--accent-glow)' : 'var(--bg)',
                border: lit ? '1.5px solid var(--accent)' : '1px solid transparent',
              }}
            >
              <span className="text-sm leading-none" style={{ color: 'var(--accent)' }}>{item.sym}</span>
              <span className="text-[11px] font-black mt-0.5 tabular">{item.digit}</span>
            </div>
          );
        })}
      </div>

      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black transition-all"
        style={{
          background: 'var(--bg-card)',
          border: pressing ? '2px solid var(--ok)' : '2px solid var(--border-strong)',
        }}
      >
        {target.sym}
      </div>

      <div className="grid grid-cols-4 gap-1.5 w-[205px]">
        {legend.map((item) => {
          const picked = pressing && item.digit === target.digit;
          return (
            <div
              key={item.digit}
              className="py-1.5 rounded-xl text-center text-sm font-black tabular transition-all"
              style={{
                background: picked ? 'rgba(52, 211, 153, 0.3)' : 'var(--bg-subtle)',
                border: picked ? '2px solid var(--ok)' : '1px solid var(--border)',
                color: picked ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {item.digit}
            </div>
          );
        })}
      </div>

      <TapCursor
        xPct={isSecond ? 74 : 42}
        yPct={83}
        pressing={pressing}
        visible={highlightLegend}
      />
    </div>
  );
}

/* ============================================================================
   9. ARITMÉTICA MENTAL
   ============================================================================ */
function ChainArithmeticDemo() {
  const step = useLoopStep(6, 800);
  const second = step >= 3;
  const expr = second ? '15 − 6' : '8 + 5';
  const options = second ? [7, 8, 9, 11] : [11, 13, 14, 12];
  const answer = second ? 9 : 13;
  const pressing = step === 2 || step === 5;
  const showCursor = step === 1 || step === 2 || step === 4 || step === 5;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 px-4">
      <div
        className="w-[190px] py-3.5 rounded-2xl text-center text-2xl font-black tabular"
        style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-strong)' }}
      >
        {expr}
      </div>

      <div className="grid grid-cols-2 gap-2 w-[190px]">
        {options.map((opt) => {
          const ok = pressing && opt === answer;
          return (
            <div
              key={opt}
              className="py-2 rounded-xl text-center text-base font-black tabular transition-all"
              style={{
                background: ok ? 'rgba(52, 211, 153, 0.3)' : 'var(--bg-subtle)',
                border: ok ? '2px solid var(--ok)' : '1px solid var(--border)',
                color: ok ? 'var(--ok)' : 'var(--text)',
              }}
            >
              {opt}
            </div>
          );
        })}
      </div>

      <TapCursor
        xPct={second ? 34 : 66}
        yPct={second ? 80 : 62}
        pressing={pressing}
        visible={showCursor}
      />
    </div>
  );
}

/* ============================================================================
   10. BALANÇA NUMÉRICA
   ============================================================================ */
function NumberComparisonDemo() {
  const step = useLoopStep(6, 850);
  const second = step >= 3;
  const left = second ? { label: '18 − 3', val: 15 } : { label: '9 + 4', val: 13 };
  const right = second ? { label: '7 + 5', val: 12 } : { label: '8 + 7', val: 15 };
  const winner: 'left' | 'right' = left.val > right.val ? 'left' : 'right';
  const showHint = step === 1 || step === 2 || step === 4 || step === 5;
  const pressing = step === 2 || step === 5;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
      >
        Toque no maior
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-[216px]">
        {(['left', 'right'] as const).map((side) => {
          const item = side === 'left' ? left : right;
          const isPicked = pressing && side === winner;
          return (
            <div
              key={side}
              className="h-24 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
              style={{
                background: isPicked ? 'rgba(52, 211, 153, 0.28)' : 'var(--bg-card)',
                border: isPicked ? '2px solid var(--ok)' : '1.5px solid var(--border-strong)',
              }}
            >
              <span className="text-lg font-black tabular">{item.label}</span>
              <span
                className="text-[11px] font-bold tabular transition-opacity"
                style={{
                  opacity: showHint ? 1 : 0,
                  color: side === winner ? 'var(--ok)' : 'var(--text-soft)',
                }}
              >
                = {item.val}
              </span>
            </div>
          );
        })}
      </div>

      <TapCursor
        xPct={winner === 'left' ? 32 : 68}
        yPct={64}
        pressing={pressing}
        visible={showHint}
      />
    </div>
  );
}

/* ============================================================================
   11. STROOP (COR DA TINTA vs PALAVRA)
   ============================================================================ */
function StroopDemo({ alternatingRule }: { alternatingRule: boolean }) {
  const step = useLoopStep(6, 900);
  const second = step >= 3;
  const ruleIsWord = alternatingRule && second;

  const word = second ? (ruleIsWord ? 'VERMELHO' : 'VERDE') : 'AZUL';
  const inkHex = second ? '#38bdf8' : '#34d399';
  const expectedId = second ? (ruleIsWord ? 'red' : 'blue') : 'green';
  const pressing = step === 2 || step === 5;
  const showCursor = step === 1 || step === 2 || step === 4 || step === 5;

  const buttons = [
    { id: 'blue', label: 'AZUL', hex: '#38bdf8', x: 34, y: 69 },
    { id: 'green', label: 'VERDE', hex: '#34d399', x: 66, y: 69 },
    { id: 'red', label: 'VERMELHO', hex: '#fb7185', x: 34, y: 85 },
    { id: 'yellow', label: 'AMARELO', hex: '#fbbf24', x: 66, y: 85 },
  ];
  const targetBtn = buttons.find((b) => b.id === expectedId) ?? buttons[1];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2 px-4">
      <div
        className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full"
        style={{
          background: ruleIsWord ? 'rgba(251, 191, 36, 0.2)' : 'var(--accent-glow)',
          color: ruleIsWord ? 'var(--warn)' : 'var(--accent)',
          border: `1px solid ${ruleIsWord ? 'var(--warn)' : 'var(--border-strong)'}`,
        }}
      >
        {ruleIsWord ? 'Palavra escrita' : 'Cor da tinta'}
      </div>

      <div
        className="w-[196px] py-3 rounded-2xl text-center text-2xl font-black tracking-wide"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: inkHex }}
      >
        {word}
      </div>

      <div className="grid grid-cols-2 gap-1.5 w-[212px]">
        {buttons.map((b) => {
          const picked = pressing && b.id === expectedId;
          return (
            <div
              key={b.id}
              className="py-1.5 px-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all"
              style={{
                background: picked ? 'rgba(52, 211, 153, 0.28)' : 'var(--bg-subtle)',
                border: picked ? '2px solid var(--ok)' : '1px solid var(--border)',
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.hex }} />
              <span>{b.label}</span>
            </div>
          );
        })}
      </div>

      <TapCursor xPct={targetBtn.x} yPct={targetBtn.y} pressing={pressing} visible={showCursor} />
    </div>
  );
}

/* ============================================================================
   12. GO / NO-GO
   ============================================================================ */
function GoNoGoDemo() {
  const step = useLoopStep(6, 860);
  const mode: 'wait' | 'go' | 'go-ok' | 'nogo' | 'nogo-ok' =
    step === 0 || step === 3
      ? 'wait'
      : step === 1
        ? 'go'
        : step === 2
          ? 'go-ok'
          : step === 4
            ? 'nogo'
            : 'nogo-ok';

  const isGo = mode === 'go' || mode === 'go-ok';
  const isNoGo = mode === 'nogo' || mode === 'nogo-ok';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4">
      <div
        className="text-[11px] font-extrabold px-3 py-0.5 rounded-full"
        style={{
          background: 'var(--bg-subtle)',
          color: mode === 'go-ok' || mode === 'nogo-ok' ? 'var(--ok)' : isNoGo ? 'var(--err)' : 'var(--text-muted)',
        }}
      >
        {mode === 'wait' && 'Aguarde o sinal...'}
        {mode === 'go' && 'Verde → Toque rápido!'}
        {mode === 'go-ok' && '✓ Acertou!'}
        {mode === 'nogo' && 'Vermelho → NÃO toque!'}
        {mode === 'nogo-ok' && '✓ Segurou o dedo!'}
      </div>

      <div
        className="w-32 h-32 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background:
            mode === 'go-ok'
              ? 'rgba(52, 211, 153, 0.28)'
              : isGo
                ? 'rgba(52, 211, 153, 0.14)'
                : isNoGo
                  ? 'rgba(251, 113, 133, 0.16)'
                  : 'var(--bg-card)',
          border:
            isGo
              ? '3px solid var(--ok)'
              : isNoGo
                ? '3px solid var(--err)'
                : '2px dashed var(--border)',
        }}
      >
        {isGo ? (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black animate-pop"
            style={{ background: '#10b981', color: '#052e16', boxShadow: '0 0 22px rgba(16,185,129,0.5)' }}
          >
            GO
          </div>
        ) : isNoGo ? (
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black animate-pop"
            style={{ background: '#f43f5e', color: '#ffffff', boxShadow: '0 0 22px rgba(244,63,94,0.45)' }}
          >
            ✕
          </div>
        ) : (
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
            ...
          </span>
        )}
      </div>

      {/* Mão parada avisando para não tocar no vermelho */}
      {isNoGo && (
        <div
          className="absolute right-5 bottom-4 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-extrabold animate-pop"
          style={{
            background: mode === 'nogo-ok' ? 'rgba(52,211,153,0.22)' : 'rgba(251,113,133,0.22)',
            border: `1px solid ${mode === 'nogo-ok' ? 'var(--ok)' : 'var(--err)'}`,
            color: mode === 'nogo-ok' ? 'var(--ok)' : 'var(--err)',
          }}
        >
          {mode === 'nogo-ok' ? <Check size={12} /> : <Hand size={12} />}
          <span>{mode === 'nogo-ok' ? 'Boa!' : 'Pare'}</span>
        </div>
      )}

      <TapCursor xPct={50} yPct={62} pressing={mode === 'go-ok'} visible={isGo} />
    </div>
  );
}

/* ============================================================================
   TEXTO CURTO E RENDERIZAÇÃO DO TUTORIAL POR MINIGAME
   ============================================================================ */
function getTutorialInstruction(slug: GameSlug, config: StageConfig): string {
  switch (slug) {
    case 'visual-search':
      return 'Encontre e toque em todos os símbolos iguais ao alvo mostrado no topo.';
    case 'sustained-tracking':
      return 'Memorize as bolinhas amarelas, acompanhe enquanto se mexem e toque nelas no final.';
    case 'spatial-span':
      return config.reverseOrder
        ? 'Observe os blocos acenderem e toque neles na ORDEM INVERSA (de trás pra frente).'
        : 'Observe os blocos acenderem em sequência e repita na mesma ordem.';
    case 'dual-n-back':
      return config.nBackLevel === 1
        ? 'Compare o bloco atual com a posição imediatamente anterior e toque em IGUAL ou DIFERENTE.'
        : `Compare o bloco atual com a posição de ${config.nBackLevel} passos atrás e toque em IGUAL ou DIFERENTE.`;
    case 'raven-matrices':
      return 'Descubra o padrão das linhas e colunas e toque na peça que completa o "?".';
    case 'path-logic':
      return config.stage >= 3
        ? 'Ligue os círculos alternando números e letras na ordem: 1 → A → 2 → B.'
        : 'Toque nos círculos em ordem crescente: 1 → 2 → 3 → 4.';
    case 'speed-match':
      return 'Memorize a carta anterior e diga se a nova carta é Igual ou Diferente.';
    case 'symbol-digit':
      return 'Veja na tabela do topo qual número corresponde ao símbolo e toque nele.';
    case 'chain-arithmetic':
      return 'Resolva a conta mentalmente e toque no resultado certo o mais rápido possível.';
    case 'number-comparison':
      return 'Compare os dois cartões e toque naquele que tiver o maior valor.';
    case 'stroop-conflict':
      return config.alternatingRule
        ? 'Fique atento ao selo do topo: ora toque na COR DA TINTA, ora na PALAVRA escrita.'
        : 'Toque na COR DA TINTA da palavra — ignore o que está escrito.';
    case 'go-nogo-reflex':
      return 'Toque rápido quando aparecer o verde (GO) e segure o dedo no vermelho (✕).';
  }
}

function TutorialStageVisual({ slug, config }: { slug: GameSlug; config: StageConfig }) {
  switch (slug) {
    case 'visual-search':
      return <VisualSearchDemo />;
    case 'sustained-tracking':
      return <SustainedTrackingDemo />;
    case 'spatial-span':
      return <SpatialSpanDemo reverseOrder={config.reverseOrder} />;
    case 'dual-n-back':
      return <DualNBackDemo nBackLevel={config.nBackLevel} />;
    case 'raven-matrices':
      return <RavenMatricesDemo />;
    case 'path-logic':
      return <PathLogicDemo alternating={config.stage >= 3} />;
    case 'speed-match':
      return <SpeedMatchDemo />;
    case 'symbol-digit':
      return <SymbolDigitDemo />;
    case 'chain-arithmetic':
      return <ChainArithmeticDemo />;
    case 'number-comparison':
      return <NumberComparisonDemo />;
    case 'stroop-conflict':
      return <StroopDemo alternatingRule={config.alternatingRule} />;
    case 'go-nogo-reflex':
      return <GoNoGoDemo />;
  }
}

export function GameTutorial({ slug, config, onConfirm }: GameTutorialProps) {
  const game = GAME_MAP[slug];
  const domain = DOMAIN_MAP[game.domain];
  const instruction = getTutorialInstruction(slug, config);

  return (
    <div className="w-full max-w-[385px] surface-card p-5 flex flex-col gap-4 animate-pop">
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider"
          style={{
            background: `${domain.color}22`,
            color: domain.color,
            border: `1px solid ${domain.color}55`,
          }}
        >
          <Play size={11} />
          Como jogar
        </span>
        <span className="text-[11px] font-bold" style={{ color: 'var(--text-soft)' }}>
          {domain.shortName}
        </span>
      </div>

      <div>
        <h2 className="text-xl font-black tracking-tight leading-tight">{game.name}</h2>
        <p className="text-xs font-medium mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {instruction}
        </p>
      </div>

      {/* Palco da demonstração visual em loop */}
      <div
        className="w-full h-[218px] rounded-2xl relative overflow-hidden"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
      >
        <span
          className="absolute top-2 right-2.5 z-10 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-soft)' }}
        >
          Exemplo
        </span>
        <TutorialStageVisual slug={slug} config={config} />
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="w-full py-3.5 rounded-2xl font-extrabold text-base btn-accent cursor-pointer flex items-center justify-center gap-2"
      >
        <Check size={18} strokeWidth={3} />
        <span>Entendi</span>
      </button>
    </div>
  );
}

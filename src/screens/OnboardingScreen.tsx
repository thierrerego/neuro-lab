import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { DomainKey, OnboardingProfileData } from '../types/cognitive';
import { DOMAIN_LIST } from '../engine/gameRegistry';
import { sound } from '../lib/audio';

interface GoalOption {
  id: string;
  label: string;
  domains: DomainKey[];
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'focus',
    label: 'Aumentar foco e evitar distrações',
    domains: ['selective_attention', 'inhibitory_control'],
  },
  {
    id: 'memory',
    label: 'Melhorar memória de curto prazo e retenção',
    domains: ['working_memory'],
  },
  {
    id: 'speed',
    label: 'Raciocinar mais rápido sob pressão',
    domains: ['processing_speed'],
  },
  {
    id: 'logic',
    label: 'Resolver problemas complexos com lógica',
    domains: ['fluid_reasoning'],
  },
  {
    id: 'numbers',
    label: 'Agilidade com números e cálculo mental',
    domains: ['numerical_cognition'],
  },
  {
    id: 'all',
    label: 'Treino completo (todas as áreas)',
    domains: DOMAIN_LIST.map((d) => d.key),
  },
];

const DAILY_OPTIONS: { minutes: 5 | 10 | 15 | 20; label: string; games: string }[] = [
  { minutes: 5,  label: '5 min/dia',   games: '2 jogos · Expressa' },
  { minutes: 10, label: '10 min/dia',  games: '3 jogos · Padrão' },
  { minutes: 15, label: '15 min/dia',  games: '4 jogos · Intensa' },
  { minutes: 20, label: '20+ min/dia', games: '5 jogos · Alta Performance' },
];

const PEAK_OPTIONS = ['Manhã', 'Tarde', 'Noite', 'Madrugada'];
const BOTTLENECK_OPTIONS = ['Esquecimento', 'Lentidão', 'Impulsividade', 'Cansaço mental'];

interface OnboardingScreenProps {
  initialGoals?: string[];
  initialMinutes?: number;
  initialPeak?: string | null;
  initialBottlenecks?: string[];
  onComplete: (data: OnboardingProfileData) => void;
}

export function OnboardingScreen({
  initialGoals = [],
  initialMinutes = 10,
  initialPeak = 'Manhã',
  initialBottlenecks = [],
  onComplete,
}: OnboardingScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(initialGoals);
  const [minutes, setMinutes] = useState<5 | 10 | 15 | 20>(
    initialMinutes === 5 || initialMinutes === 15 || initialMinutes === 20 ? initialMinutes : 10
  );
  const [peakTime, setPeakTime] = useState<string>(initialPeak || 'Manhã');
  const [bottlenecks, setBottlenecks] = useState<string[]>(initialBottlenecks);

  const toggleGoal = (id: string) => {
    sound.tap();
    if (id === 'all') {
      setSelectedGoals((prev) => (prev.includes('all') ? [] : ['all']));
      return;
    }
    setSelectedGoals((prev) => {
      const withoutAll = prev.filter((x) => x !== 'all');
      return withoutAll.includes(id) ? withoutAll.filter((x) => x !== id) : [...withoutAll, id];
    });
  };

  const toggleBottleneck = (item: string) => {
    sound.tap();
    setBottlenecks((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const resolveDomains = (): DomainKey[] => {
    const set = new Set<DomainKey>();
    for (const gid of selectedGoals) {
      const found = GOAL_OPTIONS.find((g) => g.id === gid);
      found?.domains.forEach((d) => set.add(d));
    }
    return Array.from(set);
  };

  const selectedDomainCount = resolveDomains().length;

  const handleFinish = () => {
    sound.hit(3);
    const domains = resolveDomains();
    onComplete({
      goals: selectedGoals,
      selected_domains: domains.length > 0 ? domains : DOMAIN_LIST.map((d) => d.key),
      daily_goal_minutes: minutes,
      peak_time: peakTime,
      bottlenecks,
    });
  };

  return (
    <div className="flex flex-col gap-5 py-2 animate-pop">
      {/* Topo da etapa */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="w-8 h-8 rounded-xl flex items-center justify-center btn-soft cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft size={15} />
            </button>
          )}
          <span className="text-xs font-extrabold tabular" style={{ color: 'var(--accent)' }}>
            Etapa {step} / 3
          </span>
        </div>
        {step === 1 && selectedDomainCount > 0 && (
          <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
            {selectedDomainCount} {selectedDomainCount === 1 ? 'área' : 'áreas'}
          </span>
        )}
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%`, background: 'var(--accent-grad)' }}
        />
      </div>

      {/* ETAPA 1: Objetivos Principais (Multi-escolha) */}
      {step === 1 && (
        <div className="flex flex-col gap-3 animate-pop">
          <h2 className="text-xl font-black tracking-tight">O que você quer treinar?</h2>

          <div className="flex flex-col gap-2">
            {GOAL_OPTIONS.map((opt) => {
              const active = selectedGoals.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleGoal(opt.id)}
                  className="surface-card surface-card-click px-4 py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer"
                  style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : undefined}
                >
                  <span className="text-sm font-bold leading-snug">{opt.label}</span>
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg)',
                      border: active ? 'none' : '1px solid var(--border)',
                      color: '#09090b',
                    }}
                  >
                    {active && <Check size={13} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            disabled={selectedGoals.length === 0}
            onClick={() => {
              sound.hit(1);
              setStep(2);
            }}
            className="w-full py-4 mt-1 rounded-2xl font-extrabold text-sm btn-accent cursor-pointer disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      )}

      {/* ETAPA 2: Disponibilidade Diária */}
      {step === 2 && (
        <div className="flex flex-col gap-3 animate-pop">
          <h2 className="text-xl font-black tracking-tight">Tempo por dia?</h2>

          <div className="flex flex-col gap-2.5">
            {DAILY_OPTIONS.map((opt) => {
              const active = minutes === opt.minutes;
              return (
                <button
                  key={opt.minutes}
                  onClick={() => {
                    sound.hit(2);
                    setMinutes(opt.minutes);
                    setStep(3);
                  }}
                  className="surface-card surface-card-click px-4 py-4 flex items-center justify-between text-left cursor-pointer"
                  style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : undefined}
                >
                  <span className="text-base font-extrabold">{opt.label}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                    {opt.games}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ETAPA 3: Autoavaliação de Rotina (Multi-escolha) */}
      {step === 3 && (
        <div className="flex flex-col gap-5 animate-pop">
          <div className="flex flex-col gap-2.5">
            <h2 className="text-lg font-black tracking-tight">Horário de pico mental</h2>
            <div className="grid grid-cols-2 gap-2">
              {PEAK_OPTIONS.map((p) => {
                const active = peakTime === p;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      sound.tap();
                      setPeakTime(p);
                    }}
                    className={`py-3 rounded-xl text-sm font-bold cursor-pointer ${active ? 'btn-accent' : 'btn-soft'}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <h2 className="text-lg font-black tracking-tight">Principal gargalo diário</h2>
            <div className="grid grid-cols-2 gap-2">
              {BOTTLENECK_OPTIONS.map((b) => {
                const active = bottlenecks.includes(b);
                return (
                  <button
                    key={b}
                    onClick={() => toggleBottleneck(b)}
                    className="surface-card surface-card-click py-3 px-3 flex items-center justify-between text-xs font-bold cursor-pointer"
                    style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : undefined}
                  >
                    <span>{b}</span>
                    {active && <Check size={14} style={{ color: 'var(--accent)' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleFinish}
            className="w-full py-4 rounded-2xl font-extrabold text-sm btn-accent cursor-pointer"
          >
            Montar Calibração
          </button>
        </div>
      )}
    </div>
  );
}

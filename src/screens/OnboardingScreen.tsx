import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Brain,
  Calendar,
  Check,
  Clock,
  Cpu,
  Gauge,
  Play,
  ShieldAlert,
  Target,
} from 'lucide-react';
import type { AgeBracket, DomainKey, OnboardingProfileData } from '../types/cognitive';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import {
  AGE_BRACKET_OPTIONS,
  getAgeBracketMeta,
  getCalibrationDomains,
  getDailyGamesCount,
} from '../engine/psychometricEngine';
import { GameIcon } from '../components/DomainIcon';
import { sound } from '../lib/audio';

interface TargetOption {
  id: string;
  title: string;
  desc: string;
  domains: DomainKey[];
  telemetryTag: string;
}

const INDIVIDUAL_GOAL_IDS = [
  'selective_attention',
  'working_memory',
  'processing_speed',
  'fluid_reasoning',
  'numerical_cognition',
  'inhibitory_control',
] as const;

const TARGET_OPTIONS: TargetOption[] = [
  {
    id: 'selective_attention',
    title: 'Atenção Seletiva & Vigilância',
    desc: 'Sustentar concentração profunda filtrando estímulos irrelevantes.',
    domains: ['selective_attention'],
    telemetryTag: 'Varredura Visual + Rastreamento Sustentado',
  },
  {
    id: 'working_memory',
    title: 'Memória de Trabalho',
    desc: 'Reter e manipular múltiplas informações simultaneamente sem perder a sequência.',
    domains: ['working_memory'],
    telemetryTag: 'Carga de Memória Operacional',
  },
  {
    id: 'processing_speed',
    title: 'Velocidade de Processamento',
    desc: 'Reduzir a latência entre perceber um padrão e executar a resposta correta.',
    domains: ['processing_speed'],
    telemetryTag: 'Compressão de Latência',
  },
  {
    id: 'fluid_reasoning',
    title: 'Raciocínio Fluido & Abstração',
    desc: 'Identificar relações lógicas e resolver problemas inéditos sob tempo limitado.',
    domains: ['fluid_reasoning'],
    telemetryTag: 'Inferência Lógica & Padrões',
  },
  {
    id: 'numerical_cognition',
    title: 'Cálculo Mental & Magnitude',
    desc: 'Executar estimativas e operações encadeadas com autonomia e precisão.',
    domains: ['numerical_cognition'],
    telemetryTag: 'Fluidez Numérica & Magnitude',
  },
  {
    id: 'inhibitory_control',
    title: 'Controle Inibitório & Decisão',
    desc: 'Suprimir respostas impulsivas e manter precisão sob conflito cognitivo.',
    domains: ['inhibitory_control'],
    telemetryTag: 'Controle de Interferência & Freio Motor',
  },
  {
    id: 'full_stack',
    title: 'Protocolo Completo (6 Domínios)',
    desc: 'Seleciona todas as 6 capacidades acima para calibração e equilíbrio integral.',
    domains: DOMAIN_LIST.map((d) => d.key),
    telemetryTag: 'Bateria Completa (6 Domínios)',
  },
];

export interface BottleneckScenario {
  id: string;
  text: string;
  shortLabel: string;
  domains: DomainKey[];
  telemetryTag: string;
}

export const BOTTLENECK_SCENARIOS: BottleneckScenario[] = [
  {
    id: 'wm_reread',
    text: 'Leio um parágrafo ou ouço uma instrução e preciso reler ou reconfirmar logo em seguida.',
    shortLabel: 'Retenção imediata / releitura',
    domains: ['working_memory'],
    telemetryTag: 'Prioridade em Memória de Trabalho',
  },
  {
    id: 'att_tabs',
    text: 'Inicio uma tarefa importante, mas troco de aba ou fragmento o foco antes de concluir.',
    shortLabel: 'Fragmentação de foco',
    domains: ['selective_attention'],
    telemetryTag: 'Prioridade em Atenção Seletiva',
  },
  {
    id: 'inh_impulse',
    text: 'Respondo ou ajo rápido demais e percebo o erro milissegundos depois.',
    shortLabel: 'Impulsividade decisória',
    domains: ['inhibitory_control'],
    telemetryTag: 'Prioridade em Controle Inibitório',
  },
  {
    id: 'spd_num_slow',
    text: 'Sinto maior lentidão mental para conectar ideias ou fazer contas de cabeça no cotidiano.',
    shortLabel: 'Latência e cálculo mental',
    domains: ['processing_speed', 'numerical_cognition'],
    telemetryTag: 'Prioridade em Velocidade + Cálculo',
  },
  {
    id: 'fld_stuck',
    text: 'Travo diante de problemas novos que não têm um roteiro prévio evidente.',
    shortLabel: 'Bloqueio em problemas inéditos',
    domains: ['fluid_reasoning'],
    telemetryTag: 'Prioridade em Raciocínio Fluido',
  },
];

const PEAK_WINDOWS = [
  { id: 'Manhã (06h–12h)', label: 'Manhã', range: '06h–12h' },
  { id: 'Tarde (12h–18h)', label: 'Tarde', range: '12h–18h' },
  { id: 'Noite (18h–00h)', label: 'Noite', range: '18h–00h' },
  { id: 'Madrugada (00h–06h)', label: 'Madrugada', range: '00h–06h' },
];

const STAMINA_LEVELS: Record<number, { title: string; curveNote: string }> = {
  1: { title: 'Exaustão rápida', curveNote: 'Cadência inicial leve com adaptação gradual' },
  2: { title: 'Fadiga moderada', curveNote: 'Progressão conservadora em fluxo contínuo' },
  3: { title: 'Resistência equilibrada', curveNote: 'Curva padrão em fluxo contínuo adaptativo' },
  4: { title: 'Boa sustentação', curveNote: 'Curva firme com demanda contínua' },
  5: { title: 'Alta resistência sustentada', curveNote: 'Curva intensiva para alta carga cognitiva' },
};

const APPLICATION_CONTEXTS = [
  {
    id: 'Alta performance profissional e tomada de decisão',
    tag: 'Decisão executiva sob pressão',
  },
  {
    id: 'Estudos complexos, provas e absorção de conteúdo',
    tag: 'Retenção ativa e resolução analítica',
  },
  {
    id: 'Agilidade mental, reflexos e longevidade cognitiva',
    tag: 'Velocidade neural e reserva cognitiva',
  },
  {
    id: 'Autoconhecimento e mensuração objetiva da minha mente',
    tag: 'Telemetria psicométrica de linha de base',
  },
];

const DAILY_LOAD_OPTIONS: {
  minutes: 5 | 10 | 15 | 20;
  label: string;
  protocolName: string;
  detail: string;
  telemetryTag: string;
}[] = [
  {
    minutes: 5,
    label: '5 min/dia',
    protocolName: 'Protocolo Express',
    detail: '2 exercícios/dia · Foco nos 2 maiores déficits',
    telemetryTag: 'Ciclo enxuto (2 exercícios prioritários)',
  },
  {
    minutes: 10,
    label: '10 min/dia',
    protocolName: 'Protocolo Padrão',
    detail: '3 exercícios/dia · 2 déficits + 1 manutenção',
    telemetryTag: 'Ciclo equilibrado (3 exercícios/dia)',
  },
  {
    minutes: 15,
    label: '15 min/dia',
    protocolName: 'Protocolo Intensivo',
    detail: '4 exercícios/dia · 3 déficits + 1 manutenção',
    telemetryTag: 'Ciclo intensivo (4 exercícios/dia)',
  },
  {
    minutes: 20,
    label: '20 min/dia',
    protocolName: 'Protocolo Estendido',
    detail: '5 exercícios/dia · 4 déficits + 1 manutenção',
    telemetryTag: 'Ciclo completo (5 exercícios/dia)',
  },
];

interface OnboardingScreenProps {
  initialGoals?: string[];
  initialMinutes?: number;
  initialPeak?: string | null;
  initialBottlenecks?: string[];
  initialStamina?: number;
  initialContext?: string | null;
  initialContexts?: string[];
  initialAgeBracket?: AgeBracket;
  onComplete: (data: OnboardingProfileData) => void;
}

type StepKey = 1 | 2 | 3 | 4 | 5 | 6 | 'summary';

function normalizeInitialGoals(goals: string[]): string[] {
  if (goals.includes('full_stack') || goals.includes('all')) {
    return [...INDIVIDUAL_GOAL_IDS, 'full_stack'];
  }
  const valid = goals.filter((g) => (INDIVIDUAL_GOAL_IDS as readonly string[]).includes(g));
  return valid.length === INDIVIDUAL_GOAL_IDS.length ? [...valid, 'full_stack'] : valid;
}

export function OnboardingScreen({
  initialGoals = [],
  initialMinutes = 10,
  initialPeak = 'Manhã (06h–12h)',
  initialBottlenecks = [],
  initialStamina = 3,
  initialContext = null,
  initialContexts = [],
  initialAgeBracket = '25-34',
  onComplete,
}: OnboardingScreenProps) {
  const [step, setStep] = useState<StepKey>(1);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(() => normalizeInitialGoals(initialGoals));
  const [bottlenecks, setBottlenecks] = useState<string[]>(
    initialBottlenecks.filter((id) => BOTTLENECK_SCENARIOS.some((b) => b.id === id))
  );
  const [peakTime, setPeakTime] = useState<string>(
    PEAK_WINDOWS.some((p) => p.id === initialPeak) ? (initialPeak as string) : 'Manhã (06h–12h)'
  );
  const [stamina, setStamina] = useState<number>(
    initialStamina >= 1 && initialStamina <= 5 ? Math.round(initialStamina) : 3
  );
  const [applicationContexts, setApplicationContexts] = useState<string[]>(() => {
    if (initialContexts.length > 0) {
      return initialContexts.filter((s) => APPLICATION_CONTEXTS.some((c) => c.id === s));
    }
    if (!initialContext) return [];
    return initialContext
      .split(' • ')
      .map((s) => s.trim())
      .filter((s) => APPLICATION_CONTEXTS.some((c) => c.id === s));
  });
  const [ageBracket, setAgeBracket] = useState<AgeBracket>(initialAgeBracket || '25-34');
  const [minutes, setMinutes] = useState<5 | 10 | 15 | 20>(
    initialMinutes === 5 || initialMinutes === 15 || initialMinutes === 20 ? initialMinutes : 10
  );

  const toggleGoal = (id: string) => {
    sound.tap();
    if (id === 'full_stack') {
      setSelectedGoals((prev) =>
        prev.includes('full_stack') ? [] : [...INDIVIDUAL_GOAL_IDS, 'full_stack']
      );
      return;
    }
    setSelectedGoals((prev) => {
      const individuals = prev.filter((x) => x !== 'full_stack');
      const nextIndividuals = individuals.includes(id)
        ? individuals.filter((x) => x !== id)
        : [...individuals, id];
      const allSixSelected = INDIVIDUAL_GOAL_IDS.every((g) => nextIndividuals.includes(g));
      return allSixSelected ? [...nextIndividuals, 'full_stack'] : nextIndividuals;
    });
  };

  const toggleBottleneck = (id: string) => {
    sound.tap();
    setBottlenecks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleApplicationContext = (id: string) => {
    sound.tap();
    setApplicationContexts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedDomains = useMemo<DomainKey[]>(() => {
    const set = new Set<DomainKey>();
    for (const gid of selectedGoals) {
      const opt = TARGET_OPTIONS.find((o) => o.id === gid);
      opt?.domains.forEach((d) => set.add(d));
    }
    return Array.from(set);
  }, [selectedGoals]);

  const bottleneckDomains = useMemo<DomainKey[]>(() => {
    const set = new Set<DomainKey>();
    for (const bid of bottlenecks) {
      const sc = BOTTLENECK_SCENARIOS.find((b) => b.id === bid);
      sc?.domains.forEach((d) => set.add(d));
    }
    return Array.from(set);
  }, [bottlenecks]);

  const effectiveDomains = useMemo<DomainKey[]>(
    () => (selectedDomains.length > 0 ? selectedDomains : DOMAIN_LIST.map((d) => d.key)),
    [selectedDomains]
  );

  const calibrationDomains = useMemo(
    () => getCalibrationDomains(effectiveDomains, bottlenecks),
    [effectiveDomains, bottlenecks]
  );

  const telemetryLine = useMemo(() => {
    if (step === 1) {
      if (selectedGoals.length === 0) return 'Selecione ao menos um domínio cognitivo...';
      if (selectedGoals.includes('full_stack')) {
        return 'Protocolo completo: todos os 6 domínios incluídos';
      }
      const tags = selectedGoals
        .map((id) => TARGET_OPTIONS.find((o) => o.id === id)?.telemetryTag)
        .filter(Boolean)
        .slice(0, 2);
      const extra = selectedGoals.length > 2 ? ` + ${selectedGoals.length - 2}` : '';
      return `Mapeado: ${tags.join(' + ')}${extra}`;
    }
    if (step === 2) {
      if (bottlenecks.length === 0) return 'Nenhum gargalo marcado — calibração em linha neutra.';
      const domNames = bottleneckDomains.map((d) => DOMAIN_MAP[d].shortName);
      return `Gargalos registrados para o Dossiê: ${domNames.join(' + ')}`;
    }
    if (step === 3) {
      const info = STAMINA_LEVELS[stamina] ?? STAMINA_LEVELS[3];
      return `Pico: ${peakTime} · Resistência ${stamina}/5 → ${info.curveNote}`;
    }
    if (step === 4) {
      if (applicationContexts.length === 0) return 'Selecione ao menos um contexto de aplicação...';
      const tags = applicationContexts
        .map((id) => APPLICATION_CONTEXTS.find((c) => c.id === id)?.tag)
        .filter(Boolean);
      return `Contextos (${tags.length}): ${tags.slice(0, 2).join(' + ')}${tags.length > 2 ? ` + ${tags.length - 2}` : ''}`;
    }
    if (step === 5) {
      return `Referência normativa ajustada para a faixa ${getAgeBracketMeta(ageBracket).label}`;
    }
    if (step === 6) {
      const load = DAILY_LOAD_OPTIONS.find((d) => d.minutes === minutes);
      return `Carga diária: ${load?.telemetryTag ?? '3 exercícios/dia'}`;
    }
    return 'Protocolo preliminar pronto para avaliação inicial.';
  }, [step, selectedGoals, bottlenecks, bottleneckDomains, peakTime, stamina, applicationContexts, ageBracket, minutes]);

  const numericStep = step === 'summary' ? 6 : step;

  const goBack = () => {
    sound.tap();
    if (step === 'summary') setStep(6);
    else if (step > 1) setStep((step - 1) as StepKey);
  };

  const handleConfirmProtocol = (startNow: boolean) => {
    sound.hit(3);
    onComplete({
      goals: selectedGoals,
      selected_domains: effectiveDomains,
      daily_goal_minutes: minutes,
      peak_time: peakTime,
      bottlenecks,
      bottleneck_domains: bottleneckDomains,
      mental_stamina_baseline: stamina,
      application_context: applicationContexts.join(' • '),
      application_contexts: applicationContexts,
      age_bracket: ageBracket,
      startCalibrationNow: startNow,
    });
  };

  const staminaInfo = STAMINA_LEVELS[stamina] ?? STAMINA_LEVELS[3];
  const dailyTaskCount = getDailyGamesCount(minutes);

  return (
    <div className="flex flex-col gap-5 py-1 animate-pop">
      {/* Cabeçalho + barra segmentada de 6 etapas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {step !== 1 && (
              <button
                type="button"
                onClick={goBack}
                className="w-9 h-9 rounded-xl flex items-center justify-center btn-soft cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft size={17} />
              </button>
            )}
            <span className="text-xs font-bold tracking-wide tabular" style={{ color: 'var(--accent)' }}>
              {step === 'summary' ? 'Síntese do Protocolo' : `Anamnese Cognitiva · Etapa ${step}/6`}
            </span>
          </div>

          <span className="text-xs font-bold tabular" style={{ color: 'var(--text-soft)' }}>
            {step === 'summary' ? '100%' : `${Math.round((numericStep / 6) * 100)}%`}
          </span>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const done = step === 'summary' || n <= numericStep;
            return (
              <div
                key={n}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  background: done ? 'var(--accent-grad)' : 'var(--bg-subtle)',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ETAPA 1: OBJETIVOS COGNITIVOS */}
      {step === 1 && (
        <div className="flex flex-col gap-4 animate-pop">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: 'var(--accent)' }}>
              <Target size={14} />
              <span>Etapa 1 · Objetivos Cognitivos</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight leading-snug">
              Quais capacidades executivas você deseja priorizar?
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {TARGET_OPTIONS.map((opt) => {
              const active = selectedGoals.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleGoal(opt.id)}
                  className="surface-card surface-card-click px-4 py-4 flex items-start justify-between gap-3.5 text-left cursor-pointer"
                  style={
                    active
                      ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' }
                      : undefined
                  }
                >
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold leading-snug">{opt.title}</div>
                    <div className="text-xs sm:text-sm mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {opt.desc}
                    </div>
                  </div>
                  <span
                    className="w-6 h-6 mt-0.5 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg-subtle)',
                      color: '#FFFFFF',
                    }}
                  >
                    {active && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={selectedGoals.length === 0}
            onClick={() => {
              sound.hit(1);
              setStep(2);
            }}
            className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <span>Continuar ({selectedDomains.length} {selectedDomains.length === 1 ? 'domínio' : 'domínios'})</span>
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      {/* ETAPA 2: GARGALOS REAIS */}
      {step === 2 && (
        <div className="flex flex-col gap-4 animate-pop">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: 'var(--warn)' }}>
              <ShieldAlert size={14} />
              <span>Etapa 2 · Gargalos Reais</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight leading-snug">
              Onde você percebe maior queda de rendimento no dia a dia?
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {BOTTLENECK_SCENARIOS.map((sc) => {
              const active = bottlenecks.includes(sc.id);
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => toggleBottleneck(sc.id)}
                  className="surface-card surface-card-click px-4 py-4 flex items-start justify-between gap-3.5 text-left cursor-pointer"
                  style={
                    active
                      ? { borderColor: 'var(--warn)', background: 'rgba(245, 158, 11, 0.10)' }
                      : undefined
                  }
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-relaxed">"{sc.text}"</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sc.domains.map((dk) => (
                        <span
                          key={dk}
                          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                          style={{
                            background: `${DOMAIN_MAP[dk].color}18`,
                            color: DOMAIN_MAP[dk].color,
                          }}
                        >
                          {DOMAIN_MAP[dk].shortName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className="w-6 h-6 mt-0.5 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: active ? 'var(--warn)' : 'var(--bg-subtle)',
                      color: '#FFFFFF',
                    }}
                  >
                    {active && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              sound.hit(2);
              setStep(3);
            }}
            className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{bottlenecks.length > 0 ? 'Continuar com gargalos mapeados' : 'Seguir sem gargalos específicos'}</span>
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      {/* ETAPA 3: RITMO CIRCADIANO & RESISTÊNCIA BASAL */}
      {step === 3 && (
        <div className="flex flex-col gap-5 animate-pop">
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--accent)' }}>
              <Clock size={14} />
              <span>Etapa 3 · Ritmo Circadiano</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight leading-snug">
              Qual é a sua janela natural de maior clareza mental?
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {PEAK_WINDOWS.map((w) => {
                const active = peakTime === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      sound.tap();
                      setPeakTime(w.id);
                    }}
                    className="surface-card surface-card-click py-4 px-4 text-left cursor-pointer"
                    style={
                      active
                        ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' }
                        : undefined
                    }
                  >
                    <div className="text-[16px] font-bold">{w.label}</div>
                    <div className="text-xs font-medium tabular mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {w.range}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="surface-card p-5 flex flex-col gap-3.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--ok)' }}>
              <Gauge size={14} />
              <span>Resistência à Fadiga Mental</span>
            </div>
            <h3 className="text-sm font-bold leading-snug">
              Como você avalia sua sustentação de foco após 45 minutos de esforço intelectual contínuo?
            </h3>

            <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
              Nível {stamina}/5 — {staminaInfo.title}
            </div>

            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={stamina}
              onChange={(e) => {
                sound.tap();
                setStamina(Number(e.target.value));
              }}
              style={{ accentColor: 'var(--accent)' }}
              className="w-full cursor-pointer"
            />

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    sound.tap();
                    setStamina(lvl);
                  }}
                  className="py-2.5 rounded-xl text-sm font-bold tabular cursor-pointer transition-all"
                  style={{
                    background: stamina === lvl ? 'var(--accent-glow)' : 'var(--bg-subtle)',
                    border: stamina === lvl ? '1.5px solid var(--accent)' : '1px solid transparent',
                    color: stamina === lvl ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-soft)' }}>
              <span>1 · Exaustão rápida</span>
              <span>5 · Alta resistência</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.hit(2);
              setStep(4);
            }}
            className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Continuar</span>
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      {/* ETAPA 4: CONTEXTO DE APLICAÇÃO */}
      {step === 4 && (
        <div className="flex flex-col gap-4 animate-pop">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: 'var(--accent)' }}>
              <Brain size={14} />
              <span>Etapa 4 · Contexto de Aplicação</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight leading-snug">
              Onde você pretende aplicar os ganhos do treinamento?
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {APPLICATION_CONTEXTS.map((ctx) => {
              const active = applicationContexts.includes(ctx.id);
              return (
                <button
                  key={ctx.id}
                  type="button"
                  onClick={() => toggleApplicationContext(ctx.id)}
                  className="surface-card surface-card-click px-4 py-4 flex items-center justify-between gap-3.5 text-left cursor-pointer"
                  style={
                    active
                      ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' }
                      : undefined
                  }
                >
                  <div>
                    <div className="text-[15px] font-bold leading-snug">{ctx.id}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {ctx.tag}
                    </div>
                  </div>
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg-subtle)',
                      color: '#FFFFFF',
                    }}
                  >
                    {active && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={applicationContexts.length === 0}
            onClick={() => {
              sound.hit(2);
              setStep(5);
            }}
            className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <span>Continuar ({applicationContexts.length})</span>
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      {/* ETAPA 5: FAIXA ETÁRIA */}
      {step === 5 && (
        <div className="flex flex-col gap-4 animate-pop">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: 'var(--accent)' }}>
              <Calendar size={14} />
              <span>Etapa 5 · Faixa Etária</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight leading-snug">
              Qual é a sua faixa etária?
            </h2>
            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Utilizada exclusivamente para calibrar seus percentis e a média normativa do seu Dossiê.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {AGE_BRACKET_OPTIONS.map((opt) => {
              const active = ageBracket === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    sound.tap();
                    setAgeBracket(opt.id);
                  }}
                  className="surface-card surface-card-click px-5 py-4 flex items-center justify-between gap-3 text-left cursor-pointer"
                  style={
                    active
                      ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' }
                      : undefined
                  }
                >
                  <span className="text-[16px] font-bold">{opt.label}</span>
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg-subtle)',
                      color: '#FFFFFF',
                    }}
                  >
                    {active && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              sound.hit(3);
              setStep(6);
            }}
            className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Definir meta diária</span>
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      {/* ETAPA 6: META DIÁRIA EM MINUTOS */}
      {step === 6 && (
        <div className="flex flex-col gap-4 animate-pop">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: 'var(--ok)' }}>
              <Activity size={14} />
              <span>Etapa 6 · Meta Diária</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight leading-snug">
              Quanto tempo você deseja dedicar ao protocolo diário?
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {DAILY_LOAD_OPTIONS.map((opt) => {
              const active = minutes === opt.minutes;
              return (
                <button
                  key={opt.minutes}
                  type="button"
                  onClick={() => {
                    sound.tap();
                    setMinutes(opt.minutes);
                  }}
                  className="surface-card surface-card-click px-5 py-4 flex items-center justify-between gap-3.5 text-left cursor-pointer"
                  style={
                    active
                      ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' }
                      : undefined
                  }
                >
                  <div>
                    <div className="text-[16px] font-bold">
                      {opt.label} · {opt.protocolName}
                    </div>
                    <div className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      {opt.detail}
                    </div>
                  </div>
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg-subtle)',
                      color: '#FFFFFF',
                    }}
                  >
                    {active && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              sound.hit(3);
              setStep('summary');
            }}
            className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Gerar Protocolo Preliminar</span>
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      {/* TELA FINAL: PROTOCOLO PRELIMINAR GERADO */}
      {step === 'summary' && (
        <div className="flex flex-col gap-4 animate-pop">
          <div className="surface-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
                style={{
                  background: 'var(--accent-glow)',
                  color: 'var(--accent)',
                }}
              >
                <Cpu size={14} />
                <span>Protocolo Configurado</span>
              </span>
              <span className="text-xs font-bold tabular" style={{ color: 'var(--ok)' }}>
                Nível Inicial 1
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
                Domínios Selecionados ({effectiveDomains.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {effectiveDomains.map((dk) => {
                  const d = DOMAIN_MAP[dk];
                  const isBottleneck = bottleneckDomains.includes(dk);
                  return (
                    <span
                      key={dk}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: `${d.color}18`,
                        color: d.color,
                        border: isBottleneck ? `1px solid ${d.color}` : '1px solid transparent',
                      }}
                    >
                      <span>{d.shortName}</span>
                      {isBottleneck && <span className="opacity-90">· Foco</span>}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl p-3" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                  Faixa
                </div>
                <div className="text-sm font-bold tabular mt-0.5">
                  {getAgeBracketMeta(ageBracket).label.replace(' anos', '')}
                </div>
              </div>
              <div className="rounded-2xl p-3" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                  Pico Mental
                </div>
                <div className="text-sm font-bold mt-0.5 truncate">
                  {peakTime.split(' ')[0]}
                </div>
              </div>
              <div className="rounded-2xl p-3" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                  Meta Diária
                </div>
                <div className="text-sm font-bold tabular mt-0.5">
                  {minutes} min ({dailyTaskCount}x)
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-soft)' }}>
                Avaliação de Linha de Base ({calibrationDomains.length} exercícios · Nível 1)
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {calibrationDomains.map((dk, idx) => {
                  const dom = DOMAIN_MAP[dk];
                  const game = GAME_MAP[dom.calibrationGame];
                  return (
                    <div
                      key={dk}
                      className="rounded-2xl p-3 flex items-center gap-2.5"
                      style={{ background: 'var(--bg-subtle)' }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${dom.color}18`, color: dom.color }}
                      >
                        <GameIcon slug={game.slug} size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {idx + 1}. {game.name}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-soft)' }}>
                          {dom.shortName}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleConfirmProtocol(true)}
            className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer flex items-center justify-center gap-2.5"
          >
            <Play size={18} fill="currentColor" />
            <span>Iniciar Avaliação Inicial</span>
          </button>

          <button
            type="button"
            onClick={() => handleConfirmProtocol(false)}
            className="mx-auto py-2 px-4 text-xs font-semibold cursor-pointer"
            style={{ color: 'var(--text-soft)' }}
          >
            Revisar bateria antes de começar
          </button>
        </div>
      )}

      {/* Micro-feedback técnico */}
      {step !== 'summary' && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: 'var(--ok)' }}
          />
          <span className="leading-snug">{telemetryLine}</span>
        </div>
      )}
    </div>
  );
}

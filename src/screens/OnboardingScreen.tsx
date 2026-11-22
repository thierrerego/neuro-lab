import { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { sound } from '../lib/audio';

interface QuestionItem {
  key: string;
  title: string;
  opts: { value: string; label: string }[];
}

const QUESTIONS: QuestionItem[] = [
  {
    key: 'goal',
    title: 'Qual seu objetivo principal?',
    opts: [
      { value: 'attention', label: 'Atenção e foco' },
      { value: 'memory', label: 'Memória no dia a dia' },
      { value: 'reasoning', label: 'Raciocínio lógico' },
      { value: 'speed_math', label: 'Agilidade e cálculo' },
    ],
  },
  {
    key: 'pain',
    title: 'Onde sente mais dificuldade?',
    opts: [
      { value: 'distraction', label: 'Distração fácil' },
      { value: 'forgetting', label: 'Esquecer tarefas' },
      { value: 'slowness', label: 'Lentidão mental' },
      { value: 'impulse', label: 'Agir por impulso' },
    ],
  },
  {
    key: 'sleep',
    title: 'Como anda seu sono?',
    opts: [
      { value: 'good', label: 'Bom (7–8h)' },
      { value: 'regular', label: 'Regular (~6h)' },
      { value: 'short', label: 'Curto ou irregular' },
    ],
  },
  {
    key: 'peak',
    title: 'Horário de maior pico mental?',
    opts: [
      { value: 'Manhã', label: 'Manhã' },
      { value: 'Tarde', label: 'Tarde' },
      { value: 'Noite', label: 'Noite' },
      { value: 'Varia', label: 'Varia todo dia' },
    ],
  },
  {
    key: 'minutes',
    title: 'Tempo disponível por dia?',
    opts: [
      { value: '5 min', label: '5 min' },
      { value: '10 min', label: '10 min' },
      { value: '15+ min', label: '15+ min' },
    ],
  },
  {
    key: 'pressure',
    title: 'Onde trava mais sob pressão?',
    opts: [
      { value: 'decisions', label: 'Decisões rápidas' },
      { value: 'math', label: 'Contas de cabeça' },
      { value: 'sustained', label: 'Manter foco longo' },
      { value: 'sequence', label: 'Lembrar sequência' },
    ],
  },
];

interface OnboardingScreenProps {
  initialAnswers?: Record<string, string>;
  onComplete: (answers: Record<string, string>) => void;
}

export function OnboardingScreen({ initialAnswers = {}, onComplete }: OnboardingScreenProps) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const q = QUESTIONS[idx];

  const pick = (val: string) => {
    sound.hit(idx + 1);
    const next = { ...answers, [q.key]: val };
    setAnswers(next);
    if (idx + 1 >= QUESTIONS.length) {
      onComplete(next);
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <div className="flex flex-col gap-5 py-2 animate-pop">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {idx > 0 && (
            <button
              onClick={() => setIdx(idx - 1)}
              className="w-8 h-8 rounded-xl flex items-center justify-center btn-soft cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft size={15} />
            </button>
          )}
          <span className="text-xs font-extrabold tabular" style={{ color: 'var(--accent)' }}>
            {idx + 1} / {QUESTIONS.length}
          </span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
          Perfil
        </span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((idx + 1) / QUESTIONS.length) * 100}%`, background: 'var(--accent-grad)' }}
        />
      </div>

      <h2 className="text-2xl font-black tracking-tight mt-1">{q.title}</h2>

      <div className="flex flex-col gap-2.5">
        {q.opts.map((opt) => {
          const selected = answers[q.key] === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => pick(opt.value)}
              className="surface-card surface-card-click px-4 py-4 flex items-center justify-between font-bold text-base cursor-pointer text-left"
              style={selected ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' } : undefined}
            >
              <span>{opt.label}</span>
              <ChevronRight size={18} style={{ color: selected ? 'var(--accent)' : 'var(--text-soft)' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

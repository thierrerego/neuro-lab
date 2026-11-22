import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ThemeMode } from '../types/cognitive';
import { sound } from '../lib/audio';

const QUESTIONS = [
  { key: 'goal', title: 'Foco principal', opts: ['Atenção', 'Memória', 'Velocidade', 'Raciocínio'] },
  { key: 'period', title: 'Melhor horário', opts: ['Manhã', 'Tarde', 'Noite', 'Qualquer'] },
  { key: 'minutes', title: 'Tempo por dia', opts: ['5 min', '10 min', '15 min'] },
  { key: 'pace', title: 'Ritmo inicial', opts: ['Leve', 'Equilibrado', 'Intenso'] },
  { key: 'style', title: 'Estilo visual', opts: ['Gamificado', 'Minimalista'] },
  { key: 'exp', title: 'Experiência prévia', opts: ['Iniciante', 'Já treinei', 'Avançado'] },
];

interface OnboardingScreenProps {
  onThemePreview: (theme: ThemeMode) => void;
  onComplete: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

export function OnboardingScreen({ onThemePreview, onComplete, onSkip }: OnboardingScreenProps) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const q = QUESTIONS[idx];

  const pick = (opt: string) => {
    sound.hit(idx + 1);
    if (q.key === 'style') {
      onThemePreview(opt === 'Gamificado' ? 'gamified' : 'minimal');
    }
    const next = { ...answers, [q.key]: opt };
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
        <span className="text-xs font-extrabold tabular" style={{ color: 'var(--accent)' }}>
          {idx + 1} / {QUESTIONS.length}
        </span>
        <button onClick={onSkip} className="text-xs font-bold cursor-pointer" style={{ color: 'var(--text-soft)' }}>
          Pular
        </button>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((idx + 1) / QUESTIONS.length) * 100}%`, background: 'var(--accent-grad)' }}
        />
      </div>

      <h2 className="text-2xl font-black tracking-tight mt-2">{q.title}</h2>

      <div className="flex flex-col gap-2.5">
        {q.opts.map((opt) => (
          <button
            key={opt}
            onClick={() => pick(opt)}
            className="surface-card surface-card-click px-4 py-4 flex items-center justify-between font-bold text-base cursor-pointer"
          >
            <span>{opt}</span>
            <ChevronRight size={18} style={{ color: 'var(--text-soft)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

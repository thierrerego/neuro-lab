import { LogOut, RefreshCw, Sparkles, Target } from 'lucide-react';
import type { AppDataState } from '../lib/dataService';
import type { PlanTier, ThemeMode } from '../types/cognitive';

interface ProfileScreenProps {
  data: AppDataState;
  backendOnline: boolean;
  onChangeTheme: (theme: ThemeMode) => void;
  onChangePlan: (plan: PlanTier) => void;
  onRedoOnboarding: () => void;
  onOpenCalibration: () => void;
  onLogout: () => void;
}

export function ProfileScreen({
  data,
  backendOnline,
  onChangeTheme,
  onChangePlan,
  onRedoOnboarding,
  onOpenCalibration,
  onLogout,
}: ProfileScreenProps) {
  const { profile } = data;

  return (
    <div className="flex flex-col gap-4 animate-pop">
      <div className="surface-card p-4 flex items-center gap-3.5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl text-white"
          style={{ background: 'var(--accent-grad)' }}
        >
          {profile.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-extrabold truncate">{profile.name}</div>
          <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
            {profile.isLocalGuest ? 'Sessão local' : profile.email}
          </div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase"
          style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
        >
          {profile.plan_tier}
        </span>
      </div>

      {/* Dual-Theme */}
      <div className="surface-card p-4 flex flex-col gap-2.5">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Tema
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onChangeTheme('gamified')}
            className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${profile.theme_preference === 'gamified' ? 'btn-accent' : 'btn-soft'}`}
          >
            <Sparkles size={15} /> Gamificado
          </button>
          <button
            onClick={() => onChangeTheme('minimal')}
            className={`py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${profile.theme_preference === 'minimal' ? 'btn-accent' : 'btn-soft'}`}
          >
            <Target size={15} /> Minimalista
          </button>
        </div>
      </div>

      {/* Plan tier preparado para monetização */}
      <div className="surface-card p-4 flex flex-col gap-2.5">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Plano
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['free', 'pro', 'elite'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => onChangePlan(tier)}
              className={`py-2.5 rounded-xl font-extrabold text-xs uppercase cursor-pointer ${profile.plan_tier === tier ? 'btn-accent' : 'btn-soft'}`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="surface-card p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold pb-2 mb-1" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <span>Back-end</span>
          <span style={{ color: backendOnline ? 'var(--ok)' : 'var(--warn)' }}>
            {backendOnline ? 'Docker / Supabase' : 'Local (Navegador)'}
          </span>
        </div>

        <button onClick={onOpenCalibration} className="w-full py-3 rounded-xl font-bold text-xs btn-soft flex items-center justify-center gap-2 cursor-pointer">
          <RefreshCw size={14} /> Calibração (Baseline)
        </button>
        <button onClick={onRedoOnboarding} className="w-full py-3 rounded-xl font-bold text-xs btn-soft cursor-pointer">
          Anamnese (6 perguntas)
        </button>
        <button
          onClick={onLogout}
          className="w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--err)' }}
        >
          <LogOut size={14} /> Sair
        </button>
      </div>
    </div>
  );
}

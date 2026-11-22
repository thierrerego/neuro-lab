import { Award, LogOut, RefreshCw, Sparkles, Target } from 'lucide-react';
import type { AppDataState } from '../lib/dataService';
import { getCognitiveTier } from '../engine/psychometricEngine';
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
  const tier = getCognitiveTier(profile.global_cognitive_index);

  return (
    <div className="flex flex-col gap-4 animate-pop">
      {/* Cartão do usuário + Patente Cognitiva */}
      <div className="surface-card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl text-white"
            style={{ background: 'var(--accent-grad)' }}
          >
            {profile.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-extrabold truncate">{profile.name}</div>
            <div className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: tier.accentColor }}>
              <Award size={13} />
              <span>{profile.current_title || tier.title}</span>
            </div>
          </div>
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase"
            style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
          >
            {profile.plan_tier}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-center">
            <div className="text-sm font-black tabular">{profile.daily_goal_minutes}m</div>
            <div className="text-[10px] font-semibold" style={{ color: 'var(--text-soft)' }}>Meta/dia</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-black tabular">{profile.selected_domains.length || 6}</div>
            <div className="text-[10px] font-semibold" style={{ color: 'var(--text-soft)' }}>Áreas</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-black">{profile.peak_time || '—'}</div>
            <div className="text-[10px] font-semibold" style={{ color: 'var(--text-soft)' }}>Pico</div>
          </div>
        </div>
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

      {/* Plan tier */}
      <div className="surface-card p-4 flex flex-col gap-2.5">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Plano
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['free', 'pro', 'elite'] as const).map((tierKey) => (
            <button
              key={tierKey}
              onClick={() => onChangePlan(tierKey)}
              className={`py-2.5 rounded-xl font-extrabold text-xs uppercase cursor-pointer ${profile.plan_tier === tierKey ? 'btn-accent' : 'btn-soft'}`}
            >
              {tierKey}
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
          <RefreshCw size={14} /> Calibração
        </button>
        <button onClick={onRedoOnboarding} className="w-full py-3 rounded-xl font-bold text-xs btn-soft cursor-pointer">
          Refazer Onboarding (metas e rotina)
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

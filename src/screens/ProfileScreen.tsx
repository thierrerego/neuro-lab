import { ArrowLeft, LogOut, Moon, RefreshCw, SlidersHorizontal, Sun } from 'lucide-react';
import type { AppDataState } from '../lib/dataService';
import { getAgeBracketMeta, scoreToPercent } from '../engine/psychometricEngine';
import type { ThemeMode } from '../types/cognitive';

interface ProfileScreenProps {
  data: AppDataState;
  backendOnline: boolean;
  onChangeTheme: (theme: ThemeMode) => void;
  onRedoOnboarding: () => void;
  onOpenCalibration: () => void;
  onClose: () => void;
  onLogout: () => void;
}

export function ProfileScreen({
  data,
  backendOnline,
  onChangeTheme,
  onRedoOnboarding,
  onOpenCalibration,
  onClose,
  onLogout,
}: ProfileScreenProps) {
  const { profile } = data;

  return (
    <div className="flex flex-col gap-4 animate-pop">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center btn-soft cursor-pointer"
          title="Voltar"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-sm font-bold leading-tight">Preferências & Conta</h1>
          <p className="text-[11px]" style={{ color: 'var(--text-soft)' }}>
            Configurações do protocolo pessoal
          </p>
        </div>
      </div>

      {/* Resumo enxuto do perfil */}
      <div className="surface-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{profile.name}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
              {profile.isLocalGuest ? 'Sessão local neste aparelho' : profile.email || 'Conta sincronizada'}
            </div>
          </div>
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold tabular"
            style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
          >
            ICG {scoreToPercent(profile.global_cognitive_index)}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-center">
            <div className="text-sm font-bold tabular">{profile.daily_goal_minutes} min</div>
            <div className="text-[10px]" style={{ color: 'var(--text-soft)' }}>Meta diária</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold tabular">{profile.current_streak}d</div>
            <div className="text-[10px]" style={{ color: 'var(--text-soft)' }}>Consistência</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold">{getAgeBracketMeta(profile.age_bracket).label.replace(' anos', '')}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-soft)' }}>Faixa etária</div>
          </div>
        </div>
      </div>

      {/* Aparência: Modo Escuro / Modo Claro */}
      <div className="surface-card p-4 flex flex-col gap-2.5">
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Aparência
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChangeTheme('dark')}
            className={`py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
              profile.theme_preference === 'dark' ? 'btn-accent' : 'btn-soft'
            }`}
          >
            <Moon size={14} /> Modo Escuro
          </button>
          <button
            type="button"
            onClick={() => onChangeTheme('light')}
            className={`py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
              profile.theme_preference === 'light' ? 'btn-accent' : 'btn-soft'
            }`}
          >
            <Sun size={14} /> Modo Claro
          </button>
        </div>
      </div>

      {/* Protocolo e sincronização */}
      <div className="surface-card p-4 flex flex-col gap-2">
        <div
          className="flex items-center justify-between text-xs font-medium pb-2.5 mb-1"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>Armazenamento</span>
          <span style={{ color: backendOnline ? 'var(--ok)' : 'var(--warn)' }}>
            {backendOnline ? 'Supabase Local' : 'Local (Navegador)'}
          </span>
        </div>

        <button
          type="button"
          onClick={onRedoOnboarding}
          className="w-full py-2.5 rounded-xl font-semibold text-xs btn-soft flex items-center justify-center gap-2 cursor-pointer"
        >
          <SlidersHorizontal size={13} /> Ajustar anamnese, faixa etária e meta diária
        </button>

        <button
          type="button"
          onClick={onOpenCalibration}
          className="w-full py-2.5 rounded-xl font-semibold text-xs btn-soft flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw size={13} /> {profile.calibration_skipped ? 'Fazer avaliação inicial' : 'Refazer avaliação de linha de base'}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer mt-1"
          style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--err)' }}
        >
          <LogOut size={13} /> Sair da conta
        </button>
      </div>
    </div>
  );
}

import { ArrowLeft, LogOut, Moon, RefreshCw, Shield, SlidersHorizontal, Sun } from 'lucide-react';
import type { AppDataState } from '../lib/dataService';
import { getAgeBracketMeta, scoreToPercent } from '../engine/psychometricEngine';
import type { ThemeMode } from '../types/cognitive';

interface ProfileScreenProps {
  data: AppDataState;
  backendOnline: boolean;
  isAdminSession?: boolean;
  onOpenAdmin?: () => void;
  onChangeTheme: (theme: ThemeMode) => void;
  onRedoOnboarding: () => void;
  onOpenCalibration: () => void;
  onClose: () => void;
  onLogout: () => void;
}

export function ProfileScreen({
  data,
  backendOnline,
  isAdminSession = false,
  onOpenAdmin,
  onChangeTheme,
  onRedoOnboarding,
  onOpenCalibration,
  onClose,
  onLogout,
}: ProfileScreenProps) {
  const { profile } = data;

  return (
    <div className="flex flex-col gap-5 animate-pop">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-2xl flex items-center justify-center btn-soft cursor-pointer shrink-0"
          title="Voltar"
        >
          <ArrowLeft size={19} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight leading-tight">Preferências & Conta</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Configurações do seu protocolo pessoal
          </p>
        </div>
      </div>

      {/* Resumo suave do perfil */}
      <div className="surface-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-extrabold truncate">{profile.name}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {profile.isLocalGuest ? 'Sessão local neste aparelho' : profile.email || 'Conta sincronizada'}
            </div>
          </div>
          <span
            className="px-3 py-1.5 rounded-full text-xs font-bold tabular shrink-0"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
          >
            ICG {scoreToPercent(profile.global_cognitive_index)}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'var(--bg-subtle)' }}>
            <div className="text-base font-extrabold tabular">{profile.daily_goal_minutes} min</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Meta diária</div>
          </div>
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'var(--bg-subtle)' }}>
            <div className="text-base font-extrabold tabular">{profile.current_streak}d</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Sequência</div>
          </div>
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'var(--bg-subtle)' }}>
            <div className="text-base font-extrabold">
              {getAgeBracketMeta(profile.age_bracket).label.replace(' anos', '')}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Faixa</div>
          </div>
        </div>
      </div>

      {/* Aparência: Claro Suave / Escuro Aconchegante */}
      <div className="surface-card p-5 flex flex-col gap-3">
        <div className="text-sm font-bold">Aparência</div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onChangeTheme('light')}
            className={`min-h-[48px] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${
              profile.theme_preference === 'light' ? 'btn-accent' : 'btn-soft'
            }`}
          >
            <Sun size={17} /> Claro Suave
          </button>
          <button
            type="button"
            onClick={() => onChangeTheme('dark')}
            className={`min-h-[48px] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer ${
              profile.theme_preference === 'dark' ? 'btn-accent' : 'btn-soft'
            }`}
          >
            <Moon size={17} /> Escuro Noturno
          </button>
        </div>
      </div>

      {/* Protocolo e sincronização */}
      <div className="surface-card p-5 flex flex-col gap-3">
        <div
          className="flex items-center justify-between text-sm font-medium pb-3.5"
          style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>Armazenamento</span>
          <span
            className="font-bold"
            style={{ color: profile.isLocalGuest ? 'var(--ok)' : backendOnline ? 'var(--ok)' : 'var(--warn)' }}
          >
            {profile.isLocalGuest ? 'Base Local (0 Supabase)' : backendOnline ? 'Supabase Local' : 'Local'}
          </span>
        </div>

        {isAdminSession && onOpenAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="w-full min-h-[50px] py-3.5 px-4 rounded-2xl font-bold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shield size={16} /> Abrir Painel ADM (Trocar usuário)
          </button>
        )}

        <button
          type="button"
          onClick={onRedoOnboarding}
          className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl font-semibold text-sm btn-soft flex items-center justify-center gap-2 cursor-pointer"
        >
          <SlidersHorizontal size={16} /> Ajustar anamnese, faixa e meta diária
        </button>

        <button
          type="button"
          onClick={onOpenCalibration}
          className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl font-semibold text-sm btn-soft flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw size={16} />{' '}
          {profile.calibration_skipped ? 'Fazer avaliação inicial' : 'Refazer avaliação de linha de base'}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer mt-1"
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--err)' }}
        >
          <LogOut size={16} /> Sair da conta
        </button>
      </div>
    </div>
  );
}

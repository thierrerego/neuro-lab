import type { ReactNode } from 'react';
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  FastForward,
  LayoutGrid,
  Moon,
  Shield,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react';
import type { ThemeMode } from '../types/cognitive';

export type TabKey = 'home' | 'catalog' | 'stats';

interface LayoutProps {
  activeTab: TabKey;
  onTab: (tab: TabKey) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSettings?: () => void;
  isAdminSession?: boolean;
  impersonatingUserName?: string | null;
  simulatedDayOffset?: number;
  simulatedDateLabel?: string;
  onNextDay?: () => void;
  onResetDay?: () => void;
  onOpenAdmin?: () => void;
  onReturnToAdmin?: () => void;
  showNav?: boolean;
  children: ReactNode;
}

export function Layout({
  activeTab,
  onTab,
  theme,
  onToggleTheme,
  onOpenSettings,
  isAdminSession = false,
  impersonatingUserName = null,
  simulatedDayOffset = 0,
  simulatedDateLabel,
  onNextDay,
  onResetDay,
  onOpenAdmin,
  onReturnToAdmin,
  showNav = true,
  children,
}: LayoutProps) {
  const showAdminStrip = isAdminSession && (Boolean(impersonatingUserName) || simulatedDayOffset > 0);

  return (
    <div className="min-h-screen flex justify-center">
      <div
        className="w-full max-w-[480px] min-h-screen flex flex-col relative sm:border-x sm:shadow-xl"
        style={{
          background: 'var(--bg-elev)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Cabeçalho espaçoso e suave */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 backdrop-blur-xl"
          style={{
            background: 'color-mix(in srgb, var(--bg-elev) 88%, transparent)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-base shrink-0"
              style={{
                background: 'var(--accent-grad)',
                color: 'var(--btn-fg)',
                boxShadow: '0 4px 12px var(--accent-shadow)',
              }}
            >
              N
            </div>
            <span className="font-extrabold text-[17px] tracking-tight truncate">NeuroLab</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdminSession && onNextDay && (
              <button
                type="button"
                onClick={onNextDay}
                title="Avançar para o próximo dia (simulação ADM)"
                className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all"
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.24)',
                  color: 'var(--ok)',
                }}
              >
                <FastForward size={13} />
                <span>+1 dia</span>
              </button>
            )}

            {isAdminSession && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                title="Painel ADM · Trocar Usuário"
                className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all"
                style={{
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--accent)',
                }}
              >
                <Shield size={13} />
                <span>ADM</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              aria-label={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Preferências e Conta"
                aria-label="Preferências e Conta"
                className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <SlidersHorizontal size={18} />
              </button>
            )}
          </div>
        </header>

        {/* Faixa ADM suave: mostra conta ativa (impersonação) e/ou data simulada */}
        {showAdminStrip && (
          <div
            className="px-5 py-2.5 flex flex-col gap-2 text-xs"
            style={{
              background: 'var(--accent-glow)',
              borderBottom: '1px solid var(--border-strong)',
            }}
          >
            {impersonatingUserName && (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-semibold min-w-0 truncate">
                  <Users size={14} style={{ color: 'var(--accent)' }} className="shrink-0" />
                  <span className="truncate">
                    Conta ativa: <strong>{impersonatingUserName}</strong>
                  </span>
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenAdmin && (
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                      Trocar
                    </button>
                  )}
                  {onReturnToAdmin && (
                    <button
                      type="button"
                      onClick={onReturnToAdmin}
                      className="px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                      style={{ background: 'var(--accent)', color: 'var(--btn-fg)' }}
                    >
                      Voltar ADM
                    </button>
                  )}
                </div>
              </div>
            )}

            {simulatedDayOffset > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-semibold tabular">
                  <CalendarDays size={14} style={{ color: 'var(--ok)' }} />
                  <span>
                    Dia simulado: <strong>{simulatedDateLabel}</strong> (+{simulatedDayOffset}d)
                  </span>
                </span>

                {onResetDay && (
                  <button
                    type="button"
                    onClick={onResetDay}
                    className="px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    Voltar pra hoje
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Conteúdo */}
        <main className={`flex-1 px-5 pt-5 ${showNav ? 'pb-28' : 'pb-10'}`}>{children}</main>

        {/* Navegação inferior ergonômica (3 abas essenciais) */}
        {showNav && (
          <nav
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] grid grid-cols-3 gap-1.5 py-2.5 px-3 z-40 backdrop-blur-xl"
            style={{
              background: 'color-mix(in srgb, var(--bg-card) 92%, transparent)',
              borderTop: '1px solid var(--border)',
              boxShadow: '0 -4px 20px rgba(15, 23, 42, 0.04)',
            }}
          >
            {(
              [
                { id: 'home', label: 'Treino Diário', icon: CalendarCheck },
                { id: 'catalog', label: 'Explorar', icon: LayoutGrid },
                { id: 'stats', label: 'Dossiê', icon: BarChart3 },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTab(item.id)}
                  className="flex flex-col items-center justify-center gap-1 py-2 rounded-2xl cursor-pointer transition-all"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-soft)',
                    background: active ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
                  <span className="text-xs font-semibold tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

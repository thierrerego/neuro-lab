import type { ReactNode } from 'react';
import { BarChart3, CalendarCheck, LayoutGrid, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import type { ThemeMode } from '../types/cognitive';

export type TabKey = 'home' | 'catalog' | 'stats';

interface LayoutProps {
  activeTab: TabKey;
  onTab: (tab: TabKey) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSettings?: () => void;
  showNav?: boolean;
  children: ReactNode;
}

export function Layout({
  activeTab,
  onTab,
  theme,
  onToggleTheme,
  onOpenSettings,
  showNav = true,
  children,
}: LayoutProps) {
  return (
    <div className="min-h-screen flex justify-center">
      <div
        className="w-full max-w-[460px] min-h-screen flex flex-col relative"
        style={{
          background: 'var(--bg-elev)',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Cabeçalho Minimalista */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 backdrop-blur-md"
          style={{
            background: 'color-mix(in srgb, var(--bg-elev) 90%, transparent)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm"
              style={{ background: 'var(--accent-grad)', color: 'var(--btn-fg)' }}
            >
              N
            </div>
            <span className="font-bold text-[15px] tracking-tight">NeuroLab</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              aria-label={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Preferências e Conta"
                aria-label="Preferências e Conta"
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                <SlidersHorizontal size={15} />
              </button>
            )}
          </div>
        </header>

        {/* Conteúdo */}
        <main className={`flex-1 px-4 pt-4 ${showNav ? 'pb-24' : 'pb-8'}`}>{children}</main>

        {/* Navegação inferior enxuta (3 abas essenciais) */}
        {showNav && (
          <nav
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] grid grid-cols-3 py-2 px-2 z-40 backdrop-blur-md"
            style={{
              background: 'color-mix(in srgb, var(--bg-elev) 94%, transparent)',
              borderTop: '1px solid var(--border)',
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
                  className="flex flex-col items-center gap-1 py-1.5 rounded-xl cursor-pointer transition-colors"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-soft)',
                    background: active ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  <Icon size={19} strokeWidth={active ? 2.2 : 1.75} />
                  <span className="text-[11px] font-semibold tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

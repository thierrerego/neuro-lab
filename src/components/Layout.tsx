import type { ReactNode } from 'react';
import { BarChart3, Flame, Gamepad2, Home, Sparkles, Target, User } from 'lucide-react';
import type { ThemeMode } from '../types/cognitive';

export type TabKey = 'home' | 'catalog' | 'stats' | 'profile';

interface LayoutProps {
  activeTab: TabKey;
  onTab: (tab: TabKey) => void;
  streak: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  showNav?: boolean;
  children: ReactNode;
}

export function Layout({
  activeTab,
  onTab,
  streak,
  theme,
  onToggleTheme,
  showNav = true,
  children,
}: LayoutProps) {
  return (
    <div className="min-h-screen flex justify-center">
      <div
        className="w-full max-w-[460px] min-h-screen flex flex-col relative"
        style={{ background: 'var(--bg-elev)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}
      >
        {/* Header mínimo */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 backdrop-blur-md"
          style={{ background: 'color-mix(in srgb, var(--bg-elev) 88%, transparent)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-base text-white"
              style={{ background: 'var(--accent-grad)' }}
            >
              N
            </div>
            <span className="font-extrabold text-base tracking-tight">NeuroLab</span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tabular"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <Flame size={14} style={{ color: 'var(--warn)' }} />
              <span>{streak}</span>
            </div>
            <button
              onClick={onToggleTheme}
              title={theme === 'gamified' ? 'Mudar para Minimalista' : 'Mudar para Gamificado'}
              className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--accent)' }}
            >
              {theme === 'gamified' ? <Target size={16} /> : <Sparkles size={16} />}
            </button>
          </div>
        </header>

        {/* Conteúdo */}
        <main className={`flex-1 px-4 pt-4 ${showNav ? 'pb-24' : 'pb-8'}`}>{children}</main>

        {/* Navegação inferior (4 toques) */}
        {showNav && (
          <nav
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] grid grid-cols-4 py-2 px-2 z-40 backdrop-blur-md"
            style={{ background: 'color-mix(in srgb, var(--bg-elev) 92%, transparent)', borderTop: '1px solid var(--border)' }}
          >
            {(
              [
                { id: 'home', label: 'Início', icon: Home },
                { id: 'catalog', label: 'Jogos', icon: Gamepad2 },
                { id: 'stats', label: 'Evolução', icon: BarChart3 },
                { id: 'profile', label: 'Perfil', icon: User },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTab(item.id)}
                  className="flex flex-col items-center gap-1 py-1.5 rounded-xl cursor-pointer transition-colors"
                  style={{ color: active ? 'var(--accent)' : 'var(--text-soft)' }}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  <span className="text-[11px] font-semibold">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

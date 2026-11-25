import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Aviso "Nova versão disponível": aparece quando sai uma versão nova do app.
 * Só recarrega quando a pessoa toca em "Atualizar" (nunca interrompe uma partida).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Confere se saiu versão nova a cada 30 min enquanto o app está aberto
      if (registration) {
        window.setInterval(() => {
          void registration.update().catch(() => {});
        }, 30 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-4 z-[100] w-[calc(100%-32px)] max-w-[420px] surface-card px-4 py-3 flex items-center gap-3 animate-pop"
      style={{ borderColor: 'var(--border-strong)', boxShadow: 'var(--card-shadow)' }}
      role="status"
    >
      <RefreshCw size={18} style={{ color: 'var(--accent)' }} className="shrink-0" />
      <div className="text-sm font-semibold flex-1 min-w-0">Nova versão disponível</div>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="px-3.5 py-2 rounded-xl text-sm font-bold btn-accent cursor-pointer shrink-0"
      >
        Atualizar
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
        style={{ color: 'var(--text-soft)' }}
        title="Depois"
      >
        <X size={16} />
      </button>
    </div>
  );
}

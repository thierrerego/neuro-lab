import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Botão "Refazer teste inicial" com confirmação.
 * Zera só o progresso do teste (histórico, gráficos e fases continuam).
 */
export function ResetCalibrationButton({
  onConfirm,
  variant = 'button',
}: {
  onConfirm: () => void;
  variant?: 'button' | 'link';
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'button' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl font-semibold text-sm btn-soft flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw size={16} /> Refazer teste inicial
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mx-auto inline-flex items-center gap-1.5 py-2 px-3 text-xs font-semibold cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-soft)' }}
        >
          <RefreshCw size={13} /> Refazer teste inicial
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          style={{ background: 'rgba(15, 23, 42, 0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="surface-card w-full max-w-[380px] p-5 flex flex-col gap-4 animate-pop"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div>
              <div className="text-base font-extrabold tracking-tight">Refazer o teste inicial?</div>
              <p className="text-sm leading-relaxed mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Suas notas serão atualizadas quando terminar. Seu histórico de partidas, gráficos e
                fases continuam como estão.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 min-h-[46px] rounded-2xl font-semibold text-sm btn-soft cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
                className="flex-1 min-h-[46px] rounded-2xl font-bold text-sm btn-accent cursor-pointer"
              >
                Refazer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

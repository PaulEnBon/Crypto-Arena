import { IconAlert, IconCheck, IconClose, IconInfo } from '@/components/ui/icons';
import { useToast, type ToastType } from '@/context/ToastContext';

const STYLES: Record<ToastType, { box: string; icon: typeof IconInfo }> = {
  success: { box: 'border-gain-500/40 text-gain-300', icon: IconCheck },
  error: { box: 'border-loss-500/40 text-loss-300', icon: IconAlert },
  warning: { box: 'border-amber-500/40 text-amber-300', icon: IconAlert },
  info: { box: 'border-accent-500/40 text-accent-300', icon: IconInfo },
};

/** Fixed stack of notifications fed by the ToastContext. */
export function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const { box, icon: Icon } = STYLES[toast.type];
        return (
          <div
            key={toast.id}
            role="status"
            className={`card animate-toast-in pointer-events-auto flex items-start gap-3 border p-4 shadow-2xl ${box}`}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              {toast.title && <p className="font-semibold">{toast.title}</p>}
              <p className="text-ink-200">{toast.message}</p>
            </div>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Fermer la notification" className="text-ink-500 hover:text-ink-100">
              <IconClose size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

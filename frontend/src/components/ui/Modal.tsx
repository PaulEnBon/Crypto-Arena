import { useEffect, useId, type ReactNode } from 'react';

import { IconClose } from '@/components/ui/icons';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
}

/** Accessible dialog (Escape/backdrop close, body scroll lock). Content is provided through `children`. */
export function Modal({ open, onClose, title, children, footer, size = 'sm' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-arena-950/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`card relative w-full ${size === 'sm' ? 'max-w-md' : 'max-w-2xl'} animate-toast-in p-6 shadow-2xl`}
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1 text-ink-400 transition hover:bg-arena-700 hover:text-ink-100"
          >
            <IconClose size={18} />
          </button>
        </header>
        <div className="text-sm text-ink-200">{children}</div>
        {footer && <footer className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</footer>}
      </div>
    </div>
  );
}

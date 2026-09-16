import { useCallback, useMemo, useReducer, type ReactNode } from 'react';

import { ToastContext, type Toast, type ToastInput } from '@/context/ToastContext';

type ToastAction = { type: 'ADD'; payload: Toast } | { type: 'REMOVE'; payload: number };

const MAX_VISIBLE = 4;
const AUTO_DISMISS_MS = 4500;

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case 'ADD':
      return [...state, action.payload].slice(-MAX_VISIBLE);
    case 'REMOVE':
      return state.filter((toast) => toast.id !== action.payload);
  }
}

let nextId = 1;

/** Notification provider (useReducer): toasts auto-dismiss after a few seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const dismiss = useCallback((id: number) => dispatch({ type: 'REMOVE', payload: id }), []);

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = nextId++;
      dispatch({ type: 'ADD', payload: { ...toast, id } });
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  // Stable value: consumers (AppProvider, pages) list `notify` in effect dependencies.
  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

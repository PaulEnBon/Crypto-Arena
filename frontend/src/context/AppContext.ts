import { createContext, useContext } from 'react';

import type { AppState } from '@/context/appReducer';
import type { LoginCredentials, Portfolio, RegisterPayload, User } from '@/types';

export interface AppContextValue extends AppState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: (message?: string) => void;
  refreshPortfolio: (signal?: AbortSignal) => Promise<Portfolio>;
  applyPortfolio: (portfolio: Portfolio) => void;
  updateUser: (user: User) => void;
  clearError: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext doit être utilisé dans un <AppProvider>.');
  return context;
}

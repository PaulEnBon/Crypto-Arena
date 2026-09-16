import type { Portfolio, User } from '@/types';

export interface AppState {
  user: User | null;
  portfolio: Portfolio | null;
  isAuthenticated: boolean;
  /** True while the session is being restored from the stored token on start-up. */
  loading: boolean;
  error: string | null;
}

/** Typed actions: the discriminated union makes every reducer branch exhaustive. */
export type AppAction =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_PORTFOLIO'; payload: Portfolio }
  | { type: 'UPDATE_PORTFOLIO'; payload: Partial<Portfolio> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

export const initialAppState: AppState = {
  user: null,
  portfolio: null,
  isAuthenticated: false,
  loading: true,
  error: null,
};

/** Pure reducer: every branch returns a new object, the previous state is never mutated. */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload, isAuthenticated: true, loading: false, error: null };
    case 'LOGOUT':
      return { ...initialAppState, loading: false };
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: true };
    case 'SET_PORTFOLIO':
      return { ...state, portfolio: action.payload };
    case 'UPDATE_PORTFOLIO':
      return state.portfolio ? { ...state, portfolio: { ...state.portfolio, ...action.payload } } : state;
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
  }
}

import { useAppContext } from '@/context/AppContext';
import type { LoginCredentials, RegisterPayload, User } from '@/types';

export interface UseAuthResult {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  loginWithOAuthToken: (neonToken: string) => Promise<void>;
  logout: (message?: string) => void;
  updateUser: (user: User) => void;
  clearError: () => void;
}

/** Authentication slice of the global state (Context + useReducer), exposed as a focused API. */
export function useAuth(): UseAuthResult {
  const { user, isAuthenticated, loading, error, login, register, loginWithOAuthToken, logout, updateUser, clearError } =
    useAppContext();
  return { user, isAuthenticated, loading, error, login, register, loginWithOAuthToken, logout, updateUser, clearError };
}

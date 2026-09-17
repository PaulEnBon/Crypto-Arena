import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { AppContext, type AppContextValue } from '@/context/AppContext';
import { appReducer, initialAppState } from '@/context/appReducer';
import { useToast } from '@/context/ToastContext';
import { UNAUTHORIZED_EVENT } from '@/services/apiClient';
import {
  exchangeOAuthToken,
  fetchCurrentUser,
  login as loginRequest,
  register as registerRequest,
} from '@/services/authService';
import { signOutNeonAuth } from '@/services/neonAuthService';
import { fetchPortfolio } from '@/services/portfolioService';
import { ApiError, type LoginCredentials, type Portfolio, type RegisterPayload, type User } from '@/types';
import { clearStoredToken, getStoredToken, storeToken } from '@/utils/storage';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Une erreur inattendue est survenue.';
}

/** Global state provider (Context + useReducer): session, user and portfolio. */
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const { notify } = useToast();

  // 1. Restore the session on start-up from the stored JWT (aborted if the provider unmounts).
  useEffect(() => {
    if (!getStoredToken()) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    const controller = new AbortController();
    fetchCurrentUser(controller.signal)
      .then((user) => dispatch({ type: 'LOGIN', payload: user }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // Network error: keep the token so a backend restart does not log the user out.
        if (!(error instanceof ApiError && error.isNetworkError)) clearStoredToken();
        dispatch({ type: 'LOGOUT' });
      });
    return () => controller.abort();
  }, []);

  // 2. Any 401 answered by the backend (expired token) ends the session everywhere.
  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as unknown) : null;
      const expired = detail instanceof ApiError && detail.code === 'TOKEN_EXPIRED';
      clearStoredToken();
      dispatch({ type: 'LOGOUT' });
      notify({
        type: 'warning',
        title: 'Session terminée',
        message: expired ? 'Votre session a expiré, veuillez vous reconnecter.' : 'Veuillez vous reconnecter.',
      });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [notify]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const response = await loginRequest(credentials);
      storeToken(response.access_token);
      dispatch({ type: 'LOGIN', payload: response.user });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(error) });
      throw error;
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const response = await registerRequest(payload);
      storeToken(response.access_token);
      dispatch({ type: 'LOGIN', payload: response.user });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(error) });
      throw error;
    }
  }, []);

  const loginWithOAuthToken = useCallback(async (neonToken: string) => {
    dispatch({ type: 'SET_ERROR', payload: null });
    try {
      const response = await exchangeOAuthToken(neonToken);
      storeToken(response.access_token);
      dispatch({ type: 'LOGIN', payload: response.user });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: errorMessage(error) });
      throw error;
    }
  }, []);

  const logout = useCallback(
    (message = 'Vous êtes déconnecté. À bientôt dans l’arène !') => {
      clearStoredToken();
      dispatch({ type: 'LOGOUT' });
      void signOutNeonAuth();
      notify({ type: 'info', message });
    },
    [notify],
  );

  const refreshPortfolio = useCallback(async (signal?: AbortSignal) => {
    const portfolio = await fetchPortfolio(signal);
    dispatch({ type: 'SET_PORTFOLIO', payload: portfolio });
    return portfolio;
  }, []);

  const applyPortfolio = useCallback((portfolio: Portfolio) => {
    dispatch({ type: 'SET_PORTFOLIO', payload: portfolio });
  }, []);

  const updateUser = useCallback((user: User) => dispatch({ type: 'SET_USER', payload: user }), []);
  const clearError = useCallback(() => dispatch({ type: 'SET_ERROR', payload: null }), []);

  // useMemo/useCallback are justified here: the value is consumed by many components and the
  // functions are listed as effect dependencies (e.g. refreshPortfolio) -> they must be stable.
  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      login,
      register,
      loginWithOAuthToken,
      logout,
      refreshPortfolio,
      applyPortfolio,
      updateUser,
      clearError,
    }),
    [state, login, register, loginWithOAuthToken, logout, refreshPortfolio, applyPortfolio, updateUser, clearError],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

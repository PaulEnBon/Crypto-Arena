import { api } from '@/services/apiClient';
import type { AuthResponse, LoginCredentials, RegisterPayload, User } from '@/types';

export function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', credentials, { auth: false });
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/register', payload, { auth: false });
}

/** Trade the Neon Auth JWT obtained after a Google / GitHub sign-in for a Crypto Arena session. */
export function exchangeOAuthToken(neonToken: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/oauth', { token: neonToken }, { auth: false });
}

export function fetchCurrentUser(signal?: AbortSignal): Promise<User> {
  return api.get<User>('/auth/me', signal);
}

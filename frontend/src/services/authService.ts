import { api } from '@/services/apiClient';
import type { AuthResponse, LoginCredentials, RegisterPayload, User } from '@/types';

export function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', credentials, { auth: false });
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/register', payload, { auth: false });
}

export function fetchCurrentUser(signal?: AbortSignal): Promise<User> {
  return api.get<User>('/auth/me', signal);
}

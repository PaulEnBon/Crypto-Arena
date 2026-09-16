import { api } from '@/services/apiClient';
import type { Profile, User } from '@/types';

export function fetchProfile(signal?: AbortSignal): Promise<Profile> {
  return api.get<Profile>('/profile', signal);
}

export function updateUsername(username: string): Promise<User> {
  return api.patch<User>('/profile', { username });
}

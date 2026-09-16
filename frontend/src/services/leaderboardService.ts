import { api, buildQuery } from '@/services/apiClient';
import type { LeaderboardResponse, MyRank } from '@/types';

export function fetchLeaderboard(page = 1, pageSize = 20, signal?: AbortSignal): Promise<LeaderboardResponse> {
  return api.get<LeaderboardResponse>(`/leaderboard${buildQuery({ page, page_size: pageSize })}`, signal);
}

export function fetchMyRank(signal?: AbortSignal): Promise<MyRank> {
  return api.get<MyRank>('/leaderboard/me', signal);
}

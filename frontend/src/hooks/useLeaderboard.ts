import { useAsync, type UseAsyncResult } from '@/hooks/useAsync';
import { fetchLeaderboard, fetchMyRank } from '@/services/leaderboardService';
import type { LeaderboardResponse, MyRank } from '@/types';

/** Paginated global ranking (computed server-side). */
export function useLeaderboard(page: number, pageSize = 20): UseAsyncResult<LeaderboardResponse> {
  return useAsync((signal) => fetchLeaderboard(page, pageSize, signal), [page, pageSize]);
}

/** Position of the connected player, shown on the dashboard and the profile. */
export function useMyRank(): UseAsyncResult<MyRank> {
  return useAsync((signal) => fetchMyRank(signal), []);
}

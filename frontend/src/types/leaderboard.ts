import type { Paginated } from './api';

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  initial_balance: number;
  portfolio_value: number;
  profit_loss: number;
  performance_pct: number;
  is_current_user: boolean;
}

export interface LeaderboardResponse extends Paginated<LeaderboardEntry> {
  total_players: number;
  computed_at: string;
}

export interface MyRank {
  rank: number | null;
  total_players: number;
  portfolio_value: number;
  profit_loss: number;
  performance_pct: number;
}

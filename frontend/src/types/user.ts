export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  is_demo: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

export interface Profile {
  user: User;
  initial_balance: number;
  cash_balance: number;
  portfolio_value: number;
  profit_loss: number;
  performance_pct: number;
  transactions_count: number;
  rank: number | null;
  total_players: number;
}

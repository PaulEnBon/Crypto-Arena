export type TransactionType = 'BUY' | 'SELL';

/** `fallback` means CoinGecko was unreachable and the average buy price was used instead. */
export type PriceSource = 'live' | 'fallback';

export interface PortfolioAsset {
  asset_id: number;
  coin_id: string;
  symbol: string;
  name: string;
  image_url: string | null;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  price_change_24h: number | null;
  price_source: PriceSource;
  value: number;
  invested: number;
  profit_loss: number;
  profit_loss_pct: number;
  allocation_pct: number;
}

export interface Portfolio {
  cash_balance: number;
  initial_balance: number;
  invested_amount: number;
  holdings_value: number;
  total_value: number;
  profit_loss: number;
  performance_pct: number;
  assets: PortfolioAsset[];
  updated_at: string;
}

export interface Transaction {
  id: number;
  coin_id: string;
  symbol: string;
  name: string;
  image_url: string | null;
  type: TransactionType;
  quantity: number;
  price: number;
  total: number;
  created_at: string;
}

export interface PortfolioSnapshot {
  total_value: number;
  profit_loss: number;
  created_at: string;
}

export interface SnapshotsResponse {
  days: number;
  initial_balance: number;
  points: PortfolioSnapshot[];
}

export interface TradeRequest {
  coin_id: string;
  quantity: number;
}

export interface TradeResponse {
  message: string;
  transaction: Transaction;
  portfolio: Portfolio;
}

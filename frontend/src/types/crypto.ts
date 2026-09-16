/** One row of the markets list (GET /api/crypto/markets). */
export interface MarketData {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
  price_change_24h: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d: number | null;
  sparkline_7d: number[];
  last_updated: string | null;
}

export type MarketOrder = 'market_cap_desc' | 'market_cap_asc' | 'volume_desc' | 'volume_asc';

export interface MarketsResponse {
  page: number;
  per_page: number;
  order: MarketOrder;
  coins: MarketData[];
  has_next: boolean;
}

/** Full description of one coin (GET /api/crypto/:coinId). */
export interface Crypto {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  description: string;
  market_cap_rank: number | null;
  current_price: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d: number | null;
  price_change_percentage_30d: number | null;
  market_cap: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
  ath: number | null;
  ath_date: string | null;
  atl: number | null;
  circulating_supply: number | null;
  total_supply: number | null;
  max_supply: number | null;
  homepage: string | null;
  genesis_date: string | null;
  categories: string[];
  last_updated: string | null;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface CoinHistory {
  coin_id: string;
  vs_currency: string;
  days: number;
  prices: PricePoint[];
}

export type HistoryRange = 1 | 7 | 30 | 90 | 365;

export interface SearchCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string | null;
  large: string | null;
}

export interface SearchResponse {
  query: string;
  coins: SearchCoin[];
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string | null;
  price_change_percentage_24h: number | null;
}

export interface TrendingResponse {
  coins: TrendingCoin[];
}

import { api, buildQuery } from '@/services/apiClient';
import type { CoinHistory, Crypto, HistoryRange, MarketOrder, MarketsResponse, SearchResponse, TrendingResponse } from '@/types';

export interface MarketsQuery {
  page?: number;
  perPage?: number;
  order?: MarketOrder;
  ids?: string[];
}

export function fetchMarkets(query: MarketsQuery = {}, signal?: AbortSignal): Promise<MarketsResponse> {
  const { page = 1, perPage = 50, order = 'market_cap_desc', ids } = query;
  const search = buildQuery({ page, per_page: perPage, order, ids: ids?.length ? ids.join(',') : undefined });
  return api.get<MarketsResponse>(`/crypto/markets${search}`, signal);
}

export function fetchCoin(coinId: string, signal?: AbortSignal): Promise<Crypto> {
  return api.get<Crypto>(`/crypto/${encodeURIComponent(coinId)}`, signal);
}

export function fetchCoinHistory(coinId: string, days: HistoryRange, signal?: AbortSignal): Promise<CoinHistory> {
  return api.get<CoinHistory>(`/crypto/${encodeURIComponent(coinId)}/history${buildQuery({ days })}`, signal);
}

export function searchCoins(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return api.get<SearchResponse>(`/crypto/search${buildQuery({ q: query })}`, signal);
}

export function fetchTrending(signal?: AbortSignal): Promise<TrendingResponse> {
  return api.get<TrendingResponse>('/crypto/trending', signal);
}

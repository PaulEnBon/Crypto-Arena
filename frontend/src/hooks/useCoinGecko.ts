/**
 * CoinGecko-backed data hooks. Every hook is built on the generic `useAsync<T>` and therefore
 * exposes the same `{ status, loading, data, error, refetch }` contract. All requests go through
 * the backend proxy (the CoinGecko API key never reaches the browser).
 */
import { useAsync, type UseAsyncResult } from '@/hooks/useAsync';
import { fetchCoin, fetchCoinHistory, fetchMarkets, fetchTrending, searchCoins, type MarketsQuery } from '@/services/cryptoService';
import type { CoinHistory, Crypto, HistoryRange, MarketsResponse, SearchResponse, TrendingResponse } from '@/types';

export function useMarkets(query: MarketsQuery): UseAsyncResult<MarketsResponse> {
  const { page = 1, perPage = 50, order = 'market_cap_desc', ids } = query;
  const idsKey = ids?.join(',') ?? '';
  return useAsync(
    (signal) => fetchMarkets({ page, perPage, order, ids: idsKey ? idsKey.split(',') : undefined }, signal),
    [page, perPage, order, idsKey],
    { enabled: ids === undefined || ids.length > 0 },
  );
}

export function useCoin(coinId: string | undefined): UseAsyncResult<Crypto> {
  return useAsync((signal) => fetchCoin(coinId ?? '', signal), [coinId], { enabled: Boolean(coinId) });
}

export function useCoinHistory(coinId: string | undefined, days: HistoryRange): UseAsyncResult<CoinHistory> {
  return useAsync((signal) => fetchCoinHistory(coinId ?? '', days, signal), [coinId, days], { enabled: Boolean(coinId) });
}

export function useTrending(): UseAsyncResult<TrendingResponse> {
  return useAsync((signal) => fetchTrending(signal), []);
}

/** Remote search; pass an already debounced query (see useDebounce). Disabled under 2 characters. */
export function useCoinSearch(query: string): UseAsyncResult<SearchResponse> {
  const trimmed = query.trim();
  return useAsync((signal) => searchCoins(trimmed, signal), [trimmed], { enabled: trimmed.length >= 2 });
}

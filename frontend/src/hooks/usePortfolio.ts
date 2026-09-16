import { useCallback, useEffect, useState } from 'react';

import { useAppContext } from '@/context/AppContext';
import { toApiError } from '@/hooks/useAsync';
import type { ApiError, Portfolio, PortfolioAsset } from '@/types';

export interface UsePortfolioOptions {
  /** Fetch a fresh valuation when the component mounts (default true). */
  refreshOnMount?: boolean;
}

export interface UsePortfolioResult {
  portfolio: Portfolio | null;
  /** True only when nothing has been loaded yet. */
  loading: boolean;
  refreshing: boolean;
  error: ApiError | null;
  refresh: () => Promise<void>;
  applyPortfolio: (portfolio: Portfolio) => void;
  getHolding: (coinId: string) => PortfolioAsset | null;
}

/** Portfolio slice of the global state + loading/error handling around its refresh. */
export function usePortfolio(options: UsePortfolioOptions = {}): UsePortfolioResult {
  const { refreshOnMount = true } = options;
  const { portfolio, refreshPortfolio, applyPortfolio, isAuthenticated } = useAppContext();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async (signal?: AbortSignal) => {
      setRefreshing(true);
      setError(null);
      try {
        await refreshPortfolio(signal);
      } catch (caught) {
        const apiError = toApiError(caught);
        if (apiError.isAborted) return;
        setError(apiError);
      } finally {
        if (!signal?.aborted) setRefreshing(false);
      }
    },
    [refreshPortfolio],
  );

  useEffect(() => {
    if (!refreshOnMount || !isAuthenticated) return;
    const controller = new AbortController();
    void run(controller.signal);
    return () => controller.abort();
  }, [run, refreshOnMount, isAuthenticated]);

  const refresh = useCallback(() => run(), [run]);

  const getHolding = useCallback(
    (coinId: string) => portfolio?.assets.find((asset) => asset.coin_id === coinId) ?? null,
    [portfolio],
  );

  return {
    portfolio,
    loading: refreshing && portfolio === null,
    refreshing,
    error,
    refresh,
    applyPortfolio,
    getHolding,
  };
}

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

import { ApiError, type ApiResponse } from '@/types';

export type AsyncFetcher<T> = (signal: AbortSignal) => Promise<T>;

export interface UseAsyncOptions {
  /** When false, nothing is fetched and the state stays idle (e.g. missing route param). */
  enabled?: boolean;
}

export type UseAsyncResult<T> = ApiResponse<T> & { refetch: () => void };

const IDLE: ApiResponse<never> = { status: 'idle', loading: false, data: null, error: null };

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
  return new ApiError(message, 0, 'UNKNOWN');
}

/**
 * Generic data-fetching hook: exposes loading / success / error states for any async request.
 *
 * - an AbortController cancels the in-flight request when deps change or the component unmounts;
 * - the `active` flag ignores responses from a previous run (no race condition when deps change quickly);
 * - previous data is kept while refetching so lists do not flash empty;
 * - `refetch()` re-runs the request (used by the "Réessayer" buttons).
 */
export function useAsync<T>(fetcher: AsyncFetcher<T>, deps: DependencyList, options: UseAsyncOptions = {}): UseAsyncResult<T> {
  const { enabled = true } = options;
  const [state, setState] = useState<ApiResponse<T>>(enabled ? { status: 'loading', loading: true, data: null, error: null } : IDLE);
  const [version, setVersion] = useState(0);

  // Keep the latest fetcher without making it a dependency (callers pass inline arrow functions).
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState((previous) => ({ status: 'loading', loading: true, data: previous.data, error: null }));

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (active) setState({ status: 'success', loading: false, data, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const apiError = toApiError(error);
        if (apiError.isAborted) return;
        setState((previous) => ({ status: 'error', loading: false, data: previous.data, error: apiError }));
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` are provided by the caller, like useEffect
  }, [...deps, enabled, version]);

  const refetch = useCallback(() => setVersion((current) => current + 1), []);

  return { ...state, refetch };
}

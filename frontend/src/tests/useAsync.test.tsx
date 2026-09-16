import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAsync } from '@/hooks/useAsync';
import { ApiError } from '@/types';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsync', () => {
  it('passe de loading à success', async () => {
    const request = deferred<string>();
    const { result } = renderHook(() => useAsync(() => request.promise, []));

    expect(result.current.status).toBe('loading');
    expect(result.current.loading).toBe(true);

    await act(async () => request.resolve('ok'));

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('ok');
  });

  it('expose une ApiError et permet de relancer la requête', async () => {
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('Backend indisponible', 0, 'NETWORK_ERROR'))
      .mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useAsync(fetcher, []));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.code).toBe('NETWORK_ERROR');

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ignore la réponse tardive d’une requête obsolète (race condition)', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const fetcher = vi.fn((signal: AbortSignal) => {
      void signal;
      return fetcher.mock.calls.length === 1 ? slow.promise : fast.promise;
    });

    const { result, rerender } = renderHook(({ id }) => useAsync((signal) => fetcher(signal), [id]), {
      initialProps: { id: 'first' },
    });
    rerender({ id: 'second' });

    await act(async () => fast.resolve('second'));
    await act(async () => slow.resolve('first')); // arrives after the deps changed -> must be ignored

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('second');
  });

  it('annule la requête en cours au démontage (AbortController)', () => {
    const fetcher = vi.fn((signal: AbortSignal) => new Promise<string>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const { unmount } = renderHook(() => useAsync(fetcher, []));
    const signal = fetcher.mock.calls[0]?.[0];

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});

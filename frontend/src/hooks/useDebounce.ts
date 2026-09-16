import { useEffect, useState } from 'react';

/**
 * Return `value` only after it stopped changing for `delayMs`.
 * Used to avoid one CoinGecko search request per keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

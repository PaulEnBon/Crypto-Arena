import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { ApiError, SearchCoin } from '@/types';

export interface CoinSearchResultsProps {
  query: string;
  loading: boolean;
  error: ApiError | null;
  coins: SearchCoin[];
  onSelect: (coinId: string) => void;
  onRetry: () => void;
}

/** Remote CoinGecko search results (used when the local page filter finds nothing). */
export function CoinSearchResults({ query, loading, error, coins, onSelect, onRetry }: CoinSearchResultsProps) {
  if (loading) return <LoadingSpinner size="sm" label={`Recherche de « ${query} » sur CoinGecko…`} />;
  if (error) return <ErrorMessage error={error} onRetry={onRetry} compact />;
  if (coins.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-400">Aucune cryptomonnaie ne correspond à « {query} ».</p>;
  }
  return (
    <ul className="divide-y divide-arena-700/60" aria-label="Résultats de recherche CoinGecko">
      {coins.map((coin) => (
        <li key={coin.id}>
          <button
            type="button"
            onClick={() => onSelect(coin.id)}
            className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition hover:bg-arena-700/50"
          >
            <CoinAvatar src={coin.thumb} symbol={coin.symbol} size={26} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {coin.name} <span className="text-ink-500">{coin.symbol}</span>
            </span>
            <span className="text-xs text-ink-500">{coin.market_cap_rank ? `#${coin.market_cap_rank}` : 'non classé'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

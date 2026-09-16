import { Link } from 'react-router-dom';

import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { PriceChange } from '@/components/ui/PriceChange';
import type { TrendingCoin } from '@/types';

export interface TrendingListProps {
  coins: TrendingCoin[];
  limit?: number;
}

/** Coins currently trending on CoinGecko (search popularity), linking to their detail page. */
export function TrendingList({ coins, limit = 6 }: TrendingListProps) {
  return (
    <ol className="divide-y divide-arena-700/60">
      {coins.slice(0, limit).map((coin, index) => (
        <li key={coin.id}>
          <Link to={`/crypto/${coin.id}`} className="flex items-center gap-3 py-2.5 transition hover:text-accent-300">
            <span className="w-5 text-xs text-ink-500 tabular">{index + 1}</span>
            <CoinAvatar src={coin.thumb} symbol={coin.symbol} size={24} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {coin.name} <span className="text-ink-500">{coin.symbol}</span>
            </span>
            {coin.market_cap_rank && <span className="text-xs text-ink-500">#{coin.market_cap_rank}</span>}
            <PriceChange value={coin.price_change_percentage_24h} className="text-xs" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

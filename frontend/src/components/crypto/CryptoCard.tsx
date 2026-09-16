import { Link } from 'react-router-dom';

import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { PriceChange } from '@/components/ui/PriceChange';
import { Sparkline } from '@/components/ui/Sparkline';
import type { MarketData } from '@/types';
import { formatCurrency } from '@/utils/format';

export interface CryptoCardProps {
  coin: MarketData;
}

/** Compact market card (dashboard "Top cryptos"), linking to the detail page. */
export function CryptoCard({ coin }: CryptoCardProps) {
  return (
    <Link
      to={`/crypto/${coin.id}`}
      className="card flex items-center gap-3 p-4 transition hover:border-accent-500/40 hover:bg-arena-700/50"
    >
      <CoinAvatar src={coin.image} symbol={coin.symbol} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{coin.name}</p>
        <p className="text-xs text-ink-500">{coin.symbol}</p>
      </div>
      <div className="hidden sm:block">
        <Sparkline points={coin.sparkline_7d} width={80} height={28} />
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular">{formatCurrency(coin.current_price)}</p>
        <PriceChange value={coin.price_change_percentage_24h} className="text-xs" />
      </div>
    </Link>
  );
}

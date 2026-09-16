import { memo, type KeyboardEvent } from 'react';

import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { IconSort } from '@/components/ui/icons';
import { PriceChange } from '@/components/ui/PriceChange';
import { Sparkline } from '@/components/ui/Sparkline';
import type { MarketData } from '@/types';
import { formatCurrency } from '@/utils/format';

export type SortKey = 'market_cap_rank' | 'name' | 'current_price' | 'price_change_percentage_24h' | 'market_cap' | 'total_volume';
export type SortDirection = 'asc' | 'desc';

export interface CryptoTableProps {
  coins: MarketData[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onSelect: (coinId: string) => void;
}

interface ColumnDef {
  key: SortKey;
  label: string;
  align: 'left' | 'right';
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'market_cap_rank', label: '#', align: 'left', className: 'w-12' },
  { key: 'name', label: 'Nom', align: 'left' },
  { key: 'current_price', label: 'Prix', align: 'right' },
  { key: 'price_change_percentage_24h', label: '24h', align: 'right' },
  { key: 'market_cap', label: 'Market cap', align: 'right', className: 'hidden md:table-cell' },
  { key: 'total_volume', label: 'Volume 24h', align: 'right', className: 'hidden xl:table-cell' },
];

interface CryptoRowProps {
  coin: MarketData;
  onSelect: (coinId: string) => void;
}

/**
 * memo() is justified here: the markets table holds up to 100 rows, each with a 168-point
 * sparkline, and the parent re-renders on every keystroke of the search filter and on every
 * sort. Rows whose `coin` object did not change are skipped entirely (onSelect is stable).
 */
const CryptoRow = memo(function CryptoRow({ coin, onSelect }: CryptoRowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(coin.id);
    }
  };
  return (
    <tr
      tabIndex={0}
      role="link"
      aria-label={`Voir ${coin.name}`}
      onClick={() => onSelect(coin.id)}
      onKeyDown={handleKeyDown}
      className="cursor-pointer border-t border-arena-700/60 transition hover:bg-arena-700/40 focus:bg-arena-700/40 focus:outline-none"
    >
      <td className="px-4 py-3 text-sm text-ink-500 tabular">{coin.market_cap_rank ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <CoinAvatar src={coin.image} symbol={coin.symbol} size={28} />
          <div className="min-w-0">
            <p className="truncate font-medium">{coin.name}</p>
            <p className="text-xs text-ink-500">{coin.symbol}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap tabular">{formatCurrency(coin.current_price)}</td>
      <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
        <PriceChange value={coin.price_change_percentage_24h} />
      </td>
      <td className="hidden px-4 py-3 text-right text-sm whitespace-nowrap text-ink-300 tabular md:table-cell">
        {formatCurrency(coin.market_cap, { compact: true })}
      </td>
      <td className="hidden px-4 py-3 text-right text-sm whitespace-nowrap text-ink-300 tabular xl:table-cell">
        {formatCurrency(coin.total_volume, { compact: true })}
      </td>
      <td className="hidden px-4 py-3 text-right lg:table-cell">
        <Sparkline points={coin.sparkline_7d} />
      </td>
    </tr>
  );
});

export function CryptoTable({ coins, sortKey, sortDirection, onSort, onSelect }: CryptoTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="text-xs tracking-wide text-ink-500 uppercase">
            {COLUMNS.map((column) => {
              const active = column.key === sortKey;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`px-4 py-3 font-medium ${column.className ?? ''} ${column.align === 'right' ? 'text-right' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={`inline-flex items-center gap-1 hover:text-ink-200 ${active ? 'text-accent-300' : ''}`}
                  >
                    {column.label}
                    <IconSort size={12} className={active ? 'opacity-100' : 'opacity-30'} />
                  </button>
                </th>
              );
            })}
            <th scope="col" className="hidden px-4 py-3 text-right font-medium lg:table-cell">
              7 jours
            </th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin) => (
            <CryptoRow key={coin.id} coin={coin} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

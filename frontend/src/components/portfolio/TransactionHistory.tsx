import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Transaction } from '@/types';
import { formatCurrency, formatDate, formatQuantity } from '@/utils/format';

export interface TransactionHistoryProps {
  transactions: Transaction[];
  /** Compact layout (dashboard widget). */
  compact?: boolean;
}

/** Ledger of BUY/SELL operations, newest first. */
export function TransactionHistory({ transactions, compact = false }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return <EmptyState title="Aucune transaction" description="Votre historique apparaîtra ici après votre premier achat ou vente." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left ${compact ? '' : 'min-w-[560px]'}`}>
        <thead>
          <tr className="text-xs tracking-wide text-ink-500 uppercase">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Crypto</th>
            <th className="px-3 py-2 text-right font-medium">Quantité</th>
            {!compact && <th className="px-3 py-2 text-right font-medium">Prix unitaire</th>}
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const isBuy = transaction.type === 'BUY';
            return (
              <tr key={transaction.id} className="border-t border-arena-700/60">
                <td className="px-3 py-2.5 text-xs text-ink-400 tabular">{formatDate(transaction.created_at)}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={isBuy ? 'gain' : 'loss'}>{isBuy ? 'Achat' : 'Vente'}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Link to={`/crypto/${transaction.coin_id}`} className="flex items-center gap-2 text-sm font-medium hover:text-accent-300">
                    <CoinAvatar src={transaction.image_url} symbol={transaction.symbol} size={22} />
                    {transaction.symbol}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular">{formatQuantity(transaction.quantity)}</td>
                {!compact && <td className="px-3 py-2.5 text-right text-sm text-ink-300 tabular">{formatCurrency(transaction.price)}</td>}
                <td className={`px-3 py-2.5 text-right text-sm font-semibold tabular ${isBuy ? 'text-loss-300' : 'text-gain-300'}`}>
                  {isBuy ? '-' : '+'}
                  {formatCurrency(transaction.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

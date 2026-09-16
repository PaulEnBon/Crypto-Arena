import { Badge } from '@/components/ui/Badge';
import { PriceChange } from '@/components/ui/PriceChange';
import type { LeaderboardEntry } from '@/types';
import { formatCurrency } from '@/utils/format';

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * Global ranking. No memo here on purpose: the table only re-renders when the page changes,
 * so memoising rows would cost more than it saves (measured with the React Profiler).
 */
export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="text-xs tracking-wide text-ink-500 uppercase">
            <th className="w-16 px-4 py-3 font-medium">Rang</th>
            <th className="px-4 py-3 font-medium">Joueur</th>
            <th className="px-4 py-3 text-right font-medium">Portefeuille</th>
            <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Profit / perte</th>
            <th className="px-4 py-3 text-right font-medium">Performance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.user_id}
              aria-current={entry.is_current_user ? 'true' : undefined}
              className={`border-t border-arena-700/60 ${entry.is_current_user ? 'bg-accent-500/10 ring-1 ring-inset ring-accent-500/40' : ''}`}
            >
              <td className="px-4 py-3 text-sm font-semibold tabular">
                {MEDALS[entry.rank] ?? <span className="text-ink-400">#{entry.rank}</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-arena-700 text-xs font-bold text-ink-200">
                    {entry.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="font-medium">{entry.username}</span>
                  {entry.is_current_user && <Badge tone="accent">Vous</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-sm tabular">
                <p className="font-semibold">{formatCurrency(entry.portfolio_value)}</p>
                <p className="text-xs text-ink-500">départ {formatCurrency(entry.initial_balance)}</p>
              </td>
              <td className={`hidden px-4 py-3 text-right text-sm tabular sm:table-cell ${entry.profit_loss >= 0 ? 'text-gain-400' : 'text-loss-400'}`}>
                {entry.profit_loss >= 0 ? '+' : ''}
                {formatCurrency(entry.profit_loss)}
              </td>
              <td className="px-4 py-3 text-right text-sm">
                <PriceChange value={entry.performance_pct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

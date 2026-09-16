import { useState } from 'react';

import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Card } from '@/components/ui/Card';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PriceChange } from '@/components/ui/PriceChange';
import { useLeaderboard, useMyRank } from '@/hooks/useLeaderboard';
import type { LeaderboardEntry } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

const PAGE_SIZE = 20;
const PODIUM_STYLES = ['border-gold-400/50 bg-gold-400/10', 'border-silver-400/40 bg-silver-400/5', 'border-bronze-400/40 bg-bronze-400/10'];

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {entries.slice(0, 3).map((entry, index) => (
        <div key={entry.user_id} className={`card border p-4 ${PODIUM_STYLES[index] ?? ''}`}>
          <p className="text-2xl">{['🥇', '🥈', '🥉'][index]}</p>
          <p className="mt-1 truncate text-lg font-bold">{entry.username}</p>
          <PriceChange value={entry.performance_pct} className="text-base" />
          <p className="mt-1 text-xs text-ink-400 tabular">
            {formatCurrency(entry.initial_balance)} → {formatCurrency(entry.portfolio_value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const leaderboard = useLeaderboard(page, PAGE_SIZE);
  const myRank = useMyRank();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classement"
        description="Performance = (valeur du portefeuille − capital initial) / capital initial × 100, calculée côté serveur avec les prix CoinGecko."
      />

      {myRank.data && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-accent-500/30 p-4">
          <p className="text-sm text-ink-300">
            Vous êtes <span className="text-lg font-bold text-ink-100">{myRank.data.rank ? `#${myRank.data.rank}` : '—'}</span> sur{' '}
            {myRank.data.total_players} joueur{myRank.data.total_players > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="tabular">{formatCurrency(myRank.data.portfolio_value)}</span>
            <PriceChange value={myRank.data.performance_pct} />
          </div>
        </div>
      )}

      {leaderboard.loading && !leaderboard.data && <LoadingSpinner label="Calcul du classement…" />}
      {leaderboard.error && !leaderboard.data && <ErrorMessage error={leaderboard.error} onRetry={leaderboard.refetch} />}

      {leaderboard.data && (
        <>
          {page === 1 && <Podium entries={leaderboard.data.items} />}
          <Card
            title={`${leaderboard.data.total_players} joueurs`}
            subtitle={`Calculé le ${formatDate(leaderboard.data.computed_at)}`}
            padding="none"
          >
            <LeaderboardTable entries={leaderboard.data.items} />
            {leaderboard.data.total_pages > 1 && (
              <div className="border-t border-arena-700/60 px-4 py-3">
                <Pagination page={page} totalPages={leaderboard.data.total_pages} hasNext={page < leaderboard.data.total_pages} onChange={setPage} disabled={leaderboard.loading} />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

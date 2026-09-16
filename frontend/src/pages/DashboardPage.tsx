import { Link } from 'react-router-dom';

import { CryptoCard } from '@/components/crypto/CryptoCard';
import { TrendingList } from '@/components/crypto/TrendingList';
import { PerformanceChart } from '@/components/portfolio/PerformanceChart';
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { IconFlame, IconTrophy } from '@/components/ui/icons';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { PriceChange } from '@/components/ui/PriceChange';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { useMarkets, useTrending } from '@/hooks/useCoinGecko';
import { useMyRank } from '@/hooks/useLeaderboard';
import { usePortfolio } from '@/hooks/usePortfolio';
import { fetchSnapshots, fetchTransactions } from '@/services/portfolioService';

export function DashboardPage() {
  const { user } = useAuth();
  const { portfolio, loading, error, refresh } = usePortfolio();
  const snapshots = useAsync((signal) => fetchSnapshots(30, signal), []);
  const transactions = useAsync((signal) => fetchTransactions(1, 5, signal), []);
  const rank = useMyRank();
  const topCoins = useMarkets({ page: 1, perPage: 6 });
  const trending = useTrending();

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            Bonjour {user?.username} <span aria-hidden="true">👋</span>
          </>
        }
        description="Voici l’état de votre arène aujourd’hui."
        actions={
          <Link to="/markets">
            <Button>Trader maintenant</Button>
          </Link>
        }
      />

      {/* Portfolio figures: loading / error / success */}
      {loading && <Skeleton className="h-24 w-full" lines={1} />}
      {!loading && error && <ErrorMessage error={error} onRetry={() => void refresh()} />}
      {portfolio && <PortfolioSummary portfolio={portfolio} />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Évolution du portefeuille" subtitle="30 derniers jours">
          {snapshots.loading && !snapshots.data && <LoadingSpinner size="sm" />}
          {snapshots.error && <ErrorMessage error={snapshots.error} onRetry={snapshots.refetch} compact />}
          {snapshots.data && <PerformanceChart points={snapshots.data.points} initialBalance={snapshots.data.initial_balance} />}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-gold-400/15 p-3 text-gold-400">
                <IconTrophy size={24} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium tracking-wide text-ink-400 uppercase">Position au classement</p>
                {rank.loading && !rank.data && <Skeleton className="mt-2 h-7 w-32" />}
                {rank.error && <p className="mt-1 text-sm text-loss-300">{rank.error.message}</p>}
                {rank.data && (
                  <>
                    <p className="mt-1 text-2xl font-bold tabular">
                      {rank.data.rank ? `#${rank.data.rank}` : '—'} <span className="text-base font-normal text-ink-400">/ {rank.data.total_players} joueurs</span>
                    </p>
                    <PriceChange value={rank.data.performance_pct} className="text-sm" />
                  </>
                )}
                <Link to="/leaderboard" className="mt-2 block text-sm text-accent-300 hover:underline">
                  Voir le classement complet →
                </Link>
              </div>
            </div>
          </Card>

          <Card
            title="Tendances"
            subtitle="Les plus recherchées sur CoinGecko"
            action={<IconFlame className="text-loss-400" size={18} />}
          >
            {trending.loading && !trending.data && <LoadingSpinner size="sm" />}
            {trending.error && <ErrorMessage error={trending.error} onRetry={trending.refetch} compact />}
            {trending.data && <TrendingList coins={trending.data.coins} limit={5} />}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Top cryptos" subtitle="Par capitalisation" action={<Link to="/markets" className="text-sm text-accent-300 hover:underline">Tout le marché →</Link>}>
          {topCoins.loading && !topCoins.data && <LoadingSpinner size="sm" />}
          {topCoins.error && <ErrorMessage error={topCoins.error} onRetry={topCoins.refetch} compact />}
          {topCoins.data && (
            <div className="grid gap-2 sm:grid-cols-2">
              {topCoins.data.coins.map((coin) => (
                <CryptoCard key={coin.id} coin={coin} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Dernières transactions" action={<Link to="/portfolio" className="text-sm text-accent-300 hover:underline">Historique complet →</Link>}>
          {transactions.loading && !transactions.data && <LoadingSpinner size="sm" />}
          {transactions.error && <ErrorMessage error={transactions.error} onRetry={transactions.refetch} compact />}
          {transactions.data && <TransactionHistory transactions={transactions.data.items} compact />}
        </Card>
      </div>
    </div>
  );
}

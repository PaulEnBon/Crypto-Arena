import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AllocationChart } from '@/components/portfolio/AllocationChart';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { IconRefresh } from '@/components/ui/icons';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { useAsync } from '@/hooks/useAsync';
import { usePortfolio } from '@/hooks/usePortfolio';
import { fetchTransactions } from '@/services/portfolioService';
import { formatDate } from '@/utils/format';

const TRANSACTIONS_PAGE_SIZE = 10;

export function PortfolioPage() {
  const { portfolio, loading, refreshing, error, refresh } = usePortfolio();
  const [page, setPage] = useState(1);
  const transactions = useAsync((signal) => fetchTransactions(page, TRANSACTIONS_PAGE_SIZE, signal), [page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portefeuille"
        description={portfolio ? `Valorisé avec les prix CoinGecko · ${formatDate(portfolio.updated_at)}` : 'Vos positions et votre historique.'}
        actions={
          <>
            <Button variant="secondary" onClick={() => void refresh()} loading={refreshing} icon={<IconRefresh size={16} />}>
              Actualiser
            </Button>
            <Link to="/markets">
              <Button>Acheter des cryptos</Button>
            </Link>
          </>
        }
      />

      {loading && <LoadingSpinner label="Valorisation du portefeuille…" />}
      {!portfolio && error && <ErrorMessage error={error} onRetry={() => void refresh()} />}

      {portfolio && (
        <>
          {error && <ErrorMessage error={error} onRetry={() => void refresh()} compact />}
          <PortfolioSummary portfolio={portfolio} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
            <Card title="Répartition" subtitle="Positions et cash">
              <AllocationChart assets={portfolio.assets} cashBalance={portfolio.cash_balance} totalValue={portfolio.total_value} />
            </Card>
            <Card title="Positions" subtitle={`${portfolio.assets.length} actif${portfolio.assets.length > 1 ? 's' : ''}`} padding="none">
              <HoldingsTable assets={portfolio.assets} />
            </Card>
          </div>
        </>
      )}

      <Card title="Historique des transactions" subtitle={transactions.data ? `${transactions.data.total} opération${transactions.data.total > 1 ? 's' : ''}` : undefined} padding="none">
        <div className="px-2 pb-2">
          {transactions.loading && !transactions.data && <LoadingSpinner size="sm" />}
          {transactions.error && (
            <div className="p-4">
              <ErrorMessage error={transactions.error} onRetry={transactions.refetch} compact />
            </div>
          )}
          {transactions.data && <TransactionHistory transactions={transactions.data.items} />}
        </div>
        {transactions.data && transactions.data.total_pages > 1 && (
          <div className="border-t border-arena-700/60 px-4 py-3">
            <Pagination page={page} totalPages={transactions.data.total_pages} hasNext={page < transactions.data.total_pages} onChange={setPage} disabled={transactions.loading} />
          </div>
        )}
      </Card>
    </div>
  );
}

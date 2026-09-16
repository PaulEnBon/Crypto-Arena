import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { PriceChart } from '@/components/crypto/PriceChart';
import { TransactionForm } from '@/components/trade/TransactionForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { IconExternal } from '@/components/ui/icons';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PriceChange } from '@/components/ui/PriceChange';
import { useToast } from '@/context/ToastContext';
import { toApiError } from '@/hooks/useAsync';
import { useCoin, useCoinHistory } from '@/hooks/useCoinGecko';
import { usePortfolio } from '@/hooks/usePortfolio';
import { executeTrade } from '@/services/tradeService';
import type { Crypto, HistoryRange, TransactionType } from '@/types';
import { formatCompactNumber, formatCurrency, formatDate } from '@/utils/format';

const RANGES: { days: HistoryRange; label: string }[] = [
  { days: 1, label: '1J' },
  { days: 7, label: '7J' },
  { days: 30, label: '30J' },
  { days: 90, label: '90J' },
  { days: 365, label: '1A' },
];

function statRows(coin: Crypto): { label: string; value: string }[] {
  return [
    { label: 'Capitalisation', value: formatCurrency(coin.market_cap, { compact: true }) },
    { label: 'Volume 24h', value: formatCurrency(coin.total_volume, { compact: true }) },
    { label: 'Plus haut 24h', value: formatCurrency(coin.high_24h) },
    { label: 'Plus bas 24h', value: formatCurrency(coin.low_24h) },
    { label: 'Record historique (ATH)', value: `${formatCurrency(coin.ath)}${coin.ath_date ? ` · ${formatDate(coin.ath_date, false)}` : ''}` },
    { label: 'Offre en circulation', value: formatCompactNumber(coin.circulating_supply) },
    { label: 'Offre maximale', value: coin.max_supply ? formatCompactNumber(coin.max_supply) : 'Illimitée' },
  ];
}

export function CryptoDetailPage() {
  const { coinId } = useParams<{ coinId: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [range, setRange] = useState<HistoryRange>(7);

  const coin = useCoin(coinId);
  const history = useCoinHistory(coinId, range);
  const { portfolio, getHolding, applyPortfolio, error: portfolioError, refresh } = usePortfolio();

  if (!coinId) return <Navigate to="/404" replace />;

  const handleTrade = async (type: TransactionType, quantity: number) => {
    try {
      const result = await executeTrade(type, { coin_id: coinId, quantity });
      applyPortfolio(result.portfolio);
      notify({ type: 'success', title: type === 'BUY' ? 'Achat effectué' : 'Vente effectuée', message: result.message });
    } catch (error) {
      const apiError = toApiError(error);
      notify({ type: 'error', title: 'Transaction refusée', message: apiError.message });
      throw apiError;
    }
  };

  if (coin.loading && !coin.data) return <LoadingSpinner fullPage label="Chargement de la cryptomonnaie…" />;

  if (coin.error && !coin.data) {
    const notFound = coin.error.code === 'COIN_NOT_FOUND' || coin.error.status === 404;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <ErrorMessage
          error={coin.error}
          title={notFound ? `« ${coinId} » est introuvable` : undefined}
          onRetry={notFound ? undefined : coin.refetch}
        />
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => navigate('/markets')}>
            Retour au marché
          </Button>
        </div>
      </div>
    );
  }

  if (!coin.data) return null;
  const data = coin.data;
  const holding = getHolding(data.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CoinAvatar src={data.image} symbol={data.symbol} size={56} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{data.name}</h1>
              <Badge>{data.symbol}</Badge>
              {data.market_cap_rank && <Badge tone="accent">Rang #{data.market_cap_rank}</Badge>}
            </div>
            {data.homepage && (
              <a href={data.homepage} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-accent-300">
                Site officiel <IconExternal size={14} />
              </a>
            )}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-bold tabular">{formatCurrency(data.current_price)}</p>
          <div className="flex items-center gap-3 sm:justify-end">
            <PriceChange value={data.price_change_percentage_24h} />
            <span className="text-xs text-ink-500">sur 24h</span>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card
            title="Historique du prix"
            action={
              <div className="flex gap-1 rounded-xl bg-arena-900 p-1" role="tablist" aria-label="Période">
                {RANGES.map((item) => (
                  <button
                    key={item.days}
                    type="button"
                    role="tab"
                    aria-selected={range === item.days}
                    onClick={() => setRange(item.days)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${range === item.days ? 'bg-accent-500 text-white' : 'text-ink-400 hover:text-ink-100'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            }
          >
            {history.loading && !history.data && <LoadingSpinner label="Chargement de l’historique…" />}
            {history.error && !history.data && <ErrorMessage error={history.error} onRetry={history.refetch} compact />}
            {history.data && (
              <div className={history.loading ? 'opacity-60 transition' : 'transition'}>
                <PriceChart points={history.data.prices} days={range} />
              </div>
            )}
          </Card>

          <Card title="Statistiques de marché">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {statRows(data).map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 border-b border-arena-700/50 pb-2 text-sm">
                  <dt className="text-ink-400">{row.label}</dt>
                  <dd className="text-right font-medium tabular">{row.value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-b border-arena-700/50 pb-2 text-sm">
                <dt className="text-ink-400">Variation 7 jours</dt>
                <dd>
                  <PriceChange value={data.price_change_percentage_7d} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-arena-700/50 pb-2 text-sm">
                <dt className="text-ink-400">Variation 30 jours</dt>
                <dd>
                  <PriceChange value={data.price_change_percentage_30d} />
                </dd>
              </div>
            </dl>
            {data.categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {data.categories.map((category) => (
                  <Badge key={category}>{category}</Badge>
                ))}
              </div>
            )}
          </Card>

          {data.description && (
            <Card title={`À propos de ${data.name}`}>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-300">{data.description}</p>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card title={`Trader ${data.symbol}`} subtitle="Argent virtuel, prix réel">
            {!portfolio && !portfolioError && <LoadingSpinner size="sm" label="Chargement du portefeuille…" />}
            {!portfolio && portfolioError && <ErrorMessage error={portfolioError} onRetry={() => void refresh()} compact />}
            {portfolio && (
              <TransactionForm
                key={data.id}
                symbol={data.symbol}
                name={data.name}
                price={data.current_price}
                cashBalance={portfolio.cash_balance}
                heldQuantity={holding?.quantity ?? 0}
                onSubmit={handleTrade}
              />
            )}
          </Card>

          {holding && (
            <Card title="Votre position">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-400">Quantité</dt>
                  <dd className="tabular">
                    {holding.quantity} {holding.symbol}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Prix moyen d’achat</dt>
                  <dd className="tabular">{formatCurrency(holding.avg_buy_price)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Valeur actuelle</dt>
                  <dd className="font-semibold tabular">{formatCurrency(holding.value)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Plus/moins-value</dt>
                  <dd className={`tabular ${holding.profit_loss >= 0 ? 'text-gain-400' : 'text-loss-400'}`}>
                    {holding.profit_loss >= 0 ? '+' : ''}
                    {formatCurrency(holding.profit_loss)} (<PriceChange value={holding.profit_loss_pct} withIcon={false} />)
                  </dd>
                </div>
              </dl>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate('/portfolio')}>
                Voir le portefeuille →
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

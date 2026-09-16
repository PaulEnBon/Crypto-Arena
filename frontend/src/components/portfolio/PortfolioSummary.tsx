import { IconAlert, IconMarkets, IconTrophy, IconWallet } from '@/components/ui/icons';
import { PriceChange } from '@/components/ui/PriceChange';
import { StatCard } from '@/components/ui/StatCard';
import type { Portfolio } from '@/types';
import { formatCurrency, formatPercent } from '@/utils/format';

export interface PortfolioSummaryProps {
  portfolio: Portfolio;
}

/** Key figures of the portfolio (total value, cash, invested amount, performance). */
export function PortfolioSummary({ portfolio }: PortfolioSummaryProps) {
  const tone = portfolio.profit_loss > 0 ? 'gain' : portfolio.profit_loss < 0 ? 'loss' : 'neutral';
  const degraded = portfolio.assets.some((asset) => asset.price_source === 'fallback');
  const signedPnl = `${portfolio.profit_loss > 0 ? '+' : ''}${formatCurrency(portfolio.profit_loss)}`;

  return (
    <div className="space-y-3">
      {degraded && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <IconAlert size={16} />
          Prix CoinGecko momentanément indisponibles : certaines positions sont valorisées à leur prix moyen d’achat.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Valeur du portefeuille"
          value={formatCurrency(portfolio.total_value)}
          tone={tone}
          hint={
            <span className="flex items-center gap-2">
              <span className={tone === 'gain' ? 'text-gain-400' : tone === 'loss' ? 'text-loss-400' : ''}>{signedPnl}</span>
              <PriceChange value={portfolio.performance_pct} />
            </span>
          }
          icon={<IconTrophy size={20} />}
        />
        <StatCard label="Cash disponible" value={formatCurrency(portfolio.cash_balance)} hint="Utilisable pour vos prochains achats" icon={<IconWallet size={20} />} />
        <StatCard
          label="Investissement total"
          value={formatCurrency(portfolio.invested_amount)}
          hint={`Valeur actuelle des positions : ${formatCurrency(portfolio.holdings_value)}`}
          icon={<IconMarkets size={20} />}
        />
        <StatCard
          label="Performance"
          value={formatPercent(portfolio.performance_pct)}
          tone={tone}
          hint={`Capital initial : ${formatCurrency(portfolio.initial_balance)}`}
        />
      </div>
    </div>
  );
}

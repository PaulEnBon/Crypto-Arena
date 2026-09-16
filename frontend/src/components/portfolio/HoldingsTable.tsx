import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { PriceChange } from '@/components/ui/PriceChange';
import type { PortfolioAsset } from '@/types';
import { formatCurrency, formatPercent, formatQuantity } from '@/utils/format';

export interface HoldingsTableProps {
  assets: PortfolioAsset[];
}

/** Positions held, valued with live prices; each row opens the coin page to trade. */
export function HoldingsTable({ assets }: HoldingsTableProps) {
  const navigate = useNavigate();

  if (assets.length === 0) {
    return <EmptyState title="Aucune position" description="Rendez-vous sur le marché pour effectuer votre premier achat virtuel." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="text-xs tracking-wide text-ink-500 uppercase">
            <th className="px-4 py-3 font-medium">Crypto</th>
            <th className="px-4 py-3 text-right font-medium">Quantité</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Prix moyen</th>
            <th className="px-4 py-3 text-right font-medium">Prix actuel</th>
            <th className="px-4 py-3 text-right font-medium">Valeur</th>
            <th className="px-4 py-3 text-right font-medium">Performance</th>
            <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Allocation</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr
              key={asset.asset_id}
              onClick={() => navigate(`/crypto/${asset.coin_id}`)}
              className="cursor-pointer border-t border-arena-700/60 transition hover:bg-arena-700/40"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <CoinAvatar src={asset.image_url} symbol={asset.symbol} size={28} />
                  <div>
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-xs text-ink-500">
                      {asset.symbol}
                      {asset.price_source === 'fallback' && (
                        <Badge tone="warning" className="ml-2">
                          prix estimé
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-sm tabular">{formatQuantity(asset.quantity)}</td>
              <td className="hidden px-4 py-3 text-right text-sm text-ink-300 tabular md:table-cell">{formatCurrency(asset.avg_buy_price)}</td>
              <td className="px-4 py-3 text-right text-sm tabular">
                <p>{formatCurrency(asset.current_price)}</p>
                <PriceChange value={asset.price_change_24h} className="text-xs" withIcon={false} />
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular">{formatCurrency(asset.value)}</td>
              <td className="px-4 py-3 text-right text-sm tabular">
                <p className={asset.profit_loss >= 0 ? 'text-gain-400' : 'text-loss-400'}>
                  {asset.profit_loss >= 0 ? '+' : ''}
                  {formatCurrency(asset.profit_loss)}
                </p>
                <PriceChange value={asset.profit_loss_pct} className="text-xs" />
              </td>
              <td className="hidden px-4 py-3 text-right text-sm text-ink-300 tabular lg:table-cell">
                {formatPercent(asset.allocation_pct, { signed: false, digits: 1 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

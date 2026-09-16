import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { EmptyState } from '@/components/ui/EmptyState';
import type { PortfolioAsset } from '@/types';
import { formatCurrency, formatPercent } from '@/utils/format';

const PALETTE = ['#8b5cf6', '#34d399', '#fbbf24', '#38bdf8', '#fb7185', '#f97316', '#a3e635', '#e879f9', '#22d3ee', '#94a3b8'];
const CASH_COLOUR = '#3b4a6b';

interface Slice {
  name: string;
  value: number;
  pct: number;
  colour: string;
}

interface SliceTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Slice }>;
}

function SliceTooltip({ active, payload }: SliceTooltipProps) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold">{slice.name}</p>
      <p className="text-ink-300 tabular">
        {formatCurrency(slice.value)} · {formatPercent(slice.pct, { signed: false })}
      </p>
    </div>
  );
}

export interface AllocationChartProps {
  assets: PortfolioAsset[];
  cashBalance: number;
  totalValue: number;
}

/** Donut of the portfolio allocation (positions + cash) with a custom legend. */
export function AllocationChart({ assets, cashBalance, totalValue }: AllocationChartProps) {
  const slices = useMemo<Slice[]>(() => {
    const items = assets.map((asset, index) => ({
      name: asset.symbol,
      value: asset.value,
      pct: asset.allocation_pct,
      colour: PALETTE[index % PALETTE.length] ?? CASH_COLOUR,
    }));
    if (cashBalance > 0) {
      items.push({ name: 'Cash', value: cashBalance, pct: totalValue > 0 ? (cashBalance / totalValue) * 100 : 0, colour: CASH_COLOUR });
    }
    return items;
  }, [assets, cashBalance, totalValue]);

  if (slices.length === 0) return <EmptyState title="Portefeuille vide" />;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.colour} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.colour }} />
            <span className="flex-1 font-medium">{slice.name}</span>
            <span className="text-ink-400 tabular">{formatCurrency(slice.value)}</span>
            <span className="w-14 text-right text-ink-300 tabular">{formatPercent(slice.pct, { signed: false, digits: 1 })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

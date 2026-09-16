import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState } from '@/components/ui/EmptyState';
import type { HistoryRange, PricePoint } from '@/types';
import { formatChartTime, formatCurrency, formatDate } from '@/utils/format';

interface ChartPoint {
  t: number;
  price: number;
}

interface PriceTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartPoint }>;
  intraday: boolean;
}

function PriceTooltip({ active, payload, intraday }: PriceTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="text-ink-400">{intraday ? formatChartTime(point.t, true) : formatDate(new Date(point.t).toISOString())}</p>
      <p className="mt-0.5 font-semibold tabular">{formatCurrency(point.price)}</p>
    </div>
  );
}

export interface PriceChartProps {
  points: PricePoint[];
  days: HistoryRange;
  height?: number;
}

/** Historical price area chart (Recharts). Colour follows the direction over the selected range. */
export function PriceChart({ points, days, height = 320 }: PriceChartProps) {
  const gradientId = useId();
  // useMemo justified: up to ~300 points mapped for Recharts; recomputed only when the series changes,
  // not when the parent re-renders (range buttons, trade form typing...).
  const data = useMemo<ChartPoint[]>(() => points.map((point) => ({ t: point.timestamp, price: point.price })), [points]);

  if (data.length < 2) {
    return <EmptyState title="Pas assez de données" description="CoinGecko n’a pas renvoyé d’historique pour cette période." />;
  }

  const first = data[0]?.price ?? 0;
  const last = data[data.length - 1]?.price ?? 0;
  const colour = last >= first ? '#34d399' : '#fb7185';
  const intraday = days === 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colour} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1a2238" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={(value: number) => formatChartTime(value, intraday)}
          minTickGap={48}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(value: number) => formatCurrency(value, { compact: Math.abs(value) >= 10000 })}
          width={76}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<PriceTooltip intraday={intraday} />} cursor={{ stroke: '#3b4a6b' }} />
        <Area type="monotone" dataKey="price" stroke={colour} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

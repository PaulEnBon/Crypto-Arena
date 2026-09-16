import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState } from '@/components/ui/EmptyState';
import type { PortfolioSnapshot } from '@/types';
import { formatChartTime, formatCurrency, formatDate } from '@/utils/format';

interface ValuePoint {
  t: number;
  value: number;
  pnl: number;
}

interface ValueTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ValuePoint }>;
}

function ValueTooltip({ active, payload }: ValueTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const tone = point.pnl >= 0 ? 'text-gain-400' : 'text-loss-400';
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="text-ink-400">{formatDate(new Date(point.t).toISOString())}</p>
      <p className="mt-0.5 font-semibold tabular">{formatCurrency(point.value)}</p>
      <p className={`tabular ${tone}`}>
        {point.pnl >= 0 ? '+' : ''}
        {formatCurrency(point.pnl)}
      </p>
    </div>
  );
}

export interface PerformanceChartProps {
  points: PortfolioSnapshot[];
  initialBalance: number;
  height?: number;
}

/** Portfolio value over time, with the initial capital as a reference line. */
export function PerformanceChart({ points, initialBalance, height = 260 }: PerformanceChartProps) {
  const gradientId = useId();
  const data = useMemo<ValuePoint[]>(
    () => points.map((point) => ({ t: new Date(point.created_at).getTime(), value: point.total_value, pnl: point.profit_loss })),
    [points],
  );

  if (data.length < 2) {
    return (
      <EmptyState
        title="Pas encore d’historique"
        description="Un point est enregistré à chaque transaction et au plus une fois par heure lors de vos visites."
      />
    );
  }

  const last = data[data.length - 1]?.value ?? initialBalance;
  const colour = last >= initialBalance ? '#34d399' : '#fb7185';

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
        <XAxis dataKey="t" tickFormatter={(value: number) => formatChartTime(value, false)} minTickGap={48} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis domain={['auto', 'auto']} tickFormatter={(value: number) => formatCurrency(value, { compact: true })} width={70} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip content={<ValueTooltip />} cursor={{ stroke: '#3b4a6b' }} />
        <ReferenceLine y={initialBalance} stroke="#8b5cf6" strokeDasharray="4 4" />
        <Area type="monotone" dataKey="value" stroke={colour} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

import { IconArrowDown, IconArrowUp } from '@/components/ui/icons';
import { formatPercent } from '@/utils/format';

export interface PriceChangeProps {
  value: number | null | undefined;
  /** Show the arrow icon (default true). */
  withIcon?: boolean;
  className?: string;
}

/** Signed percentage coloured by direction (green gain / red loss / neutral). */
export function PriceChange({ value, withIcon = true, className = '' }: PriceChangeProps) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={`text-ink-500 ${className}`}>—</span>;
  }
  const tone = value > 0 ? 'text-gain-400' : value < 0 ? 'text-loss-400' : 'text-ink-400';
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium whitespace-nowrap tabular ${tone} ${className}`}>
      {withIcon && value !== 0 && (value > 0 ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
      {formatPercent(value)}
    </span>
  );
}

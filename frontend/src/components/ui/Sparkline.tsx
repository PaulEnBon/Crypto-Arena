import { memo } from 'react';

export interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  /** Colour by direction of the series (default) or force a tone. */
  tone?: 'auto' | 'gain' | 'loss' | 'neutral';
}

function buildPath(points: number[], width: number, height: number): string {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / Math.max(points.length - 1, 1);
  return points
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * (height - 2) - 1;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Lightweight pure-SVG sparkline (no charting library) used in the markets table.
 * Memoised on purpose: the table re-renders on every search keystroke/sort, while the
 * 168 points of each row never change in between -> the path is not recomputed.
 */
export const Sparkline = memo(function Sparkline({ points, width = 120, height = 36, tone = 'auto' }: SparklineProps) {
  if (points.length < 2) return <span className="text-ink-500">—</span>;
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const direction = tone === 'auto' ? (last >= first ? 'gain' : 'loss') : tone;
  const colour = direction === 'gain' ? '#34d399' : direction === 'loss' ? '#fb7185' : '#94a3b8';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <path d={buildPath(points, width, height)} fill="none" stroke={colour} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
});

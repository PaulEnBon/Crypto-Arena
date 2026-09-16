import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'gain' | 'loss' | 'accent' | 'gold' | 'warning';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-arena-700 text-ink-300',
  gain: 'bg-gain-500/15 text-gain-300 ring-1 ring-gain-500/30',
  loss: 'bg-loss-500/15 text-loss-300 ring-1 ring-loss-500/30',
  accent: 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/30',
  gold: 'bg-gold-400/15 text-gold-400 ring-1 ring-gold-400/30',
  warning: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
};

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

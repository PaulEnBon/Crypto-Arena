import type { ReactNode } from 'react';

export type StatTone = 'neutral' | 'gain' | 'loss' | 'accent';

export interface StatCardProps {
  label: string;
  value: string;
  /** Secondary line under the value (e.g. a percentage or a hint). */
  hint?: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
}

const VALUE_TONE: Record<StatTone, string> = {
  neutral: 'text-ink-100',
  gain: 'text-gain-400',
  loss: 'text-loss-400',
  accent: 'text-accent-300',
};

export function StatCard({ label, value, hint, tone = 'neutral', icon }: StatCardProps) {
  return (
    <div className="card flex items-start justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-ink-400 uppercase">{label}</p>
        <p className={`mt-1 text-lg leading-tight font-semibold break-words tabular sm:text-xl ${VALUE_TONE[tone]}`}>{value}</p>
        {hint && <div className="mt-1 text-sm text-ink-400">{hint}</div>}
      </div>
      {icon && <div className="rounded-xl bg-arena-700/70 p-2 text-accent-300">{icon}</div>}
    </div>
  );
}

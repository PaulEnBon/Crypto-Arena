import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Element rendered on the right of the header (button, link, filter...). */
  action?: ReactNode;
  padding?: 'none' | 'sm' | 'md';
  className?: string;
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
};

/** Reusable surface with an optional header; content is passed through `children`. */
export function Card({ children, title, subtitle, action, padding = 'md', className = '' }: CardProps) {
  const hasHeader = Boolean(title || subtitle || action);
  return (
    <section className={`card ${PADDING[padding]} ${className}`}>
      {hasHeader && (
        <header className={`flex items-start justify-between gap-4 ${padding === 'none' ? 'px-5 pt-5' : ''} mb-4`}>
          <div>
            {title && <h2 className="text-base font-semibold text-ink-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

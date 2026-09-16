export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label, also displayed under the spinner when `showLabel` is true. */
  label?: string;
  showLabel?: boolean;
  /** Center in a tall container (page-level loading). */
  fullPage?: boolean;
}

const SIZE: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};

export function LoadingSpinner({ size = 'md', label = 'Chargement…', showLabel = true, fullPage = false }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-3 text-ink-400 ${fullPage ? 'min-h-[50vh]' : 'py-8'}`}
    >
      <span className={`${SIZE[size]} animate-spin rounded-full border-accent-500 border-t-transparent`} aria-hidden="true" />
      {showLabel && <span className="text-sm">{label}</span>}
    </div>
  );
}

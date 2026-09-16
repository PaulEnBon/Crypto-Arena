export interface SkeletonProps {
  className?: string;
  /** Number of stacked lines to render. */
  lines?: number;
}

/** Placeholder block shown while a section loads (keeps the layout stable). */
export function Skeleton({ className = 'h-4 w-full', lines = 1 }: SkeletonProps) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className={`animate-pulse rounded-lg bg-arena-700/70 ${className}`} />
      ))}
    </div>
  );
}

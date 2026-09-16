import { Button } from '@/components/ui/Button';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';

export interface PaginationProps {
  page: number;
  /** Known total (backend pagination) or undefined when only `hasNext` is known (CoinGecko markets). */
  totalPages?: number;
  hasNext: boolean;
  onChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, totalPages, hasNext, onChange, disabled = false }: PaginationProps) {
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
        icon={<IconChevronLeft size={14} />}
      >
        Précédent
      </Button>
      <span className="text-sm text-ink-400 tabular">
        Page {page}
        {totalPages ? ` / ${totalPages}` : ''}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange(page + 1)}
        disabled={disabled || !hasNext}
        icon={<IconChevronRight size={14} />}
      >
        Suivant
      </Button>
    </nav>
  );
}

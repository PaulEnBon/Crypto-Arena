import type { InputHTMLAttributes } from 'react';

import { IconClose, IconSearch } from '@/components/ui/icons';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  /** True while a remote search is in flight (shows a small spinner). */
  loading?: boolean;
}

export function SearchInput({ value, onChange, loading = false, className = '', ...rest }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-500" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input pr-10 pl-10"
        autoComplete="off"
        {...rest}
      />
      <span className="absolute top-1/2 right-3 -translate-y-1/2">
        {loading ? (
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" aria-hidden="true" />
        ) : (
          value && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Effacer la recherche"
              className="rounded p-0.5 text-ink-500 hover:text-ink-100"
            >
              <IconClose size={14} />
            </button>
          )
        )}
      </span>
    </div>
  );
}

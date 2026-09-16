import { Button } from '@/components/ui/Button';
import { IconAlert, IconRefresh } from '@/components/ui/icons';
import type { ApiError } from '@/types';

export interface ErrorMessageProps {
  error: ApiError | string;
  title?: string;
  /** When provided, a "Réessayer" button is displayed. */
  onRetry?: () => void;
  compact?: boolean;
}

function describe(error: ApiError | string): { title: string; message: string } {
  if (typeof error === 'string') return { title: 'Une erreur est survenue', message: error };
  switch (error.code) {
    case 'NETWORK_ERROR':
      return { title: 'Backend indisponible', message: error.message };
    case 'COINGECKO_UNAVAILABLE':
    case 'COINGECKO_ERROR':
      return { title: 'CoinGecko indisponible', message: error.message };
    case 'COINGECKO_RATE_LIMIT':
      return { title: 'Limite CoinGecko atteinte', message: error.message };
    case 'COIN_NOT_FOUND':
      return { title: 'Cryptomonnaie introuvable', message: error.message };
    case 'DATABASE_ERROR':
      return { title: 'Erreur base de données', message: error.message };
    default:
      return { title: 'Impossible de récupérer les données', message: error.message };
  }
}

/** Uniform error block used by every page/section; never leaves a blank screen. */
export function ErrorMessage({ error, title, onRetry, compact = false }: ErrorMessageProps) {
  const described = describe(error);
  return (
    <div
      role="alert"
      className={`flex ${compact ? 'items-center gap-3 rounded-xl p-3' : 'flex-col items-center gap-3 rounded-2xl p-6 text-center'} border border-loss-500/30 bg-loss-500/10`}
    >
      <IconAlert className="shrink-0 text-loss-400" size={compact ? 18 : 28} />
      <div className={compact ? 'min-w-0 flex-1' : ''}>
        <p className="font-semibold text-loss-300">{title ?? described.title}</p>
        <p className="text-sm text-ink-300">{described.message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={<IconRefresh size={14} />}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

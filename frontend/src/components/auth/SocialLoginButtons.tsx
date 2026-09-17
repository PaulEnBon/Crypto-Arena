import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { IconGitHub, IconGoogle } from '@/components/ui/icons';
import type { OAuthProvider } from '@/types';

export interface SocialLoginButtonsProps {
  /** Providers enabled for this deployment; nothing is rendered when the list is empty. */
  providers: OAuthProvider[];
  /** Starts the redirect to the provider. Rejects when the redirect cannot start. */
  onSelect: (provider: OAuthProvider) => Promise<void>;
}

const PROVIDERS: Record<OAuthProvider, { label: string; icon: ReactNode }> = {
  google: { label: 'Google', icon: <IconGoogle size={18} /> },
  github: { label: 'GitHub', icon: <IconGitHub size={18} /> },
};

/** "Continuer avec Google / GitHub" buttons, with a pending state and an inline error. */
export function SocialLoginButtons({ providers, onSelect }: SocialLoginButtonsProps) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (providers.length === 0) return null;

  const handleSelect = async (provider: OAuthProvider) => {
    setPending(provider);
    setError(null);
    try {
      await onSelect(provider); // on success the browser leaves the page for the provider
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'La connexion n’a pas pu démarrer, réessayez.');
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs tracking-wide text-ink-500 uppercase" aria-hidden="true">
        <span className="h-px flex-1 bg-arena-700" />
        ou
        <span className="h-px flex-1 bg-arena-700" />
      </div>
      <div className={`grid gap-2 ${providers.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {providers.map((provider) => (
          <Button
            key={provider}
            variant="secondary"
            fullWidth
            loading={pending === provider}
            disabled={pending !== null}
            icon={PROVIDERS[provider].icon}
            onClick={() => void handleSelect(provider)}
          >
            Continuer avec {PROVIDERS[provider].label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-loss-500/30 bg-loss-500/10 px-3 py-2 text-sm text-loss-300">
          {error}
        </p>
      )}
    </div>
  );
}

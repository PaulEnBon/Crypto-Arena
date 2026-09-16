import { useNavigate } from 'react-router-dom';

import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

/** Rendered for /404 and any unknown route. */
export function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo size={44} withText={false} />
      <p className="mt-8 font-mono text-7xl font-semibold text-accent-300">404</p>
      <h1 className="mt-3 text-2xl font-bold">Cette page n’existe pas</h1>
      <p className="mt-2 max-w-md text-ink-400">
        L’adresse demandée est introuvable. Elle a peut-être été déplacée, ou ce token n’a jamais été listé…
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/', { replace: true })}>
          {isAuthenticated ? 'Retour au dashboard' : 'Retour à l’accueil'}
        </Button>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Page précédente
        </Button>
      </div>
    </div>
  );
}

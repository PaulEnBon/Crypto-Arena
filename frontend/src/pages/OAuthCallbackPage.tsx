import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/context/ToastContext';
import { toApiError } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { getNeonAuthToken } from '@/services/neonAuthService';
import type { ApiError } from '@/types';

/**
 * Landing page after Google / GitHub: Neon Auth JWT, then exchange for the app session, then dashboard.
 * Route: /auth/callback (declared in the Neon Auth trusted domains through the site origin).
 */
export function OAuthCallbackPage() {
  const { loginWithOAuthToken } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState<ApiError | null>(null);
  // StrictMode runs effects twice in development: the one-time exchange must only happen once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const completeSignIn = async () => {
      try {
        const neonToken = await getNeonAuthToken();
        await loginWithOAuthToken(neonToken);
        notify({ type: 'success', title: 'Connexion réussie', message: 'Bienvenue dans l’arène !' });
        navigate('/dashboard', { replace: true });
      } catch (caught) {
        setError(toApiError(caught));
      }
    };
    void completeSignIn();
  }, [loginWithOAuthToken, navigate, notify]);

  if (!error) {
    return (
      <Card>
        <LoadingSpinner label="Connexion avec votre compte Google ou GitHub…" />
      </Card>
    );
  }

  return (
    <Card title="Connexion impossible">
      <div className="space-y-4">
        <ErrorMessage error={error} title="La connexion avec Google ou GitHub a échoué" />
        <Button fullWidth onClick={() => navigate('/login', { replace: true })}>
          Retour à la connexion
        </Button>
      </div>
    </Card>
  );
}

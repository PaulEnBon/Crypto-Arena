import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { LoginForm } from '@/components/auth/LoginForm';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { getEnabledOAuthProviders, startOAuthSignIn } from '@/services/neonAuthService';
import type { LoginCredentials } from '@/types';

const DEMO_ACCOUNT: LoginCredentials = { email: 'demo@cryptoarena.dev', password: 'Demo123!' };
const OAUTH_PROVIDERS = getEnabledOAuthProviders();

function redirectTarget(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state && typeof state.from === 'string') {
    return state.from;
  }
  return '/dashboard';
}

export function LoginPage() {
  const { login, error, clearError } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [prefill, setPrefill] = useState<LoginCredentials | null>(null);
  // Set by Neon Auth when the Google / GitHub step was cancelled or failed (errorCallbackURL).
  const oauthFailed = searchParams.has('oauth_error');

  // Clear a stale server error when leaving the page.
  useEffect(() => () => clearError(), [clearError]);

  const handleSubmit = async (credentials: LoginCredentials) => {
    await login(credentials);
    notify({ type: 'success', title: 'Connexion réussie', message: 'Bienvenue dans l’arène !' });
    navigate(redirectTarget(location.state), { replace: true });
  };

  return (
    <Card title="Connexion" subtitle="Reprenez votre place dans le classement.">
      {oauthFailed && (
        <p role="alert" className="mb-4 rounded-xl border border-loss-500/30 bg-loss-500/10 px-3 py-2 text-sm text-loss-300">
          La connexion avec Google ou GitHub a été annulée ou a échoué. Réessayez ou utilisez votre email.
        </p>
      )}

      <LoginForm
        key={prefill ? 'demo' : 'empty'}
        onSubmit={handleSubmit}
        serverError={error}
        initialEmail={prefill?.email}
        initialPassword={prefill?.password}
      />

      <div className="mt-4">
        <SocialLoginButtons providers={OAUTH_PROVIDERS} onSelect={startOAuthSignIn} />
      </div>

      <div className="mt-5 rounded-xl border border-arena-600 bg-arena-900/60 p-3 text-xs text-ink-400">
        <p className="font-semibold text-ink-300">Compte de démonstration</p>
        <p className="mt-1">
          {DEMO_ACCOUNT.email} / {DEMO_ACCOUNT.password}
        </p>
        <button type="button" onClick={() => setPrefill(DEMO_ACCOUNT)} className="mt-2 text-accent-300 hover:underline">
          Pré-remplir le formulaire
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-ink-400">
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-medium text-accent-300 hover:underline">
          Créer un compte
        </Link>
      </p>
    </Card>
  );
}

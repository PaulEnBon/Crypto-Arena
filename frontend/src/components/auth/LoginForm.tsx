import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import type { LoginCredentials } from '@/types';
import { validateEmail } from '@/utils/validation';

export interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  /** Error returned by the backend (wrong credentials, server down...). */
  serverError?: string | null;
  initialEmail?: string;
  initialPassword?: string;
}

type Touched = Partial<Record<keyof LoginCredentials, boolean>>;

/** Controlled login form with field-level validation; submission is blocked while invalid. */
export function LoginForm({ onSubmit, serverError = null, initialEmail = '', initialPassword = '' }: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [touched, setTouched] = useState<Touched>({});
  const [submitting, setSubmitting] = useState(false);

  const emailError = validateEmail(email);
  const passwordError = password ? null : 'Le mot de passe est obligatoire.';
  const isValid = !emailError && !passwordError;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!isValid) return;
    setSubmitting(true);
    try {
      await onSubmit({ email: email.trim().toLowerCase(), password });
    } catch {
      // The parent surfaces the error through `serverError`.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Formulaire de connexion">
      <FormField
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="vous@exemple.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, email: true }))}
        error={touched.email ? emailError : null}
      />
      <FormField
        id="login-password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        error={touched.password ? passwordError : null}
      />

      {serverError && (
        <p role="alert" className="rounded-xl border border-loss-500/30 bg-loss-500/10 px-3 py-2 text-sm text-loss-300">
          {serverError}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!isValid}>
        Se connecter
      </Button>
    </form>
  );
}

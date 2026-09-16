import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import type { RegisterPayload } from '@/types';
import { validateEmail, validatePassword, validatePasswordConfirmation, validateUsername } from '@/utils/validation';

export interface RegisterFormProps {
  onSubmit: (payload: RegisterPayload) => Promise<void>;
  serverError?: string | null;
}

type Touched = Partial<Record<keyof RegisterPayload, boolean>>;

const PASSWORD_RULES = [
  { label: '8 caractères minimum', test: (value: string) => value.length >= 8 },
  { label: 'une majuscule', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'une minuscule', test: (value: string) => /[a-z]/.test(value) },
  { label: 'un chiffre', test: (value: string) => /\d/.test(value) },
];

/** Controlled registration form: every field validated on the client, the backend re-validates. */
export function RegisterForm({ onSubmit, serverError = null }: RegisterFormProps) {
  const [values, setValues] = useState<RegisterPayload>({ username: '', email: '', password: '', password_confirm: '' });
  const [touched, setTouched] = useState<Touched>({});
  const [submitting, setSubmitting] = useState(false);

  const errors: Record<keyof RegisterPayload, string | null> = {
    username: validateUsername(values.username),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    password_confirm: validatePasswordConfirmation(values.password, values.password_confirm),
  };
  const isValid = Object.values(errors).every((error) => error === null);

  const update = (field: keyof RegisterPayload) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));
  const touch = (field: keyof RegisterPayload) => () => setTouched((current) => ({ ...current, [field]: true }));
  const shownError = (field: keyof RegisterPayload) => (touched[field] ? errors[field] : null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ username: true, email: true, password: true, password_confirm: true });
    if (!isValid) return;
    setSubmitting(true);
    try {
      await onSubmit({ ...values, username: values.username.trim(), email: values.email.trim().toLowerCase() });
    } catch {
      // Surfaced by the parent through `serverError`.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Formulaire d'inscription">
      <FormField
        id="register-username"
        label="Nom d'utilisateur"
        autoComplete="username"
        placeholder="CryptoMaster"
        value={values.username}
        onChange={update('username')}
        onBlur={touch('username')}
        error={shownError('username')}
        hint="Visible dans le classement."
      />
      <FormField
        id="register-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="vous@exemple.com"
        value={values.email}
        onChange={update('email')}
        onBlur={touch('email')}
        error={shownError('email')}
      />
      <div>
        <FormField
          id="register-password"
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={values.password}
          onChange={update('password')}
          onBlur={touch('password')}
          error={shownError('password')}
        />
        <ul className="mt-2 grid grid-cols-2 gap-1 text-xs" aria-label="Règles du mot de passe">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(values.password);
            return (
              <li key={rule.label} className={ok ? 'text-gain-400' : 'text-ink-500'}>
                {ok ? '✓' : '○'} {rule.label}
              </li>
            );
          })}
        </ul>
      </div>
      <FormField
        id="register-password-confirm"
        label="Confirmation du mot de passe"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={values.password_confirm}
        onChange={update('password_confirm')}
        onBlur={touch('password_confirm')}
        error={shownError('password_confirm')}
      />

      {serverError && (
        <p role="alert" className="rounded-xl border border-loss-500/30 bg-loss-500/10 px-3 py-2 text-sm text-loss-300">
          {serverError}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!isValid}>
        Créer mon compte
      </Button>
    </form>
  );
}

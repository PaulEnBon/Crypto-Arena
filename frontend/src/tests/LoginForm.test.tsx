import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/components/auth/LoginForm';

describe('LoginForm', () => {
  it('bloque la soumission et affiche les erreurs sous les champs tant que le formulaire est invalide', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);

    const submit = screen.getByRole('button', { name: /se connecter/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/email/i), 'pas-un-email');
    await user.tab();

    expect(await screen.findByText('Adresse email invalide.')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('appelle onSubmit avec les identifiants normalisés quand le formulaire est valide', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'Demo@CryptoArena.dev');
    await user.type(screen.getByLabelText(/mot de passe/i), 'Demo123!');

    const submit = screen.getByRole('button', { name: /se connecter/i });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'demo@cryptoarena.dev', password: 'Demo123!' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it("affiche l'erreur renvoyée par le serveur", () => {
    render(<LoginForm onSubmit={vi.fn()} serverError="Email ou mot de passe incorrect." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.');
  });
});

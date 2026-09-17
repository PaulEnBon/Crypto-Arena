import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { getEnabledOAuthProviders } from '@/services/neonAuthService';

describe('SocialLoginButtons', () => {
  it("n'affiche rien quand aucun fournisseur n'est configuré", () => {
    const { container } = render(<SocialLoginButtons providers={[]} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lance la connexion avec le fournisseur choisi et bloque les autres boutons pendant la redirection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn(() => new Promise<void>(() => {})); // the browser would leave the page
    render(<SocialLoginButtons providers={['google', 'github']} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /continuer avec github/i }));

    expect(onSelect).toHaveBeenCalledWith('github');
    expect(screen.getByRole('button', { name: /continuer avec google/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /continuer avec github/i })).toHaveAttribute('aria-busy', 'true');
  });

  it("affiche l'erreur et réactive les boutons si la redirection ne peut pas démarrer", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockRejectedValue(new Error('Neon Auth est momentanément injoignable, réessayez.'));
    render(<SocialLoginButtons providers={['google']} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /continuer avec google/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Neon Auth est momentanément injoignable');
    expect(screen.getByRole('button', { name: /continuer avec google/i })).toBeEnabled();
  });
});

describe('getEnabledOAuthProviders', () => {
  const url = 'https://ep-test.neonauth.aws.neon.tech/neondb/auth';

  it('renvoie une liste vide sans URL Neon Auth', () => {
    expect(getEnabledOAuthProviders('google,github', '')).toEqual([]);
  });

  it('utilise Google par défaut et ignore les valeurs inconnues ou en double', () => {
    expect(getEnabledOAuthProviders(undefined, url)).toEqual(['google']);
    expect(getEnabledOAuthProviders(' GitHub , google, facebook, github ', url)).toEqual(['github', 'google']);
  });
});

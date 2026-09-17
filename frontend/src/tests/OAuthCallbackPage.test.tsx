import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth, type UseAuthResult } from '@/hooks/useAuth';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { getNeonAuthToken } from '@/services/neonAuthService';
import { ApiError } from '@/types';

vi.mock('@/services/neonAuthService', () => ({ getNeonAuthToken: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ notify: vi.fn(), dismiss: vi.fn(), toasts: [] }) }));

const mockedGetNeonAuthToken = vi.mocked(getNeonAuthToken);
const mockedUseAuth = vi.mocked(useAuth);

function mockAuth(loginWithOAuthToken: UseAuthResult['loginWithOAuthToken']) {
  mockedUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    loginWithOAuthToken,
    logout: vi.fn(),
    updateUser: vi.fn(),
    clearError: vi.fn(),
  });
}

function renderCallback() {
  return render(
    <MemoryRouter initialEntries={['/auth/callback?neon_auth_session_verifier=abc']}>
      <Routes>
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/dashboard" element={<p>Tableau de bord</p>} />
        <Route path="/login" element={<p>Page de connexion</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    mockedGetNeonAuthToken.mockReset();
    mockedUseAuth.mockReset();
  });

  it('échange le jeton Neon Auth contre une session puis ouvre le dashboard', async () => {
    const loginWithOAuthToken = vi.fn().mockResolvedValue(undefined);
    mockAuth(loginWithOAuthToken);
    mockedGetNeonAuthToken.mockResolvedValue('neon.jwt.token');

    renderCallback();

    expect(screen.getByRole('status')).toHaveTextContent(/connexion avec votre compte google ou github/i);
    expect(await screen.findByText('Tableau de bord')).toBeInTheDocument();
    expect(loginWithOAuthToken).toHaveBeenCalledTimes(1);
    expect(loginWithOAuthToken).toHaveBeenCalledWith('neon.jwt.token');
  });

  it("affiche l'erreur du backend et permet de revenir à la connexion", async () => {
    const user = userEvent.setup();
    const loginWithOAuthToken = vi
      .fn()
      .mockRejectedValue(new ApiError("Votre adresse email n'est pas vérifiée auprès de Google ou GitHub.", 403, 'EMAIL_NOT_VERIFIED'));
    mockAuth(loginWithOAuthToken);
    mockedGetNeonAuthToken.mockResolvedValue('neon.jwt.token');

    renderCallback();

    expect(await screen.findByRole('alert')).toHaveTextContent("n'est pas vérifiée");
    await user.click(screen.getByRole('button', { name: /retour à la connexion/i }));
    expect(screen.getByText('Page de connexion')).toBeInTheDocument();
  });

  it("n'appelle pas le backend quand la session Neon est introuvable", async () => {
    const loginWithOAuthToken = vi.fn();
    mockAuth(loginWithOAuthToken);
    mockedGetNeonAuthToken.mockRejectedValue(
      new ApiError('Session Google ou GitHub introuvable ou expirée. Recommencez la connexion.', 401, 'UNAUTHORIZED'),
    );

    renderCallback();

    expect(await screen.findByRole('alert')).toHaveTextContent('Session Google ou GitHub introuvable');
    expect(loginWithOAuthToken).not.toHaveBeenCalled();
  });
});

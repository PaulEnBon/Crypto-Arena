const TOKEN_KEY = 'crypto-arena.token';

/**
 * The JWT is kept in localStorage so the session survives a page refresh.
 * Trade-off documented in the README: an httpOnly cookie would be immune to XSS
 * but requires CSRF protection and a same-site deployment.
 */
export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode / quota): the session simply won't persist.
  }
}

export function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

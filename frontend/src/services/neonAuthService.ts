/**
 * Google / GitHub sign-in through Neon Auth.
 *
 * Flow: the SDK redirects to the provider, Neon Auth handles the OAuth callback, then sends the
 * browser back to /auth/callback with a one-time session verifier in the URL. On that page the SDK
 * trades the verifier for a short-lived JWT, which the backend exchanges for its own session token.
 * The Neon session is only needed for that single exchange, so the app never depends on the
 * third-party cookies of the Neon domain afterwards.
 */
// Type-only import: erased at build time, so the SDK itself stays out of the main bundle.
import type { VanillaBetterAuthClient } from '@neondatabase/auth';

import { ApiError, type OAuthProvider } from '@/types';

interface NeonAuthInstance {
  /** Better Auth client (signIn.social, signOut...). */
  adapter: VanillaBetterAuthClient;
  /** Reads the session, trading the URL session verifier if present, and returns its JWT. */
  getJWTToken: () => Promise<string | null>;
}

const SUPPORTED_PROVIDERS: readonly OAuthProvider[] = ['google', 'github'];
export const OAUTH_CALLBACK_PATH = '/auth/callback';

const NEON_AUTH_URL = (import.meta.env.VITE_NEON_AUTH_URL ?? '').trim().replace(/\/+$/, '');

let neonAuthPromise: Promise<NeonAuthInstance> | null = null;

function isProvider(value: string): value is OAuthProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/** Providers to display, from VITE_OAUTH_PROVIDERS (default: google). Empty when Neon Auth is not configured. */
export function getEnabledOAuthProviders(
  rawProviders: string | undefined = import.meta.env.VITE_OAUTH_PROVIDERS,
  authUrl: string = NEON_AUTH_URL,
): OAuthProvider[] {
  if (!authUrl) return [];
  const requested = (rawProviders ?? 'google').split(',').map((value) => value.trim().toLowerCase());
  return [...new Set(requested.filter(isProvider))];
}

/**
 * The SDK is imported lazily: its code is only downloaded when a visitor starts or finishes a
 * social sign-in, not by every page of the app. `createInternalNeonAuth` also exposes
 * `getJWTToken`, which reads the JWT that Neon Auth returns in the `set-auth-jwt` header.
 */
async function createNeonAuth(): Promise<NeonAuthInstance> {
  const { createInternalNeonAuth } = await import('@neondatabase/auth');
  // No adapter passed: the SDK defaults to its vanilla Better Auth client.
  const instance = createInternalNeonAuth(NEON_AUTH_URL);
  return instance;
}

function loadNeonAuth(): Promise<NeonAuthInstance> {
  if (!NEON_AUTH_URL) {
    return Promise.reject(new ApiError("La connexion Google / GitHub n'est pas configurée.", 0, 'OAUTH_DISABLED'));
  }
  if (!neonAuthPromise) {
    neonAuthPromise = createNeonAuth().catch((error: unknown) => {
      neonAuthPromise = null; // allow a retry if the SDK chunk failed to download
      throw error;
    });
  }
  return neonAuthPromise;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

/** Redirect the browser to Google or GitHub. On success the page is left, so the promise rarely settles. */
export async function startOAuthSignIn(provider: OAuthProvider): Promise<void> {
  const fallback = 'Impossible de contacter le service de connexion, réessayez.';
  const { adapter } = await loadNeonAuth();
  const origin = window.location.origin;
  let result: { error?: unknown } | undefined;
  try {
    result = await adapter.signIn.social({
      provider,
      callbackURL: `${origin}${OAUTH_CALLBACK_PATH}`,
      errorCallbackURL: `${origin}/login?oauth_error=1`,
    });
  } catch (error) {
    throw new ApiError(errorMessage(error, fallback), 0, 'OAUTH_UNAVAILABLE');
  }
  if (result?.error) throw new ApiError(errorMessage(result.error, fallback), 0, 'OAUTH_UNAVAILABLE');
}

/** On the callback page: turn the session verifier present in the URL into a Neon Auth JWT. */
export async function getNeonAuthToken(): Promise<string> {
  const { getJWTToken } = await loadNeonAuth();
  let token: string | null;
  try {
    token = await getJWTToken();
  } catch (error) {
    throw new ApiError(errorMessage(error, 'Session Google ou GitHub introuvable.'), 401, 'UNAUTHORIZED');
  }
  if (!token) {
    throw new ApiError('Session Google ou GitHub introuvable ou expirée. Recommencez la connexion.', 401, 'UNAUTHORIZED');
  }
  return token;
}

/** Best effort: also close the Neon Auth session when the player logs out (only if the SDK was loaded). */
export async function signOutNeonAuth(): Promise<void> {
  if (!neonAuthPromise) return;
  try {
    const { adapter } = await neonAuthPromise;
    await adapter.signOut();
  } catch {
    // The app session is already cleared; a failure here must not block the logout.
  }
}

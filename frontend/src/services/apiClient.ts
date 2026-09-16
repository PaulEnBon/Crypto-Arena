import { ApiError, type ApiErrorCode, type ApiFieldError } from '@/types/api';
import { getStoredToken } from '@/utils/storage';

const RAW_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
export const API_BASE_URL = `${RAW_BASE_URL.replace(/\/+$/, '')}/api`;

/** Dispatched on `window` when the backend answers 401 to an authenticated call (expired/invalid token). */
export const UNAUTHORIZED_EVENT = 'crypto-arena:unauthorized';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
  /** Attach the stored JWT (default true). */
  auth?: boolean;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

const KNOWN_CODES: ReadonlySet<string> = new Set<ApiErrorCode>([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'NOT_FOUND',
  'COIN_NOT_FOUND',
  'INVALID_QUANTITY',
  'INSUFFICIENT_FUNDS',
  'INSUFFICIENT_HOLDINGS',
  'INVALID_PRICE',
  'COINGECKO_ERROR',
  'COINGECKO_RATE_LIMIT',
  'COINGECKO_UNAVAILABLE',
  'DATABASE_ERROR',
  'INTERNAL_ERROR',
  'HTTP_ERROR',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function toFieldErrors(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    isRecord(item) && typeof item.field === 'string' && typeof item.message === 'string'
      ? [{ field: item.field, message: item.message }]
      : [],
  );
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Authentification requise.';
  if (status === 403) return 'Accès refusé.';
  if (status === 404) return 'Ressource introuvable.';
  if (status === 429) return 'Trop de requêtes, réessayez dans quelques instants.';
  if (status >= 500) return 'Le serveur a rencontré une erreur, réessayez plus tard.';
  return 'La requête a échoué.';
}

/** Convert an error body `{ detail, code, errors? }` into a typed ApiError. */
export function toApiError(status: number, payload: unknown): ApiError {
  const body = isRecord(payload) ? payload : {};
  const message = typeof body.detail === 'string' ? body.detail : defaultMessage(status);
  const rawCode = typeof body.code === 'string' ? body.code : '';
  const code: ApiErrorCode = KNOWN_CODES.has(rawCode) ? (rawCode as ApiErrorCode) : 'UNKNOWN';
  return new ApiError(message, status, code, toFieldErrors(body.errors));
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Build a query string, skipping null/undefined values. */
export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * Generic fetch wrapper: JSON in/out, Bearer token, AbortSignal support and uniform errors.
 * The cast to T at the end is the single trust boundary between the backend contract and the UI.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getStoredToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw new ApiError('Requête annulée.', 0, 'ABORTED');
    throw new ApiError('Impossible de joindre le serveur. Vérifiez que le backend est démarré.', 0, 'NETWORK_ERROR');
  }

  const payload = await parseBody(response);
  if (!response.ok) {
    const apiError = toApiError(response.status, payload);
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent<ApiError>(UNAUTHORIZED_EVENT, { detail: apiError }));
    }
    throw apiError;
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal, auth = true) => request<T>(path, { signal, auth }),
  post: <T>(path: string, body: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
};

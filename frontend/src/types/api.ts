/** Machine-readable error codes returned by the backend (`code` field of every error body). */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'NOT_FOUND'
  | 'COIN_NOT_FOUND'
  | 'INVALID_QUANTITY'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_HOLDINGS'
  | 'INVALID_PRICE'
  | 'COINGECKO_ERROR'
  | 'COINGECKO_RATE_LIMIT'
  | 'COINGECKO_UNAVAILABLE'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'ABORTED'
  | 'UNKNOWN';

export interface ApiFieldError {
  field: string;
  message: string;
}

/** Normalised error thrown by the API client: HTTP status + backend code + readable French message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors: ApiFieldError[];

  constructor(message: string, status: number, code: ApiErrorCode, fieldErrors: ApiFieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isAborted(): boolean {
    return this.code === 'ABORTED';
  }
}

/** Generic page envelope, mirrored from the backend `Paginated[T]` schema. */
export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/**
 * Generic representation of an API call as seen by the UI.
 * Discriminated on `status` so that `data` is guaranteed non-null on success.
 */
export type ApiResponse<T> =
  | { status: 'idle'; loading: false; data: null; error: null }
  | { status: 'loading'; loading: true; data: T | null; error: null }
  | { status: 'success'; loading: false; data: T; error: null }
  | { status: 'error'; loading: false; data: T | null; error: ApiError };

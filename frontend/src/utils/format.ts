const LOCALE = 'fr-FR';
const PLACEHOLDER = '—';

const formatterCache = new Map<string, Intl.NumberFormat>();

function numberFormatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Decimal places adapted to the magnitude of a crypto price (0.00001234 € must stay readable). */
export function priceFractionDigits(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0) return 2;
  if (abs < 0.01) return 8;
  if (abs < 1) return 4;
  return 2;
}

export interface CurrencyOptions {
  compact?: boolean;
  maximumFractionDigits?: number;
}

export function formatCurrency(value: number | null | undefined, options: CurrencyOptions = {}): string {
  if (!isNumber(value)) return PLACEHOLDER;
  if (options.compact) {
    return numberFormatter({ style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 2 }).format(value);
  }
  const digits = options.maximumFractionDigits ?? priceFractionDigits(value);
  return numberFormatter({ style: 'currency', currency: 'EUR', minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits }).format(value);
}

export interface PercentOptions {
  signed?: boolean;
  digits?: number;
}

export function formatPercent(value: number | null | undefined, options: PercentOptions = {}): string {
  if (!isNumber(value)) return PLACEHOLDER;
  const { signed = true, digits = 2 } = options;
  const formatted = numberFormatter({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value));
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${signed ? sign : value < 0 ? '-' : ''}${formatted} %`;
}

/** Crypto quantities: up to 8 decimals, trailing zeros trimmed by Intl. */
export function formatQuantity(value: number | null | undefined, symbol?: string): string {
  if (!isNumber(value)) return PLACEHOLDER;
  const formatted = numberFormatter({ maximumFractionDigits: 8 }).format(value);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (!isNumber(value)) return PLACEHOLDER;
  return numberFormatter({ notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

export function formatDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return PLACEHOLDER;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return PLACEHOLDER;
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

/** Short axis/tooltip label for charts depending on the range (intraday vs multi-day). */
export function formatChartTime(timestamp: number, intraday: boolean): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(
    LOCALE,
    intraday ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' },
  ).format(date);
}

/** Round a quantity down to 8 decimals (what the backend accepts). */
export function floorQuantity(value: number): number {
  return Math.floor(value * 1e8) / 1e8;
}

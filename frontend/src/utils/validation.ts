import type { TransactionType } from '@/types';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
export const PASSWORD_MIN_LENGTH = 8;
export const QUANTITY_MAX_DECIMALS = 8;
export const MIN_TRADE_TOTAL = 0.01;

/** Each validator returns an error message (French) or null when the value is valid. */
export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "L'email est obligatoire.";
  if (!EMAIL_REGEX.test(value)) return 'Adresse email invalide.';
  return null;
}

export function validateUsername(username: string): string | null {
  const value = username.trim();
  if (!value) return "Le nom d'utilisateur est obligatoire.";
  if (!USERNAME_REGEX.test(value)) return '3 à 20 caractères : lettres, chiffres et underscore uniquement.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Le mot de passe est obligatoire.';
  if (password.length < PASSWORD_MIN_LENGTH) return `Au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  if (!/[A-Z]/.test(password)) return 'Au moins une majuscule.';
  if (!/[a-z]/.test(password)) return 'Au moins une minuscule.';
  if (!/\d/.test(password)) return 'Au moins un chiffre.';
  return null;
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Veuillez confirmer le mot de passe.';
  if (password !== confirmation) return 'Les mots de passe ne correspondent pas.';
  return null;
}

export function countDecimals(raw: string): number {
  const [, decimals = ''] = raw.split('.');
  return decimals.length;
}

/** Parse a user-typed quantity ("0,025" or "0.025"). Returns NaN when unparsable. */
export function parseQuantity(raw: string): number {
  const normalised = raw.trim().replace(',', '.');
  if (!normalised || !/^\d*\.?\d*$/.test(normalised)) return Number.NaN;
  return Number(normalised);
}

export interface TradeValidationInput {
  quantityRaw: string;
  type: TransactionType;
  price: number | null;
  cashBalance: number;
  heldQuantity: number;
}

export interface TradeValidationResult {
  quantity: number;
  total: number;
  error: string | null;
}

/** Client-side mirror of the backend rules (the server re-validates everything with its own price). */
export function validateTrade(input: TradeValidationInput): TradeValidationResult {
  const { quantityRaw, type, price, cashBalance, heldQuantity } = input;
  const quantity = parseQuantity(quantityRaw);
  const total = price !== null && Number.isFinite(quantity) ? quantity * price : 0;

  if (quantityRaw.trim() === '') return { quantity: 0, total: 0, error: null };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { quantity, total: 0, error: 'La quantité doit être supérieure à 0.' };
  }
  if (countDecimals(quantityRaw.trim().replace(',', '.')) > QUANTITY_MAX_DECIMALS) {
    return { quantity, total, error: `Maximum ${QUANTITY_MAX_DECIMALS} décimales.` };
  }
  if (price === null) return { quantity, total, error: 'Prix indisponible pour le moment.' };
  if (total < MIN_TRADE_TOTAL) return { quantity, total, error: 'Le montant doit être d’au moins 0,01 €.' };
  if (type === 'BUY' && total > cashBalance) {
    return { quantity, total, error: 'Vous ne disposez pas de suffisamment de fonds.' };
  }
  if (type === 'SELL' && quantity > heldQuantity) {
    return { quantity, total, error: 'Vous ne détenez pas cette quantité.' };
  }
  return { quantity, total, error: null };
}

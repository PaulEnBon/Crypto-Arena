import { describe, expect, it } from 'vitest';

import { parseQuantity, validateEmail, validatePassword, validateTrade } from '@/utils/validation';

describe('validateTrade', () => {
  const base = { price: 100, cashBalance: 1_000, heldQuantity: 5 };

  it('accepte une quantité valide et calcule le total', () => {
    expect(validateTrade({ ...base, type: 'BUY', quantityRaw: '2,5' })).toEqual({ quantity: 2.5, total: 250, error: null });
  });

  it('refuse les quantités nulles, négatives ou non numériques', () => {
    for (const raw of ['0', '-1', 'abc', '1e3']) {
      expect(validateTrade({ ...base, type: 'BUY', quantityRaw: raw }).error).toBe('La quantité doit être supérieure à 0.');
    }
  });

  it('refuse plus de 8 décimales', () => {
    expect(validateTrade({ ...base, type: 'BUY', quantityRaw: '0.000000001' }).error).toBe('Maximum 8 décimales.');
  });

  it('applique une règle différente selon le type de transaction', () => {
    expect(validateTrade({ ...base, type: 'BUY', quantityRaw: '20' }).error).toBe('Vous ne disposez pas de suffisamment de fonds.');
    expect(validateTrade({ ...base, type: 'SELL', quantityRaw: '20' }).error).toBe('Vous ne détenez pas cette quantité.');
    expect(validateTrade({ ...base, type: 'SELL', quantityRaw: '5' }).error).toBeNull();
  });

  it('refuse un montant inférieur à un centime et un prix indisponible', () => {
    expect(validateTrade({ ...base, price: 0.0001, type: 'BUY', quantityRaw: '1' }).error).toBe('Le montant doit être d’au moins 0,01 €.');
    expect(validateTrade({ ...base, price: null, type: 'BUY', quantityRaw: '1' }).error).toBe('Prix indisponible pour le moment.');
  });
});

describe('validators de formulaire', () => {
  it('parseQuantity accepte la virgule française', () => {
    expect(parseQuantity('0,5')).toBe(0.5);
    expect(Number.isNaN(parseQuantity('1,2,3'))).toBe(true);
  });

  it('validateEmail / validatePassword renvoient un message ou null', () => {
    expect(validateEmail('')).toBe("L'email est obligatoire.");
    expect(validateEmail('demo@cryptoarena.dev')).toBeNull();
    expect(validatePassword('demo1234')).toBe('Au moins une majuscule.');
    expect(validatePassword('Demo123!')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { appReducer, initialAppState, type AppState } from '@/context/appReducer';
import type { Portfolio, User } from '@/types';

const user: User = { id: 1, username: 'alice', email: 'alice@cryptoarena.dev', created_at: '2026-01-01T00:00:00Z', is_demo: false };

const portfolio: Portfolio = {
  cash_balance: 10_000,
  initial_balance: 10_000,
  invested_amount: 0,
  holdings_value: 0,
  total_value: 10_000,
  profit_loss: 0,
  performance_pct: 0,
  assets: [],
  updated_at: '2026-01-01T00:00:00Z',
};

describe('appReducer', () => {
  it('LOGIN authentifie l’utilisateur sans muter l’état précédent', () => {
    const previous: AppState = { ...initialAppState };
    Object.freeze(previous);

    const next = appReducer(previous, { type: 'LOGIN', payload: user });

    expect(next).not.toBe(previous);
    expect(next).toMatchObject({ user, isAuthenticated: true, loading: false, error: null });
    expect(previous.user).toBeNull();
    expect(previous.isAuthenticated).toBe(false);
  });

  it('UPDATE_PORTFOLIO fusionne les champs et crée un nouvel objet portfolio', () => {
    const state = appReducer({ ...initialAppState, user, isAuthenticated: true }, { type: 'SET_PORTFOLIO', payload: portfolio });
    Object.freeze(state.portfolio);

    const next = appReducer(state, { type: 'UPDATE_PORTFOLIO', payload: { cash_balance: 8_000, total_value: 10_500 } });

    expect(next.portfolio).not.toBe(state.portfolio);
    expect(next.portfolio).toMatchObject({ cash_balance: 8_000, total_value: 10_500, initial_balance: 10_000 });
    expect(portfolio.cash_balance).toBe(10_000);
  });

  it('UPDATE_PORTFOLIO est ignoré tant qu’aucun portefeuille n’est chargé', () => {
    const state = { ...initialAppState, loading: false };
    expect(appReducer(state, { type: 'UPDATE_PORTFOLIO', payload: { cash_balance: 1 } })).toBe(state);
  });

  it('LOGOUT remet l’état initial avec loading à false', () => {
    const loggedIn = appReducer(initialAppState, { type: 'LOGIN', payload: user });
    const next = appReducer(loggedIn, { type: 'LOGOUT' });
    expect(next).toEqual({ ...initialAppState, loading: false });
  });
});

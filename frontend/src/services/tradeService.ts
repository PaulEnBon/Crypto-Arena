import { api } from '@/services/apiClient';
import type { TradeRequest, TradeResponse, TransactionType } from '@/types';

/** The backend resolves the price itself: the client only sends the coin id and the quantity. */
export function executeTrade(type: TransactionType, payload: TradeRequest): Promise<TradeResponse> {
  const path = type === 'BUY' ? '/trades/buy' : '/trades/sell';
  return api.post<TradeResponse>(path, payload);
}

import { api, buildQuery } from '@/services/apiClient';
import type { Paginated, Portfolio, SnapshotsResponse, Transaction } from '@/types';

export function fetchPortfolio(signal?: AbortSignal): Promise<Portfolio> {
  return api.get<Portfolio>('/portfolio', signal);
}

export function fetchTransactions(page = 1, pageSize = 20, signal?: AbortSignal): Promise<Paginated<Transaction>> {
  return api.get<Paginated<Transaction>>(`/portfolio/transactions${buildQuery({ page, page_size: pageSize })}`, signal);
}

export function fetchSnapshots(days = 30, signal?: AbortSignal): Promise<SnapshotsResponse> {
  return api.get<SnapshotsResponse>(`/portfolio/snapshots${buildQuery({ days })}`, signal);
}

import { Profiler, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CoinSearchResults } from '@/components/crypto/CoinSearchResults';
import { CryptoTable, type SortDirection, type SortKey } from '@/components/crypto/CryptoTable';
import { Card } from '@/components/ui/Card';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { useCoinSearch, useMarkets } from '@/hooks/useCoinGecko';
import { useDebounce } from '@/hooks/useDebounce';
import type { MarketData, MarketOrder } from '@/types';
import { logRenderProfile } from '@/utils/profiler';

type ChangeFilter = 'all' | 'gainers' | 'losers';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  market_cap_rank: 'asc',
  name: 'asc',
  current_price: 'desc',
  price_change_percentage_24h: 'desc',
  market_cap: 'desc',
  total_volume: 'desc',
};

function compareCoins(a: MarketData, b: MarketData, key: SortKey): number {
  if (key === 'name') return a.name.localeCompare(b.name, 'fr');
  const left = a[key] ?? Number.NEGATIVE_INFINITY;
  const right = b[key] ?? Number.NEGATIVE_INFINITY;
  return left - right;
}

export function MarketsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [order, setOrder] = useState<MarketOrder>('market_cap_desc');
  const [filter, setFilter] = useState<ChangeFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'market_cap_rank', direction: 'asc' });

  const markets = useMarkets({ page, perPage, order });
  const coins = markets.data?.coins;

  // useMemo justified: filtering + sorting up to 100 rows on every keystroke would otherwise
  // run on each unrelated re-render (e.g. the debounced remote search resolving).
  const visibleCoins = useMemo(() => {
    if (!coins) return [];
    const needle = search.trim().toLowerCase();
    const filtered = coins.filter((coin) => {
      if (needle && !coin.name.toLowerCase().includes(needle) && !coin.symbol.toLowerCase().includes(needle)) return false;
      const change = coin.price_change_percentage_24h ?? 0;
      if (filter === 'gainers') return change > 0;
      if (filter === 'losers') return change < 0;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => compareCoins(a, b, sort.key));
    return sort.direction === 'asc' ? sorted : sorted.reverse();
  }, [coins, search, filter, sort]);

  // Remote CoinGecko search only when the local page has no match (and after debouncing).
  const debouncedSearch = useDebounce(search, 400);
  const remoteSearchActive = debouncedSearch.trim().length >= 2 && coins !== undefined && visibleCoins.length === 0;
  const remote = useCoinSearch(remoteSearchActive ? debouncedSearch : '');

  // useCallback justified: passed to memoised CryptoRow components (memo is useless otherwise).
  const handleSelect = useCallback((coinId: string) => navigate(`/crypto/${coinId}`), [navigate]);
  const handleSort = useCallback((key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: DEFAULT_DIRECTION[key] },
    );
  }, []);

  const changePage = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marché"
        description="Cotations en euros fournies par CoinGecko, rafraîchies toutes les 60 secondes par le backend."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={(value) => setSearch(value)}
          placeholder="Rechercher une crypto (nom ou symbole)…"
          loading={remote.loading}
          className="flex-1"
          aria-label="Rechercher une cryptomonnaie"
        />
        <div className="flex flex-wrap gap-2">
          <select value={filter} onChange={(event) => setFilter(event.target.value as ChangeFilter)} className="input w-auto" aria-label="Filtrer par variation">
            <option value="all">Toutes</option>
            <option value="gainers">En hausse (24h)</option>
            <option value="losers">En baisse (24h)</option>
          </select>
          <select
            value={order}
            onChange={(event) => {
              setOrder(event.target.value as MarketOrder);
              setPage(1);
            }}
            className="input w-auto"
            aria-label="Ordre CoinGecko"
          >
            <option value="market_cap_desc">Market cap ↓</option>
            <option value="market_cap_asc">Market cap ↑</option>
            <option value="volume_desc">Volume ↓</option>
            <option value="volume_asc">Volume ↑</option>
          </select>
          <select
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
            className="input w-auto"
            aria-label="Résultats par page"
          >
            {[20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card padding="none">
        {markets.loading && !coins && <LoadingSpinner label="Chargement du marché…" />}
        {markets.error && !coins && (
          <div className="p-6">
            <ErrorMessage error={markets.error} onRetry={markets.refetch} />
          </div>
        )}
        {coins && visibleCoins.length > 0 && (
          <Profiler id="CryptoTable" onRender={logRenderProfile}>
            <CryptoTable coins={visibleCoins} sortKey={sort.key} sortDirection={sort.direction} onSort={handleSort} onSelect={handleSelect} />
          </Profiler>
        )}
        {coins && visibleCoins.length === 0 && (
          <div className="p-4">
            {remoteSearchActive ? (
              <>
                <p className="mb-2 px-2 text-xs tracking-wide text-ink-500 uppercase">Résultats CoinGecko</p>
                <CoinSearchResults
                  query={debouncedSearch}
                  loading={remote.loading}
                  error={remote.error}
                  coins={remote.data?.coins ?? []}
                  onSelect={handleSelect}
                  onRetry={remote.refetch}
                />
              </>
            ) : (
              <p className="py-6 text-center text-sm text-ink-400">Aucune cryptomonnaie ne correspond à ce filtre.</p>
            )}
          </div>
        )}
        {markets.error && coins && (
          <div className="border-t border-arena-700/60 p-4">
            <ErrorMessage error={markets.error} onRetry={markets.refetch} compact />
          </div>
        )}
      </Card>

      <Pagination page={page} hasNext={markets.data?.has_next ?? false} onChange={changePage} disabled={markets.loading || search.trim() !== ''} />
    </div>
  );
}

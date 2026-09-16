import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MarketsPage } from '@/pages/MarketsPage';
import { fetchMarkets } from '@/services/cryptoService';
import { ApiError, type MarketData, type MarketsResponse } from '@/types';

vi.mock('@/services/cryptoService', () => ({
  fetchMarkets: vi.fn(),
  searchCoins: vi.fn(),
  fetchCoin: vi.fn(),
  fetchCoinHistory: vi.fn(),
  fetchTrending: vi.fn(),
}));

const mockedFetchMarkets = vi.mocked(fetchMarkets);

const bitcoin: MarketData = {
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  image: null,
  current_price: 65000,
  market_cap: 1.3e12,
  market_cap_rank: 1,
  total_volume: 3e10,
  high_24h: 66000,
  low_24h: 64000,
  price_change_24h: 500,
  price_change_percentage_24h: 0.8,
  price_change_percentage_7d: 2.1,
  sparkline_7d: [1, 2, 3],
  last_updated: null,
};

const response: MarketsResponse = { page: 1, per_page: 50, order: 'market_cap_desc', coins: [bitcoin], has_next: true };

function renderPage() {
  return render(
    <MemoryRouter>
      <MarketsPage />
    </MemoryRouter>,
  );
}

describe('MarketsPage (états asynchrones)', () => {
  beforeEach(() => {
    mockedFetchMarkets.mockReset();
  });

  it('affiche le spinner pendant le chargement puis les données', async () => {
    let resolve: (value: MarketsResponse) => void = () => {};
    mockedFetchMarkets.mockReturnValue(new Promise<MarketsResponse>((r) => (resolve = r)));

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(/chargement du marché/i);
    expect(screen.queryByText('Bitcoin')).not.toBeInTheDocument();

    resolve(response);

    expect(await screen.findByText('Bitcoin')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it("affiche une erreur lisible quand l'API échoue et permet de réessayer", async () => {
    const user = userEvent.setup();
    mockedFetchMarkets
      .mockRejectedValueOnce(new ApiError('CoinGecko ne répond pas (délai dépassé).', 503, 'COINGECKO_UNAVAILABLE'))
      .mockResolvedValueOnce(response);

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('CoinGecko indisponible');
    expect(alert).toHaveTextContent('CoinGecko ne répond pas (délai dépassé).');

    await user.click(screen.getByRole('button', { name: /réessayer/i }));

    expect(await screen.findByText('Bitcoin')).toBeInTheDocument();
    await waitFor(() => expect(mockedFetchMarkets).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TransactionForm, type TransactionFormProps } from '@/components/trade/TransactionForm';

function renderForm(overrides: Partial<TransactionFormProps> = {}) {
  const props: TransactionFormProps = {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 100_000,
    cashBalance: 10_000,
    heldQuantity: 0.05,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<TransactionForm {...props} />);
  return props;
}

describe('TransactionForm', () => {
  it('refuse une quantité nulle et désactive le bouton', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/quantité/i), '0');

    expect(await screen.findByText('La quantité doit être supérieure à 0.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acheter btc/i })).toBeDisabled();
  });

  it("signale un solde insuffisant à l'achat", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/quantité/i), '1'); // 100 000 € > 10 000 € de cash

    expect(await screen.findByText('Vous ne disposez pas de suffisamment de fonds.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acheter btc/i })).toBeDisabled();
  });

  it('valide différemment selon le type : la même quantité est refusée à la vente mais acceptée à l’achat', async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText(/quantité/i);

    await user.type(input, '0.06'); // 6 000 € : achat possible
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acheter btc/i })).toBeEnabled();

    await user.click(screen.getByRole('tab', { name: /vendre/i })); // mais on ne détient que 0.05 BTC
    expect(await screen.findByText('Vous ne détenez pas cette quantité.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vendre btc/i })).toBeDisabled();

    await user.clear(input);
    await user.type(input, '0.01');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vendre btc/i })).toBeEnabled();
  });

  it('demande une confirmation puis transmet le type et la quantité au parent', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/quantité/i), '0.02');
    await user.click(screen.getByRole('button', { name: /acheter btc/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Bitcoin');
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /confirmer l’achat/i }));

    expect(onSubmit).toHaveBeenCalledWith('BUY', 0.02);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/quantité/i)).toHaveValue('');
  });
});

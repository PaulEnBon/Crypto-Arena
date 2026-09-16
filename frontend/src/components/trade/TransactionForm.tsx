import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import type { TransactionType } from '@/types';
import { floorQuantity, formatCurrency, formatQuantity } from '@/utils/format';
import { validateTrade } from '@/utils/validation';

export interface TransactionFormProps {
  symbol: string;
  name: string;
  /** Displayed price; the backend re-resolves the real price when executing. */
  price: number | null;
  cashBalance: number;
  heldQuantity: number;
  onSubmit: (type: TransactionType, quantity: number) => Promise<void>;
  initialType?: TransactionType;
}

const QUICK_PERCENTAGES = [25, 50, 100] as const;

/**
 * Controlled buy/sell form: live validation against the client-side balance/holdings,
 * total preview, confirmation modal, then delegation to the server which owns the price.
 */
export function TransactionForm({ symbol, name, price, cashBalance, heldQuantity, onSubmit, initialType = 'BUY' }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [quantityRaw, setQuantityRaw] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isBuy = type === 'BUY';
  const validation = validateTrade({ quantityRaw, type, price, cashBalance, heldQuantity });
  const hasQuantity = quantityRaw.trim() !== '';
  const canSubmit = hasQuantity && validation.error === null && price !== null;
  const balanceAfter = isBuy ? cashBalance - validation.total : cashBalance + validation.total;
  const heldAfter = isBuy ? heldQuantity + validation.quantity : heldQuantity - validation.quantity;

  const applyPercentage = (percentage: number) => {
    if (price === null || price <= 0) return;
    const quantity = isBuy ? floorQuantity((cashBalance * percentage) / 100 / price) : floorQuantity((heldQuantity * percentage) / 100);
    setQuantityRaw(quantity > 0 ? String(quantity) : '');
    setSubmitError(null);
  };

  const switchType = (next: TransactionType) => {
    setType(next);
    setSubmitError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setConfirmOpen(true);
  };

  const confirm = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(type, validation.quantity);
      setQuantityRaw('');
      setConfirmOpen(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'La transaction a échoué.');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label={`Formulaire de transaction ${symbol}`}>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-arena-900 p-1" role="tablist" aria-label="Type de transaction">
          <button
            type="button"
            role="tab"
            aria-selected={isBuy}
            onClick={() => switchType('BUY')}
            className={`rounded-lg py-2 text-sm font-semibold transition ${isBuy ? 'bg-gain-500 text-arena-950' : 'text-ink-400 hover:text-ink-100'}`}
          >
            Acheter
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isBuy}
            onClick={() => switchType('SELL')}
            className={`rounded-lg py-2 text-sm font-semibold transition ${!isBuy ? 'bg-loss-500 text-white' : 'text-ink-400 hover:text-ink-100'}`}
          >
            Vendre
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-arena-900/70 p-3">
            <dt className="text-xs text-ink-500">Prix actuel</dt>
            <dd className="font-semibold tabular">{formatCurrency(price)}</dd>
          </div>
          <div className="rounded-xl bg-arena-900/70 p-3">
            <dt className="text-xs text-ink-500">{isBuy ? 'Cash disponible' : `${symbol} détenus`}</dt>
            <dd className="font-semibold tabular">{isBuy ? formatCurrency(cashBalance) : formatQuantity(heldQuantity, symbol)}</dd>
          </div>
        </dl>

        <FormField
          id="trade-quantity"
          label={`Quantité (${symbol})`}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          value={quantityRaw}
          onChange={(event) => {
            setQuantityRaw(event.target.value);
            setSubmitError(null);
          }}
          error={validation.error}
        />

        <div className="flex gap-2">
          {QUICK_PERCENTAGES.map((percentage) => (
            <button
              key={percentage}
              type="button"
              onClick={() => applyPercentage(percentage)}
              disabled={price === null || (isBuy ? cashBalance <= 0 : heldQuantity <= 0)}
              className="flex-1 rounded-lg border border-arena-600 py-1.5 text-xs font-medium text-ink-300 transition hover:border-accent-500/50 hover:text-ink-100 disabled:opacity-40"
            >
              {percentage === 100 ? 'Max' : `${percentage} %`}
            </button>
          ))}
        </div>

        <dl className="space-y-1.5 rounded-xl border border-arena-700/70 p-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-400">Total estimé</dt>
            <dd className="font-semibold tabular">{formatCurrency(hasQuantity ? validation.total : 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">{isBuy ? 'Solde après achat' : 'Solde après vente'}</dt>
            <dd className={`tabular ${balanceAfter < 0 ? 'text-loss-400' : ''}`}>{formatCurrency(hasQuantity ? balanceAfter : cashBalance)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">Position après</dt>
            <dd className="tabular">{formatQuantity(hasQuantity ? Math.max(heldAfter, 0) : heldQuantity, symbol)}</dd>
          </div>
        </dl>

        {submitError && (
          <p role="alert" className="rounded-xl border border-loss-500/30 bg-loss-500/10 px-3 py-2 text-sm text-loss-300">
            {submitError}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" variant={isBuy ? 'success' : 'danger'} disabled={!canSubmit}>
          {isBuy ? `Acheter ${symbol}` : `Vendre ${symbol}`}
        </Button>
        <p className="text-center text-xs text-ink-500">Le prix final est déterminé par le serveur au moment de la transaction.</p>
      </form>

      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title={isBuy ? 'Confirmer l’achat' : 'Confirmer la vente'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button variant={isBuy ? 'success' : 'danger'} onClick={confirm} loading={submitting}>
              {isBuy ? 'Confirmer l’achat' : 'Confirmer la vente'}
            </Button>
          </>
        }
      >
        <p>
          {isBuy ? 'Acheter' : 'Vendre'} <strong>{formatQuantity(validation.quantity, symbol)}</strong> ({name}) pour environ{' '}
          <strong>{formatCurrency(validation.total)}</strong> ?
        </p>
        <p className="mt-2 text-ink-400">
          Le montant exact sera calculé avec le prix CoinGecko au moment de la validation. Aucun argent réel n’est engagé.
        </p>
      </Modal>
    </>
  );
}

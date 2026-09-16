import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FormField } from '@/components/ui/FormField';
import { IconLogout } from '@/components/ui/icons';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { PriceChange } from '@/components/ui/PriceChange';
import { useToast } from '@/context/ToastContext';
import { toApiError, useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { fetchProfile, updateUsername } from '@/services/profileService';
import { formatCurrency, formatDate } from '@/utils/format';
import { validateUsername } from '@/utils/validation';

export function ProfilePage() {
  const profile = useAsync((signal) => fetchProfile(signal), []);
  const { updateUser, logout } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const usernameError = validateUsername(username);

  const startEditing = () => {
    setUsername(profile.data?.user.username ?? '');
    setServerError(null);
    setEditing(true);
  };

  const submitUsername = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (usernameError) return;
    setSaving(true);
    setServerError(null);
    try {
      const user = await updateUsername(username.trim());
      updateUser(user);
      notify({ type: 'success', message: `Nom d’utilisateur mis à jour : ${user.username}` });
      setEditing(false);
      profile.refetch();
    } catch (error) {
      setServerError(toApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (profile.loading && !profile.data) return <LoadingSpinner fullPage label="Chargement du profil…" />;
  if (profile.error && !profile.data) return <ErrorMessage error={profile.error} onRetry={profile.refetch} />;
  if (!profile.data) return null;

  const data = profile.data;
  const tone = data.profit_loss >= 0 ? 'text-gain-400' : 'text-loss-400';
  const stats = [
    { label: 'Capital initial', value: formatCurrency(data.initial_balance) },
    { label: 'Capital actuel', value: formatCurrency(data.portfolio_value) },
    { label: 'Cash disponible', value: formatCurrency(data.cash_balance) },
    { label: 'Nombre de transactions', value: String(data.transactions_count) },
    { label: 'Position au classement', value: data.rank ? `#${data.rank} / ${data.total_players}` : '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil"
        description="Vos informations et vos statistiques de joueur."
        actions={
          <Button variant="secondary" onClick={handleLogout} icon={<IconLogout size={16} />}>
            Se déconnecter
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Identité">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-500/20 text-2xl font-bold text-accent-300">
              {data.user.username.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-xl font-bold">{data.user.username}</p>
              <p className="text-sm text-ink-400">{data.user.email}</p>
              {data.user.is_demo && (
                <Badge tone="warning" className="mt-1">
                  Compte de démonstration
                </Badge>
              )}
            </div>
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between border-b border-arena-700/50 pb-2">
              <dt className="text-ink-400">Membre depuis</dt>
              <dd>{formatDate(data.user.created_at, false)}</dd>
            </div>
            <div className="flex justify-between border-b border-arena-700/50 pb-2">
              <dt className="text-ink-400">Identifiant</dt>
              <dd className="tabular">#{data.user.id}</dd>
            </div>
          </dl>

          {editing ? (
            <form onSubmit={submitUsername} noValidate className="mt-5 space-y-3">
              <FormField
                id="profile-username"
                label="Nouveau nom d'utilisateur"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                error={username ? usernameError : null}
                autoFocus
              />
              {serverError && (
                <p role="alert" className="text-sm text-loss-300">
                  {serverError}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" loading={saving} disabled={Boolean(usernameError)}>
                  Enregistrer
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Annuler
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" size="sm" className="mt-5" onClick={startEditing}>
              Modifier le nom d’utilisateur
            </Button>
          )}
        </Card>

        <Card title="Statistiques">
          <div className="mb-4 rounded-xl bg-arena-900/70 p-4">
            <p className="text-xs tracking-wide text-ink-500 uppercase">Performance globale</p>
            <div className="mt-1 flex items-baseline gap-3">
              <PriceChange value={data.performance_pct} className="text-2xl font-bold" />
              <span className={`text-sm tabular ${tone}`}>
                {data.profit_loss >= 0 ? '+' : ''}
                {formatCurrency(data.profit_loss)}
              </span>
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            {stats.map((stat) => (
              <div key={stat.label} className="flex justify-between border-b border-arena-700/50 pb-2">
                <dt className="text-ink-400">{stat.label}</dt>
                <dd className="font-medium tabular">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

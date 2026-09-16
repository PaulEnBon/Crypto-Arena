import { Link, Navigate } from 'react-router-dom';

import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/Button';
import { IconMarkets, IconTrophy, IconWallet } from '@/components/ui/icons';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';

const FEATURES = [
  {
    icon: IconWallet,
    title: '10 000 € virtuels',
    text: 'Chaque joueur démarre avec le même capital fictif. Aucun argent réel, zéro risque.',
  },
  {
    icon: IconMarkets,
    title: 'Prix réels CoinGecko',
    text: 'Achetez et vendez Bitcoin, Ethereum, Solana… au prix du marché, validé côté serveur.',
  },
  {
    icon: IconTrophy,
    title: 'Classement en direct',
    text: 'Votre performance est comparée à celle de tous les traders de l’arène.',
  },
];

/** Public entry point. Authenticated users go straight to their dashboard. */
export function LandingPage() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingSpinner fullPage />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo size={36} />
        <nav className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost">Connexion</Button>
          </Link>
          <Link to="/register">
            <Button>Créer un compte</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-300">
            Simulation de trading crypto
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">
            Tradez les cryptos. <span className="text-accent-300">Sans risquer un centime.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-400">
            Crypto Arena est un jeu de simulation : un portefeuille virtuel de 10 000 €, des prix réels fournis
            par CoinGecko, et un classement pour départager les meilleurs stratèges.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register">
              <Button size="lg">Entrer dans l’arène</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                J’ai déjà un compte
              </Button>
            </Link>
          </div>
        </div>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="card p-6">
              <div className="inline-flex rounded-xl bg-accent-500/15 p-2.5 text-accent-300">
                <Icon size={22} />
              </div>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-ink-400">{text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

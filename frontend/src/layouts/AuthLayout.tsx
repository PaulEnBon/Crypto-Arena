import { Link, Navigate, Outlet } from 'react-router-dom';

import { Logo } from '@/components/layout/Logo';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';

const HIGHLIGHTS = [
  { title: '10 000 € virtuels', text: 'Un capital de départ identique pour tous les joueurs.' },
  { title: 'Prix réels', text: 'Cotations en direct via CoinGecko, achats et ventes au prix du marché.' },
  { title: 'Classement', text: 'Comparez votre performance à celle des autres traders de l’arène.' },
];

/** Public shell for /login and /register. Authenticated users are sent to the dashboard. */
export function AuthLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingSpinner fullPage />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-arena-700/70 bg-arena-900/60 p-10 lg:flex">
        <Link to="/">
          <Logo size={40} />
        </Link>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Entrez dans l’arène.</h1>
            <p className="mt-3 max-w-md text-ink-400">
              Simulez vos stratégies crypto sans risque, avec des données de marché réelles.
            </p>
          </div>
          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-400 shadow-glow" />
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-ink-400">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-ink-500">Projet universitaire · Aucun argent réel n’est utilisé.</p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex justify-center lg:hidden">
            <Logo size={36} />
          </Link>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';

import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/Button';
import { IconLogout, IconMenu, IconSearch } from '@/components/ui/icons';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/format';

export interface NavbarProps {
  onToggleSidebar: () => void;
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { user, logout } = useAuth();
  const { portfolio } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-arena-700/70 bg-arena-900/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-ink-300 hover:bg-arena-700 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <IconMenu />
          </button>
          <Link to="/dashboard" className="lg:hidden">
            <Logo size={28} />
          </Link>
          <Link
            to="/markets"
            className="hidden items-center gap-2 rounded-xl border border-arena-600 bg-arena-900 px-3 py-2 text-sm text-ink-400 transition hover:border-accent-500/50 hover:text-ink-200 md:flex"
          >
            <IconSearch size={16} />
            Rechercher une crypto…
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {portfolio && (
            <div className="hidden text-right sm:block">
              <p className="text-[11px] tracking-wide text-ink-500 uppercase">Cash disponible</p>
              <p className="text-sm font-semibold tabular">{formatCurrency(portfolio.cash_balance)}</p>
            </div>
          )}
          <Link to="/profile" className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-arena-700/70">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500/20 text-sm font-bold text-accent-300">
              {user?.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-sm font-medium sm:block">{user?.username}</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} icon={<IconLogout size={16} />}>
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

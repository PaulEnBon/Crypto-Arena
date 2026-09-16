import { NavLink } from 'react-router-dom';

import { Logo } from '@/components/layout/Logo';
import { IconClose, IconDashboard, IconMarkets, IconTrophy, IconUser, IconWallet } from '@/components/ui/icons';

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/markets', label: 'Marché', icon: IconMarkets },
  { to: '/portfolio', label: 'Portefeuille', icon: IconWallet },
  { to: '/leaderboard', label: 'Classement', icon: IconTrophy },
  { to: '/profile', label: 'Profil', icon: IconUser },
] as const;

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-arena-950/70 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-arena-700/70 bg-arena-900 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Navigation principale"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <NavLink to="/dashboard">
            <Logo />
          </NavLink>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-arena-700 lg:hidden" aria-label="Fermer le menu">
            <IconClose size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-xl border border-accent-500/20 bg-accent-500/10 p-3 text-xs text-ink-300">
          <p className="font-semibold text-accent-300">Mode simulation</p>
          <p className="mt-1">Argent 100 % virtuel, prix réels fournis par CoinGecko.</p>
        </div>
      </aside>
    </>
  );
}

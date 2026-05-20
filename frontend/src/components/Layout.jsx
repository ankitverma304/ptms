import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const NAV = [
  { to: '/',             icon: '⊞', label: 'Dashboard' },
  { to: '/projects',    icon: '📁', label: 'Projects' },
  { to: '/reports',     icon: '📊', label: 'Reports' },
  { to: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
  { to: '/timeline',    icon: '⏱', label: 'My Timeline' },
  { to: '/users',       icon: '👥', label: 'Users', adminOnly: true },
];

const ROLE_COLORS = {
  super_admin:     'bg-purple-100 text-purple-800',
  admin:           'bg-red-100 text-red-800',
  project_manager: 'bg-blue-100 text-blue-800',
  team_lead:       'bg-yellow-100 text-yellow-800',
  developer:       'bg-green-100 text-green-800',
  qa:              'bg-gray-100 text-gray-800',
};

function SidebarInner({ compact, user, onLogout }) {
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700 flex-shrink-0">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 text-white">P</div>
        {!compact && <span className="font-semibold text-sm tracking-wide text-white">PTMS</span>}
      </div>

      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}>
            <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>
            {!compact && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-700 p-3 flex-shrink-0">
        {!compact ? (
          <div>
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full mt-1 inline-block capitalize', ROLE_COLORS[user?.role])}>
              {user?.role?.replace(/_/g, ' ')}
            </span>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Points:</span>
              <span className={clsx('text-xs font-bold', (user?.total_points ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                {(user?.total_points ?? 0) >= 0 ? '+' : ''}{user?.total_points ?? 0}
              </span>
            </div>
            <button onClick={onLogout}
              className="mt-2 text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <span>↩</span><span>Sign out</span>
            </button>
          </div>
        ) : (
          <button onClick={onLogout} title="Sign out"
            className="text-slate-400 hover:text-white text-base w-full flex justify-center py-1">↩</button>
        )}
      </div>
    </>
  );
}

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);

  // Close mobile drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  // Filter admin-only nav items
  const visibleNav = NAV.filter(item => !item.adminOnly || hasRole('super_admin'));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Mobile backdrop ─────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile slide-in drawer ───────────────────── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-slate-900 shadow-2xl',
        'transition-transform duration-300 ease-in-out md:hidden',
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xs text-white">P</div>
            <span className="font-semibold text-sm text-white">PTMS</span>
          </div>
          <button onClick={() => setDrawerOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors',
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}>
              <span className="text-lg w-6 text-center flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full capitalize', ROLE_COLORS[user?.role])}>
                {user?.role?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full text-sm text-slate-400 hover:text-white py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors text-left flex items-center gap-2">
            <span>↩</span><span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Desktop sidebar ──────────────────────────── */}
      <aside className={clsx(
        'hidden md:flex flex-col bg-slate-900 relative flex-shrink-0',
        'transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}>
        <SidebarInner compact={collapsed} user={user} onLogout={handleLogout} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-5 -right-3 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-xs text-white hover:bg-blue-500 transition-colors z-10 shadow-sm">
          {collapsed ? '›' : '‹'}
        </button>
      </aside>

      {/* ── Main content area ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0 shadow-sm">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xs text-white">P</div>
            <span className="font-semibold text-sm text-slate-900">PTMS</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={clsx('hidden xs:inline-block text-xs px-2 py-0.5 rounded-full capitalize', ROLE_COLORS[user?.role])}>
              {user?.role?.replace(/_/g, ' ')}
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

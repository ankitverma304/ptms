import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const NAV = [
  { to: '/',            icon: '⊞', label: 'Dashboard' },
  { to: '/projects',   icon: '📁', label: 'Projects' },
  { to: '/reports',    icon: '📊', label: 'Reports' },
  { to: '/leaderboard',icon: '🏆', label: 'Leaderboard' },
  { to: '/timeline',   icon: '⏱', label: 'My Timeline' },
  { to: '/users',      icon: '👥', label: 'Users', adminOnly: true },
];

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate   = useNavigate();
  const [open, setOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const ROLE_COLORS = {
    super_admin: 'bg-purple-100 text-purple-800',
    admin:       'bg-red-100 text-red-800',
    project_manager: 'bg-blue-100 text-blue-800',
    team_lead:   'bg-yellow-100 text-yellow-800',
    developer:   'bg-green-100 text-green-800',
    qa:          'bg-gray-100 text-gray-800',
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className={clsx('flex flex-col bg-slate-900 text-white transition-all duration-200', open ? 'w-56' : 'w-16')}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">P</div>
          {open && <span className="font-semibold text-sm tracking-wide">PTMS</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map(item => {
            if (item.adminOnly && !hasRole('super_admin','admin')) return null;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                )}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {open && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-700 p-3">
          {open ? (
            <div>
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full mt-1 inline-block', ROLE_COLORS[user?.role])}>
                {user?.role?.replace('_',' ')}
              </span>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-400">Points:</span>
                <span className={clsx('text-xs font-bold', user?.total_points >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {user?.total_points >= 0 ? '+' : ''}{user?.total_points}
                </span>
              </div>
              <button onClick={handleLogout} className="mt-2 text-xs text-slate-400 hover:text-white transition-colors">Sign out</button>
            </div>
          ) : (
            <button onClick={handleLogout} title="Sign out" className="text-slate-400 hover:text-white text-sm">↩</button>
          )}
        </div>

        {/* Toggle */}
        <button onClick={() => setOpen(!open)} className="absolute top-4 -right-3 w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-xs text-white hover:bg-blue-500 transition-colors z-10">
          {open ? '‹' : '›'}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto relative">
        <Outlet />
      </main>
    </div>
  );
}

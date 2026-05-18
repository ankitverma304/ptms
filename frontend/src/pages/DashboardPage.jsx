import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { reportAPI, projectAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const StatCard = ({ label, value, sub, color = 'text-slate-900' }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5">
    <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
    <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: overdue } = useQuery('overdue', () =>
    reportAPI.overdue().then(r => r.data.data)
  );

  const { data: projects } = useQuery('projects-dash', () =>
    projectAPI.list({ limit: 5 }).then(r => r.data.data)
  );

  const { data: leaderboard } = useQuery('lb-dash', () =>
    reportAPI.leaderboard({ limit: 5 }).then(r => r.data.data)
  );

  const STATUS_COLOR = {
    not_started: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Your points" value={`${user?.total_points >= 0 ? '+' : ''}${user?.total_points ?? 0}`}
          color={user?.total_points >= 0 ? 'text-green-600' : 'text-red-600'} />
        <StatCard label="Active projects" value={projects?.length ?? '—'} />
        <StatCard label="Overdue tickets" value={overdue?.length ?? '—'} color={overdue?.length ? 'text-red-600' : 'text-slate-900'} />
        <StatCard label="Your role" value={user?.role?.replace(/_/g, ' ')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent projects */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Recent Projects</p>
            <Link to="/projects" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {projects?.map(p => (
              <Link key={p.id} to={`/projects/${p.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                  {p.code?.slice(0,3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.open_count} open tickets</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>
                  {p.status?.replace(/_/g, ' ')}
                </span>
              </Link>
            ))}
            {!projects?.length && (
              <p className="px-5 py-6 text-sm text-slate-400 text-center">No projects yet</p>
            )}
          </div>
        </div>

        {/* Overdue tickets */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-slate-700">Overdue Tickets</p>
          </div>
          <div className="divide-y divide-gray-50">
            {overdue?.slice(0, 5).map(t => (
              <Link key={t.id} to={`/tickets/${t.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                  <p className="text-xs text-slate-400">{t.ticket_code} · {t.assignee_name || 'Unassigned'}</p>
                </div>
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  {t.days_overdue}d overdue
                </span>
              </Link>
            ))}
            {!overdue?.length && (
              <p className="px-5 py-6 text-sm text-slate-400 text-center">No overdue tickets</p>
            )}
          </div>
        </div>

        {/* Leaderboard preview */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden md:col-span-2">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Top Performers</p>
            <Link to="/leaderboard" className="text-xs text-blue-600 hover:underline">Full leaderboard</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {leaderboard?.slice(0, 5).map((u, i) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-slate-400 font-bold text-sm w-6">#{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {u.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{u.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{u.role?.replace(/_/g, ' ')}</p>
                </div>
                <span className={`text-sm font-bold ${u.net_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {u.net_score >= 0 ? '+' : ''}{u.net_score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

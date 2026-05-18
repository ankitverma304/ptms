import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { reportAPI } from '../utils/api';

const RANK_ICONS = ['🥇','🥈','🥉'];

export default function LeaderboardPage() {
  const [projectId, setProjectId] = useState('');
  const [period, setPeriod]       = useState('all');

  const dateRange = () => {
    const now = new Date();
    if (period === 'week')  return { start_date: new Date(now - 7  * 86400000).toISOString().slice(0,10), end_date: now.toISOString().slice(0,10) };
    if (period === 'month') return { start_date: new Date(now - 30 * 86400000).toISOString().slice(0,10), end_date: now.toISOString().slice(0,10) };
    return {};
  };

  const { data, isLoading } = useQuery(
    ['leaderboard', projectId, period],
    () => reportAPI.leaderboard({ project_id: projectId || undefined, ...dateRange(), limit: 20 }).then(r => r.data.data),
    { keepPreviousData: true }
  );

  const maxScore = data ? Math.max(...data.map(u => Math.abs(u.period_score)), 1) : 1;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🏆 Leaderboard</h1>
          <p className="text-sm text-slate-500 mt-1">Developer points ranking based on ticket completion quality</p>
        </div>
        <div className="flex gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="all">All time</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
      </div>

      {/* Points legend */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Points rules</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'On time', pts: '+1', color: 'text-green-600 bg-green-50' },
            { label: 'Overdue', pts: '-1', color: 'text-red-600 bg-red-50' },
            { label: 'Minor bug (≤15 min)', pts: '-1', color: 'text-orange-600 bg-orange-50' },
            { label: 'Major bug (<2 hrs)', pts: '-5', color: 'text-red-600 bg-red-50' },
            { label: 'Critical bug (>5 hrs)', pts: '-10', color: 'text-red-800 bg-red-100' },
          ].map(r => (
            <div key={r.label} className={`rounded-lg p-2 text-center ${r.color}`}>
              <div className="text-lg font-bold">{r.pts}</div>
              <div className="text-xs mt-0.5">{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400">Loading leaderboard…</div>}

      {data && (
        <div className="space-y-3">
          {data.map((user, idx) => {
            const score    = user.period_score;
            const barPct   = Math.round(Math.abs(score) / maxScore * 100);
            const isPos    = score >= 0;

            return (
              <div key={user.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                {/* Rank */}
                <div className="w-10 text-center">
                  {idx < 3
                    ? <span className="text-2xl">{RANK_ICONS[idx]}</span>
                    : <span className="text-slate-400 font-bold text-sm">#{idx+1}</span>
                  }
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 text-sm truncate">{user.name}</p>
                    <span className="text-xs text-slate-400 capitalize">{user.role?.replace('_',' ')}</span>
                  </div>

                  {/* Score bar */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isPos ? 'bg-green-400' : 'bg-red-400'}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-12 text-right ${isPos ? 'text-green-600' : 'text-red-600'}`}>
                      {isPos ? '+' : ''}{score}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden md:flex gap-4 text-xs text-slate-500">
                  <div className="text-center">
                    <div className="font-medium text-green-600">{user.on_time_count}</div>
                    <div>On time</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-500">{user.overdue_count}</div>
                    <div>Overdue</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-orange-500">{user.bug_count}</div>
                    <div>Bugs</div>
                  </div>
                  {user.critical_bugs > 0 && (
                    <div className="text-center">
                      <div className="font-medium text-red-700">{user.critical_bugs}</div>
                      <div>Critical</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

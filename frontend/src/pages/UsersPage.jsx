import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { userAPI } from '../utils/api';

const ROLE_COLOR = {
  super_admin:     'bg-purple-100 text-purple-800',
  admin:           'bg-red-100 text-red-800',
  project_manager: 'bg-blue-100 text-blue-800',
  team_lead:       'bg-yellow-100 text-yellow-800',
  developer:       'bg-green-100 text-green-800',
  qa:              'bg-gray-100 text-gray-700',
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole]     = useState('');

  const { data, isLoading } = useQuery(
    ['users', search, role],
    () => userAPI.list({ search: search || undefined, role: role || undefined }).then(r => r.data.data),
    { keepPreviousData: true }
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-xs" />
        <select value={role} onChange={e => setRole(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="project_manager">Project Manager</option>
          <option value="team_lead">Team Lead</option>
          <option value="developer">Developer</option>
          <option value="qa">QA</option>
        </select>
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400">Loading users…</div>}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Points</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data?.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                      {u.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${ROLE_COLOR[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {u.role?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className={`px-5 py-3 text-right font-bold ${u.total_points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {u.total_points >= 0 ? '+' : ''}{u.total_points}
                </td>
                <td className="px-5 py-3 text-right">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No users found</p>
        )}
      </div>
    </div>
  );
}

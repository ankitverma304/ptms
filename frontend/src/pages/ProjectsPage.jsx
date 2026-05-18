import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { projectAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_COLOR = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
};

const PRIORITY_COLOR = {
  low: 'bg-gray-50 text-gray-600',
  medium: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-50 text-orange-600',
  critical: 'bg-red-50 text-red-600',
};

export default function ProjectsPage() {
  const { isPM } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', client_name: '', priority: 'medium', type: 'fixed_price', start_date: '', end_date: '' });

  const { data, isLoading } = useQuery(
    ['projects', status, search],
    () => projectAPI.list({ status: status || undefined, search: search || undefined }).then(r => r.data.data),
    { keepPreviousData: true }
  );

  const createMut = useMutation(projectAPI.create, {
    onSuccess: () => { qc.invalidateQueries('projects'); setShowForm(false); setForm({ name: '', description: '', client_name: '', priority: 'medium', type: 'fixed_price', start_date: '', end_date: '' }); toast.success('Project created'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Create failed'),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        {isPM() && (
          <button onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + New Project
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">New Project</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Project name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
              <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Client name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMut.mutate(form)} disabled={!form.name || createMut.isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {createMut.isLoading ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-xs" />
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400">Loading projects…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map(p => (
          <Link key={p.id} to={`/projects/${p.id}`}
            className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm hover:border-blue-200 transition-all block">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                {p.code?.slice(0, 3)}
              </div>
              <div className="flex gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[p.priority] || ''}`}>{p.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status] || ''}`}>{p.status?.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <p className="font-semibold text-slate-900 text-sm mb-1">{p.name}</p>
            {p.client_name && <p className="text-xs text-slate-400 mb-3">{p.client_name}</p>}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{p.open_count} open · {p.ticket_count} total</span>
              {p.end_date && <span className="text-slate-400">{new Date(p.end_date).toLocaleDateString()}</span>}
            </div>
          </Link>
        ))}
        {data?.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-400">No projects found</div>
        )}
      </div>
    </div>
  );
}

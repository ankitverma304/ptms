import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ticketAPI } from '../utils/api';

const PRIORITY_COLOR = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};
const STATUS_COLOR = {
  open:         'bg-gray-100 text-gray-700',
  in_progress:  'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  testing:      'bg-yellow-100 text-yellow-700',
  resolved:     'bg-green-100 text-green-700',
  closed:       'bg-slate-100 text-slate-600',
};

export default function TicketsPage() {
  const [status,   setStatus]   = useState('');
  const [priority, setPriority] = useState('');
  const [isBug,    setIsBug]    = useState('');
  const [search,   setSearch]   = useState('');

  const { data, isLoading } = useQuery(
    ['tickets-all', status, priority, isBug, search],
    () => ticketAPI.listAll({
      status:   status   || undefined,
      priority: priority || undefined,
      is_bug:   isBug    || undefined,
      search:   search   || undefined,
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const tickets = data?.data ?? [];
  const total   = data?.meta?.total ?? 0;

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Tickets</h1>
        <p className="text-sm text-slate-400 mt-0.5">{total} total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or code…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[160px] sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All statuses</option>
          {['open','in_progress','under_review','testing','resolved','closed'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
          ))}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All priorities</option>
          {['critical','high','medium','low'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={isBug} onChange={e => setIsBug(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All types</option>
          <option value="true">Bugs only</option>
          <option value="false">Tasks only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        {isLoading ? (
          <p className="px-5 py-10 text-sm text-slate-400 text-center">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="px-5 py-10 text-sm text-slate-400 text-center">No tickets found</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Ticket</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Project</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Assignee</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Priority</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tickets.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link to={`/tickets/${t.id}`} className="block">
                          <p className="font-medium text-slate-800 truncate max-w-[260px] hover:text-blue-600">{t.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{t.ticket_code}{t.is_bug ? ' · Bug' : ''}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 truncate max-w-[120px]">{t.project_name}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{t.assignee_name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority] || ''}`}>{t.priority}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] || ''}`}>{t.status?.replace(/_/g,' ')}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-400">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-gray-50">
              {tickets.map(t => (
                <Link key={t.id} to={`/tickets/${t.id}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {t.ticket_code} · {t.project_name} · {t.assignee_name || 'Unassigned'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] || ''}`}>
                      {t.status?.replace(/_/g,' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority] || ''}`}>
                      {t.priority}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

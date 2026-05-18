import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { projectAPI, ticketAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PRIORITY_COLOR = { low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
const STATUS_COLOR    = { open: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700', under_review: 'bg-purple-100 text-purple-700', testing: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-slate-100 text-slate-600' };

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, isPM } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('tickets');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState({ title: '', priority: 'medium', due_date: '', estimated_hrs: '' });

  const { data: proj, isLoading } = useQuery(
    ['project', id],
    () => projectAPI.get(id).then(r => r.data.data)
  );

  const { data: tickets } = useQuery(
    ['tickets', id],
    () => ticketAPI.list(id).then(r => r.data.data)
  );

  const createTicket = useMutation(
    (data) => ticketAPI.create({ ...data, project_id: +id }),
    {
      onSuccess: () => { qc.invalidateQueries(['tickets', id]); setShowTicketForm(false); setTicketForm({ title: '', priority: 'medium', due_date: '', estimated_hrs: '' }); toast.success('Ticket created'); },
      onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
    }
  );

  if (isLoading) return <div className="p-6 text-slate-400">Loading…</div>;
  if (!proj) return <div className="p-6 text-slate-400">Project not found</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/projects" className="text-xs text-slate-400 hover:text-slate-600 mb-2 inline-block">← Projects</Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{proj.name}</h1>
            <p className="text-sm text-slate-400 mt-1">{proj.code} · {proj.client_name}</p>
          </div>
          <div className="flex gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full ${PRIORITY_COLOR[proj.priority] || ''}`}>{proj.priority}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{proj.status?.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: proj.stats?.total },
          { label: 'Open', value: proj.stats?.open_count },
          { label: 'Done', value: proj.stats?.done_count },
          { label: 'Bugs', value: proj.stats?.bug_count },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{s.value ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-100">
        {['tickets', 'members'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'tickets' && (
        <div>
          {isPM() && (
            <div className="mb-4">
              {!showTicketForm ? (
                <button onClick={() => setShowTicketForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ New Ticket</button>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                      <input value={ticketForm.title} onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ticket title" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                      <select value={ticketForm.priority} onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                        {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Due date</label>
                      <input type="date" value={ticketForm.due_date} onChange={e => setTicketForm(f => ({ ...f, due_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => createTicket.mutate(ticketForm)} disabled={!ticketForm.title || createTicket.isLoading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                      {createTicket.isLoading ? 'Creating…' : 'Create'}
                    </button>
                    <button onClick={() => setShowTicketForm(false)} className="text-sm text-slate-500 px-4 py-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {tickets?.map(t => (
                <Link key={t.id} to={`/tickets/${t.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.ticket_code} · {t.assignee_name || 'Unassigned'}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority] || ''}`}>{t.priority}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[t.status] || ''}`}>{t.status?.replace(/_/g, ' ')}</span>
                  </div>
                  {t.due_date && (
                    <span className="text-xs text-slate-400 w-24 text-right">{new Date(t.due_date).toLocaleDateString()}</span>
                  )}
                </Link>
              ))}
              {!tickets?.length && (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">No tickets yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {proj.members?.map(m => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {m.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.email}</p>
                </div>
                <span className="text-xs text-slate-500 capitalize">{m.role_in_project}</span>
                <span className="text-xs text-slate-400 capitalize">{m.role?.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ticketAPI, commentAPI, timeLogAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PRIORITY_COLOR = { low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
const STATUS_COLOR    = { open: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700', under_review: 'bg-purple-100 text-purple-700', testing: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-slate-100 text-slate-600' };

const TRANSITIONS = {
  open: ['in_progress'],
  in_progress: ['under_review', 'open'],
  under_review: ['testing', 'in_progress'],
  testing: ['resolved', 'in_progress'],
  resolved: ['closed'],
  closed: [],
};

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [timeLog, setTimeLog] = useState({ hours: '', work_date: new Date().toISOString().slice(0, 10), note: '' });

  const { data: ticket, isLoading } = useQuery(
    ['ticket', id],
    () => ticketAPI.get(id).then(r => r.data.data)
  );

  const { data: comments } = useQuery(
    ['comments', id],
    () => commentAPI.list(id).then(r => r.data.data)
  );

  const statusMut = useMutation(
    (status) => ticketAPI.update(id, { status }),
    {
      onSuccess: () => { qc.invalidateQueries(['ticket', id]); toast.success('Status updated'); },
      onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
    }
  );

  const commentMut = useMutation(
    (body) => commentAPI.create(id, { body }),
    {
      onSuccess: () => { qc.invalidateQueries(['comments', id]); setComment(''); toast.success('Comment added'); },
      onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
    }
  );

  const timeMut = useMutation(
    (data) => timeLogAPI.log({ ...data, ticket_id: +id, hours: +data.hours }),
    {
      onSuccess: () => { qc.invalidateQueries(['ticket', id]); setTimeLog({ hours: '', work_date: new Date().toISOString().slice(0, 10), note: '' }); toast.success('Time logged'); },
      onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
    }
  );

  if (isLoading) return <div className="p-6 text-slate-400">Loading…</div>;
  if (!ticket) return <div className="p-6 text-slate-400">Ticket not found</div>;

  const nextStatuses = TRANSITIONS[ticket.status] || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to={`/projects/${ticket.project_id}`} className="text-xs text-slate-400 hover:text-slate-600 mb-2 inline-block">
        ← {ticket.project_name}
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-400 font-mono">{ticket.ticket_code}</span>
              {ticket.is_bug && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Bug · {ticket.bug_severity}</span>}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{ticket.title}</h1>
            {ticket.description && <p className="text-sm text-slate-500 mt-2">{ticket.description}</p>}
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full text-center ${PRIORITY_COLOR[ticket.priority] || ''}`}>{ticket.priority}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full text-center ${STATUS_COLOR[ticket.status] || ''}`}>{ticket.status?.replace(/_/g, ' ')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-50 text-sm">
          <div><p className="text-xs text-slate-400">Assignee</p><p className="font-medium">{ticket.assignee_name || '—'}</p></div>
          <div><p className="text-xs text-slate-400">Reporter</p><p className="font-medium">{ticket.reporter_name || '—'}</p></div>
          <div><p className="text-xs text-slate-400">Due date</p><p className="font-medium">{ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : '—'}</p></div>
          <div><p className="text-xs text-slate-400">Est. hours</p><p className="font-medium">{ticket.estimated_hrs ?? '—'}</p></div>
        </div>

        {nextStatuses.length > 0 && (
          <div className="mt-4 flex gap-2">
            <p className="text-xs text-slate-400 self-center">Move to:</p>
            {nextStatuses.map(s => (
              <button key={s} onClick={() => statusMut.mutate(s)} disabled={statusMut.isLoading}
                className="text-xs bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 px-3 py-1.5 rounded-lg transition-colors capitalize">
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: comments + log time */}
        <div className="md:col-span-2 space-y-4">
          {/* Log time */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">Log Time</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hours *</label>
                <input type="number" step="0.25" min="0.25" value={timeLog.hours}
                  onChange={e => setTimeLog(f => ({ ...f, hours: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="1.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={timeLog.work_date}
                  onChange={e => setTimeLog(f => ({ ...f, work_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                <input value={timeLog.note} onChange={e => setTimeLog(f => ({ ...f, note: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
              </div>
            </div>
            <button onClick={() => timeMut.mutate(timeLog)} disabled={!timeLog.hours || timeMut.isLoading}
              className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
              {timeMut.isLoading ? 'Logging…' : 'Log Time'}
            </button>
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-slate-700">Comments ({comments?.length ?? 0})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {comments?.map(c => (
                <div key={c.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">{c.author_name}</span>
                    <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-50">
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="Add a comment…" />
              <button onClick={() => commentMut.mutate(comment)} disabled={!comment.trim() || commentMut.isLoading}
                className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg">
                {commentMut.isLoading ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: history + time logs */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-slate-700">History</p>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {ticket.history?.map(h => (
                <div key={h.id} className="px-4 py-2.5">
                  <p className="text-xs text-slate-700 font-medium">{h.action?.replace(/_/g, ' ')}</p>
                  {h.field_changed && <p className="text-xs text-slate-400">{h.field_changed}: {h.old_value} → {h.new_value}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{h.user_name} · {new Date(h.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-slate-700">Time Logs</p>
            </div>
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {ticket.timeLogs?.map(tl => (
                <div key={tl.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">{tl.user_name}</span>
                    <span className="text-xs font-semibold text-blue-600">{tl.hours}h</span>
                  </div>
                  <p className="text-xs text-slate-400">{tl.work_date ? new Date(tl.work_date).toLocaleDateString() : ''}</p>
                  {tl.note && <p className="text-xs text-slate-500">{tl.note}</p>}
                </div>
              ))}
              {!ticket.timeLogs?.length && <p className="px-4 py-4 text-xs text-slate-400">No time logged</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

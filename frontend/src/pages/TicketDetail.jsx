import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ticketAPI, commentAPI, timeLogAPI, projectAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PRIORITY_COLOR = { low: 'bg-gray-100 text-gray-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' };
const STATUS_COLOR    = { open: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-700', under_review: 'bg-purple-100 text-purple-700', testing: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-slate-100 text-slate-600' };

const TRANSITIONS = {
  open:         ['in_progress'],
  in_progress:  ['under_review', 'open'],
  under_review: ['testing', 'in_progress'],
  testing:      ['resolved', 'in_progress'],
  resolved:     ['closed'],
  closed:       [],
};

const ROLE_RANK = { super_admin: 6, admin: 5, project_manager: 4, team_lead: 3, developer: 2, qa: 1 };

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [timeLog, setTimeLog] = useState({ hours: '', work_date: new Date().toISOString().slice(0, 10), note: '' });
  const [editingAssignee, setEditingAssignee] = useState(false);

  const { data: ticket, isLoading } = useQuery(
    ['ticket', id],
    () => ticketAPI.get(id).then(r => r.data.data)
  );

  const { data: comments } = useQuery(
    ['comments', id],
    () => commentAPI.list(id).then(r => r.data.data)
  );

  // Load project members for the assignee dropdown
  const { data: projectData } = useQuery(
    ['project', ticket?.project_id],
    () => projectAPI.get(ticket.project_id).then(r => r.data.data),
    { enabled: !!ticket?.project_id }
  );

  const canManage = (ROLE_RANK[user?.role] || 0) >= ROLE_RANK['team_lead'];

  // ── Status change ────────────────────────────────────────────
  const statusMut = useMutation(
    (status) => ticketAPI.changeStatus(id, status),
    {
      onSuccess: () => { qc.invalidateQueries(['ticket', id]); toast.success('Status updated'); },
      onError: (e) => toast.error(e.response?.data?.message || 'Status update failed'),
    }
  );

  // ── Assignee change ──────────────────────────────────────────
  const assignMut = useMutation(
    (assignee_id) => ticketAPI.update(id, { assignee_id: assignee_id || null }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['ticket', id]);
        setEditingAssignee(false);
        toast.success('Assignee updated');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Assignment failed'),
    }
  );

  // ── Comment ──────────────────────────────────────────────────
  const commentMut = useMutation(
    (body) => commentAPI.create(id, { body }),
    {
      onSuccess: () => { qc.invalidateQueries(['comments', id]); setComment(''); toast.success('Comment added'); },
      onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
    }
  );

  // ── Time log ─────────────────────────────────────────────────
  const timeMut = useMutation(
    (data) => timeLogAPI.log({ ...data, ticket_id: +id, hours: +data.hours }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['ticket', id]);
        setTimeLog({ hours: '', work_date: new Date().toISOString().slice(0, 10), note: '' });
        toast.success('Time logged');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
    }
  );

  if (isLoading) return <div className="p-4 sm:p-6 text-slate-400 text-sm">Loading…</div>;
  if (!ticket) return <div className="p-4 sm:p-6 text-slate-400 text-sm">Ticket not found</div>;

  const nextStatuses = TRANSITIONS[ticket.status] || [];
  const members = projectData?.members || [];

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-4xl mx-auto">
      <Link to={`/projects/${ticket.project_id}`} className="text-xs text-slate-400 hover:text-slate-600 mb-2 inline-block">
        ← {ticket.project_name}
      </Link>

      {/* ── Ticket header card ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 mb-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs text-slate-400 font-mono">{ticket.ticket_code}</span>
              {ticket.is_bug && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  Bug · {ticket.bug_severity}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">{ticket.title}</h1>
            {ticket.description && <p className="text-sm text-slate-500 mt-2">{ticket.description}</p>}
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full text-center ${PRIORITY_COLOR[ticket.priority] || ''}`}>
              {ticket.priority}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full text-center ${STATUS_COLOR[ticket.status] || ''}`}>
              {ticket.status?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-50 text-sm">
          {/* Assignee — editable for team_lead+ */}
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Assignee</p>
            {canManage && editingAssignee ? (
              <div className="flex items-center gap-1">
                <select
                  defaultValue={ticket.assignee_id || ''}
                  onChange={e => assignMut.mutate(e.target.value ? +e.target.value : null)}
                  disabled={assignMut.isLoading}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0">
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button onClick={() => setEditingAssignee(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 flex-shrink-0 text-xs">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-slate-800 truncate">{ticket.assignee_name || '—'}</p>
                {canManage && (
                  <button onClick={() => setEditingAssignee(true)}
                    className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 leading-none">
                    ✎
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-0.5">Reporter</p>
            <p className="font-medium text-slate-800 truncate">{ticket.reporter_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Due date</p>
            <p className="font-medium text-slate-800">
              {ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Est. hours</p>
            <p className="font-medium text-slate-800">{ticket.estimated_hrs ?? '—'}</p>
          </div>
        </div>

        {/* Status transition buttons */}
        {nextStatuses.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-400">Move to:</p>
            {nextStatuses.map(s => (
              <button key={s} onClick={() => statusMut.mutate(s)} disabled={statusMut.isLoading}
                className="text-xs bg-slate-100 hover:bg-blue-100 hover:text-blue-700 active:bg-blue-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors capitalize disabled:opacity-50">
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Two-column layout ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: log time + comments */}
        <div className="lg:col-span-2 space-y-4">

          {/* Log time */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">Log Time</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hours *</label>
                <input type="number" step="0.25" min="0.25" value={timeLog.hours}
                  onChange={e => setTimeLog(f => ({ ...f, hours: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={timeLog.work_date}
                  onChange={e => setTimeLog(f => ({ ...f, work_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                <input value={timeLog.note} onChange={e => setTimeLog(f => ({ ...f, note: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional" />
              </div>
            </div>
            <button onClick={() => timeMut.mutate(timeLog)} disabled={!timeLog.hours || timeMut.isLoading}
              className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
              {timeMut.isLoading ? 'Logging…' : 'Log Time'}
            </button>
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-slate-700">Comments ({comments?.length ?? 0})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {comments?.map(c => (
                <div key={c.id} className="px-4 sm:px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">{c.author_name}</span>
                    <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
              {!comments?.length && (
                <p className="px-5 py-6 text-sm text-slate-400 text-center">No comments yet</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-50">
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2} placeholder="Add a comment…" />
              <button onClick={() => commentMut.mutate(comment)} disabled={!comment.trim() || commentMut.isLoading}
                className="mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                {commentMut.isLoading ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: history + time logs */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-slate-700">History</p>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {ticket.history?.map(h => (
                <div key={h.id} className="px-4 py-2.5">
                  <p className="text-xs text-slate-700 font-medium capitalize">{h.action?.replace(/_/g, ' ')}</p>
                  {h.field_changed && (
                    <p className="text-xs text-slate-400">{h.field_changed}: {h.old_value} → {h.new_value}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">{h.user_name} · {new Date(h.created_at).toLocaleString()}</p>
                </div>
              ))}
              {!ticket.history?.length && (
                <p className="px-4 py-4 text-xs text-slate-400">No history</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-slate-700">Time Logs</p>
            </div>
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {ticket.timeLogs?.map(tl => (
                <div key={tl.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate">{tl.user_name}</span>
                    <span className="text-xs font-semibold text-blue-600 flex-shrink-0">{tl.hours}h</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {tl.work_date ? new Date(tl.work_date).toLocaleDateString() : ''}
                  </p>
                  {tl.note && <p className="text-xs text-slate-500 truncate">{tl.note}</p>}
                </div>
              ))}
              {!ticket.timeLogs?.length && (
                <p className="px-4 py-4 text-xs text-slate-400">No time logged</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

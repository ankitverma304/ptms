import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { reportAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { format, subDays } from 'date-fns';

const EVENT_META = {
  // Completion
  on_time:               { label: 'Resolved on time',          pill: 'bg-green-100 text-green-700' },
  overdue:               { label: 'Resolved overdue',          pill: 'bg-orange-100 text-orange-600' },
  complex_bonus:         { label: 'Complex task bonus',        pill: 'bg-purple-100 text-purple-700' },
  // Bug created (penalties)
  bug_created_minor:     { label: 'Bug created · Minor',       pill: 'bg-yellow-100 text-yellow-700' },
  bug_created_major:     { label: 'Bug created · Major',       pill: 'bg-orange-100 text-orange-700' },
  bug_created_critical:  { label: 'Bug created · Critical',    pill: 'bg-red-100 text-red-700' },
  // Bug fixed (rewards)
  bug_fixed_minor:       { label: 'Bug fixed · Minor',         pill: 'bg-teal-100 text-teal-700' },
  bug_fixed_major:       { label: 'Bug fixed · Major',         pill: 'bg-teal-100 text-teal-700' },
  bug_fixed_critical:    { label: 'Bug fixed · Critical',      pill: 'bg-teal-100 text-teal-700' },
  // Fast fix bonuses
  fast_fix_minor:        { label: 'Fast fix bonus · Minor',    pill: 'bg-cyan-100 text-cyan-700' },
  fast_fix_major:        { label: 'Fast fix bonus · Major',    pill: 'bg-cyan-100 text-cyan-700' },
  fast_fix_critical:     { label: 'Fast fix bonus · Critical', pill: 'bg-cyan-100 text-cyan-700' },
  // Self-fix reduction
  self_fix_reduction:    { label: 'Self-fix reduction',        pill: 'bg-indigo-100 text-indigo-700' },
  // Manual
  manual_adjust:         { label: 'Manual adjustment',         pill: 'bg-blue-100 text-blue-700' },
};

const SCOPE_BANNER = {
  developer: { text: 'Showing your data only',           style: 'bg-blue-50 text-blue-700 border-blue-200' },
  qa:        { text: 'Showing your data only',           style: 'bg-blue-50 text-blue-700 border-blue-200' },
  team_lead: { text: 'Showing data for your team projects', style: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
};

export default function ReportsPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('super_admin', 'admin');

  const [tab, setTab] = useState('performance');
  const defaultEnd   = format(new Date(), 'yyyy-MM-dd');
  const defaultStart = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate]     = useState(defaultEnd);
  const [journeyUserId, setJourneyUserId] = useState('');

  const { data: perf, isLoading: perfLoading, isError: perfError } = useQuery(
    ['report-perf', startDate, endDate],
    () => reportAPI.userPerformance({ start_date: startDate, end_date: endDate }).then(r => r.data.data),
    { enabled: tab === 'performance' }
  );

  const { data: bugs, isLoading: bugsLoading, isError: bugsError } = useQuery(
    ['report-bugs', startDate, endDate],
    () => reportAPI.bugAnalytics({ start_date: startDate, end_date: endDate }).then(r => r.data.data),
    { enabled: tab === 'bugs' }
  );

  const { data: time, isLoading: timeLoading, isError: timeError } = useQuery(
    ['report-time', startDate, endDate],
    () => reportAPI.timeTracking({ start_date: startDate, end_date: endDate }).then(r => r.data.data),
    { enabled: tab === 'time' }
  );

  // Journey: admin picks a user; everyone else sees their own automatically
  const journeyTarget = isAdmin ? journeyUserId : user?.id;
  const { data: journey, isLoading: journeyLoading } = useQuery(
    ['points-journey', journeyTarget, startDate, endDate],
    () => reportAPI.pointsJourney({
      user_id: journeyTarget,
      start_date: startDate,
      end_date: endDate,
    }).then(r => r.data.data),
    { enabled: tab === 'performance' && !!journeyTarget, staleTime: 30_000 }
  );

  // Compute running totals (events arrive newest-first; reverse → accumulate → reverse back)
  const eventsWithRunning = (() => {
    if (!journey?.length) return [];
    let running = 0;
    return [...journey].reverse().map(e => {
      running += e.delta;
      return { ...e, running_total: running };
    }).reverse();
  })();

  const journeySummary = journey?.length ? {
    net:        journey.reduce((s, e) => s + e.delta, 0),
    on_time:    journey.filter(e => e.event_type === 'on_time').length,
    overdue:    journey.filter(e => e.event_type === 'overdue').length,
    bugs_made:  journey.filter(e => e.event_type.startsWith('bug_created_')).length,
    bugs_fixed: journey.filter(e => e.event_type.startsWith('bug_fixed_')).length,
  } : null;

  const fmtDate = d => { try { return format(new Date(d), 'MMM d, yyyy'); } catch { return '—'; } };

  const TABS = ['performance', 'bugs', 'time'];

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-slate-400 text-sm flex-shrink-0">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Scope banner for restricted roles */}
      {SCOPE_BANNER[user?.role] && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg border text-sm flex items-center gap-2 ${SCOPE_BANNER[user.role].style}`}>
          <span>ℹ</span>
          <span>{SCOPE_BANNER[user.role].text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 sm:mb-6 border-b border-gray-100 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium capitalize transition-colors whitespace-nowrap flex-shrink-0 ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'performance' ? 'User Performance' : t === 'bugs' ? 'Bug Analytics' : 'Time Tracking'}
          </button>
        ))}
      </div>

      {/* User performance */}
      {tab === 'performance' && (
        <div className="space-y-6">

          {/* ── Overview table ── */}
          {perfLoading
            ? <p className="text-sm text-slate-400 text-center py-12">Loading…</p>
            : perfError
              ? <p className="text-sm text-red-500 text-center py-12">Failed to load performance data. Please try again.</p>
              : !perf?.length
                ? <p className="text-sm text-slate-400 text-center py-12">No data for this period</p>
                : <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="px-5 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-slate-700">Overview</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Score</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">On Time</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Overdue</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Bugs Made</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Bugs Fixed</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Hours</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {perf.map(u => (
                            <tr key={u.id}
                              onClick={() => isAdmin && setJourneyUserId(String(u.id))}
                              className={`hover:bg-gray-50 ${isAdmin ? 'cursor-pointer' : ''} ${isAdmin && String(journeyUserId) === String(u.id) ? 'bg-blue-50' : ''}`}>
                              <td className="px-4 sm:px-5 py-3">
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                                    {u.name?.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate">{u.name}</p>
                                    <p className="text-xs text-slate-400 capitalize truncate">{u.role?.replace(/_/g, ' ')}</p>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-4 sm:px-5 py-3 text-right font-bold ${u.net_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {u.net_score >= 0 ? '+' : ''}{u.net_score}
                              </td>
                              <td className="px-4 sm:px-5 py-3 text-right text-green-600">{u.tasks_on_time}</td>
                              <td className="px-4 sm:px-5 py-3 text-right text-orange-500">{u.tasks_overdue}</td>
                              <td className="px-4 sm:px-5 py-3 text-right text-red-500">{(u.bugs_minor || 0) + (u.bugs_major || 0) + (u.bugs_critical || 0)}</td>
                              <td className="px-4 sm:px-5 py-3 text-right text-teal-600">{u.bugs_fixed || 0}</td>
                              <td className="px-4 sm:px-5 py-3 text-right text-slate-600">{u.total_hours}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {isAdmin && <p className="px-5 py-2 text-xs text-slate-400 border-t border-gray-50">Click a row to view that user's points journey below</p>}
                  </div>
          }

          {/* ── Points Journey ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Points Journey</p>
                <p className="text-xs text-slate-400 mt-0.5">Every ticket event that earned or deducted points</p>
              </div>
              {isAdmin && (
                <select
                  value={journeyUserId}
                  onChange={e => setJourneyUserId(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— Select a user —</option>
                  {perf?.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                </select>
              )}
            </div>

            {!journeyTarget ? (
              <p className="px-5 py-12 text-sm text-slate-400 text-center">Select a user above to view their points journey</p>
            ) : journeyLoading ? (
              <p className="px-5 py-12 text-sm text-slate-400 text-center">Loading…</p>
            ) : !journey?.length ? (
              <p className="px-5 py-12 text-sm text-slate-400 text-center">No point events in this period</p>
            ) : (
              <>
                {/* Mini summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-gray-100">
                  {[
                    { label: 'Net Score',  value: journeySummary.net,        color: journeySummary.net >= 0 ? 'text-green-600' : 'text-red-600', prefix: journeySummary.net > 0 ? '+' : '' },
                    { label: 'On Time',    value: journeySummary.on_time,    color: 'text-green-600',  prefix: '' },
                    { label: 'Bugs Made',  value: journeySummary.bugs_made,  color: 'text-red-500',    prefix: '' },
                    { label: 'Bugs Fixed', value: journeySummary.bugs_fixed, color: 'text-teal-600',   prefix: '' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.prefix}{s.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Timeline feed */}
                <div className="divide-y divide-gray-50">
                  {eventsWithRunning.map(ev => {
                    const meta = EVENT_META[ev.event_type] || { label: ev.event_type, pill: 'bg-gray-100 text-gray-700' };
                    return (
                      <div key={ev.id} className="px-5 py-4 flex items-start gap-3 sm:gap-5 hover:bg-gray-50 transition-colors">

                        {/* Date */}
                        <div className="w-20 flex-shrink-0 pt-0.5 hidden sm:block">
                          <p className="text-xs text-slate-400 leading-snug">{fmtDate(ev.created_at)}</p>
                        </div>

                        {/* Connector dot */}
                        <div className="flex flex-col items-center flex-shrink-0 pt-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ev.delta > 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                        </div>

                        {/* Ticket info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <Link
                              to={`/tickets/${ev.ticket_id}`}
                              className="text-xs font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline flex-shrink-0"
                            >
                              {ev.ticket_code}
                            </Link>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${meta.pill}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 truncate">{ev.ticket_title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{ev.project_name}</p>
                          <p className="text-xs text-slate-400 sm:hidden mt-0.5">{fmtDate(ev.created_at)}</p>
                        </div>

                        {/* Points delta + running total */}
                        <div className="flex flex-col items-end flex-shrink-0 text-right">
                          <span className={`text-lg font-bold leading-none ${ev.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {ev.delta > 0 ? '+' : ''}{ev.delta}
                          </span>
                          <span className="text-xs text-slate-400 mt-1">
                            Total {ev.running_total >= 0 ? '+' : ''}{ev.running_total}
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* Bug analytics */}
      {tab === 'bugs' && (
        bugsLoading
          ? <p className="text-sm text-slate-400 text-center py-12">Loading…</p>
          : bugsError
            ? <p className="text-sm text-red-500 text-center py-12">Failed to load bug analytics. Please try again.</p>
          : !bugs
            ? null
            : <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                  {[
                    { label: 'Total',    value: bugs.summary?.total_bugs,    color: 'text-slate-900' },
                    { label: 'Minor',    value: bugs.summary?.minor,         color: 'text-yellow-600' },
                    { label: 'Major',    value: bugs.summary?.major,         color: 'text-orange-600' },
                    { label: 'Critical', value: bugs.summary?.critical,      color: 'text-red-700' },
                    { label: 'Resolved', value: bugs.summary?.resolved_bugs, color: 'text-green-600' },
                    { label: 'Open',     value: bugs.summary?.open_bugs,     color: 'text-red-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 text-center shadow-sm">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {!bugs.summary?.total_bugs && (
                  <p className="text-sm text-slate-400 text-center py-8">No bug tickets in this period</p>
                )}

                {bugs.trend?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-700 mb-4">Bug trend</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={bugs.trend}>
                        <XAxis dataKey="wk" tick={{ fontSize: 11 }} tickFormatter={v => `W${v}`} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#EF4444" strokeWidth={2} dot={false} name="Bugs" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {bugs.topReporters?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-slate-700">Top Bug Reporters</p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 sm:px-5 py-2.5 text-xs font-semibold text-slate-500">User</th>
                            <th className="text-right px-4 sm:px-5 py-2.5 text-xs font-semibold text-slate-500">Bugs</th>
                            <th className="text-right px-4 sm:px-5 py-2.5 text-xs font-semibold text-slate-500">Critical</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {bugs.topReporters.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-4 sm:px-5 py-2.5 font-medium text-slate-800">{u.name}</td>
                              <td className="px-4 sm:px-5 py-2.5 text-right text-slate-600">{u.bug_count}</td>
                              <td className="px-4 sm:px-5 py-2.5 text-right text-red-600">{u.critical_count ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {bugs.topAssignees?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-slate-700">Most Bugs Assigned</p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 sm:px-5 py-2.5 text-xs font-semibold text-slate-500">User</th>
                            <th className="text-right px-4 sm:px-5 py-2.5 text-xs font-semibold text-slate-500">Bugs</th>
                            <th className="text-right px-4 sm:px-5 py-2.5 text-xs font-semibold text-slate-500">Pts lost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {bugs.topAssignees.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-4 sm:px-5 py-2.5 font-medium text-slate-800">{u.name}</td>
                              <td className="px-4 sm:px-5 py-2.5 text-right text-slate-600">{u.bug_count}</td>
                              <td className="px-4 sm:px-5 py-2.5 text-right text-red-600">{u.points_lost ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
      )}

      {/* Time tracking */}
      {tab === 'time' && (
        timeLoading
          ? <p className="text-sm text-slate-400 text-center py-12">Loading…</p>
          : timeError
            ? <p className="text-sm text-red-500 text-center py-12">Failed to load time tracking data. Please try again.</p>
          : !time
            ? null
            : <div className="space-y-4 sm:space-y-6">
                {time.daily?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-700 mb-4">Hours logged per day</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={time.daily}>
                        <XAxis dataKey="work_date" tick={{ fontSize: 11 }} tickFormatter={d => { try { return format(new Date(String(d).length === 10 ? d + 'T00:00' : d), 'MMM d'); } catch { return ''; } }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={v => [`${v} hrs`, 'Hours']} />
                        <Bar dataKey="hours" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-slate-700">By User</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[400px]">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500">User</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500">Total hrs</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500">Billable</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500">Tickets</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {time.byUser?.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-4 sm:px-5 py-3 font-medium text-slate-800">{u.name}</td>
                              <td className="px-4 sm:px-5 py-3 text-right text-blue-600 font-semibold">{u.total_hours}</td>
                              <td className="px-4 sm:px-5 py-3 text-right text-green-600">{u.billable_hours}</td>
                              <td className="px-4 sm:px-5 py-3 text-right text-slate-500">{u.tickets_worked}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!time.byUser?.length && <p className="px-5 py-8 text-sm text-slate-400 text-center">No data for this period</p>}
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-slate-700">By Project</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[360px]">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500">Project</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500">Logged hrs</th>
                            <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500">Est. hrs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {time.byProject?.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-4 sm:px-5 py-3">
                                <p className="font-medium text-slate-800 truncate">{p.name}</p>
                                <p className="text-xs text-slate-400">{p.code}</p>
                              </td>
                              <td className="px-4 sm:px-5 py-3 text-right text-blue-600 font-semibold">{p.logged_hours}</td>
                              <td className="px-4 sm:px-5 py-3 text-right text-slate-500">{p.estimated_hours ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!time.byProject?.length && <p className="px-5 py-8 text-sm text-slate-400 text-center">No data for this period</p>}
                  </div>
                </div>
              </div>
      )}
    </div>
  );
}

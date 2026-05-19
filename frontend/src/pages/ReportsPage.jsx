import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { reportAPI } from '../utils/api';
import { format, subDays } from 'date-fns';

export default function ReportsPage() {
  const [tab, setTab] = useState('performance');
  const defaultEnd   = format(new Date(), 'yyyy-MM-dd');
  const defaultStart = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate]     = useState(defaultEnd);

  const { data: perf } = useQuery(
    ['report-perf', startDate, endDate],
    () => reportAPI.userPerformance({ start_date: startDate, end_date: endDate }).then(r => r.data.data),
    { enabled: tab === 'performance' }
  );

  const { data: bugs } = useQuery(
    ['report-bugs', startDate, endDate],
    () => reportAPI.bugAnalytics({ start_date: startDate, end_date: endDate }).then(r => r.data.data),
    { enabled: tab === 'bugs' }
  );

  const { data: time } = useQuery(
    ['report-time', startDate, endDate],
    () => reportAPI.timeTracking({ start_date: startDate, end_date: endDate }).then(r => r.data.data),
    { enabled: tab === 'time' }
  );

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
      {tab === 'performance' && perf && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                    <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Score</th>
                    <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">On Time</th>
                    <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Overdue</th>
                    <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Bugs</th>
                    <th className="text-right px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {perf.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
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
                      <td className="px-4 sm:px-5 py-3 text-right text-slate-600">{u.total_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!perf?.length && <p className="px-5 py-8 text-sm text-slate-400 text-center">No data for this period</p>}
          </div>
        </div>
      )}

      {/* Bug analytics */}
      {tab === 'bugs' && bugs && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {[
              { label: 'Total', value: bugs.summary?.total_bugs, color: 'text-slate-900' },
              { label: 'Minor', value: bugs.summary?.minor, color: 'text-yellow-600' },
              { label: 'Major', value: bugs.summary?.major, color: 'text-orange-600' },
              { label: 'Critical', value: bugs.summary?.critical, color: 'text-red-700' },
              { label: 'Resolved', value: bugs.summary?.resolved_bugs, color: 'text-green-600' },
              { label: 'Open', value: bugs.summary?.open_bugs, color: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 text-center shadow-sm">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {bugs.trend?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-4">Bug trend (last 12 weeks)</p>
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
        </div>
      )}

      {/* Time tracking */}
      {tab === 'time' && time && (
        <div className="space-y-4 sm:space-y-6">
          {time.daily?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-4">Hours logged per day</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={time.daily}>
                  <XAxis dataKey="work_date" tick={{ fontSize: 11 }} tickFormatter={d => format(new Date(d + 'T00:00'), 'MMM d')} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => [`${v} hrs`, 'Hours']} />
                  <Bar dataKey="hours" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

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
        </div>
      )}
    </div>
  );
}

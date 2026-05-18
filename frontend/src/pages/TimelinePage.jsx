import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { timeLogAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { format, subDays } from 'date-fns';

export default function TimelinePage() {
  const { userId }    = useParams();
  const { user: me }  = useAuth();
  const targetId      = userId || me?.id;

  const defaultEnd   = format(new Date(), 'yyyy-MM-dd');
  const defaultStart = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate,   setEndDate]   = useState(defaultEnd);

  const { data, isLoading } = useQuery(
    ['timeline', targetId, startDate, endDate],
    () => timeLogAPI.userTimeline(targetId, { start_date: startDate, end_date: endDate }).then(r => r.data.data),
    { enabled: !!targetId }
  );

  const score  = data?.scoreSummary;
  const bugMap = Object.fromEntries((data?.bugSummary || []).map(b => [b.bug_severity, b.cnt]));

  const StatCard = ({ label, value, color = 'text-slate-900' }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">⏱ My Timeline</h1>
        <div className="flex gap-2 items-center">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className="text-sm border border-gray-200 rounded-lg px-3 py-2" />
        </div>
      </div>

      {isLoading && <div className="text-center py-16 text-slate-400">Loading timeline…</div>}

      {data && (
        <>
          {/* Score cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatCard label="Net score" value={`${score?.net_score >= 0 ? '+' : ''}${score?.net_score}`} color={score?.net_score >= 0 ? 'text-green-600' : 'text-red-600'} />
            <StatCard label="On time" value={score?.on_time?.count ?? 0} color="text-green-600" />
            <StatCard label="Overdue" value={score?.overdue?.count ?? 0} color="text-orange-600" />
            <StatCard label="Bugs total" value={(bugMap.minor||0)+(bugMap.major||0)+(bugMap.critical||0)} color="text-red-500" />
            <StatCard label="Critical bugs" value={bugMap.critical || 0} color="text-red-700" />
          </div>

          {/* Bug severity breakdown */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { key: 'minor',    label: 'Minor bugs',    pts: '-1 each', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
              { key: 'major',    label: 'Major bugs',    pts: '-5 each', color: 'bg-orange-50 border-orange-200 text-orange-700' },
              { key: 'critical', label: 'Critical bugs', pts: '-10 each', color: 'bg-red-50 border-red-200 text-red-700' },
            ].map(b => (
              <div key={b.key} className={`rounded-xl border p-4 ${b.color}`}>
                <p className="text-xs font-medium">{b.label}</p>
                <p className="text-3xl font-bold mt-1">{bugMap[b.key] || 0}</p>
                <p className="text-xs mt-1 opacity-70">{b.pts} = {((bugMap[b.key] || 0) * parseInt(b.pts))} pts</p>
              </div>
            ))}
          </div>

          {/* Hours chart */}
          {data.daily?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
              <p className="text-sm font-semibold text-slate-700 mb-4">Hours logged per day</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.daily}>
                  <XAxis dataKey="work_date" tick={{ fontSize: 11 }} tickFormatter={d => format(new Date(d), 'MMM d')} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => [`${v} hrs`, 'Hours']} labelFormatter={d => format(new Date(d), 'MMM d, yyyy')} />
                  <Bar dataKey="total_hours" fill="#3B82F6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Log table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-slate-700">Time log entries ({data.logs?.length})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {data.logs?.map(log => (
                <div key={log.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
                  <div className="w-20 text-xs text-slate-400">{format(new Date(log.work_date), 'MMM d')}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{log.title}</p>
                    <p className="text-xs text-slate-400">{log.project_code} · {log.project_name}</p>
                  </div>
                  <div className="text-xs text-slate-500 max-w-xs truncate">{log.note}</div>
                  <div className="text-sm font-semibold text-blue-600 w-16 text-right">{log.hours}h</div>
                </div>
              ))}
              {!data.logs?.length && (
                <div className="px-5 py-8 text-center text-slate-400 text-sm">No time logs in this period</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { Activity, WeekSummary } from '../api/client';
import { CATEGORY_COLORS, CATEGORY_DOT, CATEGORY_ICONS } from './ActivityCard';

const RACE_DATE = new Date('2026-07-18T00:00:00');

function getCountdown() {
  const diff = RACE_DATE.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
  };
}

interface Props {
  activities: Activity[];
  weeks: WeekSummary[];
  onActivityClick?: (id: number) => void;
}

export default function LandingHero({ activities, weeks, onActivityClick }: Props) {
  const [countdown, setCountdown] = useState(getCountdown());

  useEffect(() => {
    const id = setInterval(() => setCountdown(getCountdown()), 60_000);
    return () => clearInterval(id);
  }, []);

  const runs = activities.filter(a => a.category === 'Run');
  const displayWeeks = weeks.slice(-8);
  const recentWeek = weeks[weeks.length - 1];
  const weeklyKm = recentWeek?.total_distance_km?.toFixed(1) ?? '—';
  const totalRuns = runs.length;
  const nextSession = activities
    .filter(a => new Date(a.date) > new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const maxKm = Math.max(...displayWeeks.map(w => w.total_distance_km ?? 0), 1);
  const maxLoad = Math.max(...displayWeeks.map(w => w.load_score ?? 0), 1);

  // Category breakdown
  const categoryCount: Record<string, number> = {};
  activities.forEach(a => { categoryCount[a.category] = (categoryCount[a.category] ?? 0) + 1; });
  const totalActivities = activities.length;
  const sortedCategories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);

  // Recent sessions (last 5)
  const recentSessions = [...activities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const stats = [
    {
      label: 'This week',
      value: `${weeklyKm} km`,
      sub: 'running volume',
      color: 'from-blue-600 to-blue-500',
    },
    {
      label: 'Total runs',
      value: String(totalRuns),
      sub: 'last 3 months',
      color: 'from-orange-600 to-orange-500',
    },
    {
      label: 'Next session',
      value: nextSession
        ? new Date(nextSession.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : 'Plan your week',
      sub: nextSession?.name ?? 'chat with your coach',
      color: 'from-purple-600 to-purple-500',
    },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-700/20 rounded-full blur-3xl" />
        <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-700/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-40 bg-orange-700/10 rounded-full blur-3xl -translate-x-1/2" />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero — centered */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
            Hybrid Day — Single Open Men · 18 Jul 2026
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-2 tracking-tight">
            {countdown.days}
            <span className="text-3xl md:text-4xl text-slate-400 font-normal ml-2">days</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10">until race day</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.label} className="bg-slate-800/60 border border-white/10 rounded-2xl p-5 text-left backdrop-blur-sm">
                <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">{s.label}</p>
                <p className={`text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
                <p className="text-slate-400 text-sm mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Weekly Volume Chart */}
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-5">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-4">Weekly Training Volume</p>
            {displayWeeks.length === 0 ? (
              <p className="text-slate-500 text-sm">No data yet.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-28">
                {displayWeeks.map((w, i) => {
                  const kmPct = ((w.total_distance_km ?? 0) / maxKm) * 100;
                  const loadPct = ((w.load_score ?? 0) / maxLoad) * 100;
                  const isLatest = i === displayWeeks.length - 1;
                  return (
                    <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {(w.total_distance_km ?? 0).toFixed(1)} km · load {w.load_score ?? 0}
                      </div>
                      <div className="w-full flex flex-col justify-end h-24 gap-px">
                        {/* Load overlay */}
                        <div
                          className="w-full rounded-t-sm opacity-20"
                          style={{ height: `${loadPct}%`, background: 'rgb(168,85,247)' }}
                        />
                        {/* Distance bar */}
                        <div
                          className={`w-full rounded-sm transition-all ${isLatest ? 'bg-blue-500' : 'bg-blue-700/70'}`}
                          style={{ height: `${Math.max(kmPct, 4)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 truncate w-full text-center">
                        {w.week.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-blue-500" />
                <span className="text-[10px] text-slate-400">Distance km</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-purple-500 opacity-40" />
                <span className="text-[10px] text-slate-400">Load</span>
              </div>
            </div>
          </div>

          {/* Activity Breakdown */}
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-5">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-4">
              Activity Breakdown
              <span className="text-slate-500 ml-2 normal-case">({totalActivities} total)</span>
            </p>
            {sortedCategories.length === 0 ? (
              <p className="text-slate-500 text-sm">No activities yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedCategories.map(([cat, count]) => {
                  const pct = Math.round((count / totalActivities) * 100);
                  const dotClass = CATEGORY_DOT[cat] ?? 'bg-gray-400';
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                          <span className="text-sm text-slate-300">{CATEGORY_ICONS[cat]} {cat}</span>
                        </div>
                        <span className="text-xs text-slate-400">{count} <span className="text-slate-600">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${dotClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-4">Recent Sessions</p>
          {recentSessions.length === 0 ? (
            <p className="text-slate-500 text-sm">No sessions yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {recentSessions.map(a => (
                <button
                  key={a.id}
                  onClick={() => onActivityClick?.(a.id)}
                  className="w-full text-left flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors cursor-pointer group"
                >
                  <div className={`${CATEGORY_COLORS[a.category] ?? 'bg-gray-500'} w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0`}>
                    {CATEGORY_ICONS[a.category]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{a.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {a.distance_km > 0 && ` · ${a.distance_km.toFixed(1)} km`}
                      {a.pace_per_km && ` · ${a.pace_per_km}/km`}
                      {a.avg_hr && ` · ♥ ${Math.round(a.avg_hr)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-500 text-xs">{a.duration_min}m</span>
                    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

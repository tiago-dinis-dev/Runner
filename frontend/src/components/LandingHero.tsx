import { useEffect, useState } from 'react';
import type { Activity, WeekSummary } from '../api/client';

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
  onOpenCalendar: () => void;
}

export default function LandingHero({ activities, weeks, onOpenCalendar }: Props) {
  const [countdown, setCountdown] = useState(getCountdown());

  useEffect(() => {
    const id = setInterval(() => setCountdown(getCountdown()), 60_000);
    return () => clearInterval(id);
  }, []);

  const runs = activities.filter(a => a.category === 'Run');
  const recentWeek = weeks[weeks.length - 1];
  const weeklyKm = recentWeek?.total_distance_km?.toFixed(1) ?? '—';
  const totalRuns = runs.length;
  const nextSessions = activities
    .filter(a => new Date(a.date) > new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextSession = nextSessions[0];

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

      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        {/* Race badge */}
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
          Hybrid Day — Single Open Men · 18 Jul 2026
        </div>

        {/* Countdown */}
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-2 tracking-tight">
          {countdown.days}
          <span className="text-3xl md:text-4xl text-slate-400 font-normal ml-2">days</span>
        </h1>
        <p className="text-slate-400 text-lg mb-10">until race day</p>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {stats.map(s => (
            <div
              key={s.label}
              className="bg-slate-800/60 border border-white/10 rounded-2xl p-5 text-left backdrop-blur-sm"
            >
              <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>
                {s.value}
              </p>
              <p className="text-slate-400 text-sm mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onOpenCalendar}
          className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors duration-200 cursor-pointer shadow-lg shadow-purple-900/30"
        >
          Open Training Calendar
        </button>
      </div>
    </section>
  );
}

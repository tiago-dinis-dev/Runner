import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { WeekSummary } from '../api/client';
import LandingHero from '../components/LandingHero';
import Calendar from '../components/Calendar';
import { useActivities } from '../hooks/useActivities';
import { usePlans, usePlan } from '../hooks/usePlan';
import { parsePlan } from '../components/planParser';

export default function Home() {
  const [showCalendar, setShowCalendar] = useState(false);
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const { activities, loading } = useActivities(100);
  const { plans } = usePlans();

  // Load the most recent Hyrox plan automatically
  const latestPlan = plans.find(p => p.race_type === 'Hyrox') ?? plans[0] ?? null;
  const { plan } = usePlan(latestPlan?.filename ?? null);
  const { sessions: planSessions, phases } = plan ? parsePlan(plan.content) : { sessions: [], phases: [] };

  useEffect(() => {
    api.weeklySummary(4).then(d => setWeeks(d.weeks)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏃</span>
            <span className="font-semibold text-white">Runner</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCalendar(false)}
              className={`text-sm cursor-pointer transition-colors ${!showCalendar ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Overview
            </button>
            <button
              onClick={() => setShowCalendar(true)}
              className={`text-sm cursor-pointer transition-colors ${showCalendar ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Calendar
            </button>
          </div>
        </div>
      </nav>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {!showCalendar ? (
            <LandingHero
              activities={activities}
              weeks={weeks}
              onOpenCalendar={() => setShowCalendar(true)}
            />
          ) : (
            <div className="max-w-5xl mx-auto px-6 py-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Training Calendar</h2>
                  {latestPlan && (
                    <p className="text-slate-400 text-sm mt-1">
                      Plan: {latestPlan.title}
                      {latestPlan.race_date && ` · Race ${latestPlan.race_date}`}
                    </p>
                  )}
                </div>
              </div>
              <Calendar activities={activities} planSessions={planSessions} phases={phases} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

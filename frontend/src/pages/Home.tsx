import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { WeekSummary, PlanMeta } from '../api/client';
import LandingHero from '../components/LandingHero';
import Calendar from '../components/Calendar';
import ActivityDetailModal from '../components/ActivityDetailModal';
import { useActivities } from '../hooks/useActivities';
import { usePlans, usePlan } from '../hooks/usePlan';
import { parsePlan, matchPlanSessions } from '../components/planParser';

// ── Trash icon ────────────────────────────────────────────────────────────────
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export default function Home() {
  const [showCalendar, setShowCalendar] = useState(false);
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const { activities, loading } = useActivities(100);
  const { plans, refetch: refetchPlans } = usePlans();

  const defaultPlan = plans.find(p => p.race_type === 'Hyrox') ?? plans[0] ?? null;
  const [selectedPlanMeta, setSelectedPlanMeta] = useState<PlanMeta | null>(null);
  const activePlanMeta = selectedPlanMeta ?? defaultPlan;

  const { plan, refetch: refetchPlanDetail } = usePlan(activePlanMeta?.filename ?? null);
  const { sessions: rawSessions, phases } = plan ? parsePlan(plan.content) : { sessions: [], phases: [] };
  const planSessions = matchPlanSessions(rawSessions, activities);

  useEffect(() => {
    api.weeklySummary(8).then(d => setWeeks(d.weeks)).catch(() => {});
  }, []);

  // Refetch plans when the chat widget saves a new one
  useEffect(() => {
    const handler = () => {
      refetchPlans();
      setShowCalendar(true);
      setShowAllPlans(true);
    };
    window.addEventListener('plan-saved', handler);
    return () => window.removeEventListener('plan-saved', handler);
  }, [refetchPlans]);

  async function handleDeletePlan(filename: string) {
    setDeletingFilename(filename);
    try {
      await api.deletePlan(filename);
      // If we deleted the active plan, fall back to next available
      if (filename === activePlanMeta?.filename) setSelectedPlanMeta(null);
      await refetchPlans();
    } finally {
      setDeletingFilename(null);
    }
  }

  const RACE_TYPE_COLORS: Record<string, string> = {
    Hyrox: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
    Run: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <ActivityDetailModal
        activityId={selectedActivityId}
        onClose={() => setSelectedActivityId(null)}
      />
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
            <LandingHero activities={activities} weeks={weeks} onActivityClick={setSelectedActivityId} />
          ) : (
            <div className="max-w-5xl mx-auto px-6 py-8">
              {/* Calendar header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Training Calendar</h2>
                  {activePlanMeta && (
                    <p className="text-slate-400 text-sm mt-1">
                      Active: {activePlanMeta.title}
                      {activePlanMeta.race_date && ` · Race ${activePlanMeta.race_date}`}
                    </p>
                  )}
                </div>
                {plans.length > 0 && (
                  <button
                    onClick={() => setShowAllPlans(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {showAllPlans ? 'Hide plans' : `All plans (${plans.length})`}
                  </button>
                )}
              </div>

              {/* All Plans panel */}
              {showAllPlans && plans.length > 0 && (
                <div className="mb-6 bg-slate-800/60 border border-white/10 rounded-2xl p-4">
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">Training Plans</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {plans.map(p => {
                      const isActive = p.filename === activePlanMeta?.filename;
                      const canDelete = !isActive || plans.length > 1;
                      const typeStyle = RACE_TYPE_COLORS[p.race_type ?? ''] ?? 'text-slate-300 bg-slate-500/10 border-slate-500/30';
                      const isDeleting = deletingFilename === p.filename;
                      return (
                        <div
                          key={p.filename}
                          className={`relative group rounded-xl border transition-all
                            ${isActive
                              ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500'
                              : 'border-white/10 bg-slate-900/40'
                            }`}
                        >
                          <button
                            onClick={() => setSelectedPlanMeta(p)}
                            className="w-full text-left p-3 pr-9 cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-white text-sm font-medium leading-tight">{p.title}</p>
                              {isActive && (
                                <span className="text-[10px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded font-medium shrink-0">Active</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                              {p.race_type && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${typeStyle}`}>
                                  {p.race_type}
                                </span>
                              )}
                              {p.race_date && (
                                <span className="text-[10px] text-slate-400">{p.race_date}</span>
                              )}
                            </div>
                            <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{p.preview}</p>
                          </button>

                          {/* Delete button — appears on hover */}
                          <div className="absolute top-2 right-2">
                            {canDelete ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeletePlan(p.filename); }}
                                disabled={isDeleting}
                                title={isActive ? 'Delete (another plan will become active)' : 'Delete plan'}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:cursor-wait"
                              >
                                {isDeleting
                                  ? <div className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                                  : <TrashIcon className="w-3.5 h-3.5" />
                                }
                              </button>
                            ) : (
                              <div
                                title="Only plan — create another before deleting this one"
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-700 cursor-not-allowed"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Calendar
                activities={activities}
                planSessions={planSessions}
                phases={phases}
                onActivityClick={setSelectedActivityId}
                activePlanFilename={activePlanMeta?.filename}
                onSessionMoved={refetchPlanDetail}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

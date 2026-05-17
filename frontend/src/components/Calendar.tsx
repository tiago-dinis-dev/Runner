import { useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  format, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns';
import type { Activity } from '../api/client';
import { CATEGORY_DOT, CATEGORY_ICONS, CATEGORY_COLORS } from './ActivityCard';

export interface PlanSession {
  date: string; // YYYY-MM-DD
  label: string;
  type: 'Run' | 'Hyrox' | 'Gym' | 'Erg' | 'Race';
  phase?: 'Base' | 'Build' | 'Race Week' | 'Vacation';
}

export interface PhaseRange {
  name: 'Base' | 'Build' | 'Race Week' | 'Vacation';
  label: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

interface Props {
  activities: Activity[];
  planSessions?: PlanSession[];
  phases?: PhaseRange[];
}

type ViewMode = 'both' | 'past' | 'plan';

export default function Calendar({ activities, planSessions = [], phases = [] }: Props) {
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('both');

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build grid of weeks
  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const actsByDate = activities.reduce<Record<string, Activity[]>>((acc, a) => {
    const d = a.date.slice(0, 10);
    (acc[d] ??= []).push(a);
    return acc;
  }, {});

  const planByDate = planSessions.reduce<Record<string, PlanSession[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  const selectedKey = selected ? format(selected, 'yyyy-MM-dd') : null;
  const selectedActivities = selectedKey ? (actsByDate[selectedKey] ?? []) : [];
  const selectedPlan = selectedKey ? (planByDate[selectedKey] ?? []) : [];

  const PLAN_COLORS: Record<string, string> = {
    Run: 'border-blue-400 text-blue-300',
    Hyrox: 'border-orange-400 text-orange-300',
    Gym: 'border-slate-400 text-slate-300',
    Erg: 'border-cyan-400 text-cyan-300',
    Race: 'border-yellow-400 text-yellow-300',
  };

  const PHASE_BG: Record<string, string> = {
    Base: 'rgba(34,197,94,0.08)',
    Build: 'rgba(59,130,246,0.08)',
    'Race Week': 'rgba(245,158,11,0.08)',
    Vacation: 'rgba(20,184,166,0.08)',
  };

  const PHASE_DOT: Record<string, string> = {
    Base: 'bg-green-500',
    Build: 'bg-blue-500',
    'Race Week': 'bg-amber-500',
    Vacation: 'bg-teal-500',
  };

  const PHASE_TEXT: Record<string, string> = {
    Base: 'text-green-400',
    Build: 'text-blue-400',
    'Race Week': 'text-amber-400',
    Vacation: 'text-teal-400',
  };

  function getPhaseForDate(dateStr: string): PhaseRange | undefined {
    return phases.find(p => dateStr >= p.start && dateStr <= p.end);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Calendar grid */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrent(subMonths(current, 1))}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-white font-semibold text-lg">
            {format(current, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrent(addMonths(current, 1))}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1 w-fit">
          {(['both', 'past', 'plan'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === mode
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode === 'both' ? 'All' : mode === 'past' ? 'Past' : 'Plan'}
            </button>
          ))}
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-xs text-slate-500 font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-rows-[repeat(auto,auto)] gap-px bg-white/5 rounded-xl overflow-hidden border border-white/10">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-px">
              {week.map((d) => {
                const key = format(d, 'yyyy-MM-dd');
                const inMonth = isSameMonth(d, current);
                const isSelected = selected ? isSameDay(d, selected) : false;
                const dayActs = (viewMode !== 'plan') ? (actsByDate[key] ?? []) : [];
                const dayPlan = (viewMode !== 'past') ? (planByDate[key] ?? []) : [];
                const today = isSameDay(d, new Date());
                const phase = inMonth ? getPhaseForDate(key) : undefined;

                return (
                  <button
                    key={key}
                    onClick={() => setSelected(isSameDay(d, selected ?? new Date('')) ? null : d)}
                    className={`min-h-[72px] p-1.5 text-left flex flex-col gap-0.5 transition-colors cursor-pointer
                      ${inMonth ? 'bg-slate-900/60' : 'bg-slate-900/20'}
                      ${isSelected ? 'ring-2 ring-purple-500 ring-inset' : ''}
                      ${today ? 'bg-slate-800/80' : ''}
                      hover:bg-slate-700/50`}
                    style={phase && viewMode !== 'past' ? { backgroundColor: PHASE_BG[phase.name] } : undefined}
                  >
                    <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                      ${today ? 'bg-purple-600 text-white' : inMonth ? 'text-slate-300' : 'text-slate-600'}`}>
                      {format(d, 'd')}
                    </span>
                    {/* Past activity dots */}
                    <div className="flex flex-wrap gap-0.5">
                      {dayActs.slice(0, 3).map((a, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[a.category] ?? 'bg-gray-400'}`}
                          title={`${CATEGORY_ICONS[a.category]} ${a.name}`}
                        />
                      ))}
                    </div>
                    {/* Plan sessions */}
                    {dayPlan.slice(0, 2).map((s, i) => (
                      <span
                        key={i}
                        className={`text-[9px] border rounded px-0.5 leading-3 ${PLAN_COLORS[s.type] ?? 'border-gray-400 text-gray-300'}`}
                        style={{ borderStyle: 'dashed' }}
                      >
                        {s.label.length > 10 ? s.label.slice(0, 10) + '…' : s.label}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(CATEGORY_DOT).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-xs text-slate-400">{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded-sm border border-dashed border-purple-400" />
            <span className="text-xs text-slate-400">Plan</span>
          </div>
        </div>
        {phases.length > 0 && viewMode !== 'past' && (
          <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-white/5">
            {phases.map(p => (
              <div key={p.name} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${PHASE_DOT[p.name]}`} style={{ opacity: 0.5 }} />
                <span className="text-xs text-slate-400">{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side panel */}
      {selected && (
        <div className="lg:w-72 bg-slate-800/60 border border-white/10 rounded-xl p-4 flex flex-col gap-4">
          <h3 className="text-white font-semibold">
            {format(selected, 'EEEE, d MMM')}
          </h3>

          {selectedActivities.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Completed</p>
              <div className="flex flex-col gap-2">
                {selectedActivities.map(a => (
                  <div key={a.id} className="flex items-start gap-2">
                    <div className={`${CATEGORY_COLORS[a.category] ?? 'bg-gray-500'} w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0`}>
                      {CATEGORY_ICONS[a.category]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{a.name}</p>
                      <p className="text-slate-400 text-xs">
                        {a.duration_min}m
                        {a.distance_km > 0 && ` · ${a.distance_km.toFixed(1)} km`}
                        {a.pace_per_km && ` · ${a.pace_per_km}/km`}
                        {a.avg_hr && ` · ♥ ${Math.round(a.avg_hr)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPlan.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Planned</p>
              <div className="flex flex-col gap-2">
                {selectedPlan.map((s, i) => (
                  <div key={i} className={`border rounded-lg p-2 ${PLAN_COLORS[s.type] ?? 'border-gray-500 text-gray-300'}`} style={{ borderStyle: 'dashed' }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{CATEGORY_ICONS[s.type === 'Erg' ? 'CardioMix' : s.type]} {s.label}</p>
                      {s.phase && (
                        <span className={`text-[10px] font-medium shrink-0 ${PHASE_TEXT[s.phase]}`}>{s.phase}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedActivities.length === 0 && selectedPlan.length === 0 && (
            <p className="text-slate-500 text-sm">No sessions on this day.</p>
          )}
        </div>
      )}
    </div>
  );
}

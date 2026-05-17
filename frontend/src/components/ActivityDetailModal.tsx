import { useEffect, useState } from 'react';
import { api, type ActivityDetail } from '../api/client';
import { CATEGORY_COLORS, CATEGORY_ICONS } from './ActivityCard';

interface Props {
  activityId: number | null;
  onClose: () => void;
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900/70 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
    </div>
  );
}

export default function ActivityDetailModal({ activityId, onClose }: Props) {
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) { setDetail(null); return; }
    setLoading(true);
    setError(null);
    api.activity(activityId)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activityId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!activityId) return null;

  const icon = detail ? (CATEGORY_ICONS[detail.category] ?? '🏅') : '⏳';
  const color = detail ? (CATEGORY_COLORS[detail.category] ?? 'bg-gray-500') : 'bg-slate-700';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides in from right */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-white/10 z-50 flex flex-col shadow-2xl overflow-hidden"
        style={{ animation: 'slideIn 0.22s ease-out' }}
      >
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          {detail && (
            <div className={`${color} w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {detail ? (
              <>
                <p className="text-white font-semibold text-sm truncate">{detail.name}</p>
                <p className="text-slate-400 text-xs">
                  {new Date(detail.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Loading…</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-white/10 shrink-0"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-sm">
              ⚠️ {error}
            </div>
          )}

          {detail && !loading && (
            <>
              {/* Key stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {detail.distance_km > 0 && (
                  <StatBadge label="Distance" value={`${detail.distance_km.toFixed(2)} km`} />
                )}
                <StatBadge label="Duration" value={`${detail.duration_min} min`} />
                {detail.pace_per_km && (
                  <StatBadge label="Avg pace" value={`${detail.pace_per_km}/km`} />
                )}
                {detail.avg_hr && (
                  <StatBadge label="Avg HR" value={`♥ ${Math.round(detail.avg_hr)}`} />
                )}
                {detail.max_hr && (
                  <StatBadge label="Max HR" value={`♥ ${Math.round(detail.max_hr)}`} />
                )}
                {detail.elevation_m != null && detail.elevation_m > 0 && (
                  <StatBadge label="Elevation" value={`↑ ${Math.round(detail.elevation_m)} m`} />
                )}
                {detail.calories != null && detail.calories > 0 && (
                  <StatBadge label="Calories" value={`${detail.calories} kcal`} />
                )}
                {detail.suffer_score != null && detail.suffer_score > 0 && (
                  <StatBadge label="Suffer score" value={detail.suffer_score} />
                )}
              </div>

              {/* Description */}
              {detail.description && (
                <div className="bg-slate-800/50 border border-white/5 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Notes</p>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{detail.description}</p>
                </div>
              )}

              {/* Km splits */}
              {detail.splits_metric && detail.splits_metric.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Km Splits</p>
                  <div className="bg-slate-800/50 border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left text-xs text-slate-500 px-3 py-2 font-medium">Km</th>
                          <th className="text-right text-xs text-slate-500 px-3 py-2 font-medium">Pace</th>
                          <th className="text-right text-xs text-slate-500 px-3 py-2 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {detail.splits_metric.map((s) => {
                          const mins = Math.floor(s.elapsed_sec / 60);
                          const secs = s.elapsed_sec % 60;
                          return (
                            <tr key={s.km} className="hover:bg-white/5 transition-colors">
                              <td className="px-3 py-2 text-slate-300">{s.km}</td>
                              <td className="px-3 py-2 text-right font-mono text-white">{s.pace}/km</td>
                              <td className="px-3 py-2 text-right text-slate-400 font-mono">
                                {mins}:{String(secs).padStart(2, '0')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Laps (only if meaningfully different from splits) */}
              {detail.laps && detail.laps.length > 1 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Laps</p>
                  <div className="bg-slate-800/50 border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left text-xs text-slate-500 px-3 py-2 font-medium">Lap</th>
                          <th className="text-right text-xs text-slate-500 px-3 py-2 font-medium">Dist</th>
                          <th className="text-right text-xs text-slate-500 px-3 py-2 font-medium">Pace</th>
                          <th className="text-right text-xs text-slate-500 px-3 py-2 font-medium">HR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {detail.laps.map((l, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-3 py-2 text-slate-300 truncate max-w-[100px]">{l.name}</td>
                            <td className="px-3 py-2 text-right text-slate-400">{l.distance_km} km</td>
                            <td className="px-3 py-2 text-right font-mono text-white">{l.pace}/km</td>
                            <td className="px-3 py-2 text-right text-slate-400">
                              {l.avg_hr ? `♥ ${Math.round(l.avg_hr)}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

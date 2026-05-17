import type { Activity } from '../api/client';

export const CATEGORY_COLORS: Record<string, string> = {
  Run: 'bg-blue-500',
  Hyrox: 'bg-orange-500',
  Gym: 'bg-slate-500',
  HIIT: 'bg-red-500',
  CardioMix: 'bg-cyan-500',
  Other: 'bg-gray-400',
};

export const CATEGORY_DOT: Record<string, string> = {
  Run: 'bg-blue-400',
  Hyrox: 'bg-orange-400',
  Gym: 'bg-slate-400',
  HIIT: 'bg-red-400',
  CardioMix: 'bg-cyan-400',
  Other: 'bg-gray-400',
};

export const CATEGORY_ICONS: Record<string, string> = {
  Run: '🏃',
  Hyrox: '🏋️',
  Gym: '💪',
  HIIT: '⚡',
  CardioMix: '🚴',
  Other: '🏅',
};

interface Props {
  activity: Activity;
  onClick?: () => void;
}

export default function ActivityCard({ activity, onClick }: Props) {
  const color = CATEGORY_COLORS[activity.category] ?? 'bg-gray-400';
  const icon = CATEGORY_ICONS[activity.category] ?? '🏅';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors duration-200 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className={`${color} w-9 h-9 rounded-lg flex items-center justify-center text-white text-base shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{activity.name}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {new Date(activity.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {activity.distance_km > 0 && ` · ${activity.distance_km.toFixed(1)} km`}
            {activity.pace_per_km && ` · ${activity.pace_per_km}/km`}
            {activity.avg_hr && ` · ♥ ${Math.round(activity.avg_hr)}`}
          </p>
        </div>
        <span className="text-slate-500 text-xs shrink-0">{activity.duration_min}m</span>
      </div>
    </button>
  );
}

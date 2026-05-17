export interface AthleteProfile {
  easyPacePerKm: string;
  tempoPacePerKm: string;
  intervalPacePerKm: string;
  estimatedHRmax: number | null;
  zone2HR: string;
  zone4HR: string;
  weeklyRunKmBaseline: number;
  weeklySessionsBaseline: number;
  hyroxSessionsLast8Weeks: number;
  recentRunsForContext: string;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}m`;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}

/** Convert m/s speed to min:sec /km pace string */
export function speedToPace(metersPerSec: number): string {
  if (!metersPerSec || metersPerSec <= 0) return "N/A";
  const secPerKm = 1000 / metersPerSec;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}


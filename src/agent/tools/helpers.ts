import type { SummaryActivity } from "../../strava/types.js";
import { speedToPace, type AthleteProfile } from "../prompts.js";

export function groupByWeek(activities: SummaryActivity[]): Record<string, SummaryActivity[]> {
  const weeks: Record<string, SummaryActivity[]> = {};
  for (const a of activities) {
    const weekKey = getISOWeekKey(new Date(a.start_date_local));
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(a);
  }
  return weeks;
}

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
}

export function calcLoad(activities: SummaryActivity[]): number {
  const intensity: Record<string, number> = {
    Run: 1.0, HIIT: 1.4, Hyrox: 1.5, Gym: 0.8, CardioMix: 1.2, Other: 0.8,
  };
  return activities.reduce((sum, a) => {
    return sum + (a.moving_time / 60) * (intensity[a.category ?? "Other"] ?? 0.8);
  }, 0);
}

export function computeAthleteProfile(activities: SummaryActivity[]): AthleteProfile {
  const runs = activities
    .filter((a) => a.category === "Run" && a.distance > 500 && a.average_speed > 0)
    .slice(0, 60);

  const speeds = runs.map((r) => r.average_speed).sort((a, b) => a - b);
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

  const easySpeed = avg(speeds.slice(0, Math.max(1, Math.floor(speeds.length * 0.25))));
  const tempoSpeed = avg(speeds.slice(Math.floor(speeds.length * 0.3), Math.floor(speeds.length * 0.7)));
  const intervalSpeed = avg(speeds.slice(Math.max(0, Math.floor(speeds.length * 0.75))));

  const hrRuns = runs.filter((r) => r.max_heartrate && r.max_heartrate > 100);
  const maxHR = hrRuns.length > 0 ? Math.max(...hrRuns.map((r) => r.max_heartrate!)) : null;

  const grouped = groupByWeek(runs);
  const recentWeeks = Object.keys(grouped).sort().reverse().slice(0, 8);
  const weeklyRunKm = recentWeeks.length
    ? recentWeeks.map((wk) => grouped[wk].reduce((s, a) => s + a.distance, 0) / 1000)
    : [0];

  const allGrouped = groupByWeek(activities);
  const allWeeks = Object.keys(allGrouped).sort().reverse().slice(0, 8);
  const weeklySessions = allWeeks.length ? allWeeks.map((wk) => allGrouped[wk].length) : [0];

  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  return {
    easyPacePerKm: speedToPace(easySpeed),
    tempoPacePerKm: speedToPace(tempoSpeed),
    intervalPacePerKm: speedToPace(intervalSpeed),
    estimatedHRmax: maxHR,
    zone2HR: maxHR ? `${Math.round(maxHR * 0.65)}–${Math.round(maxHR * 0.75)}bpm` : "HR data unavailable",
    zone4HR: maxHR ? `${Math.round(maxHR * 0.85)}–${Math.round(maxHR * 0.92)}bpm` : "HR data unavailable",
    weeklyRunKmBaseline: parseFloat((weeklyRunKm.reduce((s, v) => s + v, 0) / weeklyRunKm.length).toFixed(1)),
    weeklySessionsBaseline: parseFloat((weeklySessions.reduce((s, v) => s + v, 0) / weeklySessions.length).toFixed(1)),
    hyroxSessionsLast8Weeks: activities.filter(
      (a) => a.category === "Hyrox" && new Date(a.start_date_local) >= eightWeeksAgo
    ).length,
    recentRunsForContext: runs
      .slice(0, 5)
      .map((r) => `${r.start_date_local.split("T")[0]}: ${(r.distance / 1000).toFixed(1)}km @ ${speedToPace(r.average_speed)}/km${r.average_heartrate ? ` (avg HR ${r.average_heartrate})` : ""}`)
      .join(", "),
  };
}

export function bar(value: number, max: number, width = 10): string {
  const filled = Math.round((value / (max || 1)) * width);
  return "█".repeat(Math.min(filled, width)) + "░".repeat(Math.max(0, width - filled));
}

export function hrZoneLabel(avgHR: number, maxHR: number): string {
  const pct = avgHR / maxHR;
  if (pct < 0.65) return "Z1 🟦 Recovery";
  if (pct < 0.75) return "Z2 🟩 Aerobic Base";
  if (pct < 0.85) return "Z3 🟨 Tempo";
  if (pct < 0.92) return "Z4 🟧 Threshold";
  return "Z5 🟥 VO₂max";
}

export function paceDelta(currentMps: number, baselinePaceStr: string): string {
  const [min, sec] = baselinePaceStr.split(":").map(Number);
  if (isNaN(min) || isNaN(sec)) return "";
  const baselineMps = 1000 / (min * 60 + sec);
  const diffSec = Math.round(1000 / currentMps - 1000 / baselineMps);
  if (Math.abs(diffSec) < 3) return "≈ on pace";
  return diffSec < 0
    ? `⚡ ${Math.abs(diffSec)}s/km faster than baseline`
    : `🐢 ${diffSec}s/km slower than baseline`;
}

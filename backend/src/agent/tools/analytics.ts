import { getActivities } from "../../cache.js";
import { speedToPace } from "../prompts.js";
import { calcLoad, computeAthleteProfile, groupByWeek } from "./helpers.js";

export async function toolGetAthleteProfile(args: { force_refresh?: boolean }): Promise<object> {
  const all = await getActivities(args.force_refresh ?? false);
  const profile = computeAthleteProfile(all);

  const runs = all.filter((a) => a.category === "Run");
  const grouped = groupByWeek(runs);
  const weekKeys = Object.keys(grouped).sort().reverse().slice(0, 12).reverse();

  const paceHistory = weekKeys.map((wk) => {
    const wkRuns = grouped[wk];
    const avgSpeed = wkRuns.reduce((s, a) => s + a.average_speed, 0) / (wkRuns.length || 1);
    const hrRuns = wkRuns.filter((r) => r.average_heartrate);
    return {
      week: wk,
      run_km: parseFloat((wkRuns.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(1)),
      avg_pace: speedToPace(avgSpeed),
      runs: wkRuns.length,
      avg_hr: hrRuns.length
        ? Math.round(hrRuns.reduce((s, r) => s + r.average_heartrate!, 0) / hrRuns.length)
        : null,
    };
  });

  return { profile, pace_and_hr_trend_12_weeks: paceHistory };
}

export async function toolGetWeeklySummary(args: { weeks?: number }): Promise<object> {
  const all = await getActivities();
  const grouped = groupByWeek(all);
  const weekKeys = Object.keys(grouped).sort().reverse().slice(0, args.weeks ?? 8);

  const summaries = weekKeys.map((wk) => {
    const acts = grouped[wk];
    const runs = acts.filter((a) => a.category === "Run");
    const byCategory: Record<string, number> = {};
    for (const a of acts) byCategory[a.category ?? "Other"] = (byCategory[a.category ?? "Other"] ?? 0) + 1;

    return {
      week: wk,
      total_activities: acts.length,
      run_km: parseFloat((runs.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(1)),
      total_distance_km: parseFloat((acts.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(1)),
      total_duration_min: Math.round(acts.reduce((s, a) => s + a.moving_time, 0) / 60),
      load_score: Math.round(calcLoad(acts)),
      avg_run_pace: runs.length
        ? speedToPace(runs.reduce((s, a) => s + a.average_speed, 0) / runs.length)
        : "N/A",
      by_category: byCategory,
    };
  });

  return { weeks: summaries };
}

export async function toolAnalyzeFitnessTrend(args: { weeks?: number }): Promise<object> {
  const all = await getActivities();
  const profile = computeAthleteProfile(all);
  const grouped = groupByWeek(all);
  const weekKeys = Object.keys(grouped).sort().reverse().slice(0, args.weeks ?? 12);

  const trend = weekKeys.reverse().map((wk) => {
    const acts = grouped[wk];
    const runs = acts.filter((a) => a.category === "Run");
    const hrRuns = runs.filter((r) => r.average_heartrate);
    const avgRunSpeed = runs.length ? runs.reduce((s, a) => s + a.average_speed, 0) / runs.length : 0;

    return {
      week: wk,
      run_km: parseFloat((runs.reduce((s, a) => s + a.distance, 0) / 1000).toFixed(1)),
      avg_run_pace: speedToPace(avgRunSpeed),
      load: Math.round(calcLoad(acts)),
      sessions: acts.length,
      hyrox_sessions: acts.filter((a) => a.category === "Hyrox").length,
      avg_hr: hrRuns.length
        ? Math.round(hrRuns.reduce((s, r) => s + r.average_heartrate!, 0) / hrRuns.length)
        : null,
    };
  });

  return { profile, trend };
}

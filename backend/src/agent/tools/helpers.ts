import { getActivityDetail } from "../../strava/client.js";
import type { DetailedActivity, SummaryActivity } from "../../strava/types.js";
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

function weightedAverage(values: { value: number; weight: number }[]): number | null {
  if (values.length === 0) return null;
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function paceMentionsToSeconds(text?: string): number[] {
  if (!text) return [];
  return [...text.matchAll(/(\d{1,2}):(\d{2})\s*\/?\s*km/gi)]
    .map((match) => parseInt(match[1], 10) * 60 + parseInt(match[2], 10))
    .filter((value) => Number.isFinite(value));
}

function parseIntervalTargetDistanceKm(detail: DetailedActivity): number | null {
  const text = `${detail.name} ${detail.description ?? ""}`.toLowerCase();
  const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*km/);
  if (kmMatch) return parseFloat(kmMatch[2]);

  const mMatch = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*m/);
  if (mMatch) return parseFloat(mMatch[2]) / 1000;

  const singleKmMatch = text.match(/\b(\d+(?:\.\d+)?)\s*km\b/);
  if (singleKmMatch && /\b(interval|repeats?|reps?|work)\b/.test(text)) {
    return parseFloat(singleKmMatch[1]);
  }

  const singleMMatch = text.match(/\b(\d{3,4})\s*m\b/);
  if (singleMMatch && /\b(interval|repeats?|reps?|work)\b/.test(text)) {
    return parseInt(singleMMatch[1], 10) / 1000;
  }

  return null;
}

function clusterLapPace(laps: DetailedActivity["laps"], targetDistanceKm?: number | null): number | null {
  if (!laps || laps.length === 0) return null;

  const candidates = laps
    .filter((lap) => lap.distance >= 0.35 && lap.distance <= 2.2 && lap.average_speed > 0)
    .map((lap) => ({
      distanceKm: lap.distance / 1000,
      paceSec: 1000 / lap.average_speed,
      speed: lap.average_speed,
    }));

  if (candidates.length === 0) return null;

  const target = targetDistanceKm ?? null;
  let pool = candidates;

  if (target) {
    pool = candidates.filter((lap) => Math.abs(lap.distanceKm - target) <= Math.max(0.08, target * 0.2));
  }

  if (pool.length === 0) return null;

  const sortedByDistanceThenPace = [...pool].sort((a, b) => a.paceSec - b.paceSec);
  const takeCount = Math.max(1, Math.ceil(sortedByDistanceThenPace.length * 0.67));
  const repPool = sortedByDistanceThenPace.slice(0, takeCount);

  const finalPool = repPool.length > 0 ? repPool : sortedByDistanceThenPace.slice(0, takeCount);
  return weightedAverage(finalPool.map((lap) => ({ value: lap.paceSec, weight: lap.distanceKm })));
}

function inferIntervalPaceFromSplits(detail: DetailedActivity, targetDistanceKm?: number | null): number | null {
  const splits = detail.splits_metric ?? [];
  if (splits.length === 0) return null;

  const pool = splits.filter((split) => split.distance >= 350 && split.distance <= 2500 && split.average_speed > 0);
  if (pool.length === 0) return null;

  const target = targetDistanceKm ?? null;
  const filtered = target
    ? pool.filter((split) => Math.abs(split.distance - target * 1000) <= Math.max(80, target * 1000 * 0.2))
    : pool;
  const ranked = [...(filtered.length > 0 ? filtered : pool)].sort((a, b) => b.average_speed - a.average_speed);
  const takeCount = Math.max(1, Math.ceil(ranked.length * 0.67));
  const fastest = ranked.slice(0, takeCount);
  return weightedAverage(
    fastest.map((split) => ({
      value: 1000 / split.average_speed,
      weight: split.distance / 1000,
    }))
  );
}

function looksLikeIntervalSession(detail: DetailedActivity): boolean {
  const text = `${detail.name} ${detail.description ?? ""}`.toLowerCase();
  if (/(interval|tempo|fartlek|repeats?|reps?|speed|track|vo2|threshold)/.test(text)) return true;
  if (/\b\d+\s*[x×]\s*\d+\s*(m|km|min)\b/.test(text)) return true;
  if (/\b(main|work|w\/u|wu|cd)\b/.test(text) && /\d{1,2}:\d{2}\s*\/?\s*km/.test(text)) return true;

  const laps = detail.laps ?? [];
  if (laps.length >= 4) {
    const speeds = laps.map((lap) => lap.average_speed).filter((speed) => speed > 0).sort((a, b) => a - b);
    if (speeds.length >= 4) {
      const ratio = speeds[speeds.length - 1] / speeds[0];
      if (ratio >= 1.15) return true;
    }
  }

  const splits = detail.splits_metric ?? [];
  if (splits.length >= 4) {
    const speeds = splits.map((split) => split.average_speed).filter((speed) => speed > 0).sort((a, b) => a - b);
    if (speeds.length >= 4) {
      const ratio = speeds[speeds.length - 1] / speeds[0];
      if (ratio >= 1.15) return true;
    }
  }

  return false;
}

function estimateIntervalPace(detail: DetailedActivity): { secondsPerKm: number; confidence: number } | null {
  if (!looksLikeIntervalSession(detail)) return null;

  const targetDistanceKm = parseIntervalTargetDistanceKm(detail);
  const lapPace = clusterLapPace(detail.laps, targetDistanceKm);
  const splitPace = inferIntervalPaceFromSplits(detail, targetDistanceKm);

  const samples: { value: number; weight: number }[] = [];
  if (lapPace) samples.push({ value: lapPace, weight: 0.65 });
  if (splitPace) samples.push({ value: splitPace, weight: 0.35 });

  const paceSeconds = weightedAverage(samples);
  if (!paceSeconds) return null;

  const confidence = samples.length >= 2 ? 0.95 : 0.8;
  return { secondsPerKm: paceSeconds, confidence };
}

export async function computeAthleteProfile(activities: SummaryActivity[]): Promise<AthleteProfile> {
  const runs = activities
    .filter((a) => a.category === "Run" && a.distance > 500 && a.average_speed > 0)
    .slice(0, 60);

  const speeds = runs.map((r) => r.average_speed).sort((a, b) => a - b);
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

  const easySpeed = avg(speeds.slice(0, Math.max(1, Math.floor(speeds.length * 0.25))));
  const tempoSpeed = avg(speeds.slice(Math.floor(speeds.length * 0.3), Math.floor(speeds.length * 0.7)));

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

  const recentRunSamples = activities
    .filter((a) => a.category === "Run" && a.distance > 500 && a.average_speed > 0)
    .slice(0, 16);
  const detailedSamples = await Promise.all(
    recentRunSamples.map(async (run) => {
      try {
        const detail = await getActivityDetail(run.id);
        return estimateIntervalPace(detail);
      } catch {
        return null;
      }
    })
  );
  const intervalFromDetail = weightedAverage(
    detailedSamples
      .filter((sample): sample is { secondsPerKm: number; confidence: number } => sample !== null)
      .map((sample, index) => ({
        value: sample.secondsPerKm,
        weight: sample.confidence * Math.max(0.6, 1 - index * 0.03),
      }))
  );

  const intervalSpeed = intervalFromDetail
    ? 1000 / intervalFromDetail
    : avg(speeds.slice(Math.max(0, Math.floor(speeds.length * 0.75))));

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

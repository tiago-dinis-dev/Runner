import { getActivities } from "../../cache.js";
import { getActivityDetail, getActivityPhotos } from "../../strava/client.js";
import { formatDuration, speedToPace } from "../prompts.js";
import { bar, calcLoad, computeAthleteProfile, hrZoneLabel, paceDelta } from "./helpers.js";

export async function toolGetRecentActivities(args: {
  limit?: number;
  category?: string;
  force_refresh?: boolean;
}): Promise<object> {
  const all = await getActivities(args.force_refresh ?? false);
  const filtered = args.category
    ? all.filter((a) => a.category?.toLowerCase() === args.category!.toLowerCase())
    : all;
  const activities = filtered.slice(0, args.limit ?? 20);
  return {
    count: activities.length,
    activities: activities.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      sport_type: a.sport_type,
      date: a.start_date_local.split("T")[0],
      distance_km: parseFloat((a.distance / 1000).toFixed(2)),
      duration_min: Math.round(a.moving_time / 60),
      pace_per_km: a.category === "Run" ? speedToPace(a.average_speed) : undefined,
      avg_hr: a.average_heartrate,
      max_hr: a.max_heartrate,
      suffer_score: a.suffer_score,
    })),
  };
}

export async function toolGetActivityDetail(args: { activity_id: number }): Promise<object> {
  const a = await getActivityDetail(args.activity_id);
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    sport_type: a.sport_type,
    date: a.start_date_local,
    distance_km: parseFloat((a.distance / 1000).toFixed(2)),
    duration_min: Math.round(a.moving_time / 60),
    pace_per_km: a.category === "Run" ? speedToPace(a.average_speed) : undefined,
    elevation_m: a.total_elevation_gain,
    avg_hr: a.average_heartrate,
    max_hr: a.max_heartrate,
    calories: a.calories,
    description: a.description,
    suffer_score: a.suffer_score,
    splits_metric: a.splits_metric?.map((s) => ({
      km: s.split,
      pace: speedToPace(s.average_speed),
      elapsed_sec: s.elapsed_time,
    })),
    laps: a.laps?.map((l) => ({
      name: l.name,
      distance_km: parseFloat((l.distance / 1000).toFixed(2)),
      pace: speedToPace(l.average_speed),
      avg_hr: l.average_heartrate,
    })),
  };
}

export async function toolGetLastSession(args: {
  category?: string;
  force_refresh?: boolean;
}): Promise<object> {
  const all = await getActivities(args.force_refresh ?? false);
  const profile = await computeAthleteProfile(all);

  const filtered = args.category
    ? all.filter((a) => a.category?.toLowerCase() === args.category!.toLowerCase())
    : all;

  if (filtered.length === 0) return { error: "No activities found matching the filter." };

  const latest = filtered[0];
  const detail = await getActivityDetail(latest.id);
  const isRun = latest.category === "Run";
  const distKm = latest.distance / 1000;
  const durationMin = latest.moving_time / 60;

  const hrZone =
    latest.average_heartrate && profile.estimatedHRmax
      ? hrZoneLabel(latest.average_heartrate, profile.estimatedHRmax)
      : null;

  const splits = detail.splits_metric?.map((s) => ({
    km: s.split,
    pace: speedToPace(s.average_speed),
    effort_bar: bar(s.average_speed, latest.average_speed * 1.15, 8),
    vs_avg:
      s.average_speed > latest.average_speed * 1.02 ? "⬆️ faster"
      : s.average_speed < latest.average_speed * 0.98 ? "⬇️ slower"
      : "➡️ steady",
  }));

  const sameType = all
    .filter((a) => a.category === latest.category && a.id !== latest.id && a.distance > 500)
    .slice(0, 10);

  const avgDist = sameType.length ? sameType.reduce((s, a) => s + a.distance, 0) / sameType.length / 1000 : null;
  const avgDur = sameType.length ? sameType.reduce((s, a) => s + a.moving_time, 0) / sameType.length / 60 : null;
  const avgSpd = sameType.filter((a) => a.average_speed > 0).length
    ? sameType.reduce((s, a) => s + a.average_speed, 0) / sameType.length
    : null;

  const comparison = avgDist
    ? {
        vs_avg_distance:
          distKm > avgDist * 1.05 ? `📏 ${(distKm - avgDist).toFixed(1)}km above your ${latest.category} average`
          : distKm < avgDist * 0.95 ? `📏 ${(avgDist - distKm).toFixed(1)}km below your ${latest.category} average`
          : `📏 Right on your typical ${latest.category} distance`,
        vs_avg_duration:
          durationMin > avgDur! * 1.05 ? `⏱️ ${Math.round(durationMin - avgDur!)}min longer than average`
          : durationMin < avgDur! * 0.95 ? `⏱️ ${Math.round(avgDur! - durationMin)}min shorter than average`
          : `⏱️ Typical duration`,
        vs_avg_pace: isRun && avgSpd ? paceDelta(latest.average_speed, speedToPace(avgSpd)) : null,
      }
    : null;

  const thisWeekActs = all.filter((a) => {
    const actDate = new Date(a.start_date_local);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return actDate >= weekStart;
  });

  return {
    session: {
      id: latest.id,
      name: latest.name,
      category: latest.category,
      date: latest.start_date_local.split("T")[0],
      distance_km: parseFloat(distKm.toFixed(2)),
      duration: formatDuration(latest.moving_time),
      avg_pace: isRun ? speedToPace(latest.average_speed) : undefined,
      avg_hr: latest.average_heartrate,
      max_hr: latest.max_heartrate,
      calories: detail.calories,
      elevation_m: latest.total_elevation_gain,
      suffer_score: latest.suffer_score,
    },
    effort_analysis: {
      hr_zone: hrZone,
      effort_vs_easy_baseline: isRun ? paceDelta(latest.average_speed, profile.easyPacePerKm) : null,
      overall_effort:
        latest.average_heartrate && profile.estimatedHRmax
          ? bar(latest.average_heartrate, profile.estimatedHRmax)
          : null,
    },
    pace_splits_per_km: splits ?? [],
    comparison_to_recent: comparison,
    week_context: {
      sessions_this_week: thisWeekActs.length,
      load_score_this_week: Math.round(calcLoad(thisWeekActs)),
      load_bar: bar(Math.round(calcLoad(thisWeekActs)), profile.weeklyRunKmBaseline * profile.weeklySessionsBaseline * 1.3, 12),
    },
    laps: detail.laps?.map((l) => ({
      name: l.name,
      distance_km: parseFloat((l.distance / 1000).toFixed(2)),
      pace: speedToPace(l.average_speed),
      avg_hr: l.average_heartrate,
    })),
  };
}

export async function toolGetActivityPhotos(args: {
  activity_id?: number;
  category?: string;
  force_refresh?: boolean;
}): Promise<object> {
  const all = await getActivities(args.force_refresh ?? false);

  // Resolve activity
  let activityId = args.activity_id;
  let activityName = "Unknown activity";
  let activityDate = "";

  if (!activityId) {
    const filtered = args.category
      ? all.filter((a) => a.category?.toLowerCase() === args.category!.toLowerCase())
      : all;
    if (filtered.length === 0) return { error: "No activities found matching the filter." };
    activityId = filtered[0].id;
    activityName = filtered[0].name;
    activityDate = filtered[0].start_date_local.split("T")[0];
  } else {
    const match = all.find((a) => a.id === activityId);
    if (match) {
      activityName = match.name;
      activityDate = match.start_date_local.split("T")[0];
    }
  }

  const photos = await getActivityPhotos(activityId);

  if (photos.length === 0) {
    return {
      activity_id: activityId,
      activity_name: activityName,
      photo_count: 0,
      message: "No photos found for this activity.",
    };
  }

  return {
    activity_id: activityId,
    activity_name: photos[0]?.activity_name ?? activityName,
    activity_date: activityDate,
    photo_count: photos.length,
    photos: photos.map((p, i) => ({
      index: i + 1,
      caption: p.caption ?? null,
      uploaded_at: p.uploaded_at,
      url_full: p.urls?.["600"] ?? null,
      url_thumbnail: p.urls?.["100"] ?? null,
    })),
    display_hint:
      "Present each photo as a clickable markdown link: [📸 Workout Photo N](url_full). " +
      "Show caption below if present. Group under ## 📸 Workout Photos. " +
      "Note that Strava photo URLs are signed and expire — open them quickly.",
  };
}

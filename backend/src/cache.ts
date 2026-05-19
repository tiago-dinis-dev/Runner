import { listActivities } from "./strava/client.js";
import type { SummaryActivity } from "./strava/types.js";
import { classifyActivity } from "./strava/types.js";
import { db } from "./db.js";

function getTtlMs(): number {
  const ttlMin = Number(process.env.CACHE_TTL_MINUTES ?? 60);
  return ttlMin * 60 * 1000;
}

function toSummaryActivity(row: any): SummaryActivity {
  const a: SummaryActivity = {
    id: Number(row.id),
    name: row.name,
    sport_type: row.sport_type,
    start_date: row.start_date instanceof Date ? row.start_date.toISOString() : row.start_date,
    start_date_local: row.start_date_local instanceof Date ? row.start_date_local.toISOString() : row.start_date_local,
    distance: row.distance,
    moving_time: row.moving_time,
    elapsed_time: row.elapsed_time,
    total_elevation_gain: row.total_elevation_gain,
    average_speed: row.average_speed,
    max_speed: row.max_speed,
    average_heartrate: row.average_heartrate ?? undefined,
    max_heartrate: row.max_heartrate ?? undefined,
    suffer_score: row.suffer_score ?? undefined,
    total_photo_count: row.total_photo_count ?? undefined,
  };
  // Always re-classify so improvements to classifyActivity take effect without a cache purge
  a.category = classifyActivity(a);
  return a;
}

async function isCacheStale(): Promise<boolean> {
  const latest = await db.activity.findFirst({ orderBy: { fetched_at: "desc" } });
  if (!latest) return true;
  return Date.now() - latest.fetched_at.getTime() > getTtlMs();
}

async function saveActivitiesToDb(activities: SummaryActivity[]): Promise<void> {
  const now = new Date();
  await Promise.all(
    activities.map((a) =>
      db.activity.upsert({
        where: { id: BigInt(a.id) },
        update: {
          name: a.name,
          sport_type: a.sport_type,
          start_date: new Date(a.start_date),
          start_date_local: new Date(a.start_date_local),
          distance: a.distance,
          moving_time: a.moving_time,
          elapsed_time: a.elapsed_time,
          total_elevation_gain: a.total_elevation_gain,
          average_speed: a.average_speed,
          max_speed: a.max_speed,
          average_heartrate: a.average_heartrate ?? null,
          max_heartrate: a.max_heartrate ?? null,
          suffer_score: a.suffer_score ?? null,
          total_photo_count: a.total_photo_count ?? null,
          category: a.category ?? null,
          fetched_at: now,
        },
        create: {
          id: BigInt(a.id),
          name: a.name,
          sport_type: a.sport_type,
          start_date: new Date(a.start_date),
          start_date_local: new Date(a.start_date_local),
          distance: a.distance,
          moving_time: a.moving_time,
          elapsed_time: a.elapsed_time,
          total_elevation_gain: a.total_elevation_gain,
          average_speed: a.average_speed,
          max_speed: a.max_speed,
          average_heartrate: a.average_heartrate ?? null,
          max_heartrate: a.max_heartrate ?? null,
          suffer_score: a.suffer_score ?? null,
          total_photo_count: a.total_photo_count ?? null,
          category: a.category ?? null,
          fetched_at: now,
        },
      })
    )
  );
}

/**
 * Get activities from DB cache or sync fresh from Strava.
 *
 * Sync strategy:
 * - If DB is empty → full backfill (all activities from Strava)
 * - If DB has data and TTL is fresh → return DB rows (no Strava call)
 * - If DB has data and TTL is stale → incremental sync: only fetch activities
 *   newer than the most recent activity already in DB, then upsert them.
 *
 * @param forceRefresh - bypass TTL and force a Strava sync
 */
export async function getActivities(forceRefresh = false): Promise<SummaryActivity[]> {
  const mostRecent = await db.activity.findFirst({ orderBy: { start_date: "desc" } });

  // Empty DB → full backfill
  if (!mostRecent) {
    const activities = await listActivities();
    await saveActivitiesToDb(activities);
    return activities;
  }

  const stale = Date.now() - mostRecent.fetched_at.getTime() > getTtlMs();

  // DB is fresh and no force → return cached rows
  if (!stale && !forceRefresh) {
    const rows = await db.activity.findMany({ orderBy: { start_date: "desc" } });
    return rows.map(toSummaryActivity);
  }

  // Incremental sync: only fetch activities after the most recent one
  const afterTs = Math.floor(mostRecent.start_date.getTime() / 1000);
  const newActivities = await listActivities({ after: afterTs });

  if (newActivities.length > 0) {
    await saveActivitiesToDb(newActivities);
  }

  // Return full DB (old + newly upserted)
  const rows = await db.activity.findMany({ orderBy: { start_date: "desc" } });
  return rows.map(toSummaryActivity);
}


import * as fs from "fs";
import * as path from "path";
import { listActivities } from "./strava/client.js";
import type { SummaryActivity } from "./strava/types.js";

interface CacheFile {
  fetchedAt: number; // unix timestamp ms
  activities: SummaryActivity[];
}

function getCacheFilePath(): string {
  return process.env.CACHE_FILE ?? path.join(process.cwd(), "data", "activities-cache.json");
}

function getTtlMs(): number {
  const ttlMin = Number(process.env.CACHE_TTL_MINUTES ?? 60);
  return ttlMin * 60 * 1000;
}

export function loadCache(): CacheFile | null {
  const file = getCacheFilePath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as CacheFile;
}

export function saveCache(activities: SummaryActivity[]): void {
  const file = getCacheFilePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const cache: CacheFile = { fetchedAt: Date.now(), activities };
  fs.writeFileSync(file, JSON.stringify(cache, null, 2));
}

export function isCacheStale(cache: CacheFile): boolean {
  return Date.now() - cache.fetchedAt > getTtlMs();
}

/**
 * Get activities from cache or fetch fresh from Strava.
 * @param forceRefresh - bypass cache TTL
 */
export async function getActivities(forceRefresh = false): Promise<SummaryActivity[]> {
  const cache = loadCache();
  if (cache && !isCacheStale(cache) && !forceRefresh) {
    return cache.activities;
  }

  const activities = await listActivities();
  saveCache(activities);
  return activities;
}

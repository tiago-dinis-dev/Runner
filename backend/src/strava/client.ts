import axios, { type AxiosInstance } from "axios";
import { getValidAccessToken } from "./auth.js";
import { classifyActivity, type ActivityPhoto, type DetailedActivity, type SummaryActivity } from "./types.js";

const STRAVA_BASE = "https://www.strava.com/api/v3";

function buildClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: STRAVA_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Fetch activities for the authenticated athlete.
 * @param options.after   - only return activities after this unix timestamp (incremental sync)
 * @param options.maxActivities - cap total fetched (default 500, set 0 for all)
 */
export async function listActivities(options: { after?: number; maxActivities?: number } = {}): Promise<SummaryActivity[]> {
  const { after, maxActivities = 500 } = options;
  const token = await getValidAccessToken();
  const client = buildClient(token);

  const all: SummaryActivity[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await client.get<SummaryActivity[]>("/athlete/activities", {
      params: { per_page: perPage, page, ...(after ? { after } : {}) },
    });

    const batch = res.data;
    if (batch.length === 0) break;

    // Classify each activity
    for (const a of batch) {
      a.category = classifyActivity(a);
      all.push(a);
    }

    if (maxActivities > 0 && all.length >= maxActivities) break;
    if (batch.length < perPage) break;
    page++;
  }

  return all;
}

/** Fetch a single activity with full detail */
export async function getActivityDetail(activityId: number): Promise<DetailedActivity> {
  const token = await getValidAccessToken();
  const client = buildClient(token);
  const res = await client.get<DetailedActivity>(`/activities/${activityId}`);
  const activity = res.data;

  activity.category = classifyActivity(activity);
  return activity;
}

/** Fetch photos attached to a specific activity */
export async function getActivityPhotos(activityId: number): Promise<ActivityPhoto[]> {
  const token = await getValidAccessToken();
  const client = buildClient(token);
  const res = await client.get<ActivityPhoto[]>(`/activities/${activityId}/photos`, {
    params: { photo_sources: true, size: 600 },
  });
  
  return res.data ?? [];
}

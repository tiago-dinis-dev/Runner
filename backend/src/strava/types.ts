export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp
  token_type: string;
}

export interface StravaAthleteStats {
  id: number;
  firstname: string;
  lastname: string;
}

/** Lightweight summary returned by list-activities endpoint */
export interface SummaryActivity {
  id: number;
  name: string;
  sport_type: string; // "Run" | "WeightTraining" | "Workout" | "HIIT" | ...
  start_date: string; // ISO 8601
  start_date_local: string;
  distance: number; // metres
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // metres
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  total_photo_count?: number;
  /** Computed field: "Run" | "Hyrox" | "Gym" | "HIIT" | "Other" */
  category?: ActivityCategory;
}

/** Detailed activity with extra fields */
export interface DetailedActivity extends SummaryActivity {
  description?: string;
  calories?: number;
  average_cadence?: number;
  splits_metric?: SpeedSplit[];
  laps?: Lap[];
}

export interface SpeedSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  pace_zone: number;
}

export interface ActivityPhoto {
  unique_id: string;
  activity_id: number;
  activity_name?: string;
  caption?: string;
  type: number;
  uploaded_at: string;
  created_at: string;
  urls?: Record<string, string>; // e.g. { "100": "...", "600": "..." }
  location?: [number, number];
}

export interface Lap {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  distance: number;
  average_speed: number;
  average_heartrate?: number;
}

export type ActivityCategory = "Run" | "Hyrox" | "Gym" | "HIIT" | "CardioMix" | "Other";

/** Keywords in activity name that signal Hyrox */
export const HYROX_KEYWORDS = ["hyrox", "sled", "ski erg", "rowing", "wall ball", "sandbag", "burpee broad jump"];

/** Classify a Strava activity into our categories */
export function classifyActivity(activity: SummaryActivity): ActivityCategory {
  const name = activity.name.toLowerCase();
  const sport = activity.sport_type.toLowerCase();

  if (sport === "run" || sport === "virtualrun") return "Run";

  if (HYROX_KEYWORDS.some((kw) => name.includes(kw))) return "Hyrox";

  if (sport === "hiit") return "HIIT";
  if (name.includes("hiit") || name.includes("interval")) return "HIIT";

  if (name.includes("mix") || name.includes("cardio") || name.includes("circuit")) return "CardioMix";

  if (
    sport === "weighttraining" ||
    sport === "workout" ||
    sport === "crossfit" ||
    name.includes("gym") ||
    name.includes("strength") ||
    name.includes("lift") ||
    name.includes("weight") ||
    name.includes("dumbbell") ||
    name.includes("barbell") ||
    name.includes("squat") ||
    name.includes("deadlift") ||
    name.includes("bench press")
  )
    return "Gym";

  return "Other";
}

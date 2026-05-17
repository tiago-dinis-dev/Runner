const BASE = '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export interface Activity {
  id: number;
  name: string;
  category: 'Run' | 'Hyrox' | 'Gym' | 'HIIT' | 'CardioMix' | 'Other';
  sport_type: string;
  date: string;
  distance_km: number;
  duration_min: number;
  pace_per_km?: string;
  avg_hr?: number;
  max_hr?: number;
}

export interface WeekSummary {
  week: string;
  total_activities: number;
  total_distance_km: number;
  total_duration_min: number;
  load_score: number;
  by_category: Record<string, number>;
}

export interface PlanMeta {
  filename: string;
  title: string;
  date: string;
  race_type?: string;
  race_date?: string;
  tags?: string;
  preview: string;
}

export interface PlanDetail {
  filename: string;
  title: string;
  content: string;
  race_date?: string;
  race_type?: string;
}

export const api = {
  activities: (limit = 100) =>
    get<{ count: number; activities: Activity[] }>(`/api/activities?limit=${limit}`),

  activity: (id: number) =>
    get<Activity & { splits_metric?: any[]; laps?: any[] }>(`/api/activities/${id}`),

  weeklySummary: (weeks = 12) =>
    get<{ weeks: WeekSummary[] }>(`/api/weekly-summary?weeks=${weeks}`),

  plans: () => get<{ plans: PlanMeta[] }>('/api/plans'),

  plan: (filename: string) => get<PlanDetail>(`/api/plans/${filename}`),

  health: () => get<{ status: string }>('/api/health'),
};

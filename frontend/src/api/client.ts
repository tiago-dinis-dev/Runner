const BASE = '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PendingAction {
  type: 'edit_session' | 'save_plan' | 'delete_plan';
  filename: string;
  date?: string;
  old_title?: string;
  new_title?: string;
  new_details?: string;
  updated_markdown?: string;
  content?: string;
  summary: string;
}

export interface ChatResult {
  reply: string;
  toolsUsed: string[];
  pendingAction?: PendingAction;
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

export interface ActivityDetail extends Activity {
  elevation_m?: number;
  calories?: number;
  description?: string;
  suffer_score?: number;
  splits_metric?: { km: number; pace: string; elapsed_sec: number }[];
  laps?: { name: string; distance_km: number; pace: string; avg_hr?: number }[];
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
    get<ActivityDetail>(`/api/activities/${id}`),

  weeklySummary: (weeks = 12) =>
    get<{ weeks: WeekSummary[] }>(`/api/weekly-summary?weeks=${weeks}`),

  plans: () => get<{ plans: PlanMeta[] }>('/api/plans'),

  plan: (filename: string) => get<PlanDetail>(`/api/plans/${filename}`),

  deletePlan: (filename: string) =>
    fetch(`/api/plans/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({})) as any;
        if (!res.ok) throw new Error(body.error ?? `Delete failed ${res.status}`);
        // Guard: backend returned preview instead of actually deleting (backend not restarted)
        if (body.preview) throw new Error('Backend needs restart — plan was not deleted.');
        if (!body.deleted) throw new Error(body.error ?? 'Plan was not deleted.');
        return body as { deleted: boolean; filename: string };
      }),

  movePlanSession: (filename: string, from_date: string, label: string, to_date: string) =>
    fetch(`/api/plans/${encodeURIComponent(filename)}/move-session`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_date, label, to_date }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `Move failed ${res.status}`);
      }
      return res.json() as Promise<{ moved: boolean; message: string }>;
    }),

  applyPlanEdit: (filename: string, updated_markdown: string) =>
    fetch(`/api/plans/${encodeURIComponent(filename)}/apply-edit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updated_markdown }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `Apply edit failed ${res.status}`);
      }
      return res.json() as Promise<{ applied: boolean; message: string }>;
    }),

  savePlanDirect: (filename: string, content: string) =>
    fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `Save failed ${res.status}`);
      }
      return res.json() as Promise<{ saved: boolean; message: string }>;
    }),

  health: () => get<{ status: string }>('/api/health'),

  chat: (messages: ChatMessage[]) =>
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `Chat error ${res.status}`);
      }
      return res.json() as Promise<ChatResult>;
    }),
};

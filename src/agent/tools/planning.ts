import * as fs from "fs";
import * as path from "path";
import { getActivities } from "../../cache.js";
import { speedToPace } from "../prompts.js";
import { computeAthleteProfile } from "./helpers.js";

// ── Plans storage path ────────────────────────────────────────────────────────
function plansDir(): string {
  const dir = path.join(process.cwd(), "data", "plans");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Tool implementations ──────────────────────────────────────────────────────

export async function toolBuildTrainingPlan(args: {
  race_date: string;
  race_type: string;
  notes?: string;
}): Promise<object> {
  const all = await getActivities();
  const profile = computeAthleteProfile(all);
  const weeksAvailable = Math.max(
    1,
    Math.round((new Date(args.race_date).getTime() - Date.now()) / (7 * 24 * 3600 * 1000))
  );

  const recentActivities = all.slice(0, 28).map((a) => ({
    date: a.start_date_local.split("T")[0],
    category: a.category,
    name: a.name,
    distance_km: parseFloat((a.distance / 1000).toFixed(1)),
    duration_min: Math.round(a.moving_time / 60),
    pace_per_km: a.category === "Run" ? speedToPace(a.average_speed) : undefined,
    avg_hr: a.average_heartrate,
  }));

  return {
    race_date: args.race_date,
    race_type: args.race_type,
    weeks_available: weeksAvailable,
    athlete_profile: profile,
    recent_activities: recentActivities,
    notes: args.notes,
    tip: "Once the plan is generated, use save_plan to persist it for future sessions.",
    after_response_instruction: "After presenting the full plan, ALWAYS ask the user: '💾 Would you like me to save this plan so you can access it in future sessions?'",
  };
}

export async function toolSuggestNextWeek(args: { notes?: string }): Promise<object> {
  const all = await getActivities();
  const profile = computeAthleteProfile(all);

  const recentActivities = all.slice(0, 14).map((a) => ({
    date: a.start_date_local.split("T")[0],
    category: a.category,
    name: a.name,
    distance_km: parseFloat((a.distance / 1000).toFixed(1)),
    duration_min: Math.round(a.moving_time / 60),
    pace_per_km: a.category === "Run" ? speedToPace(a.average_speed) : undefined,
    avg_hr: a.average_heartrate,
  }));

  return {
    athlete_profile: profile,
    recent_activities_14_days: recentActivities,
    notes: args.notes,
    tip: "Use save_plan to persist the generated week plan for future reference.",
    after_response_instruction: "After presenting the week plan, ALWAYS ask the user: '💾 Would you like me to save this week plan so you can refer back to it later?'",
  };
}

export async function toolSetRaceGoal(args: {
  race_date: string;
  race_type: string;
  notes?: string;
}): Promise<object> {
  const weeksAvailable = Math.max(
    0,
    Math.round((new Date(args.race_date).getTime() - Date.now()) / (7 * 24 * 3600 * 1000))
  );
  return {
    message: `Race goal set: ${args.race_type} on ${args.race_date} (${weeksAvailable} weeks away).`,
    race_date: args.race_date,
    race_type: args.race_type,
    weeks_available: weeksAvailable,
    notes: args.notes,
    next_step: "Use build_training_plan to generate a full Hyrox-specific plan, or suggest_next_week to start immediately.",
  };
}

export async function toolSavePlan(args: {
  title: string;
  content: string;
  race_type?: string;
  race_date?: string;
  tags?: string;
}): Promise<object> {
  const date = new Date().toISOString().split("T")[0];
  const slug = slugify(args.title);
  const filename = `${date}-${slug}.md`;
  const filepath = path.join(plansDir(), filename);

  const frontmatter = [
    "---",
    `title: "${args.title}"`,
    `saved_at: "${new Date().toISOString()}"`,
    args.race_type ? `race_type: "${args.race_type}"` : null,
    args.race_date ? `race_date: "${args.race_date}"` : null,
    args.tags ? `tags: "${args.tags}"` : null,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  fs.writeFileSync(filepath, frontmatter + args.content);

  return {
    saved: true,
    filename,
    filepath,
    message: `✅ Plan "${args.title}" saved to data/plans/${filename}. Load it anytime with load_plan.`,
  };
}

export async function toolListPlans(args: { race_type?: string }): Promise<object> {
  const dir = plansDir();
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  if (files.length === 0) {
    return { plans: [], message: "No saved plans yet. Use save_plan after generating a plan." };
  }

  const plans = files.map((filename) => {
    const raw = fs.readFileSync(path.join(dir, filename), "utf-8");
    // Parse frontmatter
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    const meta: Record<string, string> = {};
    if (fmMatch) {
      for (const line of fmMatch[1].split("\n")) {
        const [key, ...val] = line.split(": ");
        if (key && val.length) meta[key.trim()] = val.join(": ").replace(/^"|"$/g, "");
      }
    }
    return {
      filename,
      title: meta.title ?? filename,
      saved_at: meta.saved_at ?? "unknown",
      race_type: meta.race_type ?? null,
      race_date: meta.race_date ?? null,
      tags: meta.tags ?? null,
      preview: raw.replace(/^---[\s\S]*?---\n/, "").slice(0, 200).replace(/\n/g, " ") + "...",
    };
  }).filter((p) => !args.race_type || p.race_type?.toLowerCase() === args.race_type.toLowerCase());

  return { count: plans.length, plans };
}

export async function toolLoadPlan(args: { filename: string }): Promise<object> {
  const filepath = path.join(plansDir(), args.filename);

  if (!fs.existsSync(filepath)) {
    return { error: `Plan file "${args.filename}" not found. Use list_plans to see available plans.` };
  }

  const raw = fs.readFileSync(filepath, "utf-8");
  const content = raw.replace(/^---[\s\S]*?---\n/, "");

  // Parse frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  const meta: Record<string, string> = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const [key, ...val] = line.split(": ");
      if (key && val.length) meta[key.trim()] = val.join(": ").replace(/^"|"$/g, "");
    }
  }

  return {
    filename: args.filename,
    title: meta.title ?? args.filename,
    saved_at: meta.saved_at ?? "unknown",
    race_type: meta.race_type ?? null,
    race_date: meta.race_date ?? null,
    tags: meta.tags ?? null,
    content,
  };
}


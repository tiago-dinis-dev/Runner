import * as fs from "fs";
import * as path from "path";
import { getActivities } from "../../cache.js";
import { speedToPace } from "../prompts.js";
import { computeAthleteProfile } from "./helpers.js";
import { DATA_DIR } from "../../config.js";

// ── Plans storage path ────────────────────────────────────────────────────────
function plansDir(): string {
  const dir = path.join(DATA_DIR, "plans");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Markdown session rewriter ─────────────────────────────────────────────────
const MONTH_MAP_R: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};
const DAY_NAMES_R = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES_R = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_OFFSET_R: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function toDateStrR(year: number, monthIdx: number, day: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMondayOfWeekR(year: number, monthIdx: number, day: number): Date {
  const d = new Date(year, monthIdx, day);
  const dow = d.getDay();
  const daysBack = dow === 0 ? 6 : dow - 1;
  return new Date(year, monthIdx, day - daysBack);
}

function cleanLabelR(raw: string): string {
  return raw.replace(/\*{1,2}/g, "").replace(/🏆|🏋️|💪|🚣|🏃|🏖️|😴|⚠️/g, "").trim();
}

/**
 * Rewrites a single session's date in a plan markdown file.
 * Returns the updated markdown, or null if the session was not found.
 */
function rewriteSessionDate(
  markdown: string,
  fromDate: string,
  label: string,
  toDate: string
): string | null {
  const year = parseInt(fromDate.split("-")[0]);
  const toD = new Date(toDate + "T12:00:00");
  const newDateStr = `${DAY_NAMES_R[toD.getDay()]} ${MONTH_NAMES_R[toD.getMonth()]} ${toD.getDate()}`;

  // Normalised search label (first 30 chars, lower-case)
  const searchLabel = cleanLabelR(label).toLowerCase().slice(0, 30);

  const lines = markdown.split("\n");
  let weekMonday: Date | null = null;
  let found = false;

  const result = lines.map((line) => {
    if (found) return line;

    // Track week headers: ### Week N · Mon DD
    const weekMatch = line.match(
      /^###\s+Week\s+\d+\s+[·•]\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/
    );
    if (weekMatch) {
      const mi = MONTH_MAP_R[weekMatch[1]];
      const d = parseInt(weekMatch[2]);
      if (mi !== undefined && !isNaN(d)) weekMonday = getMondayOfWeekR(year, mi, d);
      return line;
    }

    // Explicit-date row: | [**]Day Mon DD[**] | label |
    const explicitMatch = line.match(
      /^(\|\s*\*{0,2})((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})(\*{0,2}\s*\|\s*)([^|]+)(\|?.*)$/
    );
    if (explicitMatch) {
      const parts = explicitMatch[2].trim().split(/\s+/);
      const mi = MONTH_MAP_R[parts[1]];
      const d = parseInt(parts[2]);
      if (mi !== undefined && !isNaN(d)) {
        const dateStr = toDateStrR(year, mi, d);
        const rowLabel = cleanLabelR(explicitMatch[4]).toLowerCase();
        if (dateStr === fromDate && rowLabel.includes(searchLabel)) {
          found = true;
          return `${explicitMatch[1]}${newDateStr}${explicitMatch[3]}${explicitMatch[4]}${explicitMatch[5]}`;
        }
      }
      return line;
    }

    // Week-relative row: | Day | label |
    if (weekMonday) {
      const dayMatch = line.match(/^(\|\s*)(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\s*\|\s*)([^|]+)(\|?.*)$/);
      if (dayMatch) {
        const offset = DAY_OFFSET_R[dayMatch[2]] ?? 0;
        const t = new Date(
          weekMonday.getFullYear(),
          weekMonday.getMonth(),
          weekMonday.getDate() + offset
        );
        const dateStr = toDateStrR(year, t.getMonth(), t.getDate());
        const rowLabel = cleanLabelR(dayMatch[4]).toLowerCase();
        if (dateStr === fromDate && rowLabel.includes(searchLabel)) {
          found = true;
          // Convert to explicit date so future moves remain unambiguous
          return `| ${newDateStr} | ${dayMatch[4].trimEnd()} ${dayMatch[5]}`.trimEnd();
        }
      }
    }

    return line;
  });

  return found ? result.join("\n") : null;
}

/**
 * Rewrite a single session's title/details in a plan markdown file.
 * If the plan uses a 3-column row (| Date | Title | Details |) the third column is replaced.
 * If the plan uses a 2-column row (| Day | cell-with-·-separators |) and newDetails is provided,
 * the row is converted to a 3-column row so details are kept separate.
 */
function rewriteSessionText(
  markdown: string,
  fromDate: string,
  label: string,
  newTitle: string,
  newDetails?: string
): string | null {
  const year = parseInt(fromDate.split("-")[0]);
  const searchLabel = cleanLabelR(label).toLowerCase().slice(0, 30);

  const lines = markdown.split("\n");
  let weekMonday: Date | null = null;
  let found = false;

  const result = lines.map((line) => {
    if (found) return line;

    // Track week headers: ### Week N · Mon DD
    const weekMatch = line.match(
      /^###\s+Week\s+\d+\s+[·•]\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/
    );
    if (weekMatch) {
      const mi = MONTH_MAP_R[weekMatch[1]];
      const d = parseInt(weekMatch[2]);
      if (mi !== undefined && !isNaN(d)) weekMonday = getMondayOfWeekR(year, mi, d);
      return line;
    }

    // Explicit-date row: | [**]Day Mon DD[**] | label | [details] |
    const explicitMatch = line.match(
      /^(\|\s*\*{0,2})((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})(\*{0,2}\s*\|\s*)([^|]+)(\|?.*)$/
    );
    if (explicitMatch) {
      const parts = explicitMatch[2].trim().split(/\s+/);
      const mi = MONTH_MAP_R[parts[1]];
      const d = parseInt(parts[2]);
      if (mi !== undefined && !isNaN(d)) {
        const dateStr = toDateStrR(year, mi, d);
        const rowLabel = cleanLabelR(explicitMatch[4]).toLowerCase();
        if (dateStr === fromDate && rowLabel.includes(searchLabel)) {
          found = true;
          // If newDetails provided, construct a 3-column row
          if (newDetails) {
            return `${explicitMatch[1]}${explicitMatch[2]}${explicitMatch[3]}${newTitle} | ${newDetails}${explicitMatch[5]}`;
          }
          // Otherwise keep existing trailing part (may include trailing pipe)
          return `${explicitMatch[1]}${explicitMatch[2]}${explicitMatch[3]}${newTitle}${explicitMatch[5]}`;
        }
      }
      return line;
    }

    // Week-relative row: | Day | label | [details] |
    if (weekMonday) {
      const dayMatch = line.match(/^(\|\s*)(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\s*\|\s*)([^|]+)(\|?.*)$/);
      if (dayMatch) {
        const offset = DAY_OFFSET_R[dayMatch[2]] ?? 0;
        const t = new Date(
          weekMonday.getFullYear(),
          weekMonday.getMonth(),
          weekMonday.getDate() + offset
        );
        const dateStr = toDateStrR(year, t.getMonth(), t.getDate());
        const rowLabel = cleanLabelR(dayMatch[4]).toLowerCase();
        if (dateStr === fromDate && rowLabel.includes(searchLabel)) {
          found = true;
          // If newDetails provided, convert to a 3-column row keeping the day name
          if (newDetails) {
            return `${dayMatch[1]}${dayMatch[2]} ${dayMatch[3].replace(/\|\s*$/, "|")} ${newTitle} | ${newDetails}${dayMatch[5]}`.replace(/\s+/g, ' ').trim();
          }
          return `${dayMatch[1]}${dayMatch[2]}${dayMatch[3]}${newTitle}${dayMatch[5]}`;
        }
      }
    }

    return line;
  });

  return found ? result.join("\n") : null;
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
    session_format_guide: "CRITICAL: Use a 3-column markdown table for every session row: | Day/Date | Session Title | Workout Details | — Column 2: emoji + type + total volume (e.g. '🏃 Interval Run 12km'). Column 3: full prescription using · as separator. For intervals: 'WU: Xkm @ pace · Main: N×dist @ pace (Ys jog rec) · CD: Xkm @ pace · HR: Zone · Total: Xkm'. For long runs: 'Easy Xkm @ pace range · HR Z2 · fuel note'. For Hyrox: list all stations with weights. For Gym: lifts with sets×reps. For Erg: intervals or duration @ HR/watts. Be specific enough to program into Apple Watch custom workouts. No line breaks inside cells.",
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
    session_format_guide: "CRITICAL: Use a 3-column markdown table for every session row: | Day/Date | Session Title | Workout Details | — Column 2: emoji + type + total volume (e.g. '🏃 Interval Run 12km'). Column 3: full prescription using · as separator. For intervals: 'WU: Xkm @ pace · Main: N×dist @ pace (Ys jog rec) · CD: Xkm @ pace · HR: Zone · Total: Xkm'. For long runs: 'Easy Xkm @ pace range · HR Z2 · fuel note'. For Hyrox: list all stations with weights. For Gym: lifts with sets×reps. For Erg: intervals or duration @ HR/watts. Be specific enough to program into Apple Watch custom workouts. No line breaks inside cells.",
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
  confirm?: boolean; // if true, perform write; otherwise return preview
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

  const full = frontmatter + args.content;

  if (!args.confirm) {
    return { preview: true, filename, filepath, content: full, message: `Plan prepared. Call save_plan with confirm=true to persist.` };
  }

  fs.writeFileSync(filepath, full);

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

// ── Tool: delete_plan ─────────────────────────────────────────────────────────
export async function toolDeletePlan(args: { filename: string; confirm?: boolean }): Promise<object> {
  const filepath = path.join(plansDir(), args.filename);
  if (!fs.existsSync(filepath)) {
    return { error: `Plan file "${args.filename}" not found.` };
  }
  if (!args.confirm) {
    return { preview: true, filename: args.filename, message: `Plan "${args.filename}" exists. Call delete_plan with confirm=true to delete.` };
  }
  fs.unlinkSync(filepath);
  return { deleted: true, filename: args.filename, message: `Plan "${args.filename}" deleted.` };
}

// ── Tool: move_plan_session ───────────────────────────────────────────────────
export async function toolMovePlanSession(args: {
  filename: string;
  from_date: string;
  label: string;
  to_date: string;
}): Promise<object> {
  const filepath = path.join(plansDir(), args.filename);
  if (!fs.existsSync(filepath)) {
    return { error: `Plan file "${args.filename}" not found.` };
  }
  const raw = fs.readFileSync(filepath, "utf-8");
  const updated = rewriteSessionDate(raw, args.from_date, args.label, args.to_date);
  if (updated === null) {
    return {
      error: `Session "${args.label}" on ${args.from_date} not found in plan. Check the date and label are correct.`,
    };
  }
  fs.writeFileSync(filepath, updated);
  return {
    moved: true,
    filename: args.filename,
    from_date: args.from_date,
    to_date: args.to_date,
    label: args.label,
    message: `✅ Moved "${args.label}" from ${args.from_date} to ${args.to_date}.`,
  };
}

// ── Tool: edit_plan_session ───────────────────────────────────────────────────
export async function toolEditPlanSession(args: {
  filename: string;
  date: string;
  label: string;
  new_title?: string;
  new_details?: string;
}): Promise<object> {
  const filepath = path.join(plansDir(), args.filename);
  if (!fs.existsSync(filepath)) {
    return { error: `Plan file "${args.filename}" not found.` };
  }
  const raw = fs.readFileSync(filepath, "utf-8");
  const updated = rewriteSessionText(
    raw,
    args.date,
    args.label,
    args.new_title ?? args.label,
    args.new_details
  );
  if (updated === null) {
    return {
      error: `Session "${args.label}" on ${args.date} not found in plan. Check the date and label are correct.`,
    };
  }
  fs.writeFileSync(filepath, updated);
  return {
    edited: true,
    filename: args.filename,
    date: args.date,
    label: args.label,
    new_title: args.new_title ?? args.label,
    new_details: args.new_details ?? null,
    message: `✅ Updated session "${args.label}" on ${args.date} in ${args.filename}.`,
  };
}

// ── Tool: natural_edit_plan (accepts freeform instruction and edits the best-matching session)
export async function toolNaturalEditPlan(args: {
  filename: string;
  instruction: string; // freeform user instruction (e.g., "Make Tuesday intervals 800s instead of 600s and add fueling note")
}): Promise<object> {
  // lazy import OpenAI to avoid circular deps
  const OpenAI = await import("openai");
  const client = new OpenAI.default({
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    baseURL: process.env.OLLAMA_BASE_URL ?? "https://ollama.com/v1",
  });
  const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:cloud";

  const filepath = path.join(plansDir(), args.filename);
  if (!fs.existsSync(filepath)) {
    return { error: `Plan file "${args.filename}" not found.` };
  }
  const raw = fs.readFileSync(filepath, "utf-8");

  // Collect sessions (explicit-date rows and week-relative rows)
  const sessions: { date: string; title: string; details?: string; rawLine: string }[] = [];
  const lines = raw.split("\n");
  let weekMonday: Date | null = null;
  const yearGuess = new Date().getFullYear();
  for (const line of lines) {
    const weekMatch = line.match(/^###\s+Week\s+\d+\s+[·•]\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/);
    if (weekMatch) {
      const mi = MONTH_MAP_R[weekMatch[1]];
      const d = parseInt(weekMatch[2]);
      if (mi !== undefined && !isNaN(d)) weekMonday = getMondayOfWeekR(yearGuess, mi, d);
      continue;
    }
    const explicit = line.match(/^\|\s*\*{0,2}((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\*{0,2}\s*\|\s*([^|]+?)\s*\|(?:\s*([^|]+?)\s*\|)?/);
    if (explicit) {
      const parts = explicit[1].trim().split(/\s+/);
      const mi = MONTH_MAP_R[parts[1]];
      const d = parseInt(parts[2]);
      if (mi !== undefined && !isNaN(d)) {
        sessions.push({ date: toDateStrR(yearGuess, mi, d), title: cleanLabelR(explicit[2]), details: explicit[3]?.trim(), rawLine: line });
      }
      continue;
    }
    if (weekMonday) {
      const dayMatch = line.match(/^\|\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*\|\s*([^|]+?)\s*\|(?:\s*([^|]+?)\s*\|)?/);
      if (dayMatch) {
        const t = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + (DAY_OFFSET_R[dayMatch[1]] ?? 0));
        sessions.push({ date: toDateStrR(yearGuess, t.getMonth(), t.getDate()), title: cleanLabelR(dayMatch[2]), details: dayMatch[3]?.trim(), rawLine: line });
      }
    }
  }

  if (sessions.length === 0) return { error: "No sessions found in plan." };

  // Try to match by explicit date mentioned in instruction (YYYY-MM-DD or 'May 19')
  const dateRegexIso = /(\d{4}-\d{2}-\d{2})/;
  const dateMatchIso = args.instruction.match(dateRegexIso);
  let candidates = sessions;
  if (dateMatchIso) {
    candidates = sessions.filter((s) => s.date === dateMatchIso[1]);
  } else {
    // try 'May 19' format
    const dateWord = args.instruction.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
    if (dateWord) {
      const mi = MONTH_MAP_R[dateWord[1].slice(0,3)];
      const d = parseInt(dateWord[2]);
      const ds = toDateStrR(yearGuess, mi, d);
      candidates = sessions.filter((s) => s.date === ds);
    } else {
      // keyword matching: look for words of length>3
      const kws = args.instruction.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      if (kws.length > 0) {
        candidates = sessions.filter((s) => {
          const hay = (s.title + " " + (s.details ?? "")).toLowerCase();
          return kws.some((k) => hay.includes(k));
        });
      }
    }
  }

  if (candidates.length === 0) return { error: "Could not match the instruction to any session. Be more specific (date or session keyword)." };

  const target = candidates[0];

  // Ask the LLM to produce new title/details given the old ones and the instruction
  const prompt = `You are a training plan editor. The user gave this instruction: "${args.instruction}"\n\nThe current session title is: "${target.title}"\nThe current details (if any) are: "${target.details ?? ''}"\n\nReturn a JSON object with exactly these keys: {"new_title": "...", "new_details": "..."}
- new_title: the updated session title (emoji + short title + key volume, or keep original if unchanged)
- new_details: the details cell content using the site's conventions (use · as separator). If no change needed, return the original values. Do not output any other text.`;

  const resp = await client.chat.completions.create({ model: MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 400 });
  const reply = (resp.choices?.[0]?.message?.content ?? '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(reply);
  } catch (e) {
    // attempt to extract JSON block
    const m = reply.match(/\{[\s\S]*\}$/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch (e2) { /* fallthrough */ }
    }
  }

  if (!parsed) return { error: 'LLM did not return valid JSON. Response: ' + reply };

  const updatedMarkdown = rewriteSessionText(raw, target.date, target.title, parsed.new_title ?? target.title, parsed.new_details ?? target.details);
  if (updatedMarkdown === null) return { error: 'Failed to apply changes to the markdown.' };

  // Don't write automatically. Return preview and the candidate changes so the agent can ask for confirmation.
  return { preview: true, filename: args.filename, date: target.date, old_title: target.title, new_title: parsed.new_title, new_details: parsed.new_details, updated_markdown: updatedMarkdown };
}

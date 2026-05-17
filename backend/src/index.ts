import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import "./config.js"; // loads .env from workspace root
import { z } from "zod";
import {
  toolAnalyzeFitnessTrend,
  toolBuildTrainingPlan,
  toolGetActivityDetail,
  toolGetActivityPhotos,
  toolGetAthleteProfile,
  toolGetLastSession,
  toolGetRecentActivities,
  toolGetWeeklySummary,
  toolListPlans,
  toolLoadPlan,
  toolSavePlan,
  toolSetRaceGoal,
  toolSuggestNextWeek,
} from "./agent/tools/index.js";

const server = new McpServer({
  name: "runner-agent",
  version: "1.0.0",
});

// ── Tool: get_last_session ────────────────────────────────────────────────────
server.tool(
  "get_last_session",
  "Get a detailed coaching breakdown of the most recent workout. Returns pace splits per km with effort bars, HR zone, comparison vs recent averages, and week load context. Use this whenever the athlete asks about their last run, last Hyrox session, or last workout. Present the response with emojis, markdown sections, and visual bars.",
  {
    category: z
      .enum(["Run", "Hyrox", "Gym", "HIIT", "CardioMix", "Other"])
      .optional()
      .describe("Filter to last session of a specific type (default: most recent of any type)"),
    force_refresh: z.boolean().optional().describe("Bypass cache and fetch fresh from Strava"),
  },
  async (args) => {
    const result = await toolGetLastSession(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: get_athlete_profile ─────────────────────────────────────────────────
server.tool(
  "get_athlete_profile",
  "Compute the athlete's fitness profile: pace zones (easy/tempo/interval), HR zones, weekly volume baseline, Hyrox frequency, and 12-week pace/HR trend. Present with emojis, a pace zone table, and trend observations.",
  {
    force_refresh: z.boolean().optional().describe("Bypass cache and fetch fresh from Strava"),
  },
  async (args) => {
    const result = await toolGetAthleteProfile(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: get_recent_activities ───────────────────────────────────────────────
server.tool(
  "get_recent_activities",
  "Fetch recent Strava activities. Optionally filter by category. Present as a formatted list with emojis per category (🏃 Run, 🏋️ Hyrox, 💪 Gym, ⚡ HIIT).",
  {
    limit: z.number().int().min(1).max(200).optional().describe("Number of activities to return (default 20)"),
    category: z
      .enum(["Run", "Hyrox", "Gym", "HIIT", "CardioMix", "Other"])
      .optional()
      .describe("Filter by activity category"),
    force_refresh: z.boolean().optional().describe("Bypass cache and fetch fresh from Strava"),
  },
  async (args) => {
    const result = await toolGetRecentActivities(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: get_activity_detail ─────────────────────────────────────────────────
server.tool(
  "get_activity_detail",
  "Get full details for a specific Strava activity by its ID (laps, km splits, HR, calories). Present with emoji sections and a lap breakdown table.",
  {
    activity_id: z.number().int().describe("Strava activity ID"),
  },
  async (args) => {
    const result = await toolGetActivityDetail(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: get_weekly_summary ──────────────────────────────────────────────────
server.tool(
  "get_weekly_summary",
  "Get a week-by-week summary of training load, distance, duration, and activity breakdown. Present as a table with load bars and emoji category icons.",
  {
    weeks: z.number().int().min(1).max(52).optional().describe("Number of recent weeks to summarise (default 8)"),
  },
  async (args) => {
    const result = await toolGetWeeklySummary(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: analyze_fitness_trend ───────────────────────────────────────────────
server.tool(
  "analyze_fitness_trend",
  "Analyse fitness trends over recent weeks: volume, pace, HR, load, Hyrox frequency. Return athlete profile + trend table. Present with section headers, a trend narrative, emoji highlights, and 5–7 coaching observations.",
  {
    weeks: z.number().int().min(4).max(26).optional().describe("Number of weeks to analyse (default 12)"),
  },
  async (args) => {
    const result = await toolAnalyzeFitnessTrend(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: suggest_next_week ───────────────────────────────────────────────────
server.tool(
  "suggest_next_week",
  "Suggest next week's Hyrox training plan based on recent workouts and athlete profile. Present as a Mon–Sun schedule with emoji session types, exact prescriptions (distance, pace, reps), and a coach's note for the week.",
  {
    notes: z
      .string()
      .optional()
      .describe("Any context (e.g. 'feeling tired', 'want more erg work', 'Hyrox in 3 weeks')"),
  },
  async (args) => {
    const result = await toolSuggestNextWeek(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: build_training_plan ─────────────────────────────────────────────────
server.tool(
  "build_training_plan",
  "Generate a full multi-week Hyrox training plan towards a race date with base/build/taper phases. Present week by week with emoji phase labels, daily sessions with exact prescriptions, load summaries, and a race-week checklist.",
  {
    race_date: z.string().describe("Race date in YYYY-MM-DD format"),
    race_type: z
      .enum(["Hyrox", "5k", "10k", "Half Marathon", "Marathon", "Trail Run", "Other"])
      .describe("Type of race"),
    notes: z.string().optional().describe("Additional context (injury, target time, etc.)"),
  },
  async (args) => {
    const result = await toolBuildTrainingPlan(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: save_plan ───────────────────────────────────────────────────────────
server.tool(
  "save_plan",
  "Save a training plan or week suggestion to a local markdown file so it can be loaded in future sessions. Call this when the user confirms they want to save.",
  {
    title: z.string().describe("Short descriptive title, e.g. '9-Week Hyrox Plan July 2026'"),
    content: z.string().describe("The full plan text to save (markdown format)"),
    race_type: z.string().optional().describe("e.g. Hyrox, Half Marathon"),
    race_date: z.string().optional().describe("Race date YYYY-MM-DD"),
    tags: z.string().optional().describe("Comma-separated tags, e.g. 'hyrox,base-phase'"),
  },
  async (args) => {
    const result = await toolSavePlan(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: list_plans ──────────────────────────────────────────────────────────
server.tool(
  "list_plans",
  "List all saved training plans with title, date, race type, and a short preview. Use this when the user asks what plans they have saved.",
  {
    race_type: z.string().optional().describe("Filter by race type, e.g. Hyrox"),
  },
  async (args) => {
    const result = await toolListPlans(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: load_plan ───────────────────────────────────────────────────────────
server.tool(
  "load_plan",
  "Load the full content of a saved plan by filename so it can be discussed, modified, or referenced. Present the plan with its original formatting.",
  {
    filename: z.string().describe("Filename from list_plans, e.g. '2026-05-16-hyrox-plan.md'"),
  },
  async (args) => {
    const result = await toolLoadPlan(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Tool: get_activity_photos ─────────────────────────────────────────────────
server.tool(
  "get_activity_photos",
  "Fetch workout photos from a Strava activity and embed them so you can visually analyse them. Downloads each photo and returns it as an image so you can read workout results, station times, total times, or any data visible in the screenshot. If no activity_id given, uses the most recent activity of the specified category. After seeing the images, extract and summarise all visible workout data under a ## 📸 Workout Photos section.",
  {
    activity_id: z.number().int().optional().describe("Specific Strava activity ID (optional — defaults to most recent)"),
    category: z
      .enum(["Run", "Hyrox", "Gym", "HIIT", "CardioMix", "Other"])
      .optional()
      .describe("Filter to most recent activity of this category when no activity_id given"),
    force_refresh: z.boolean().optional().describe("Bypass cache"),
  },
  async (args) => {
    const result = await toolGetActivityPhotos(args) as any;

    // Start with a text summary
    const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
      { type: "text", text: JSON.stringify(result, null, 2) },
    ];

    // Download each photo and embed as base64 so Claude can visually read it
    if (Array.isArray(result.photos)) {
      for (const photo of result.photos.slice(0, 5)) { // cap at 5 to avoid huge payloads
        const url = photo.url_full ?? photo.url_thumbnail;
        if (!url) continue;
        try {
          const imgRes = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer" });
          const mimeType = (imgRes.headers["content-type"] as string) || "image/jpeg";
          const data = Buffer.from(imgRes.data as ArrayBuffer).toString("base64");
          content.push({ type: "image", data, mimeType });
        } catch {
          // Skip photos that fail to download (e.g. expired URL)
        }
      }
    }

    return { content };
  }
);

// ── Tool: set_race_goal ───────────────────────────────────────────────────────
server.tool(
  "set_race_goal",
  "Register an upcoming race goal. Returns weeks available and next steps. Present with a countdown and race-day context.",
  {
    race_date: z.string().describe("Race date in YYYY-MM-DD format"),
    race_type: z
      .enum(["Hyrox", "5k", "10k", "Half Marathon", "Marathon", "Trail Run", "Other"])
      .describe("Type of race"),
    notes: z.string().optional().describe("Target time, current fitness notes, etc."),
  },
  async (args) => {
    const result = await toolSetRaceGoal(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Start server ──────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Runner Agent MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

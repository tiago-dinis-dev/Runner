import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions.js";
import "./config.js";
import {
  toolGetLastSession,
  toolGetAthleteProfile,
  toolGetRecentActivities,
  toolGetActivityDetail,
  toolGetWeeklySummary,
  toolAnalyzeFitnessTrend,
  toolSuggestNextWeek,
  toolBuildTrainingPlan,
  toolSavePlan,
  toolListPlans,
  toolLoadPlan,
  toolSetRaceGoal,
  toolDeletePlan,
  toolMovePlanSession,
  toolEditPlanSession,
  toolNaturalEditPlan,
  toolGetPlanCompliance,
} from "./agent/tools/index.js";

// ── OpenAI-compatible client → Ollama cloud ───────────────────────────────────
const client = new OpenAI({
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
  baseURL: process.env.OLLAMA_BASE_URL ?? "https://ollama.com/v1",
});

const MODEL = process.env.OLLAMA_MODEL ?? "qwen3:cloud";

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a personal running and Hyrox coach with access to the athlete's Strava training data. You have a direct, motivating tone — like a great coach who knows their athlete well.

When answering questions:
- Use the available tools to fetch real data before answering
- Format responses with markdown: use **bold**, emoji, and short bullet lists
- Keep coaching advice specific and actionable
- Reference actual numbers from the athlete's data when possible

## PLAN TOOL ROUTING (follow strictly)

| User intent | Tool to use |
|---|---|
| "Create a new plan" / "Build me a plan" | build_training_plan → then save_plan with confirm absent |
| "Update/change/adjust/fix a specific session" | list_plans → natural_edit_plan (DO NOT call build_training_plan or save_plan) |
| "Adapt this week" / "change Tuesday's workout" | list_plans → natural_edit_plan for each affected session |
| "Delete plan X" | list_plans → delete_plan (without confirm first — returns preview) |
| "Show me my plans" | list_plans |
| "Am I on track?" / "How's my plan going?" / "What did I miss?" / "Plan adherence" | get_plan_compliance |

**CRITICAL**: When the user asks to update/edit/change an existing plan — even just one session — you MUST use natural_edit_plan on the existing file. Never call build_training_plan or save_plan when the user is asking to modify an existing plan. Modifying ≠ creating.

If the user's instruction affects multiple sessions (e.g. "adapt this week"), call natural_edit_plan once per session that needs changing — do NOT regenerate the whole plan.

## TRAINING PLAN FORMAT (STRICT — 3-column table)

Every session row MUST use exactly this 3-column format:
| Day/Date | Session Title | Workout Details |

- **Column 2 (title)**: emoji + session type + key volume (e.g. "🏃 Interval Run 12km", "🏋️ Hyrox Full Sim", "💪 Strength A")
- **Column 3 (details)**: full workout prescription, using · as separator between parts

### Workout detail rules by type:

**Running intervals** (enough detail to program into Apple Watch):
WU: Xkm @ pace · Main: N×dist @ pace (Ys jog rec) · CD: Xkm @ pace · HR: Zone · Total: Xkm

**Long run**:
Easy Xkm @ pace range · HR Z2 · [fueling note if >10km] · [progression note if any]

**Hyrox full sim / station practice**:
SkiErg 1km · Sled Push 50m @102kg · Sled Pull 50m @78kg · Burpee BJ 80m · Rowing 1km · Farmers 50m @24kg · Sandbag Lunges 50m @20kg · Wall Balls 100×4kg · Run splits: 1km @4:30/km

**Gym/Strength**:
Main: Deadlift 4×5 · DB Split Squat 3×10 · Pull-ups 3×8 · Core 3×15 · Duration: ~50min

**Erg/Cardio**:
N×Xmin @ HR target · Xmin rest · Damper 4 · RPE X/10

**Rest**: 😴 Rest — active recovery walk or mobility only

### Example rows:
| Tue | 🏃 Interval Run 11km | WU: 2km @ 6:15/km · Main: 6×800m @ 4:40/km (90s jog) · CD: 1km @ 6:15/km · HR: Z3-Z4 · Total: ~11km |
| Fri | 🚣 Erg intervals | 4×5min @ HR 145-155 · 2min rest · damper 4 · RPE 6/10 |
| Sat | 🏃 Long Run 13km | Easy 6:10-6:25/km · HR Z2 · gel at km 7 · progressive last 2km @ 5:50/km |

Apple Watch note: interval sessions must specify exact distances, exact pace targets, and exact recovery (duration + type: jog/walk/standing) so the athlete can program them directly into a custom workout.`;



// ── Tool schemas (OpenAI JSON Schema format) ──────────────────────────────────
export const chatTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_last_session",
      description:
        "Get a detailed coaching breakdown of the most recent workout. Returns pace splits, HR zone, and week load context. Use when the athlete asks about their last run or workout.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["Run", "Hyrox", "Gym", "HIIT", "CardioMix", "Other"],
            description: "Filter to last session of a specific type",
          },
          force_refresh: { type: "boolean", description: "Bypass cache" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_athlete_profile",
      description:
        "Compute the athlete's fitness profile: pace zones, HR zones, weekly volume baseline, and 12-week trend.",
      parameters: {
        type: "object",
        properties: {
          force_refresh: { type: "boolean", description: "Bypass cache" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_activities",
      description: "Fetch recent Strava activities, optionally filtered by category.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of activities to return (default 20)" },
          category: {
            type: "string",
            enum: ["Run", "Hyrox", "Gym", "HIIT", "CardioMix", "Other"],
            description: "Filter by activity category",
          },
          force_refresh: { type: "boolean", description: "Bypass cache" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_activity_detail",
      description: "Get full details for a specific Strava activity by ID (laps, km splits, HR, calories).",
      parameters: {
        type: "object",
        properties: {
          activity_id: { type: "number", description: "Strava activity ID" },
        },
        required: ["activity_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weekly_summary",
      description: "Get a week-by-week summary of training load, distance, duration, and activity breakdown.",
      parameters: {
        type: "object",
        properties: {
          weeks: { type: "number", description: "Number of recent weeks (default 8)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_fitness_trend",
      description: "Analyse fitness trends over recent weeks: volume, pace, HR, load, Hyrox frequency.",
      parameters: {
        type: "object",
        properties: {
          weeks: { type: "number", description: "Number of weeks to analyse (default 12)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_next_week",
      description: "Suggest next week's training plan based on recent workouts and athlete profile.",
      parameters: {
        type: "object",
        properties: {
          notes: {
            type: "string",
            description: "Context e.g. 'feeling tired', 'Hyrox in 3 weeks'",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_training_plan",
      description: "Generate a full multi-week training plan towards a race date.",
      parameters: {
        type: "object",
        properties: {
          race_date: { type: "string", description: "Race date in YYYY-MM-DD format" },
          race_type: {
            type: "string",
            enum: ["Hyrox", "5k", "10k", "Half Marathon", "Marathon", "Trail Run", "Other"],
          },
          notes: { type: "string", description: "Additional context (injury, target time, etc.)" },
        },
        required: ["race_date", "race_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_plan",
      description: "Save a NEW training plan to a local markdown file. Only use this when the user explicitly asks to create a brand new plan. Do NOT use this to update/edit an existing plan — use natural_edit_plan instead.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          race_type: { type: "string" },
          race_date: { type: "string" },
          tags: { type: "string" },
          confirm: { type: "boolean", description: "Set to true only after user confirms saving" },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_plans",
      description: "List all saved training plans.",
      parameters: {
        type: "object",
        properties: {
          race_type: { type: "string", description: "Filter by race type" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "load_plan",
      description: "Load the full content of a saved plan by filename.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Filename from list_plans" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_race_goal",
      description: "Register an upcoming race goal and get a countdown with next steps.",
      parameters: {
        type: "object",
        properties: {
          race_date: { type: "string", description: "Race date in YYYY-MM-DD format" },
          race_type: {
            type: "string",
            enum: ["Hyrox", "5k", "10k", "Half Marathon", "Marathon", "Trail Run", "Other"],
          },
          notes: { type: "string" },
        },
        required: ["race_date", "race_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_plan",
      description: "Delete a saved training plan. Call WITHOUT confirm first — this shows the user a preview card. Only pass confirm=true after the user explicitly approves.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Filename from list_plans" },
          confirm: { type: "boolean", description: "Set to true only after user confirms deletion" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "natural_edit_plan",
      description: "PREFERRED tool for ANY update/change/adjustment to an existing plan. Use this when the user wants to change a session, adapt a week, fix a workout, or tweak anything in a saved plan. Do NOT call build_training_plan when user wants to modify an existing plan. This returns a preview — do NOT write until the user confirms.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Filename from list_plans" },
          instruction: { type: "string", description: "Freeform description of the change — be specific about which session/date and what to change" },
        },
        required: ["filename", "instruction"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_plan_session",
      description: "Apply a confirmed edit to a session in a saved plan. Only call this after user has confirmed the preview from natural_edit_plan.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD of the session to edit" },
          label: { type: "string", description: "Current session title/label" },
          new_title: { type: "string" },
          new_details: { type: "string" },
        },
        required: ["filename", "date", "label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_plan_compliance",
      description: "Check how well the athlete is following their training plan. Compares planned sessions to actual Strava activities, computes compliance %, lists completed/missed/upcoming sessions. Use when the user asks 'am I on track?', 'how is my plan going?', 'what did I miss?', 'plan adherence', or when giving coaching advice based on plan execution.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Specific plan filename (from list_plans). If omitted, uses the most recently saved plan.",
          },
        },
      },
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────
type ToolFn = (args: any) => Promise<any>;

const toolExecutors: Record<string, ToolFn> = {
  get_last_session: toolGetLastSession,
  get_athlete_profile: toolGetAthleteProfile,
  get_recent_activities: toolGetRecentActivities,
  get_activity_detail: toolGetActivityDetail,
  get_weekly_summary: toolGetWeeklySummary,
  analyze_fitness_trend: toolAnalyzeFitnessTrend,
  suggest_next_week: toolSuggestNextWeek,
  build_training_plan: toolBuildTrainingPlan,
  save_plan: toolSavePlan,
  list_plans: toolListPlans,
  load_plan: toolLoadPlan,
  set_race_goal: toolSetRaceGoal,
  delete_plan: toolDeletePlan,
  move_plan_session: toolMovePlanSession,
  natural_edit_plan: toolNaturalEditPlan,
  edit_plan_session: toolEditPlanSession,
  get_plan_compliance: toolGetPlanCompliance,
};

const MAX_TOOL_CHARS = 4000;

function truncate(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return str.length > MAX_TOOL_CHARS ? str.slice(0, MAX_TOOL_CHARS) + "\n…[truncated]" : str;
}

// ── Agentic loop ──────────────────────────────────────────────────────────────
export interface PendingAction {
  type: 'edit_session' | 'save_plan' | 'delete_plan';
  filename: string;
  // edit_session specific
  date?: string;
  old_title?: string;
  new_title?: string;
  new_details?: string;
  updated_markdown?: string;
  // save_plan specific
  content?: string;
  // human-readable summary shown in the confirmation card
  summary: string;
}

export interface ChatResult {
  reply: string;
  toolsUsed: string[];
  pendingAction?: PendingAction;
}

export async function handleChat(userMessages: Array<{ role: "user" | "assistant"; content: string }>): Promise<ChatResult> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...userMessages,
  ];

  const toolsUsed: string[] = [];
  let pendingAction: PendingAction | undefined;
  const MAX_ITERATIONS = 8;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: chatTools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const msg = choice.message;

    // Always push the assistant turn
    messages.push(msg);

    // If no tool calls → final answer
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { reply: msg.content ?? "", toolsUsed, pendingAction };
    }

    // Execute each tool call and feed results back
    for (const call of msg.tool_calls) {
      if (call.type !== "function") continue;
      const name = call.function.name;
      toolsUsed.push(name);

      let toolResult: string;
      let rawResult: any;
      try {
        const executor = toolExecutors[name];
        if (!executor) throw new Error(`Unknown tool: ${name}`);
        const args = JSON.parse(call.function.arguments);
        rawResult = await executor(args);
        toolResult = truncate(rawResult);
      } catch (err: any) {
        toolResult = `Error: ${err.message}`;
        rawResult = null;
      }

      // Detect preview results and build pendingAction
      if (rawResult && typeof rawResult === 'object' && (rawResult as any).preview === true && !pendingAction) {
        const r = rawResult as any;
        if (name === 'natural_edit_plan') {
          pendingAction = {
            type: 'edit_session',
            filename: r.filename,
            date: r.date,
            old_title: r.old_title,
            new_title: r.new_title,
            new_details: r.new_details,
            updated_markdown: r.updated_markdown,
            summary: `Edit **${r.old_title}** on ${r.date}\n→ **${r.new_title}**${r.new_details ? `\n${r.new_details}` : ''}`,
          };
        } else if (name === 'save_plan') {
          pendingAction = {
            type: 'save_plan',
            filename: r.filename,
            content: r.content,
            summary: `Save new plan as **${r.filename}**`,
          };
        } else if (name === 'delete_plan') {
          pendingAction = {
            type: 'delete_plan',
            filename: r.filename,
            summary: `Delete plan **${r.filename}**`,
          };
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: toolResult,
      });
    }
  }

  // Exceeded max iterations — ask for a plain summary
  const fallback = await client.chat.completions.create({
    model: MODEL,
    messages: [...messages, { role: "user", content: "Please summarise what you found so far." }],
  });

  return {
    reply: fallback.choices[0]?.message?.content ?? "Sorry, I hit the iteration limit. Please try a more specific question.",
    toolsUsed,
    pendingAction,
  };
}

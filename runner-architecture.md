# 🏗️ Runner — How It All Works

---

## The Big Picture

```
Your Apple Watch
      ↓ syncs
   Strava App
      ↓ API
  MCP Server (Node.js)   ←→   data/cache.json
      ↓ tools
  VS Code Copilot Agent
  (Claude Sonnet)
      ↓ answers
      You
```

---

## The 3 Layers

### 1. 📡 Strava Layer (`src/strava/`)
- `auth.ts` — handles OAuth2 tokens (load, refresh, save to `data/strava-tokens.json`)
- `client.ts` — calls Strava API (`/athlete/activities`, `/activities/{id}`, `/activities/{id}/photos`)
- `types.ts` — TypeScript interfaces + `classifyActivity()` which labels each workout as `Run | Hyrox | Gym | HIIT | CardioMix | Other`
- `cache.ts` — saves fetched activities to `data/activities.json` with a TTL (default 60min) so you don't hammer the API every message

### 2. 🔧 MCP Tools Layer (`src/agent/tools/` + `src/index.ts`)

This is the MCP server — a process that speaks the **Model Context Protocol** over stdio. VS Code Copilot connects to it and discovers the tools.

There are **12 tools** grouped by file:

| File | Tools |
|------|-------|
| `activities.ts` | `get_last_session`, `get_recent_activities`, `get_activity_detail`, `get_activity_photos` |
| `analytics.ts` | `get_athlete_profile`, `get_weekly_summary`, `analyze_fitness_trend` |
| `planning.ts` | `build_training_plan`, `suggest_next_week`, `set_race_goal`, `save_plan`, `list_plans`, `load_plan` |

Each tool is a **pure data function** — it fetches/computes structured data and returns JSON. No AI happens here.

`src/index.ts` is the entry point — it registers all 12 tools with their schemas (via Zod) and starts the stdio server.

### 3. 🧠 Agent Layer — Claude Sonnet in VS Code

Claude is the brain. It:
- Decides **which tools to call** based on your question
- Receives the JSON data back
- **Reasons over it** — writes plans, gives coaching insights, reads photos via vision
- Formats the response with emojis, tables, markdown

The tool descriptions (in `index.ts`) double as **formatting instructions** to Claude — e.g. _"present with emoji sections and a lap breakdown table"_.

---

## A Real Request Flow

> _"How was my last Hyrox?"_

```
1. You type it in VS Code Copilot chat

2. Claude decides to call → get_last_session(category: "Hyrox")

3. MCP server:
   - checks cache (or fetches from Strava)
   - finds most recent Hyrox activity
   - calls /activities/{id} for full detail
   - computes: pace zones, HR zone, km splits with effort bars,
     comparison vs your last 10 sessions, week load score

4. Returns JSON to Claude

5. Claude reads the JSON and writes a rich coaching response
   with sections, emojis, tables, observations

6. You see the answer
```

---

## Key Design Decisions

- **No secondary AI model** — Claude Sonnet does all reasoning. The MCP tools are just data pipes.
- **Local cache** — activities cached in JSON so the server is fast and doesn't re-fetch every message
- **One-time auth** — `npm run strava-auth` opens a browser, you log in once, tokens are saved forever (auto-refreshed)
- **Photo vision** — photos are downloaded as base64 and sent directly to Claude so it can visually read your Hyrox result screenshots

---

## File Map

```
Runner/
├── src/
│   ├── index.ts              ← MCP server entry, registers all tools
│   ├── cache.ts              ← JSON cache with TTL
│   ├── strava/
│   │   ├── auth.ts           ← OAuth2 token management
│   │   ├── client.ts         ← Strava API calls
│   │   └── types.ts          ← Interfaces + activity classifier
│   └── agent/
│       ├── prompts.ts        ← AthleteProfile type, pace/duration helpers
│       └── tools/
│           ├── activities.ts ← Session & photo tools
│           ├── analytics.ts  ← Profile & trend tools
│           ├── planning.ts   ← Plan generation & persistence
│           └── index.ts      ← Barrel exports
├── scripts/
│   └── strava-auth.ts        ← One-time OAuth browser flow
└── data/                     ← Runtime data (gitignored)
    ├── strava-tokens.json    ← Your OAuth tokens
    ├── activities.json       ← Cached activities
    └── plans/                ← Saved training plans (.md files)
```

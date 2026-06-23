# Runner — Architecture

## Overview

A full-stack training app that fetches & analyzes Strava activities, surfaces insights via a VS Code Copilot MCP agent, and provides a React frontend with training plan management, calendar visualization, and an embedded AI chat widget.

---

## Project Structure

```
Runner/
├── frontend/          # React + Vite + TypeScript UI
└── backend/           # Express API + MCP server + Agent
```

---

## Backend (`backend/src/`)

### Entry Points
- `index.ts` — Registers MCP tools, starts MCP stdio server (used by VS Code Copilot)
- `api.ts` — Express REST API server (used by frontend + widget chat)
- `chat.ts` — `/api/chat` endpoint: LLM orchestration with tool routing and streaming

### Core Modules
- `db.ts` — SQLite database (plans, sessions, metadata)
- `cache.ts` — Strava activity cache with TTL; re-runs `classifyActivity()` on every read to keep labels fresh
- `config.ts` — Environment config (Strava credentials, ports)

### Strava (`backend/src/strava/`)
- `auth.ts` — OAuth helpers (token refresh, initial flow)
- `client.ts` — Strava API calls (activities list, detail, laps)
- `types.ts` — `classifyActivity()`: maps `sport_type` + name keywords → `Run | Gym | Erg | Hyrox | Other`

### Agent (`backend/src/agent/`)
- `prompts.ts` — System prompt templates (widget chat vs Copilot chat)
- `tools/index.ts` — Barrel export of all tools
- `tools/activities.ts` — `get_activities`, `get_last_session`, `search_activities`
- `tools/analytics.ts` — `get_athlete_profile`, `analyze_fitness_trend`, `get_running_evolution`
- `tools/planning.ts` — `build_training_plan`, `suggest_next_week`, `apply_plan_edit`, `get_plan_compliance`
- `tools/helpers.ts` — Shared logic: `computeAthleteProfile` (async, fetches lap data for true interval pace), `clusterLapPace`, `inferIntervalPaceFromSplits`, `looksLikeIntervalSession`

### API Endpoints (Express)
| Method | Path | Description |
|---|---|---|
| GET | `/api/activities` | Cached Strava activities |
| GET | `/api/activities/:id` | Single activity detail |
| GET | `/api/plan` | Load active training plan |
| POST | `/api/plan/save` | Save/overwrite plan |
| POST | `/api/plan/apply-edit` | Patch specific rows in plan |
| POST | `/api/chat` | Widget chat: LLM + tools |

---

## Frontend (`frontend/src/`)

### Pages
- `pages/Home.tsx` — Main page: fetches activities + plan, runs `matchPlanSessions()`, renders calendar

### Components
- `components/Calendar.tsx` — Weekly calendar grid; shows plan sessions with completion status (green border + checkmark when matched to a Strava activity)
- `components/ChatWidget.tsx` — Embedded AI chat bubble; calls `/api/chat`
- `components/ActivityCard.tsx` — Activity summary card
- `components/ActivityDetailModal.tsx` — Full activity detail overlay
- `components/MoveSessionModal.tsx` — UI to reschedule a plan session
- `components/planParser.ts` — Parses plan markdown → `PlanSession[]`; `matchPlanSessions()` joins plan sessions with Strava activities by date + type compatibility + keyword score
- `api/` — Typed API client wrappers

---

## Request Flows

### VS Code Copilot (MCP)
```
You → VS Code Copilot → MCP stdio → tool call → cache/Strava API → JSON → Copilot → You
```

### Widget Chat
```
You → ChatWidget → POST /api/chat → LLM orchestration → tool calls → JSON → streamed response → You
```

### Calendar Completion Matching (frontend)
```
Strava activities + Plan sessions → matchPlanSessions() → PlanSession.completedActivity → Calendar renders ✅
```

---

## Key Design Decisions

- **Dual agent interface**: MCP server (VS Code Copilot) and Express chat endpoint (widget) share the same tools and prompts — no duplication of logic.
- **Classification at read time**: `classifyActivity()` runs in `cache.ts` on every DB read, so fixing keyword rules instantly affects all cached activities without a purge.
- **Interval pace from laps**: `computeAthleteProfile` is async and fetches detailed lap data from Strava to compute true rep pace (filters rest laps by distance + speed) rather than using whole-activity average speed.
- **Plan compliance**: `toolGetPlanCompliance` matches plan sessions to Strava activities server-side; also exposed to frontend via `matchPlanSessions()` for calendar display.
- **SQLite for plans**: Plans stored as markdown in SQLite (`db.ts`); patched via `apply-edit` endpoint to avoid full rewrites.
- **Confirmation before plan mutations**: Widget chat agent asks for user confirmation before any plan save/delete/edit operation.

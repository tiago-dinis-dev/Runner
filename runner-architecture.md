# Runner — Architecture (Simple & Updated)

Overview

A lightweight setup to fetch & analyze Strava activities and surface insights via a local MCP server + VS Code Copilot agent.

Components

- frontend/ — UI (optional) for visualizing plans & summaries
- backend/ — API helpers and server code
- src/ — MCP server (Node.js) that exposes small, pure "tools" over stdio
- src/strava/ — handles OAuth, API calls, and classification
- data/ — runtime cache and tokens (gitignored)
- agent (VS Code) — Copilot/Claude calls tools, reasons over returned JSON, formats responses

Request flow (simple)

You → VS Code (Copilot) → MCP tool call → cache/Strava API → JSON → Copilot → You

Files of interest

- src/index.ts        — register tools, start MCP stdio server
- src/strava/auth.ts  — OAuth helpers
- src/strava/client.ts — Strava API calls
- src/cache.ts         — simple JSON cache with TTL
- scripts/strava-auth.ts — one-time OAuth flow
- data/ (strava-tokens.json, activities.json)

Design notes

- Tools return structured JSON only; all reasoning stays in the agent.
- Keep cache local to reduce API calls.
- Keep tools small and testable.

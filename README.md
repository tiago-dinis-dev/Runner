# Runner

A Hyrox training coach powered by Strava + AI — with a web dashboard and VS Code Copilot integration.

## Project Structure

```
Runner/
├── backend/    ← MCP stdio server + Express REST API
├── frontend/   ← React + Vite + Tailwind web app
├── data/       ← Runtime data (gitignored): tokens, cache, plans
└── scripts/    → moved to backend/scripts/
```

## Setup

```bash
npm install          # installs all workspaces
cp .env.example .env # fill in Strava credentials
```

Fill in `.env` (at project root):

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
```

## Strava Auth (one-time)

```bash
npm run strava-auth
```

## Development

Run both the REST API and the frontend together:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:api       # REST API on http://localhost:3001
npm run dev:frontend  # Web app on http://localhost:5173
```

## Web Dashboard

Open **http://localhost:5173** to see:
- 🏆 Race countdown to your next Hyrox race
- 📊 Weekly km, total runs, next session stats
- 📅 Interactive calendar with Strava activities + training plan overlay
- 💬 Floating chat widget → opens VS Code Copilot agent

## MCP Server (VS Code Copilot)

```json
{
  "mcpServers": {
    "runner-agent": {
      "command": "npx",
      "args": ["tsx", "backend/src/index.ts"],
      "cwd": "C:/path/to/Runner"
    }
  }
}
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + frontend together |
| `npm run dev:api` | REST API only (port 3001) |
| `npm run dev:frontend` | Frontend only (port 5173) |
| `npm run build` | Build backend + frontend |
| `npm run strava-auth` | One-time Strava OAuth |


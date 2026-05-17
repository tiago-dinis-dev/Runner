# Runner Agent

Runner Agent is an MCP server for Strava workouts. It pulls activity data, keeps a local cache, and helps with training summaries and plans.

## Setup

```bash
cd Runner
npm install
cp .env.example .env
```

Fill in `.env`:

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
OLLAMA_API_KEY=your_ollama_api_key
OLLAMA_BASE_URL=https://ollama.com/v1
OLLAMA_MODEL=gemma4:31b-cloud
```

## Strava auth

Run the one-time browser login flow:

```bash
npm run strava-auth
```

## Run the server

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

## MCP client config

Use the built server:

```json
{
  "mcpServers": {
    "runner-agent": {
      "command": "node",
      "args": ["C:/path/to/Runner/dist/index.js"],
      "cwd": "C:/path/to/Runner"
    }
  }
}
```

Or run directly from source:

```json
{
  "mcpServers": {
    "runner-agent": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "C:/path/to/Runner"
    }
  }
}
```

## Scripts

- `npm run dev` - run from source
- `npm run build` - compile TypeScript
- `npm start` - run compiled output
- `npm run strava-auth` - authorize Strava

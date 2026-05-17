import * as fs from "node:fs";
import * as path from "node:path";
import axios from "axios";
import type { StravaTokens } from "./types.js";

const TOKEN_FILE = path.join(process.cwd(), "data", "strava-tokens.json");

export function loadTokens(): StravaTokens | null {
  // Prefer token file; fall back to env vars
  if (fs.existsSync(TOKEN_FILE)) {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")) as StravaTokens;
  }

  const { STRAVA_ACCESS_TOKEN, STRAVA_REFRESH_TOKEN, STRAVA_TOKEN_EXPIRES_AT } = process.env;

  if (STRAVA_REFRESH_TOKEN) {
    return {
      access_token: STRAVA_ACCESS_TOKEN ?? "",
      refresh_token: STRAVA_REFRESH_TOKEN,
      expires_at: Number(STRAVA_TOKEN_EXPIRES_AT ?? 0),
      token_type: "Bearer",
    };
  }

  return null;
}

export function saveTokens(tokens: StravaTokens): void {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));

  // Also update env vars in memory for current process
  process.env.STRAVA_ACCESS_TOKEN = tokens.access_token;
  process.env.STRAVA_REFRESH_TOKEN = tokens.refresh_token;
  process.env.STRAVA_TOKEN_EXPIRES_AT = String(tokens.expires_at);
}

export async function refreshAccessToken(tokens: StravaTokens): Promise<StravaTokens> {
  const clientId = process.env.STRAVA_CLIENT_ID!;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET!;

  const res = await axios.post<StravaTokens>("https://www.strava.com/oauth/token", {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
  });

  const fresh = res.data;
  saveTokens(fresh);
  return fresh;
}

/** Return a valid access token, refreshing if needed */
export async function getValidAccessToken(): Promise<string> {
  let tokens = loadTokens();

  if (!tokens) {
    throw new Error(
      "No Strava tokens found. Run `npm run strava-auth` first, or set STRAVA_REFRESH_TOKEN in .env"
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  // Refresh if token expires in less than 5 minutes
  if (tokens.expires_at - nowSec < 300) {
    tokens = await refreshAccessToken(tokens);
  }

  return tokens.access_token;
}

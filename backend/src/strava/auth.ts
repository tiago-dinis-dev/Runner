import * as fs from "node:fs";
import * as path from "node:path";
import axios from "axios";
import type { StravaTokens } from "./types.js";
import { ROOT } from "../config.js";

const ENV_FILE = path.join(ROOT, ".env");

export function loadTokens(): StravaTokens | null {
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

/** Write token values back into .env file (updates existing keys in-place) */
export function saveTokens(tokens: StravaTokens): void {
  let env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf-8") : "";

  const updates: Record<string, string> = {
    STRAVA_ACCESS_TOKEN: tokens.access_token,
    STRAVA_REFRESH_TOKEN: tokens.refresh_token,
    STRAVA_TOKEN_EXPIRES_AT: String(tokens.expires_at),
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    if (regex.test(env)) {
      env = env.replace(regex, line);
    } else {
      env = env.trimEnd() + `\n${line}\n`;
    }
    // Update in-memory env for the current process
    process.env[key] = value;
  }

  fs.writeFileSync(ENV_FILE, env);
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

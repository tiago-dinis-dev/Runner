/**
 * One-time Strava OAuth2 authorization script.
 * Run with: npm run strava-auth
 *
 * This opens a browser to authorize your Strava app, then saves
 * tokens to data/strava-tokens.json for future use.
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import axios from "axios";
import * as dotenv from "dotenv";
import { ROOT } from "../src/config.js";

dotenv.config();

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_PORT = 8888;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌  Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in .env");
  console.error("   Copy .env.example → .env and fill in your Strava app credentials.");
  process.exit(1);
}

const authUrl =
  `https://www.strava.com/oauth/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&approval_prompt=force` +
  `&scope=read,activity:read_all`;

console.log("\n🔗  Opening browser for Strava authorization...");
console.log("   If the browser does not open, visit:\n");
console.log(`   ${authUrl}\n`);

// Open browser
const cmd =
  process.platform === "win32" ? `start "" "${authUrl}"` :
  process.platform === "darwin" ? `open "${authUrl}"` :
  `xdg-open "${authUrl}"`;
exec(cmd);

// Local HTTP server to catch the OAuth callback
const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) return;

  const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.end("❌ No code in callback. Please try again.");
    server.close();
    return;
  }

  try {
    const tokenRes = await axios.post("https://www.strava.com/oauth/token", {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    });

    const tokens = tokenRes.data;

    // Save tokens directly to .env
    const envFile = path.join(ROOT, ".env");
    let envContent = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf-8") : "";

    const updates: Record<string, string> = {
      STRAVA_ACCESS_TOKEN: tokens.access_token,
      STRAVA_REFRESH_TOKEN: tokens.refresh_token,
      STRAVA_TOKEN_EXPIRES_AT: String(tokens.expires_at),
    };
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      const line = `${key}=${value}`;
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, line);
      } else {
        envContent = envContent.trimEnd() + `\n${line}\n`;
      }
    }
    fs.writeFileSync(envFile, envContent);

    const athlete = tokens.athlete;
    console.log(`\n✅  Authorized as: ${athlete?.firstname} ${athlete?.lastname}`);
    console.log(`   Tokens saved to: ${envFile}`);
    console.log("\n🚀  You're all set! You can now run the MCP server.\n");

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>✅ Strava authorization successful!</h2>
        <p>You can close this tab and return to the terminal.</p>
      </body></html>
    `);
  } catch (err: any) {
    console.error("❌  Token exchange failed:", err.message);
    res.end("Token exchange failed. Check the terminal.");
  }

  server.close();
});

server.listen(REDIRECT_PORT, () => {
  console.log(`   Waiting for callback on http://localhost:${REDIRECT_PORT}/callback ...`);
});

/**
 * seed-db.ts
 *
 * One-time migration: reads existing JSON cache and plan markdown files,
 * inserts them into PostgreSQL. Safe to re-run — skips records that already exist.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/seed-db.ts
 */

import * as fs from "fs";
import * as path from "path";
import "../src/config.js"; // load .env
import { db } from "../src/db.js";
import type { SummaryActivity } from "../src/strava/types.js";

// Resolve DATA_DIR: prefer explicit env, then project data, then data-archive
let DATA_DIR: string;
if (process.env.DATA_DIR) {
  DATA_DIR = path.resolve(process.env.DATA_DIR);
} else {
  const candidate1 = path.join(__dirname, "../../data");
  const candidate2 = path.join(__dirname, "../../data-archive");
  if (fs.existsSync(candidate1)) DATA_DIR = path.resolve(candidate1);
  else if (fs.existsSync(candidate2)) DATA_DIR = path.resolve(candidate2);
  else DATA_DIR = path.resolve(candidate1); // fallback to original path
}

// ── Seed activities ────────────────────────────────────────────────────────────
async function seedActivities() {
  const cacheFile = path.join(DATA_DIR, "activities-cache.json");
  if (!fs.existsSync(cacheFile)) {
    console.log("⚠️  No activities-cache.json found — skipping activities seed.");
    return;
  }

  const { activities, fetchedAt } = JSON.parse(fs.readFileSync(cacheFile, "utf-8")) as {
    activities: SummaryActivity[];
    fetchedAt: number;
  };

  const fetchedAtDate = new Date(fetchedAt);
  let inserted = 0;
  let skipped = 0;

  for (const a of activities) {
    const existing = await db.activity.findUnique({ where: { id: BigInt(a.id) } });
    if (existing) { skipped++; continue; }

    await db.activity.create({
      data: {
        id: BigInt(a.id),
        name: a.name,
        sport_type: a.sport_type,
        start_date: new Date(a.start_date),
        start_date_local: new Date(a.start_date_local),
        distance: a.distance,
        moving_time: a.moving_time,
        elapsed_time: a.elapsed_time,
        total_elevation_gain: a.total_elevation_gain,
        average_speed: a.average_speed,
        max_speed: a.max_speed,
        average_heartrate: a.average_heartrate ?? null,
        max_heartrate: a.max_heartrate ?? null,
        suffer_score: a.suffer_score ?? null,
        total_photo_count: a.total_photo_count ?? null,
        category: a.category ?? null,
        fetched_at: fetchedAtDate,
      },
    });
    inserted++;
  }

  console.log(`✅ Activities: ${inserted} inserted, ${skipped} already existed.`);
}

// ── Seed plans ─────────────────────────────────────────────────────────────────
async function seedPlans() {
  const plansDir = path.join(DATA_DIR, "plans");
  if (!fs.existsSync(plansDir)) {
    console.log("⚠️  No plans directory found — skipping plans seed.");
    return;
  }

  const files = fs.readdirSync(plansDir).filter((f) => f.endsWith(".md"));
  let inserted = 0;
  let skipped = 0;

  for (const filename of files) {
    const existing = await db.plan.findUnique({ where: { filename } });
    if (existing) { skipped++; continue; }

    const content = fs.readFileSync(path.join(plansDir, filename), "utf-8");
    const rtMatch = content.match(/^race_type:\s*"?([^"\n]+)"?/m);
    const race_type = rtMatch ? rtMatch[1].trim() : null;

    // Use file mtime as created_at
    const stat = fs.statSync(path.join(plansDir, filename));

    await db.plan.create({
      data: {
        filename,
        content,
        race_type,
        created_at: stat.birthtime,
        updated_at: stat.mtime,
      },
    });
    inserted++;
  }

  console.log(`✅ Plans: ${inserted} inserted, ${skipped} already existed.`);
}

async function main() {
  console.log("🌱 Seeding database from existing files...\n");
  await seedActivities();
  await seedPlans();
  console.log("\n🎉 Seed complete!");
  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});

import express from "express";
import cors from "cors";
import "./config.js"; // loads .env from workspace root
import {
  toolGetRecentActivities,
  toolGetActivityDetail,
  toolGetActivityPhotos,
  toolGetWeeklySummary,
  toolGetAthleteProfile,
  toolListPlans,
  toolLoadPlan,
} from "./agent/tools/index.js";

const app = express();
const PORT = process.env.API_PORT ?? 3001;

app.use(cors());
app.use(express.json());

// ── GET /api/activities ───────────────────────────────────────────────────────
app.get("/api/activities", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const category = req.query.category as string | undefined;
    const result = await toolGetRecentActivities({ limit, category: category as any });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/activities/:id ───────────────────────────────────────────────────
app.get("/api/activities/:id", async (req, res) => {
  try {
    const activity_id = parseInt(req.params.id);
    const result = await toolGetActivityDetail({ activity_id });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/activities/:id/photos ────────────────────────────────────────────
app.get("/api/activities/:id/photos", async (req, res) => {
  try {
    const activity_id = parseInt(req.params.id);
    const result = await toolGetActivityPhotos({ activity_id });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/weekly-summary ───────────────────────────────────────────────────
app.get("/api/weekly-summary", async (req, res) => {
  try {
    const weeks = req.query.weeks ? parseInt(req.query.weeks as string) : 12;
    const result = await toolGetWeeklySummary({ weeks });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/profile ──────────────────────────────────────────────────────────
app.get("/api/profile", async (_req, res) => {
  try {
    const result = await toolGetAthleteProfile({});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/plans ────────────────────────────────────────────────────────────
app.get("/api/plans", async (req, res) => {
  try {
    const race_type = req.query.race_type as string | undefined;
    const result = await toolListPlans({ race_type });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/plans/:filename ──────────────────────────────────────────────────
app.get("/api/plans/:filename", async (req, res) => {
  try {
    const result = await toolLoadPlan({ filename: req.params.filename });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Runner REST API running on http://localhost:${PORT}`);
});

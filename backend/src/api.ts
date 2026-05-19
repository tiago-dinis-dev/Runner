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
  toolDeletePlan,
  toolMovePlanSession,
  toolSavePlan,
} from "./agent/tools/index.js";
import { handleChat } from "./chat.js";
import { db } from "./db.js";

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

// ── DELETE /api/plans/:filename ───────────────────────────────────────────────
app.delete("/api/plans/:filename", async (req, res) => {
  try {
    // Direct UI delete — bypass the chat confirmation flow, always execute
    const result = await toolDeletePlan({ filename: req.params.filename, confirm: true });
    const r = result as any;
    if (r.error) {
      res.status(404).json({ error: r.error });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/plans/:filename/move-session ───────────────────────────────────
app.patch("/api/plans/:filename/move-session", async (req, res) => {
  try {
    const { from_date, label, to_date } = req.body as {
      from_date: string;
      label: string;
      to_date: string;
    };
    if (!from_date || !label || !to_date) {
      res.status(400).json({ error: "from_date, label, and to_date are required" });
      return;
    }
    const result = await toolMovePlanSession({ filename: req.params.filename, from_date, label, to_date });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/plans/:filename/apply-edit — write confirmed edit from chat ────
app.patch("/api/plans/:filename/apply-edit", async (req, res) => {
  try {
    const { updated_markdown } = req.body as { updated_markdown: string };
    if (!updated_markdown) {
      res.status(400).json({ error: "updated_markdown is required" });
      return;
    }
    const existing = await db.plan.findUnique({ where: { filename: req.params.filename } });
    if (!existing) {
      res.status(404).json({ error: `Plan "${req.params.filename}" not found.` });
      return;
    }
    await db.plan.update({
      where: { filename: req.params.filename },
      data: { content: updated_markdown },
    });
    res.json({ applied: true, filename: req.params.filename, message: "✅ Plan updated." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/plans — save a new plan directly (confirmed from chat) ───────────
app.post("/api/plans", async (req, res) => {
  try {
    const { filename, content } = req.body as { filename: string; content: string };
    if (!filename || !content) {
      res.status(400).json({ error: "filename and content are required" });
      return;
    }
    // Extract race_type from frontmatter if present
    const rtMatch = content.match(/^race_type:\s*"?([^"\n]+)"?/m);
    const race_type = rtMatch ? rtMatch[1].trim() : null;
    await db.plan.upsert({
      where: { filename },
      update: { content, race_type },
      create: { filename, content, race_type },
    });
    res.json({ saved: true, filename, message: `✅ Plan "${filename}" saved.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/chat ────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }
    const result = await handleChat(messages);
    res.json(result);
  } catch (err: any) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message ?? "Chat failed" });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Runner REST API running on http://localhost:${PORT}`);
});

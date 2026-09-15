import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { generateContent } from "./ollama.js";

/**
 * In-memory Stitch job store (local dev only).
 *
 * Stitch generation can take 40s+ (well beyond the ~60s Firebase Hosting
 * rewrite timeout in production). So instead of blocking, we create a job and
 * run generation in the background. The client polls /api/stitch-status/:id.
 *
 * Production uses Firestore + a Cloud Task worker instead — see
 * functions/src/stitchJobs.ts. This map lives in app.ts (not index.ts) so the
 * app can be imported without triggering the port bootstrap — which makes the
 * router testable via supertest.
 */
type StitchJob = {
  status: "queued" | "running" | "done" | "error";
  html?: string;
  imageUrl?: string;
  error?: string;
};

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  /**
   * POST /api/generate
   * Body: { systemPrompt: string, userPrompt: string }
   * Returns: { content: string, model: string, usage: { promptTokens, completionTokens, totalTokens } }
   */
  app.post("/api/generate", async (req, res) => {
    try {
      const { systemPrompt, userPrompt } = req.body as {
        systemPrompt?: string;
        userPrompt?: string;
      };

      if (!userPrompt || typeof userPrompt !== "string") {
        return res.status(400).json({ error: "userPrompt is required" });
      }

      const result = await generateContent(
        systemPrompt || "You are a helpful assistant.",
        userPrompt
      );

      res.json({
        content: result.content,
        model: result.model,
        usage: {
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
        },
      });
    } catch (err: any) {
      console.error("[/api/generate] Error:", err.message);
      res.status(500).json({
        error: err.message || "Failed to generate content",
      });
    }
  });

  /**
   * GET /api/health — simple health check
   */
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      ollamaKey: process.env.OLLAMA_API_KEY ? "configured" : "missing",
    });
  });

  /**
   * GET /api/admin/stats — admin-only system stats.
   *
   * The local dev server has no Firebase Admin SDK / service account, so admin
   * stats are only available in the production Cloud Function. This stub keeps
   * the API surface consistent and returns a clear message instead of a 404.
   */
  app.get("/api/admin/stats", (_req, res) => {
    res.status(501).json({
      error: "Admin stats are only available in the Firebase Cloud Function (production).",
    });
  });

  /**
   * POST /api/admin/roles — facilitator role management needs the Admin SDK,
   * so it only exists in the Cloud Function (same deviation as admin stats).
   */
  app.post("/api/admin/roles", (_req, res) => {
    res.status(501).json({
      error: "Role management is only available in the Firebase Cloud Function (production).",
    });
  });

  /**
   * Workshop guest join proxies to the DEPLOYED Cloud Function. The join
   * endpoint mints Firebase custom tokens, which requires the Admin SDK —
   * the local server has no service account. Proxying (instead of stubbing)
   * keeps the full guest flow testable on localhost: the deployed function
   * is the source of truth and localhost is an authorized auth domain.
   */
  app.post("/api/workshop/join", async (req, res) => {
    const PROXY_TARGET =
      process.env.WORKSHOP_PROXY_URL || "https://carbondocs.web.app/api/workshop/join";
    try {
      const r = await fetch(PROXY_TARGET, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body || {}),
      });
      const data = await r.json();
      res.status(r.status).json(data);
    } catch (e: any) {
      console.error("[/api/workshop/join] proxy error:", e?.message);
      res
        .status(502)
        .json({ error: "Workshop join is unavailable — the production function could not be reached." });
    }
  });

  return app;
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

vi.mock("./ollama.js", () => ({
  generateContent: vi.fn(async (systemPrompt: string, userPrompt: string) => ({
    content: `response for: ${userPrompt}`,
    model: "mock-model",
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
  })),
}));

// Silence expected console noise (error paths intentionally log).
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("reports ok with missing keys by default", async () => {
    delete process.env.OLLAMA_API_KEY;

    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      ollamaKey: "missing",
    });
  });
});

describe("POST /api/generate", () => {
  it("returns 400 when userPrompt is missing", async () => {
    const res = await request(createApp())
      .post("/api/generate")
      .send({ systemPrompt: "sys" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("userPrompt");
  });

  it("returns content + token usage, defaulting the system prompt", async () => {
    const res = await request(createApp())
      .post("/api/generate")
      .send({ userPrompt: "hello" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      content: "response for: hello",
      model: "mock-model",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });
});

describe("GET /api/admin/stats", () => {
  it("returns 501 locally (production-only feature)", async () => {
    const res = await request(createApp()).get("/api/admin/stats");
    expect(res.status).toBe(501);
  });
});
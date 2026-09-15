const API_BASE = "/api";

export interface GenerateRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateResponse {
  content: string;
  model?: string;
  usage?: TokenUsage;
  error?: string;
}

/**
 * Calls the backend to generate text content via the Ollama backend.
 */
export async function generate(
  req: GenerateRequest
): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

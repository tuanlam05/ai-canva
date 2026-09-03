// Ollama Cloud integration for AI text generation (Firebase Cloud Functions).
//
// Ollama Cloud runs models remotely and exposes a standard Ollama HTTP API at
// https://ollama.com. See https://docs.ollama.com/cloud for details. This uses
// the native /api/chat endpoint (non-streaming), so it also works against a
// local Ollama daemon by setting OLLAMA_HOST.

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatResponse {
  model?: string;
  message?: { role?: string; content?: string };
  error?: string;
}

/**
 * Calls an Ollama model with a system + user prompt and returns the text reply.
 *
 * - Endpoint:  POST {OLLAMA_HOST}/api/chat   (default https://ollama.com)
 * - Auth:      Bearer token from OLLAMA_API_KEY
 * - Model:     OLLAMA_MODEL (default "deepseek-v4-flash")
 */
export async function generateContent(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const host = process.env.OLLAMA_HOST || "https://ollama.com";
  const apiKey = process.env.OLLAMA_API_KEY;
  const model = process.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      options: { num_predict: 8192 },
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama request failed (${res.status}): ${text.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as ChatResponse;
  const content = data.message?.content;
  if (!content) {
    throw new Error(`Ollama returned no content. ${data.error || ""}`.trim());
  }

  return content;
}

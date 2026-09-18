import type {VercelRequest, VercelResponse} from "@vercel/node";
import {generateContent} from "../server/src/ollama.js";

// Vercel serverless version of POST /api/generate in server/src/app.ts.
// Same request/response shape so the client is unchanged between dev and prod.

export const config = {maxDuration: 120};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({error: "Method not allowed"});
    }

    try {
        const {systemPrompt, userPrompt} = (req.body ?? {}) as {
            systemPrompt?: string;
            userPrompt?: string;
        };

        if (!userPrompt || typeof userPrompt !== "string") {
            return res.status(400).json({error: "userPrompt is required"});
        }

        const result = await generateContent(
            systemPrompt || "You are a helpful assistant.",
            userPrompt
        );

        return res.status(200).json({
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
        return res.status(500).json({error: err.message || "Failed to generate content"});
    }
}
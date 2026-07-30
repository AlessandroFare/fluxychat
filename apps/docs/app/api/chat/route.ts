import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

const PROVIDERS = [
  {
    name: "opencode",
    baseURL: (process.env.AI_BASE_URL || "https://opencode.ai/zen").replace(/\/+$/, "") + "/v1",
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL || "deepseek-v4-flash-free",
  },
  {
    name: "mistral",
    baseURL: "https://api.mistral.ai/v1",
    apiKey: process.env.MISTRAL_API_KEY,
    model: "open-mistral-nemo",
  },
];

const active = PROVIDERS.find((p) => p.apiKey);
const providerName = active?.name || "none";

export async function POST(req: Request) {
  const { messages } = await req.json();

  if (!active) {
    return Response.json(
      {
        error:
          "No AI provider configured. Set AI_API_KEY (OpenCode) or MISTRAL_API_KEY in apps/docs/.env.local.",
      },
      { status: 501 },
    );
  }

  const provider = createOpenAICompatible({
    name: active.name,
    baseURL: active.baseURL,
    apiKey: active.apiKey,
  });

  const result = streamText({
    model: provider.languageModel(active.model),
    system:
      `You are a documentation assistant for FluxyChat (provider: ${providerName}). ` +
      "Answer in English, concisely and technically. " +
      "Use accurate API paths: POST /auth/token, POST /messages, FluxyChatClient, useChat, FluxyRealtimeProvider. " +
      "Never expose API keys in browser code. Include code examples when helpful. Say when unsure.",
    messages,
  });

  return result.toTextStreamResponse();
}

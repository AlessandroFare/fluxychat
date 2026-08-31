import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKey: string | undefined;
  model: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  },
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
    model: process.env.MISTRAL_MODEL || "open-mistral-nemo",
  },
  {
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },
];

const active = PROVIDERS.find((p) => p.apiKey?.trim());
const providerName = active?.name || "none";

export async function POST(req: Request) {
  const { messages } = await req.json();

  if (!active?.apiKey) {
    return Response.json(
      {
        error:
          "No AI provider configured. Set one of: GROQ_API_KEY, AI_API_KEY (OpenCode), MISTRAL_API_KEY, OPENAI_API_KEY in apps/docs/.env.local.",
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
      `You are a documentation assistant for FluxyChat (provider: ${providerName}, model: ${active.model}). ` +
      "Answer in English, concisely and technically. " +
      "Use accurate API paths: POST /auth/token (X-Fluxy-Api-Key, never in the browser), POST /messages. " +
      "FluxyRealtimeProvider takes workerUrl plus publishableKey (public rooms), authTokenProvider, or connectUrl (not token/config.baseUrl). FluxyYjsProvider takes token. " +
      "Cursors: sendCursor / type cursor, not client_event. Feeds ≠ chat. Threads ≠ parentId. Copilot ≠ invokeAgent. " +
      "Never invent MQTT, HIPAA, netcode, or Liveblocks keys. Point agents to /llms.txt. Include code examples when helpful. Say when unsure.",
    messages,
  });

  return result.toTextStreamResponse();
}

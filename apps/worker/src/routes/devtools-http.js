/**
 * DevTools playground — direct LLM streaming for the dashboard /devtools page.
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { resolveLlmConnection } from "../lib/llm-providers.js";
import { callLlmOpenAIStream } from "../lib/llm-stream.js";
import { isAiConfigured, resolveAiTransport } from "../lib/ai-gateway.js";
import { chatCompletion } from "../lib/ai-chat-completion.js";

function sseLine(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function dispatchDevtoolsRoutes(request, url, h) {
  if (url.pathname !== "/api/devtools/chat" || request.method !== "POST") {
    return null;
  }

  const { env, corsHeaders, verifyJwtAndGetContext } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "verifyJwtAndGetContext",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    return null;
  });
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) {
    return new Response(JSON.stringify({ error: "message required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const useStream = body.stream !== false;
  const modelOverride = body.model ? String(body.model) : null;
  const providerOverride = body.provider ? String(body.provider) : null;

  const messages = [
    {
      role: "system",
      content: "You are a helpful assistant inside the FluxyChat DevTools playground. Be concise and technical when appropriate.",
    },
    { role: "user", content: message },
  ];

  const connection = await resolveLlmConnection(env, {
    provider: providerOverride || "custom",
    model: modelOverride || env.AI_MODEL || null,
    config: null,
    projectId: auth.projectId,
  });

  if (!connection.ok) {
    if (isAiConfigured(env)) {
      if (!useStream) {
        const result = await chatCompletion(env, {
          messages,
          model: modelOverride || undefined,
          logContext: { projectId: auth.projectId, feature: "devtools_chat" },
        });
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status || 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ content: result.content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transport = resolveAiTransport(env);
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const push = (chunk) => controller.enqueue(encoder.encode(sseLine(chunk)));
          try {
            const { content, usage } = await callLlmOpenAIStream(
              transport.openAiCompatBase,
              env.AI_API_KEY || "",
              modelOverride || env.AI_MODEL || "openai/gpt-4o-mini",
              messages,
              { chatCompletionsUrl: transport.chatCompletionsUrl },
              async (delta) => {
                await push({ type: "text", text: delta });
              },
            );
            if (usage?.prompt_tokens || usage?.completion_tokens) {
              await push({
                type: "usage",
                usage: {
                  promptTokens: usage.prompt_tokens || 0,
                  completionTokens: usage.completion_tokens || 0,
                  totalTokens: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
                },
              });
            }
            if (!content) await push({ type: "text", text: "" });
          } catch (err) {
            await push({
              type: "error",
              error: err instanceof Error ? err.message : "stream_failed",
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: connection.error || "llm_not_configured",
        hint: "Set AI_BASE_URL + AI_API_KEY in worker .dev.vars, or configure project LLM credentials.",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!useStream || !connection.supportsStreaming) {
    const { callLlmOpenAI } = await import("../lib/agent-llm.js");
    try {
      const json = await callLlmOpenAI(
        connection.baseUrl,
        connection.apiKey,
        connection.model,
        messages,
        null,
        {
          chatCompletionsUrl: connection.chatCompletionsUrl,
          gatewayHeaders: connection.gatewayHeaders,
        },
      );
      const content = String(json.choices?.[0]?.message?.content ?? "").trim();
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "llm_failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (chunk) => controller.enqueue(encoder.encode(sseLine(chunk)));
      try {
        const { usage } = await callLlmOpenAIStream(
          connection.baseUrl,
          connection.apiKey,
          connection.model,
          messages,
          {
            chatCompletionsUrl: connection.chatCompletionsUrl,
            gatewayHeaders: connection.gatewayHeaders,
          },
          async (delta) => {
            await push({ type: "text", text: delta });
          },
        );
        if (usage?.prompt_tokens || usage?.completion_tokens) {
          await push({
            type: "usage",
            usage: {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
            },
          });
        }
      } catch (err) {
        await push({
          type: "error",
          error: err instanceof Error ? err.message : "stream_failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

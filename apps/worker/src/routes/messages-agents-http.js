import { dispatchMessagesRoutes } from "./messages-http.js";
import { dispatchLlmRoutes } from "./llm-http.js";
import { dispatchAgentsRoutes } from "./agents-http.js";

/**
 * Messages, LLM credentials, and agents (composite dispatch).
 * @returns {Promise<Response|null>}
 */
export async function dispatchMessagesAgentsRoutes(request, url, h) {
  const resMessages = await dispatchMessagesRoutes(request, url, h);
  if (resMessages) return resMessages;
  const resLlm = await dispatchLlmRoutes(request, url, h);
  if (resLlm) return resLlm;
  return dispatchAgentsRoutes(request, url, h);
}

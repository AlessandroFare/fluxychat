import { dispatchEventsRoutes } from "./events-http.js";
import { dispatchUsersEventsRoutes } from "./users-events-http.js";
import { dispatchWatchlistRoutes } from "./watchlist-http.js";
import { dispatchMessagesRoutes } from "./messages-http.js";
import { dispatchLlmRoutes } from "./llm-http.js";
import { dispatchAgentsRoutes } from "./agents-http.js";
import { dispatchMessageTemplatesRoutes } from "./message-templates-http.js";
import { dispatchTemplatesRoutes } from "./templates-http.js";
import { dispatchActivitiesRoutes } from "./activities-http.js";
import { dispatchVoiceMessagesRoutes } from "./voice-messages-http.js";
import { dispatchSuggestRepliesRoutes } from "./suggest-replies-http.js";
import { dispatchThreadSummaryRoutes } from "./thread-summary-http.js";
import { dispatchUsersRoutes } from "./users-http.js";

/**
 * Messages, LLM credentials, and agents (composite dispatch).
 * @returns {Promise<Response|null>}
 */
export async function dispatchMessagesAgentsRoutes(request, url, h) {
  const resEvents = await dispatchEventsRoutes(request, url, h);
  if (resEvents) return resEvents;
  const resUsersEvents = await dispatchUsersEventsRoutes(request, url, h);
  if (resUsersEvents) return resUsersEvents;
  const resWatchlist = await dispatchWatchlistRoutes(request, url, h);
  if (resWatchlist) return resWatchlist;
  const resActivities = await dispatchActivitiesRoutes(request, url, h);
  if (resActivities) return resActivities;
  const resMessageTemplates = await dispatchMessageTemplatesRoutes(request, url, h);
  if (resMessageTemplates) return resMessageTemplates;
  const resTemplates = await dispatchTemplatesRoutes(request, url, h);
  if (resTemplates) return resTemplates;
  const resSuggest = await dispatchSuggestRepliesRoutes(request, url, h);
  if (resSuggest) return resSuggest;
  const resThreadSummary = await dispatchThreadSummaryRoutes(request, url, h);
  if (resThreadSummary) return resThreadSummary;
  const resUsers = await dispatchUsersRoutes(request, url, h);
  if (resUsers) return resUsers;
  const resVoice = await dispatchVoiceMessagesRoutes(request, url, h);
  if (resVoice) return resVoice;
  const resMessages = await dispatchMessagesRoutes(request, url, h);
  if (resMessages) return resMessages;
  const resLlm = await dispatchLlmRoutes(request, url, h);
  if (resLlm) return resLlm;
  return dispatchAgentsRoutes(request, url, h);
}

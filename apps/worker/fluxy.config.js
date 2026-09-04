/**
 * Default FluxyChat worker config — edit this file to customize rooms, authz, and middleware.
 * Portal-style authoring via @fluxy-chat/config.
 */
import {
  defineConfig,
  allow,
  block,
  defineMiddleware,
  allowPublish,
  blockPublish,
  maskContent,
} from "@fluxy-chat/config";

const moderatePublish = defineMiddleware("publish", (ctx) => {
  if (ctx.capabilities.publish === false) {
    return blockPublish("You do not have permission to post in this room.");
  }
  const text = ctx.message.rawContent;
  if (text.toLowerCase().includes("badword")) {
    return maskContent(text.replace(/badword/gi, "****"));
  }
  return allowPublish();
});

/** @type {import("@fluxy-chat/config").FluxyConfig} */
const config = defineConfig({
  client: {
    readOn: "visible",
    wsCache: "on",
    historyLimit: 50,
  },
  rooms: {
    "support-*": {
      anonymous: false,
      authz: (ctx) =>
        ctx.anonymous ? block("Sign in to contact support.") : allow({ publish: true, invokeAgent: true }),
      onPublish: [moderatePublish.handler],
    },
    "room-*": {
      anonymous: true,
      extensions: [{ id: "state", kind: "kv" }],
      authz: () => allow({ publish: true, sendDirect: true, react: true, invokeAgent: true }),
      onPublish: [moderatePublish.handler],
    },
  },
});

export default config;

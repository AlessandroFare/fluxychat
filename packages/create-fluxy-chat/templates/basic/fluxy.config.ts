/**
 * Example fluxy.config.ts — copy to your worker project root.
 * See packages/config/README.md
 */
import {
  defineConfig,
  allow,
  block,
  defineMiddleware,
  allowPublish,
} from "@fluxy-chat/config";

const moderate = defineMiddleware("publish", (ctx) => {
  if (ctx.capabilities.publish === false) {
    return { action: "block", reason: "You cannot post here." };
  }
  return allowPublish();
});

export default defineConfig({
  client: { readOn: "visible", wsCache: "on", historyLimit: 50 },
  rooms: {
    "room-*": {
      anonymous: true,
      authz: () => allow({ publish: true }),
      onPublish: [moderate.handler],
    },
  },
});

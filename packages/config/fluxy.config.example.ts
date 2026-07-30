import {
  defineConfig,
  allow,
  block,
  defineMiddleware,
  allowPublish,
  blockPublish,
} from "@fluxy-chat/config";

const moderate = defineMiddleware("publish", (ctx) => {
  if (ctx.capabilities.publish === false) {
    return blockPublish("You do not have permission to post.");
  }
  return allowPublish();
});

export default defineConfig({
  workerUrl: process.env.FLUXY_WORKER_URL,
  client: {
    readOn: "visible",
    wsCache: "on",
    historyLimit: 50,
  },
  rooms: {
    "support-*": {
      anonymous: false,
      authz: (ctx) =>
        ctx.anonymous ? block("Sign in to contact support.") : allow({ publish: true }),
      onPublish: [moderate.handler],
    },
    "room-*": {
      anonymous: true,
      authz: () => allow({ publish: true, invokeAgent: true }),
      onPublish: [moderate.handler],
    },
  },
});

import type {
  FluxyAuthzContext,
  FluxyAuthzResult,
  FluxyConfig,
  FluxyDisconnectContext,
  FluxyPublishContext,
  FluxyRoomCapabilities,
} from "./types.js";
import { resolveRoomConfig } from "./resolve-room.js";

const DEFAULT_CAPABILITIES: FluxyRoomCapabilities = {
  publish: true,
  sendDirect: true,
  react: true,
  invokeAgent: true,
};

export async function runRoomAuthz(
  config: FluxyConfig | null | undefined,
  ctx: FluxyAuthzContext,
): Promise<FluxyAuthzResult> {
  const room = resolveRoomConfig(config, ctx.roomId);
  if (room.anonymous === false && ctx.anonymous) {
    return { action: "block", reason: "Sign in to join this room." };
  }
  if (!room.authz) {
    return { action: "allow", capabilities: { ...DEFAULT_CAPABILITIES } };
  }
  try {
    const result = await room.authz(ctx);
    if (result.action === "block") return result;
    return {
      action: "allow",
      capabilities: { ...DEFAULT_CAPABILITIES, ...result.capabilities },
    };
  } catch {
    return { action: "block", reason: "Authorization failed." };
  }
}

export interface FluxyPublishPipelineResult {
  ok: true;
  content: string;
  blocked?: false;
}
export interface FluxyPublishPipelineBlocked {
  ok: false;
  reason: string;
}

export async function runPublishMiddleware<T = unknown>(
  config: FluxyConfig | null | undefined,
  roomId: string,
  ctx: Omit<FluxyPublishContext<T>, "capabilities"> & {
    capabilities?: FluxyRoomCapabilities;
  },
): Promise<FluxyPublishPipelineResult | FluxyPublishPipelineBlocked> {
  const room = resolveRoomConfig(config, roomId);
  const chain = room.onPublish ?? [];
  let content = ctx.message.rawContent;
  let typedContent: T = ctx.message.content;

  for (const step of chain) {
    const result = await step({
      roomId,
      userId: ctx.userId,
      capabilities: ctx.capabilities ?? DEFAULT_CAPABILITIES,
      message: {
        content: typedContent,
        rawContent: content,
        replyTo: ctx.message.replyTo,
        attachments: ctx.message.attachments,
      },
    });
    if (result.action === "block") {
      return { ok: false, reason: result.reason };
    }
    if (result.action === "mask") {
      typedContent = result.content as T;
      content =
        typeof result.content === "string"
          ? result.content
          : JSON.stringify(result.content);
    }
  }

  return { ok: true, content };
}

export async function runDisconnectMiddleware(
  config: FluxyConfig | null | undefined,
  ctx: FluxyDisconnectContext,
): Promise<void> {
  const room = resolveRoomConfig(config, ctx.roomId);
  for (const step of room.onDisconnect ?? []) {
    try {
      await step(ctx);
    } catch {
      /* observer-only */
    }
  }
}

export function getClientDefaults(config: FluxyConfig | null | undefined) {
  return config?.client ?? {};
}

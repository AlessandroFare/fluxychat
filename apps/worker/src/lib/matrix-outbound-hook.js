import { getMatrixMappingByFluxyRoom, syncMatrixOutbound } from "./matrix-bridge.js";
import { logInfo } from "./worker-log.js";

/**
 * Mirror a FluxyChat room message to mapped Matrix rooms (best-effort, non-blocking).
 */
export async function maybeSyncMatrixOutboundForMessage(
  env,
  { projectId, roomId, messageId, content },
) {
  if (!projectId || !roomId || messageId == null || !content?.trim()) return;

  const mappings = await getMatrixMappingByFluxyRoom(env, { roomId });
  if (!mappings?.length) return;

  for (const mapping of mappings) {
    const bridgeId = mapping.bridgeId || mapping.bridge_id;
    const matrixRoomId = mapping.matrixRoomId || mapping.matrix_room_id;
    if (!bridgeId || !matrixRoomId) continue;

    const result = await syncMatrixOutbound(env, {
      bridgeId,
      projectId,
      fluxychatMessageId: String(messageId),
      matrixRoomId,
      content: content.trim(),
      msgtype: "m.text",
    });

    if (result.error && result.error !== "already_synced") {
      logInfo("matrix.outbound_skipped", {
        projectId,
        roomId,
        bridgeId,
        error: result.error,
      });
    }
  }
}

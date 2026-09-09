export const CLOUDFLARE_STUN = { urls: "stun:stun.cloudflare.com:3478" } as const;

export interface LocalTrackObject {
  location: "local";
  mid: string;
  trackName: string;
}

export interface RemoteTrackObject {
  location: "remote";
  sessionId: string;
  trackName: string;
}

export interface NamedTransceiver {
  mid: string | null;
  sender: { track: { id: string; kind?: string } | null };
}

export function buildLocalTrackObjects(transceivers: NamedTransceiver[]): LocalTrackObject[] {
  return transceivers.flatMap((transceiver) => {
    const track = transceiver.sender.track;
    const mid = transceiver.mid;
    if (!track || mid == null || mid === "") return [];
    return [{ location: "local" as const, mid, trackName: track.id }];
  });
}

export function toRemotePullTracks(
  sessionId: string,
  trackObjects: Array<{ trackName: string }>,
): RemoteTrackObject[] {
  return trackObjects.map((track) => ({
    location: "remote",
    sessionId,
    trackName: track.trackName,
  }));
}

export function sfuTracksNeedAnswer(result: {
  requiresImmediateRenegotiation?: boolean;
  sessionDescription?: { type?: string };
}): boolean {
  return Boolean(
    result?.requiresImmediateRenegotiation && result.sessionDescription?.type === "offer",
  );
}

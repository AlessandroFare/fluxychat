export type VoiceStageRole = "speaker" | "listener";

export interface VoiceStageParticipant {
  userId: string;
  role: VoiceStageRole;
  displayName: string | null;
  vadScore: number;
  isActiveSpeaker: boolean;
  joinedAt: string;
}

export interface VoiceStageSnapshot {
  enabled: boolean;
  activeSpeakerUserId: string | null;
  participants: VoiceStageParticipant[];
  speakerCount: number;
  listenerCount: number;
}

export function findStageParticipant(
  stage: VoiceStageSnapshot | null | undefined,
  userId: string,
): VoiceStageParticipant | null {
  if (!stage) return null;
  return stage.participants.find((p) => p.userId === userId) ?? null;
}

export function isUserActiveSpeaker(
  stage: VoiceStageSnapshot | null | undefined,
  userId: string,
): boolean {
  if (!stage?.activeSpeakerUserId) return false;
  return stage.activeSpeakerUserId === userId;
}

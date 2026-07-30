export interface SpeakerSegment {
  speakerId: string;
  startMs: number;
  endMs: number;
  confidence: number;
  text: string;
}

export interface DiarizationConfig {
  maxSpeakers: number;
  minSegmentDurationMs: number;
  overlapThreshold: number;
  stableSpeakerThreshold: number;
}

export interface DiarizationSession {
  sessionId: string;
  speakers: Map<string, SpeakerInfo>;
  segments: SpeakerSegment[];
  overlaps: OverlapRegion[];
  config: DiarizationConfig;
}

export interface SpeakerInfo {
  speakerId: string;
  label: string;
  color: string;
  segments: SpeakerSegment[];
  firstSeenMs: number;
}

export interface OverlapRegion {
  startMs: number;
  endMs: number;
  speakers: string[];
}

export interface DiarizationResult {
  sessionId: string;
  speakers: SpeakerInfo[];
  segments: SpeakerSegment[];
  overlaps: OverlapRegion[];
}

export interface Diarizer {
  createSession(sessionId: string): void;
  addSegment(sessionId: string, segment: Omit<SpeakerSegment, "speakerId"> & { speakerId?: string }): SpeakerSegment;
  assignSpeaker(sessionId: string, segmentIndex: number, speakerId: string): void;
  mergeSegments(sessionId: string, fromIndex: number, toIndex: number): void;
  getSession(sessionId: string): DiarizationSession | null;
  getResult(sessionId: string): DiarizationResult | null;
  closeSession(sessionId: string): void;
  getSpeakerCount(sessionId: string): number;
}

const SPEAKER_COLORS = [
  "#4A90D9", "#E57373", "#81C784", "#FFB74D",
  "#BA68C8", "#4DB6AC", "#F06292", "#AED581",
];

const DEFAULT_DIARIZATION_CONFIG: DiarizationConfig = {
  maxSpeakers: 8,
  minSegmentDurationMs: 50,
  overlapThreshold: 0.3,
  stableSpeakerThreshold: 0.7,
};

export function createDiarizer(config: Partial<DiarizationConfig> = {}): Diarizer {
  const cfg: DiarizationConfig = { ...DEFAULT_DIARIZATION_CONFIG, ...config };
  const sessions = new Map<string, DiarizationSession>();
  let speakerCounter = 0;

  function allocateSpeakerId(): string {
    const id = `SPEAKER_${String(speakerCounter).padStart(2, "0")}`;
    speakerCounter++;
    return id;
  }

  function detectOverlaps(segments: SpeakerSegment[]): OverlapRegion[] {
    const overlaps: OverlapRegion[] = [];
    const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].startMs < sorted[i].endMs; j++) {
        const overlapStart = Math.max(sorted[i].startMs, sorted[j].startMs);
        const overlapEnd = Math.min(sorted[i].endMs, sorted[j].endMs);
        const overlapDuration = overlapEnd - overlapStart;
        if (overlapDuration > 0 && sorted[i].speakerId !== sorted[j].speakerId) {
          overlaps.push({
            startMs: overlapStart,
            endMs: overlapEnd,
            speakers: [...new Set([sorted[i].speakerId, sorted[j].speakerId])],
          });
        }
      }
    }
    return overlaps;
  }

  return {
    createSession(sessionId: string): void {
      if (sessions.has(sessionId)) return;
      sessions.set(sessionId, {
        sessionId,
        speakers: new Map(),
        segments: [],
        overlaps: [],
        config: { ...cfg },
      });
    },

    addSegment(sessionId: string, segment: Omit<SpeakerSegment, "speakerId"> & { speakerId?: string }): SpeakerSegment {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found. Call createSession first.`);

      const sid = segment.speakerId ?? allocateSpeakerId();
      const seg: SpeakerSegment = {
        speakerId: sid,
        startMs: segment.startMs,
        endMs: segment.endMs,
        confidence: segment.confidence,
        text: segment.text,
      };

      if (!session.speakers.has(sid)) {
        session.speakers.set(sid, {
          speakerId: sid,
          label: `Speaker ${session.speakers.size + 1}`,
          color: SPEAKER_COLORS[session.speakers.size % SPEAKER_COLORS.length],
          segments: [],
          firstSeenMs: seg.startMs,
        });
      }

      session.speakers.get(sid)!.segments.push(seg);
      session.segments.push(seg);
      session.overlaps = detectOverlaps(session.segments);
      return seg;
    },

    assignSpeaker(sessionId: string, segmentIndex: number, speakerId: string): void {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found.`);
      const seg = session.segments[segmentIndex];
      if (!seg) throw new Error(`Segment index ${segmentIndex} out of range.`);

      const oldId = seg.speakerId;
      seg.speakerId = speakerId;

      if (!session.speakers.has(speakerId)) {
        session.speakers.set(speakerId, {
          speakerId,
          label: `Speaker ${session.speakers.size + 1}`,
          color: SPEAKER_COLORS[session.speakers.size % SPEAKER_COLORS.length],
          segments: [],
          firstSeenMs: seg.startMs,
        });
      }

      const oldSpeaker = session.speakers.get(oldId);
      if (oldSpeaker) {
        const idx = oldSpeaker.segments.findIndex((s) => s.startMs === seg.startMs && s.endMs === seg.endMs);
        if (idx !== -1) oldSpeaker.segments.splice(idx, 1);
        if (oldSpeaker.segments.length === 0) session.speakers.delete(oldId);
      }

      session.speakers.get(speakerId)!.segments.push(seg);
      session.overlaps = detectOverlaps(session.segments);
    },

    mergeSegments(sessionId: string, fromIndex: number, toIndex: number): void {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found.`);

      const from = session.segments[fromIndex];
      const to = session.segments[toIndex];
      if (!from || !to) throw new Error("Segment index out of range.");

      to.endMs = Math.max(to.endMs, from.endMs);
      to.text = `${to.text} ${from.text}`;
      session.segments.splice(fromIndex, 1);
      session.overlaps = detectOverlaps(session.segments);
    },

    getSession(sessionId: string): DiarizationSession | null {
      return sessions.get(sessionId) ?? null;
    },

    getResult(sessionId: string): DiarizationResult | null {
      const session = sessions.get(sessionId);
      if (!session) return null;
      return {
        sessionId,
        speakers: [...session.speakers.values()],
        segments: [...session.segments],
        overlaps: [...session.overlaps],
      };
    },

    closeSession(sessionId: string): void {
      sessions.delete(sessionId);
    },

    getSpeakerCount(sessionId: string): number {
      return sessions.get(sessionId)?.speakers.size ?? 0;
    },
  };
}

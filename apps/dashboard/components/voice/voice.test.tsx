import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import { VoiceRecorder } from "~/components/voice/voice-recorder";
import { VoiceMessageBubble } from "~/components/voice/voice-message-bubble";
import type { FluxyChatMessage } from "@fluxy-chat/sdk";

beforeEach(() => {
  // jsdom does not implement MediaRecorder or getUserMedia
  // so VoiceRecorder falls back to the "unsupported" path.
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VoiceMessageBubble (P12-B UI)", () => {
  it("renders the audio player when audioUrl is set", () => {
    const msg: FluxyChatMessage = {
      id: 1,
      roomId: "lobby",
      userId: "alice",
      content: "",
      createdAt: "2026-06-05T10:00:00.000Z",
      kind: "voice",
      audioUrl: "/attachments/voice/p/l/1.webm",
      audioMimeType: "audio/webm",
      audioSizeBytes: 1024,
      durationMs: 4200,
      transcription: null,
      transcriptionStatus: "pending",
    };
    render(<VoiceMessageBubble message={msg} />);
    const player = screen.getByTestId("voice-message-player");
    expect(player).toBeTruthy();
    expect((player as HTMLAudioElement).getAttribute("src")).toBe(
      "/attachments/voice/p/l/1.webm",
    );
  });

  it("renders the pending state while transcription is in flight", () => {
    const msg: FluxyChatMessage = {
      id: 2,
      roomId: "lobby",
      userId: "alice",
      content: "",
      createdAt: "2026-06-05T10:00:00.000Z",
      kind: "voice",
      audioUrl: "/a.webm",
      audioMimeType: "audio/webm",
      audioSizeBytes: 1,
      durationMs: 1000,
      transcription: null,
      transcriptionStatus: "pending",
    };
    const { container } = render(<VoiceMessageBubble message={msg} />);
    expect(
      container.querySelector('[data-testid="voice-transcription-pending"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-voice-status="pending"]'),
    ).toBeTruthy();
  });

  it("renders the transcription text when done", () => {
    const msg: FluxyChatMessage = {
      id: 3,
      roomId: "lobby",
      userId: "alice",
      content: "",
      createdAt: "2026-06-05T10:00:00.000Z",
      kind: "voice",
      audioUrl: "/a.webm",
      audioMimeType: "audio/webm",
      audioSizeBytes: 1,
      durationMs: 1000,
      transcription: "hello there",
      transcriptionStatus: "done",
    };
    render(<VoiceMessageBubble message={msg} />);
    expect(screen.getByTestId("voice-transcription-done").textContent).toBe(
      "hello there",
    );
  });

  it("renders the failed state when transcription failed", () => {
    const msg: FluxyChatMessage = {
      id: 4,
      roomId: "lobby",
      userId: "alice",
      content: "",
      createdAt: "2026-06-05T10:00:00.000Z",
      kind: "voice",
      audioUrl: "/a.webm",
      audioMimeType: "audio/webm",
      audioSizeBytes: 1,
      durationMs: 1000,
      transcription: null,
      transcriptionStatus: "failed",
    };
    const { container } = render(<VoiceMessageBubble message={msg} />);
    expect(
      container.querySelector('[data-testid="voice-transcription-failed"]'),
    ).toBeTruthy();
  });

  it("returns null when the message is not a voice kind", () => {
    const msg: FluxyChatMessage = {
      id: 5,
      roomId: "lobby",
      userId: "alice",
      content: "plain",
      createdAt: "2026-06-05T10:00:00.000Z",
    };
    const { container } = render(<VoiceMessageBubble message={msg} />);
    expect(container.firstChild).toBeNull();
  });

  it("formats the duration in m:ss", () => {
    const msg: FluxyChatMessage = {
      id: 6,
      roomId: "lobby",
      userId: "alice",
      content: "",
      createdAt: "2026-06-05T10:00:00.000Z",
      kind: "voice",
      audioUrl: "/a.webm",
      audioMimeType: "audio/webm",
      audioSizeBytes: 1,
      durationMs: 65_000,
      transcription: null,
      transcriptionStatus: "pending",
    };
    render(<VoiceMessageBubble message={msg} />);
    expect(screen.getByText("1:05")).toBeTruthy();
  });
});

describe("VoiceRecorder (P12-B UI) — unsupported env", () => {
  it("falls back to the 'unsupported' notice when MediaRecorder is missing", () => {
    // jsdom does not implement MediaRecorder
    render(<VoiceRecorder onSend={vi.fn()} />);
    expect(screen.getByTestId("voice-recorder-unsupported")).toBeTruthy();
  });
});

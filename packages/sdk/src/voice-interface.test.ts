import { describe, it, expect } from "vitest";
import { createVoiceInterfaceManager } from "./voice-interface";

describe("createVoiceInterfaceManager", () => {
  it("returns default state", () => {
    const vi = createVoiceInterfaceManager();
    const state = vi.getState();
    expect(state.mode).toBe("push_to_talk");
    expect(state.isListening).toBe(false);
  });

  it("setMode changes voice mode", () => {
    const vi = createVoiceInterfaceManager();
    vi.setMode("always_listening");
    expect(vi.getState().mode).toBe("always_listening");
  });

  it("startListening and stopListening toggle state", () => {
    const vi = createVoiceInterfaceManager();
    vi.setMode("voice_activity_detection");
    vi.startListening();
    expect(vi.getState().isListening).toBe(true);
    vi.stopListening();
    expect(vi.getState().isListening).toBe(false);
  });

  it("setMuted toggles mute", () => {
    const vi = createVoiceInterfaceManager();
    vi.setMuted(true);
    expect(vi.getState().isMuted).toBe(true);
    vi.setMuted(false);
    expect(vi.getState().isMuted).toBe(false);
  });

  it("submitTranscript creates command", () => {
    const vi = createVoiceInterfaceManager();
    const cmd = vi.submitTranscript("hello world");
    expect(cmd.text).toBe("hello world");
    expect(cmd.processed).toBe(false);
    expect(vi.getCommands()).toHaveLength(1);
  });

  it("getFeedbackVisual returns waveform when listening", () => {
    const vi = createVoiceInterfaceManager();
    vi.setMode("always_listening");
    vi.startListening();
    const visual = vi.getFeedbackVisual();
    expect(visual.type).toBe("waveform");
    expect(visual.data.levels).toBeDefined();
  });

  it("getFeedbackVisual returns indicator when not listening", () => {
    const vi = createVoiceInterfaceManager();
    const visual = vi.getFeedbackVisual();
    expect(visual.type).toBe("listening_indicator");
    expect(visual.data.active).toBe(false);
  });

  it("reset clears state and commands", () => {
    const vi = createVoiceInterfaceManager();
    vi.submitTranscript("test");
    vi.setMode("always_listening");
    vi.reset();
    expect(vi.getState().mode).toBe("push_to_talk");
    expect(vi.getCommands()).toHaveLength(0);
  });
});

export type VoiceMode = "push_to_talk" | "always_listening" | "voice_activity_detection";

export interface VoiceSessionState {
  mode: VoiceMode;
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  audioLevel: number;
  transcript: string;
  interimTranscript: string;
}

export interface VoiceCommand {
  id: string;
  text: string;
  confidence: number;
  timestamp: number;
  processed: boolean;
}

export interface VoiceFeedbackVisual {
  type: "waveform" | "level_meter" | "transcript" | "listening_indicator";
  data: Record<string, unknown>;
}

export interface VoiceInterfaceManager {
  getState(): VoiceSessionState;
  setMode(mode: VoiceMode): void;
  startListening(): void;
  stopListening(): void;
  setMuted(muted: boolean): void;
  submitTranscript(text: string): VoiceCommand;
  getCommands(): VoiceCommand[];
  getFeedbackVisual(): VoiceFeedbackVisual;
  reset(): void;
}

const DEFAULT_STATE: VoiceSessionState = {
  mode: "push_to_talk",
  isListening: false,
  isSpeaking: false,
  isMuted: false,
  audioLevel: 0,
  transcript: "",
  interimTranscript: "",
};

export function createVoiceInterfaceManager(): VoiceInterfaceManager {
  let state: VoiceSessionState = { ...DEFAULT_STATE };
  const commands: VoiceCommand[] = [];
  let cmdCounter = 0;

  return {
    getState() {
      return { ...state };
    },

    setMode(mode) {
      state = { ...state, mode };
    },

    startListening() {
      state = { ...state, isListening: true, interimTranscript: "" };
    },

    stopListening() {
      state = { ...state, isListening: false };
      if (state.interimTranscript) {
        state = { ...state, transcript: state.interimTranscript };
      }
    },

    setMuted(muted) {
      state = { ...state, isMuted: muted };
    },

    submitTranscript(text) {
      state = { ...state, transcript: text, isListening: false };
      const cmd: VoiceCommand = {
        id: `cmd-${++cmdCounter}`, text, confidence: 0.95,
        timestamp: Date.now(), processed: false,
      };
      commands.push(cmd);
      return { ...cmd };
    },

    getCommands() {
      return commands.map((c) => ({ ...c }));
    },

    getFeedbackVisual() {
      if (state.isListening) {
        return {
          type: "waveform",
          data: { levels: [0.2, 0.5, 0.3, 0.8, 0.4], sampleRate: 16000 },
        };
      }
      return { type: "listening_indicator", data: { active: false } };
    },

    reset() {
      state = { ...DEFAULT_STATE };
      commands.length = 0;
    },
  };
}

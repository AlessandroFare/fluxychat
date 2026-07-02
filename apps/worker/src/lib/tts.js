/**
 * P24-9: Text-to-Speech — Worker Implementation
 */

/**
 * Create a text-to-speech instance.
 * @param {Object} config
 */
export function createTextToSpeech(config = {}) {
  const { provider = "openai", apiKey, model = "tts-1", defaultVoice = "alloy", defaultSpeed = 1.0 } = config;

  return {
    async synthesize(request) {
      const { text, voice = defaultVoice, speed = defaultSpeed, format = "mp3" } = request;

      if (provider === "openai" && apiKey) {
        const resp = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, input: text, voice, speed, response_format: format }),
        });

        const audio = await resp.arrayBuffer();
        return {
          audio,
          contentType: `audio/${format}`,
          durationMs: Math.round((audio.byteLength / 16000) * 1000), // Rough estimate
        };
      }

      return { audio: new ArrayBuffer(0), contentType: `audio/${format}` };
    },

    async listVoices() {
      return [
        { id: "alloy", name: "Alloy" },
        { id: "echo", name: "Echo" },
        { id: "fable", name: "Fable" },
        { id: "onyx", name: "Onyx" },
        { id: "nova", name: "Nova" },
        { id: "shimmer", name: "Shimmer" },
      ];
    },
  };
}

/**
 * Tool definition for TTS.
 */
export const TTS_TOOL = {
  name: "text_to_speech",
  description: "Convert text to speech audio.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to convert to speech" },
      voice: { type: "string", enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"], default: "alloy" },
      speed: { type: "number", description: "Speech speed (0.25-4.0)", default: 1.0 },
    },
    required: ["text"],
  },
  execute: async (input) => {
    const tts = createTextToSpeech();
    return tts.synthesize(input);
  },
};

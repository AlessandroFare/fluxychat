export type TranslationStatus = "idle" | "translating" | "completed" | "error";

export interface LanguagePreference {
  userId: string;
  sourceLanguage: string;
  targetLanguage: string;
  autoDetect: boolean;
  glossaryTerms: GlossaryEntry[];
}

export interface GlossaryEntry {
  source: string;
  target: string;
  context?: string;
}

export interface TranslatedMessage {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  timestamp: number;
}

export interface TranslationService {
  setPreference(pref: LanguagePreference): void;
  getPreference(userId: string): LanguagePreference | undefined;
  translate(text: string, sourceLang: string, targetLang: string): TranslatedMessage;
  addGlossaryTerm(userId: string, entry: GlossaryEntry): void;
  removeGlossaryTerm(userId: string, source: string): boolean;
  detectLanguage(text: string): string;
  getOriginalMessage(messageId: string): string | undefined;
}

export function createTranslationService(): TranslationService {
  const preferences = new Map<string, LanguagePreference>();
  const originalMessages = new Map<string, string>();
  let msgCounter = 0;

  return {
    setPreference(pref) {
      preferences.set(pref.userId, { ...pref, glossaryTerms: [...pref.glossaryTerms] });
    },

    getPreference(userId) {
      const p = preferences.get(userId);
      return p ? { ...p, glossaryTerms: [...p.glossaryTerms] } : undefined;
    },

    translate(text, sourceLang, targetLang) {
      const id = `orig-${++msgCounter}`;
      originalMessages.set(id, text);

      let translatedText = text;
      for (const [, pref] of preferences) {
        for (const term of pref.glossaryTerms) {
          if (text.includes(term.source)) {
            translatedText = translatedText.replace(term.source, term.target);
          }
        }
      }

      if (sourceLang !== targetLang) {
        translatedText = `[${sourceLang}→${targetLang}] ${translatedText}`;
      }

      return {
        originalText: text,
        translatedText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        confidence: 0.92,
        timestamp: Date.now(),
      };
    },

    addGlossaryTerm(userId, entry) {
      const pref = preferences.get(userId);
      if (pref) pref.glossaryTerms.push({ ...entry });
    },

    removeGlossaryTerm(userId, source) {
      const pref = preferences.get(userId);
      if (!pref) return false;
      const idx = pref.glossaryTerms.findIndex((t) => t.source === source);
      if (idx === -1) return false;
      pref.glossaryTerms.splice(idx, 1);
      return true;
    },

    detectLanguage(text) {
      const ascii = text.replace(/[^\x00-\x7f]/g, "").length;
      const nonAscii = text.length - ascii;
      if (nonAscii > text.length * 0.3) {
        if (/[\u4e00-\u9fff]/.test(text)) return "zh";
        if (/[\u0400-\u04ff]/.test(text)) return "ru";
        if (/[\u0600-\u06ff]/.test(text)) return "ar";
        return "unknown";
      }
      return "en";
    },

    getOriginalMessage(messageId) {
      return originalMessages.get(messageId);
    },
  };
}

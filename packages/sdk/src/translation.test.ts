import { describe, it, expect } from "vitest";
import { createTranslationService } from "./translation";

describe("createTranslationService", () => {
  it("translate with same language returns text", () => {
    const ts = createTranslationService();
    const result = ts.translate("hello", "en", "en");
    expect(result.translatedText).toBe("hello");
  });

  it("translate with different languages adds prefix", () => {
    const ts = createTranslationService();
    const result = ts.translate("hello", "en", "fr");
    expect(result.translatedText).toContain("[en→fr]");
  });

  it("setPreference and getPreference store user prefs", () => {
    const ts = createTranslationService();
    ts.setPreference({ userId: "user-1", sourceLanguage: "en", targetLanguage: "fr", autoDetect: true, glossaryTerms: [] });
    const pref = ts.getPreference("user-1");
    expect(pref).toBeDefined();
    expect(pref!.targetLanguage).toBe("fr");
  });

  it("addGlossaryTerm and apply in translation", () => {
    const ts = createTranslationService();
    ts.setPreference({ userId: "user-1", sourceLanguage: "en", targetLanguage: "fr", autoDetect: false, glossaryTerms: [] });
    ts.addGlossaryTerm("user-1", { source: "API", target: "API (interface)" });
    const result = ts.translate("the API is great", "en", "fr");
    expect(result.translatedText).toContain("API (interface)");
  });

  it("removeGlossaryTerm removes term", () => {
    const ts = createTranslationService();
    ts.setPreference({ userId: "user-1", sourceLanguage: "en", targetLanguage: "fr", autoDetect: false, glossaryTerms: [] });
    ts.addGlossaryTerm("user-1", { source: "API", target: "API (interface)" });
    expect(ts.removeGlossaryTerm("user-1", "API")).toBe(true);
    expect(ts.removeGlossaryTerm("user-1", "nonexistent")).toBe(false);
  });

  it("detectLanguage detects english", () => {
    const ts = createTranslationService();
    expect(ts.detectLanguage("hello world")).toBe("en");
  });

  it("detectLanguage detects chinese", () => {
    const ts = createTranslationService();
    expect(ts.detectLanguage("你好世界")).toBe("zh");
  });

  it("translate preserves original text in result", () => {
    const ts = createTranslationService();
    const result = ts.translate("hello", "en", "fr");
    expect(result.originalText).toBe("hello");
  });
});

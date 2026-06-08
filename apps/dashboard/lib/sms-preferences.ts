const E164_RE = /^\+[1-9]\d{6,14}$/;

export interface SmsNotifyPreferences {
  smsE164: string;
  smsOptIn: boolean;
}

export function smsPrefsFromMemberPreferences(
  preferences: Record<string, unknown> | undefined,
): SmsNotifyPreferences {
  if (!preferences) {
    return { smsE164: "", smsOptIn: false };
  }
  const raw =
    preferences.smsE164 ?? preferences.sms_e164 ?? preferences.phoneE164;
  const smsE164 = typeof raw === "string" ? raw.trim() : "";
  const optIn = preferences.smsOptIn ?? preferences.sms_opt_in;
  const smsOptIn = optIn === true || optIn === 1 || optIn === "true";
  return { smsE164, smsOptIn };
}

export function validateSmsE164(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!E164_RE.test(trimmed)) {
    return "Use E.164 format, e.g. +14155551234";
  }
  return null;
}

export function buildSmsPreferencesPatch(
  smsE164: string,
  smsOptIn: boolean,
): Record<string, unknown> {
  const trimmed = smsE164.trim();
  return {
    ...(trimmed ? { smsE164: trimmed } : {}),
    smsOptIn,
  };
}

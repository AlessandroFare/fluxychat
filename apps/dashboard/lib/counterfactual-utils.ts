const SIDE_EFFECT_PATTERNS = [
  /send_email/i,
  /send_mail/i,
  /payment/i,
  /charge/i,
  /checkout/i,
  /purchase/i,
  /transfer/i,
  /delete_/i,
  /create_invoice/i,
  /refund/i,
];

export function isSideEffectToolName(toolName: string): boolean {
  return SIDE_EFFECT_PATTERNS.some((re) => re.test(toolName));
}

import { describe, it, expect } from "vitest";
import {
  buildWhatsAppInteractiveForField,
  buildRcsSuggestedRepliesForField,
  normalizeFormResponses,
  parseReplyToken,
  parseRcsFormReply,
  parseWhatsAppInteractiveReply,
  validateChannelFormSchema,
} from "./channel-structured-forms.js";

describe("channel-structured-forms", () => {
  it("validates form schema", () => {
    const ok = validateChannelFormSchema({
      fields: [
        { id: "rating", label: "How was support?", type: "rating" },
        { id: "issue", label: "Issue type", type: "select", options: [{ value: "billing", label: "Billing" }] },
      ],
    });
    expect(ok.ok).toBe(true);
    expect(ok.fields).toHaveLength(2);
  });

  it("builds WhatsApp yes/no interactive", () => {
    const payload = buildWhatsAppInteractiveForField(
      { id: "confirm", label: "Accept terms?", type: "yes_no" },
      "cfd_abc",
      0,
      "Please confirm",
    );
    expect(payload.type).toBe("interactive");
    expect(payload.interactive.type).toBe("button");
    expect(payload.interactive.action.buttons).toHaveLength(2);
  });

  it("builds RCS suggested replies for select", () => {
    const payload = buildRcsSuggestedRepliesForField(
      {
        id: "plan",
        label: "Pick a plan",
        type: "select",
        options: [{ value: "pro", label: "Pro" }],
      },
      "cfd_xyz",
      0,
      "Choose plan",
    );
    expect(payload.contentMessage.text).toContain("Choose plan");
    expect(payload.contentMessage.suggestions).toHaveLength(1);
  });

  it("parseReplyToken round-trips", () => {
    const token = "cfd:del123:0:pro";
    const parsed = parseReplyToken(token);
    expect(parsed?.deliveryId).toBe("del123");
    expect(parsed?.fieldIndex).toBe(0);
    expect(parsed?.value).toBe("pro");
  });

  it("parseWhatsAppInteractiveReply reads list reply", () => {
    const parsed = parseWhatsAppInteractiveReply({
      from: "15551234567",
      type: "interactive",
      interactive: {
        type: "list_reply",
        list_reply: { id: "cfd:del1:0:billing", title: "Billing" },
      },
    });
    expect(parsed?.deliveryId).toBe("del1");
    expect(parsed?.value).toBe("billing");
  });

  it("parseRcsFormReply reads postback", () => {
    const parsed = parseRcsFormReply({
      suggestionResponse: { postbackData: "cfd:del2:1:yes" },
    });
    expect(parsed?.deliveryId).toBe("del2");
    expect(parsed?.value).toBe("yes");
  });

  it("normalizeFormResponses formats summary", () => {
    const out = normalizeFormResponses(
      [{ id: "a", label: "Answer" }],
      { a: "hello" },
    );
    expect(out.summaryText).toContain("Answer: hello");
  });
});

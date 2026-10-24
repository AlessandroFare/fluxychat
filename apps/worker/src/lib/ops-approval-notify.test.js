import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./digest-email.js", () => ({ sendDigestEmail: vi.fn(async () => ({ ok: true })) }));
vi.mock("./daily-digest.js", () => ({ getDigestPreferences: vi.fn(async () => ({ emailEnabled: true, email: null })) }));
vi.mock("./in-app-notifications.js", () => ({ createInAppNotification: vi.fn(async () => 1) }));
vi.mock("./push-notifications.js", () => ({ sendWebPushToUser: vi.fn(async () => ({ sent: 1 })) }));

import { sendDigestEmail } from "./digest-email.js";
import { getDigestPreferences } from "./daily-digest.js";
import { createInAppNotification } from "./in-app-notifications.js";
import { notifyOpsApprovalOffRoom, notifyOpsTaskEscalation, resolveOpsApprovalRecipients } from "./ops-approval-notify.js";
import { sendWebPushToUser } from "./push-notifications.js";

const emailMock = vi.mocked(sendDigestEmail);
const prefsMock = vi.mocked(getDigestPreferences);
const inAppMock = vi.mocked(createInAppNotification);
const pushMock = vi.mocked(sendWebPushToUser);

function fakeEnv({ members = [], emails = {} } = {}) {
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          all: async () => ({ results: sql.includes("room_members") ? members : [] }),
          first: async () => (sql.includes("FROM users") ? { email: emails[args[0]] || null } : null),
        }),
      }),
    },
    PUBLIC_APP_URL: "https://app.test",
  };
}

const input = {
  projectId: "p1",
  roomId: "room1",
  runId: "run1",
  approvalId: "oap_1",
  stepId: "approve-write",
  tool: "notify.send",
  input: { channel: "#ops" },
  required: 1,
  dueAt: "2026-10-18T00:00:00.000Z",
  payloadHash: "hash-1",
};

describe("ops-approval-notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    prefsMock.mockResolvedValue({ emailEnabled: true, email: null });
  });

  it("prefers room admins over plain members", async () => {
    const env = fakeEnv({
      members: [
        { user_id: "u1", role: "admin" },
        { user_id: "u2", role: "member" },
      ],
      emails: { u1: "admin@x.test", u2: "member@x.test" },
    });
    const out = await notifyOpsApprovalOffRoom(env, input);

    expect(out).toMatchObject({ recipients: 1, inApp: 1, emailed: 1 });
    expect(inAppMock).toHaveBeenCalledTimes(1);
    expect(emailMock).toHaveBeenCalledTimes(1);
    expect(emailMock.mock.calls[0][1]).toMatchObject({ to: "admin@x.test" });
    // Force: approval pushes wake the device (Urgency: high), no quiet windows.
    expect(pushMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ urgency: "high" }),
    );
  });

  it("falls back to every member when the room has no admin", async () => {
    const env = fakeEnv({
      members: [{ user_id: "u2", role: "member" }],
      emails: { u2: "member@x.test" },
    });
    prefsMock.mockResolvedValue({ emailEnabled: true, email: "prefs@x.test" });
    const out = await notifyOpsApprovalOffRoom(env, input);

    expect(out.recipients).toBe(1);
    expect(emailMock.mock.calls[0][1]).toMatchObject({ to: "prefs@x.test" });
  });

  it("honors an email opt-out but still notifies in-app and by push", async () => {
    const env = fakeEnv({
      members: [{ user_id: "u1", role: "admin" }],
      emails: { u1: "admin@x.test" },
    });
    prefsMock.mockResolvedValue({ emailEnabled: false, email: "admin@x.test" });
    const out = await notifyOpsApprovalOffRoom(env, input);

    expect(emailMock).not.toHaveBeenCalled();
    expect(out).toMatchObject({ inApp: 1, pushed: 1, emailed: 0 });
  });

  it("posts one summary to the operator Slack webhook", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      ...fakeEnv({ members: [{ user_id: "u1", role: "admin" }] }),
      HITL_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/abc",
    };
    prefsMock.mockResolvedValue({ emailEnabled: false });
    const out = await notifyOpsApprovalOffRoom(env, input);

    expect(out.slack).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("hooks.slack.com");
  });

  it("does nothing when the room has no members", async () => {
    const out = await notifyOpsApprovalOffRoom(fakeEnv({}), input);

    expect(out).toMatchObject({ recipients: 0, inApp: 0, emailed: 0, slack: false });
    expect(inAppMock).not.toHaveBeenCalled();
  });

  it("pages the on-call assignee with high urgency", async () => {
    pushMock.mockClear();
    const env = fakeEnv({ emails: { u1: "oncall@x.test" } });
    const out = await notifyOpsTaskEscalation(env, {
      projectId: "p1",
      roomId: "room1",
      runId: "run1",
      userId: "u1",
      stepId: "review",
      taskId: "task1",
      dueAt: null,
    });

    expect(out).toMatchObject({ notified: true, pushed: 1, emailed: 1, taskId: "task1" });
    expect(pushMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ urgency: "high" }),
    );
  });

  it("resolves admins first, then all members, de-duplicated", async () => {
    const env = fakeEnv({
      members: [
        { user_id: "u2", role: "member" },
        { user_id: "u3", role: "moderator" },
        { user_id: "u2", role: "member" },
      ],
    });
    expect(await resolveOpsApprovalRecipients(env, { projectId: "p1", roomId: "room1" })).toEqual([
      { userId: "u2", admin: false },
      { userId: "u3", admin: false },
    ]);

    const adminEnv = fakeEnv({
      members: [
        { user_id: "u2", role: "member" },
        { user_id: "u1", role: "admin" },
      ],
    });
    expect(await resolveOpsApprovalRecipients(adminEnv, { projectId: "p1", roomId: "room1" })).toEqual([
      { userId: "u1", admin: true },
    ]);
  });

  it("gives room admins one-tap links and members a console link only", async () => {
    const adminEnv = {
      ...fakeEnv({ members: [{ user_id: "u1", role: "admin" }], emails: { u1: "admin@x.test" } }),
      ART50_MARK_SECRET: "tap-secret",
      WORKER_PUBLIC_URL: "https://api.test",
    };
    await notifyOpsApprovalOffRoom(adminEnv, input);
    const adminBody = String(emailMock.mock.calls[0][1].textBody);
    expect(adminBody).toContain("Approve: https://api.test/public/ops/approvals/tap?token=");
    expect(adminBody).toContain("Deny: https://api.test/public/ops/approvals/tap?token=");
    expect(adminBody).toContain("Open: https://app.test/ops/runs");

    emailMock.mockClear();
    const memberEnv = {
      ...fakeEnv({ members: [{ user_id: "u2", role: "member" }], emails: { u2: "member@x.test" } }),
      ART50_MARK_SECRET: "tap-secret",
    };
    await notifyOpsApprovalOffRoom(memberEnv, input);
    const memberBody = String(emailMock.mock.calls[0][1].textBody);
    expect(memberBody).not.toContain("/public/ops/approvals/tap");
    expect(memberBody).toContain("Open: https://app.test/ops/runs");
  });

  it("caps the fan-out at twenty recipients", async () => {
    const members = Array.from({ length: 25 }, (_, i) => ({ user_id: `u${i}`, role: "member" }));
    prefsMock.mockResolvedValue({ emailEnabled: false });
    const out = await notifyOpsApprovalOffRoom(fakeEnv({ members }), input);
    expect(out.recipients).toBe(20);
    expect(inAppMock).toHaveBeenCalledTimes(20);
  });

  it("never throws when the database fails", async () => {
    const env = { DB: { prepare: () => { throw new Error("d1 down"); } }, PUBLIC_APP_URL: "https://app.test" };
    const out = await notifyOpsApprovalOffRoom(env, input);
    expect(out.recipients).toBe(0);
  });
});

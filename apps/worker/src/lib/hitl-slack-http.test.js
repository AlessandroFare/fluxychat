import { describe, expect, it } from "vitest";
import { applyHitlSlackPayload, handlePublicHitlSlack } from "./hitl-slack-http.js";

const APPROVAL_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeMappedEnv() {
  const approval = {
    id: APPROVAL_ID,
    project_id: "proj_1",
    room_id: "room_1",
    tool_call_id: APPROVAL_ID,
    tool_name: "pay",
    tool_input_json: "{}",
    run_id: null,
    agent_id: null,
    requester_user_id: null,
    status: "pending",
    approval_chain_snapshot_json: "{}",
    current_step_index: 0,
    current_approver_id: "user_ana",
    started_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    created_at: new Date().toISOString(),
    decided_at: null,
    decided_by: null,
    decision_note: null,
  };
  return {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("FROM hitl_slack_user_map")) {
                  return { fluxy_user_id: "user_ana" };
                }
                if (sql.includes("FROM hitl_approval_requests")) {
                  return { ...approval };
                }
                return null;
              },
              async run() {
                if (sql.includes("UPDATE hitl_approval_requests")) {
                  approval.status = "approved";
                  approval.decided_by = "user_ana";
                }
                return { success: true };
              },
            };
          },
        };
      },
    },
  };
}

describe("handlePublicHitlSlack", () => {
  it("503s when signing secret is missing", async () => {
    const res = await handlePublicHitlSlack(
      new Request("https://api.example/public/hitl/slack", { method: "POST", body: "payload={}" }),
      { RATE_LIMIT_FALLBACK_ALLOW: "true" },
    );
    expect(res.status).toBe(503);
  });

  it("401s a bad signature", async () => {
    const res = await handlePublicHitlSlack(
      new Request("https://api.example/public/hitl/slack", {
        method: "POST",
        headers: {
          "X-Slack-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
          "X-Slack-Signature": "v0=00",
        },
        body: "payload=%7B%7D",
      }),
      { HITL_SLACK_SIGNING_SECRET: "secret", RATE_LIMIT_FALLBACK_ALLOW: "true" },
    );
    expect(res.status).toBe(401);
  });
});

describe("applyHitlSlackPayload", () => {
  it("decides with the mapped Slack user when value is an approval UUID", async () => {
    const res = await applyHitlSlackPayload(makeMappedEnv(), {
      type: "block_actions",
      user: { id: "U01234567" },
      actions: [{ action_id: "fluxy_hitl_approve", value: APPROVAL_ID }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toContain("approved");
  });
});

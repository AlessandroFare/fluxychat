import { describe, expect, it, vi } from "vitest";

function mockEnv(tickets = [], surveys = []) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              first: async () => {
                if (sql.includes("support_tickets") && sql.includes("tags LIKE")) {
                  const roomId = args[1]?.match(/"([^"]+)"/)?.[1];
                  const t = tickets.find(
                    (x) => x.project_id === args[0] && x.tags?.includes(roomId),
                  );
                  return t ? { id: t.id } : null;
                }
                if (sql.includes("support_satisfaction_surveys") && sql.includes("responded_at IS NULL")) {
                  const [projectId, ticketId] = args;
                  const s = surveys.find(
                    (x) =>
                      x.project_id === projectId &&
                      x.ticket_id === ticketId &&
                      !x.responded_at,
                  );
                  return s ? { id: s.id, survey_type: s.survey_type, created_at: s.created_at } : null;
                }
                if (sql.includes("JOIN support_tickets")) {
                  const s = surveys.find((x) => x.id === args[0]);
                  const t = tickets.find((x) => x.id === s?.ticket_id && x.project_id === args[1]);
                  return s && t
                    ? { id: s.id, ticket_id: s.ticket_id, responded_at: s.responded_at }
                    : null;
                }
                return null;
              },
              run: async () => ({ meta: { changes: 1 } }),
            };
          },
        };
      },
    },
  };
}

vi.mock("./enterprise-support.js", () => ({
  createSatisfactionSurvey: vi.fn(async (_env, { ticketId }) => ({ id: `sss_${ticketId}` })),
  respondToSurvey: vi.fn(async () => ({ responded: true })),
  createTicket: vi.fn(async () => ({ id: "st_new" })),
  updateTicket: vi.fn(async () => ({ updated: true })),
}));

describe("support-csat", () => {
  it("skips trigger when status is not terminal", async () => {
    const { maybeTriggerCsatOnTicketStatus } = await import("./support-csat.js");
    const result = await maybeTriggerCsatOnTicketStatus(mockEnv(), {
      projectId: "p1",
      ticketId: "st_1",
      previousStatus: "open",
      newStatus: "in_progress",
    });
    expect(result.skipped).toBe(true);
  });

  it("returns pending survey for room", async () => {
    const env = mockEnv(
      [{ id: "st_1", project_id: "p1", tags: ["room_a"] }],
      [{ id: "sss_1", project_id: "p1", ticket_id: "st_1", survey_type: "csat", created_at: "2026-01-01" }],
    );
    const { getPendingCsatForRoom } = await import("./support-csat.js");
    const result = await getPendingCsatForRoom(env, { projectId: "p1", roomId: "room_a" });
    expect(result.survey?.id).toBe("sss_1");
  });
});

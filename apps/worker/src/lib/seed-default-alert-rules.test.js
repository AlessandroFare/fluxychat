import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALERT_RULES,
  seedDefaultAlertRules,
} from "./seed-default-alert-rules.js";

describe("seedDefaultAlertRules (ENG-09)", () => {
  it("inserts default rules for a new project", async () => {
    const inserts = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...params) {
              return {
                async run() {
                  inserts.push({ sql, params });
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
        async batch(stmts) {
          for (const stmt of stmts) await stmt.run();
        },
      },
    };

    const result = await seedDefaultAlertRules(env, "proj_seed");
    expect(result.seeded).toBe(DEFAULT_ALERT_RULES.length);
    expect(inserts).toHaveLength(DEFAULT_ALERT_RULES.length);
    expect(inserts[0].params[1]).toBe("proj_seed");
  });
});

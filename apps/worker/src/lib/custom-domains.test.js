import { describe, expect, it } from "vitest";
import {
  buildAllowedOriginsList,
  getPublicHostConfig,
  isPlatformWorkerHostname,
  listCustomDomainsForProject,
  createCustomDomain,
  updateCustomDomain,
  validateCustomHostname,
} from "./custom-domains.js";

describe("custom-domains", () => {
  it("validateCustomHostname normalizes and rejects www", () => {
    expect(validateCustomHostname("CHAT.Acme.COM").hostname).toBe("chat.acme.com");
    expect(validateCustomHostname("www.acme.com").ok).toBe(false);
    expect(validateCustomHostname("not a host").ok).toBe(false);
  });

  it("isPlatformWorkerHostname detects workers.dev", () => {
    expect(isPlatformWorkerHostname("fluxy.workers.dev", {})).toBe(true);
    expect(
      isPlatformWorkerHostname("api.fluxychat.com", {
        WORKER_PLATFORM_HOSTS: "api.fluxychat.com",
      }),
    ).toBe(true);
    expect(isPlatformWorkerHostname("chat.acme.com", {})).toBe(false);
  });

  it("buildAllowedOriginsList merges host origins", () => {
    const list = buildAllowedOriginsList(
      { ALLOWED_ORIGINS: "https://app.fluxy.chat" },
      {
        hostname: "chat.acme.com",
        allowedOrigins: ["https://acme.com"],
      },
    );
    expect(list).toContain("https://chat.acme.com");
    expect(list).toContain("https://acme.com");
    expect(list).toContain("https://app.fluxy.chat");
  });

  it("create and activate custom domain", async () => {
    const env = createDomainEnv();
    const created = await createCustomDomain(env, {
      projectId: "proj_1",
      hostname: "chat.acme.com",
      defaultRoomId: "room_1",
      brandName: "Acme Support",
    });
    expect(created.ok).toBe(true);
    expect(created.domain.status).toBe("pending");

    const activated = await updateCustomDomain(env, {
      projectId: "proj_1",
      domainId: created.domain.id,
      status: "active",
    });
    expect(activated.domain.status).toBe("active");
    expect(activated.domain.verifiedAt).toBeTruthy();

    const config = await getPublicHostConfig(env, "chat.acme.com");
    expect(config?.projectId).toBe("proj_1");
    expect(config?.defaultRoomId).toBe("room_1");

    const list = await listCustomDomainsForProject(env, "proj_1");
    expect(list).toHaveLength(1);
  });
});

function createDomainEnv() {
  const domains = [];
  const rooms = [{ id: "room_1", project_id: "proj_1" }];

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              first: async () => {
                if (sql.includes("FROM rooms")) {
                  return rooms.find(
                    (r) => r.id === binds[1] && r.project_id === binds[0],
                  );
                }
                if (sql.includes("hostname = ? AND status = 'active'")) {
                  return (
                    domains.find(
                      (d) => d.hostname === binds[0] && d.status === "active",
                    ) || null
                  );
                }
                if (sql.includes("WHERE id = ? AND project_id")) {
                  return domains.find(
                    (d) => d.id === binds[0] && d.project_id === binds[1],
                  );
                }
                if (sql.includes("WHERE id = ?") && binds.length === 1) {
                  return domains.find((d) => d.id === binds[0]) || null;
                }
                return null;
              },
              all: async () => {
                if (sql.includes("FROM project_custom_domains")) {
                  return {
                    results: domains.filter((d) => d.project_id === binds[0]),
                  };
                }
                return { results: [] };
              },
              run: async () => {
                if (sql.includes("INSERT INTO project_custom_domains")) {
                  domains.push({
                    id: binds[0],
                    project_id: binds[1],
                    hostname: binds[2],
                    default_room_id: binds[3],
                    brand_name: binds[4],
                    brand_logo_url: binds[5],
                    allowed_origins: binds[6],
                    status: "pending",
                    verified_at: null,
                    created_at: binds[8],
                    updated_at: binds[9],
                  });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE project_custom_domains")) {
                  const domainId = binds[7];
                  const domain = domains.find((d) => d.id === domainId);
                  if (domain) {
                    domain.status = binds[0];
                    domain.verified_at = binds[5];
                    domain.updated_at = binds[6];
                  }
                  return { meta: { changes: domain ? 1 : 0 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    },
  };
}

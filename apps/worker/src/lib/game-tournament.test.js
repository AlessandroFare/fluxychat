import { describe, expect, it } from "vitest";
import {
  createGameTournament,
  reportTournamentMatch,
  startGameTournament,
} from "./game-tournament.js";

function tournamentEnv() {
  const rows = new Map();
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("FROM game_tournaments")) {
                  const [projectId, id] = params;
                  return [...rows.values()].find((r) => r.project_id === projectId && r.id === id) ?? null;
                }
                return null;
              },
              async all() {
                return { results: [...rows.values()] };
              },
              async run() {
                if (sql.includes("INSERT INTO game_tournaments")) {
                  rows.set(params[0], {
                    id: params[0],
                    project_id: params[1],
                    room_id: params[2],
                    name: params[3],
                    prize: params[4],
                    max_players: params[5],
                    status: "registration",
                    bracket_json: params[6],
                    created_by: params[7],
                    created_at: params[8],
                    updated_at: params[9],
                  });
                }
                if (sql.includes("UPDATE game_tournaments")) {
                  const row = rows.get(params[params.length - 2]);
                  if (!row) return { meta: { changes: 0 } };
                  if (sql.includes("status = 'in_progress'")) {
                    row.status = "in_progress";
                    row.bracket_json = params[0];
                    row.updated_at = params[1];
                  } else if (sql.includes("status = 'completed'")) {
                    row.status = "completed";
                    row.bracket_json = params[0];
                    row.updated_at = params[1];
                  } else {
                    row.bracket_json = params[0];
                    row.updated_at = params[1];
                  }
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
    rows,
  };
}

describe("game-tournament", () => {
  it("creates tournament in registration", async () => {
    const env = tournamentEnv();
    const auth = { projectId: "p1", userId: "host" };
    const result = await createGameTournament(env, auth, {
      name: "Summer Cup",
      maxPlayers: 8,
      prize: "Pro annual",
      players: ["p1", "p2", "p3", "p4"],
    });
    expect(result.ok).toBe(true);
    expect(result.tournament.status).toBe("registration");
    expect(result.tournament.currentPlayers).toBe(4);
  });

  it("starts bracket with first round matches", async () => {
    const env = tournamentEnv();
    const auth = { projectId: "p1", userId: "host" };
    const created = await createGameTournament(env, auth, { name: "Cup", maxPlayers: 8, prize: "x" });
    const started = await startGameTournament(env, auth, created.tournament.id, {
      players: ["p1", "p2", "p3", "p4"],
    });
    expect(started.ok).toBe(true);
    expect(started.tournament.status).toBe("active");
    expect(started.tournament.rounds[0]?.matches).toHaveLength(2);
  });

  it("reports match winner and advances bracket", async () => {
    const env = tournamentEnv();
    const auth = { projectId: "p1", userId: "host" };
    const created = await createGameTournament(env, auth, { name: "Cup", maxPlayers: 4, prize: "x" });
    const started = await startGameTournament(env, auth, created.tournament.id, {
      players: ["p1", "p2", "p3", "p4"],
    });
    const matchId = started.tournament.rounds[0]?.matches[0]?.id;
    await reportTournamentMatch(env, auth, created.tournament.id, matchId, "p1");
    const match2 = started.tournament.rounds[0]?.matches[1]?.id;
    const final = await reportTournamentMatch(env, auth, created.tournament.id, match2, "p3");
    expect(final.ok).toBe(true);
    expect(final.tournament.rounds.length).toBeGreaterThan(1);
  });
});

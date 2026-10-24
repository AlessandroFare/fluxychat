import { describe, expect, it } from "vitest";
import {
  classifyMessage,
  classifyRoom,
  createLabel,
  deleteLabel,
  getLabelById,
  getLabelsByLevel,
  getMessageClassifications,
  getRoomClassification,
  listLabels,
  updateLabel,
} from "./data-classification.js";

function makeEnv() {
  const labels = new Map();
  const rooms = new Map();
  const messages = new Map();
  const roomOwners = new Map([["r1", "p1"]]);
  const messageOwners = new Map([["m1", "p1"]]);
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("FROM data_classification_labels") && sql.includes("WHERE id = ?")) {
                  const row = labels.get(params[0]);
                  return row?.project_id === params[1] ? row : null;
                }
                if (sql.includes("FROM rooms")) {
                  return roomOwners.get(params[0]) === params[1] ? { id: params[0] } : null;
                }
                if (sql.includes("FROM messages")) {
                  return messageOwners.get(params[0]) === params[1] ? { id: params[0] } : null;
                }
                if (sql.includes("FROM room_classifications")) {
                  const row = rooms.get(params[0]);
                  return row?.project_id === params[1] ? row : null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM data_classification_labels")) {
                  let rows = [...labels.values()].filter((row) => row.project_id === params[0]);
                  if (sql.includes("level = ?")) rows = rows.filter((row) => row.level === params[1]);
                  return { results: rows };
                }
                if (sql.includes("FROM message_classifications")) {
                  return {
                    results: [...messages.values()].filter(
                      (row) => row.message_id === params[0] && row.project_id === params[1],
                    ),
                  };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO data_classification_labels")) {
                  const [id, project_id, name, level, color, description, created_at] = params;
                  labels.set(id, { id, project_id, name, level, color, description, created_at });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE data_classification_labels")) {
                  const [name, level, color, description, id, projectId] = params;
                  const row = labels.get(id);
                  if (!row || row.project_id !== projectId) return { meta: { changes: 0 } };
                  Object.assign(row, { name, level, color, description });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("DELETE FROM data_classification_labels")) {
                  const [id, projectId] = params;
                  const row = labels.get(id);
                  if (!row || row.project_id !== projectId) return { meta: { changes: 0 } };
                  labels.delete(id);
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("INSERT INTO room_classifications")) {
                  const [room_id, project_id, label_id, classified_by, classified_at] = params;
                  rooms.set(room_id, { room_id, project_id, label_id, classified_by, classified_at });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("INSERT INTO message_classifications")) {
                  const [message_id, project_id, label_id, classified_by, classified_at] = params;
                  messages.set(`${message_id}:${label_id}`, {
                    message_id,
                    project_id,
                    label_id,
                    classified_by,
                    classified_at,
                  });
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

describe("data classification", () => {
  it("creates a label with a valid level and defaults invalid levels to 0", async () => {
    const env = makeEnv();
    const label = await createLabel(env, {
      projectId: "p1",
      name: "Confidential",
      level: 2,
      color: "#ff0000",
    });
    expect(label).toMatchObject({ projectId: "p1", name: "Confidential", level: 2, color: "#ff0000" });

    const invalid = await createLabel(env, { projectId: "p1", name: "Odd", level: 9 });
    expect(invalid.level).toBe(0);

    const listed = await listLabels(env, { projectId: "p1" });
    expect(listed.map((row) => row.name).sort()).toEqual(["Confidential", "Odd"]);
  });

  it("scopes labels to the project", async () => {
    const env = makeEnv();
    const label = await createLabel(env, { projectId: "p1", name: "Secret", level: 3 });

    expect(await getLabelById(env, { projectId: "p1", labelId: label.id })).toMatchObject({ id: label.id });
    expect(await getLabelById(env, { projectId: "p2", labelId: label.id })).toBeNull();
    expect(await listLabels(env, { projectId: "p2" })).toEqual([]);
  });

  it("updates only the supplied fields and returns null for a foreign label", async () => {
    const env = makeEnv();
    const label = await createLabel(env, {
      projectId: "p1",
      name: "Internal",
      level: 1,
      color: "#00ff00",
      description: "Internal only",
    });

    const updated = await updateLabel(env, { projectId: "p1", labelId: label.id, name: "Restricted" });
    expect(updated).toMatchObject({
      name: "Restricted",
      level: 1,
      color: "#00ff00",
      description: "Internal only",
    });

    expect(await updateLabel(env, { projectId: "p2", labelId: label.id, name: "Hijack" })).toBeNull();
  });

  it("deletes a label only for its project", async () => {
    const env = makeEnv();
    const label = await createLabel(env, { projectId: "p1", name: "Temporary" });

    expect(await deleteLabel(env, { projectId: "p2", labelId: label.id })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await deleteLabel(env, { projectId: "p1", labelId: label.id })).toEqual({ ok: true });
    expect(await getLabelById(env, { projectId: "p1", labelId: label.id })).toBeNull();
  });

  it("classifies a room only with a label from the same project", async () => {
    const env = makeEnv();
    const label = await createLabel(env, { projectId: "p1", name: "Confidential", level: 2 });

    expect(
      await classifyRoom(env, { projectId: "p1", roomId: "r1", labelId: "missing", classifiedBy: "u1" }),
    ).toEqual({ ok: false, error: "label_not_found" });

    expect(
      await classifyRoom(env, { projectId: "p1", roomId: "r-missing", labelId: label.id, classifiedBy: "u1" }),
    ).toEqual({ ok: false, error: "room_not_found" });

    const foreignLabel = await createLabel(env, { projectId: "p2", name: "Foreign", level: 1 });
    expect(
      await classifyRoom(env, { projectId: "p2", roomId: "r1", labelId: foreignLabel.id, classifiedBy: "u1" }),
    ).toEqual({ ok: false, error: "room_not_found" });

    const result = await classifyRoom(env, {
      projectId: "p1",
      roomId: "r1",
      labelId: label.id,
      classifiedBy: "u1",
    });
    expect(result).toMatchObject({
      ok: true,
      roomId: "r1",
      projectId: "p1",
      labelId: label.id,
      classifiedBy: "u1",
    });

    expect(await getRoomClassification(env, { projectId: "p1", roomId: "r1" })).toMatchObject({
      roomId: "r1",
      labelId: label.id,
    });
    expect(await getRoomClassification(env, { projectId: "p2", roomId: "r1" })).toBeNull();
  });

  it("classifies messages and updates an existing override", async () => {
    const env = makeEnv();
    const label = await createLabel(env, { projectId: "p1", name: "Restricted", level: 3 });

    expect(
      await classifyMessage(env, { projectId: "p1", messageId: "m1", labelId: "missing", classifiedBy: "u1" }),
    ).toEqual({ ok: false, error: "label_not_found" });

    expect(
      await classifyMessage(env, { projectId: "p1", messageId: "m-missing", labelId: label.id, classifiedBy: "u1" }),
    ).toEqual({ ok: false, error: "message_not_found" });

    await classifyMessage(env, {
      projectId: "p1",
      messageId: "m1",
      labelId: label.id,
      classifiedBy: "u1",
    });
    const updated = await classifyMessage(env, {
      projectId: "p1",
      messageId: "m1",
      labelId: label.id,
      classifiedBy: "u2",
    });
    expect(updated).toMatchObject({
      ok: true,
      messageId: "m1",
      projectId: "p1",
      labelId: label.id,
      classifiedBy: "u2",
    });

    const rows = await getMessageClassifications(env, { projectId: "p1", messageId: "m1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ messageId: "m1", labelId: label.id, classifiedBy: "u2" });
  });

  it("filters labels by level", async () => {
    const env = makeEnv();
    await createLabel(env, { projectId: "p1", name: "Low", level: 0 });
    await createLabel(env, { projectId: "p1", name: "High", level: 3 });

    const high = await getLabelsByLevel(env, { projectId: "p1", level: 3 });
    expect(high.map((row) => row.name)).toEqual(["High"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  persistKnowledgeGraph,
  queryKnowledgeGraph,
  getEntityTimeline,
  getRoomGraph,
} from "./knowledge-graph.js";

function createGraphEnv(overrides = {}) {
  const nodes = [];
  const edges = [];
  let nextNodeId = 1;
  let nextEdgeId = 1;

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("SELECT id, valid_to FROM kg_nodes")) {
                  const [, , nodeType, label] = args;
                  return nodes.find(
                    (n) => n.project_id === args[0] && n.room_id === args[1]
                      && n.node_type === nodeType && n.label === label && !n.valid_to,
                  ) || null;
                }
                if (sql.includes("SELECT id FROM kg_edges")) {
                  return edges.find(
                    (e) => e.project_id === args[0] && e.room_id === args[1]
                      && e.source_node_id === args[2] && e.target_node_id === args[3]
                      && e.edge_type === args[4] && !e.valid_to,
                  ) || null;
                }
                if (sql.includes("SELECT * FROM kg_nodes WHERE id = ?")) {
                  return nodes.find((n) => n.id === args[0] && n.project_id === args[1]) || null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM kg_nodes")) {
                  let filtered = nodes.filter((n) => n.project_id === args[0]);
                  if (sql.includes("AND room_id = ?")) {
                    filtered = filtered.filter((n) => n.room_id === args[1]);
                  }
                  if (sql.includes("AND node_type = ?")) {
                    const typeIdx = sql.indexOf("AND node_type = ?");
                    const typeArgIdx = args.findIndex((a, i) => i > 0 && sql.substring(0, sql.indexOf("AND node_type = ?")).includes("?") ? false : true);
                    filtered = filtered.filter((n) => n.node_type === args[2]);
                  }
                  if (sql.includes("AND valid_to IS NULL")) {
                    filtered = filtered.filter((n) => !n.valid_to);
                  }
                  if (sql.includes("AND id = ?")) {
                    filtered = filtered.filter((n) => n.id === args[args.length - 2]);
                  }
                  return { results: filtered };
                }
                if (sql.includes("FROM kg_edges")) {
                  let filtered = edges.filter((e) => e.project_id === args[0]);
                  if (sql.includes("AND room_id = ?")) {
                    filtered = filtered.filter((e) => e.room_id === args[1]);
                  }
                  if (sql.includes("AND edge_type = ?")) {
                    filtered = filtered.filter((e) => e.edge_type === args[2]);
                  }
                  if (sql.includes("AND valid_to IS NULL")) {
                    filtered = filtered.filter((e) => !e.valid_to);
                  }
                  if (sql.includes("source_node_id = ? OR target_node_id = ?")) {
                    filtered = filtered.filter(
                      (e) => e.source_node_id === args[2] || e.target_node_id === args[2],
                    );
                  }
                  return { results: filtered };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO kg_nodes")) {
                  const node = {
                    id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    node_type: args[3],
                    label: args[4],
                    properties: args[5],
                    source_message_id: args[6],
                    confidence: args[7],
                    valid_from: args[8],
                    valid_to: args[9],
                    created_at: args[10],
                    updated_at: args[11],
                  };
                  nodes.push(node);
                }
                if (sql.includes("INSERT INTO kg_edges")) {
                  const edge = {
                    id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    source_node_id: args[3],
                    target_node_id: args[4],
                    edge_type: args[5],
                    properties: args[6],
                    source_message_id: args[7],
                    confidence: args[8],
                    valid_from: args[9],
                    valid_to: args[10],
                    created_at: args[11],
                  };
                  edges.push(edge);
                }
                if (sql.includes("UPDATE kg_nodes SET valid_to")) {
                  const validTo = args[0];
                  const entryId = args[2];
                  const entry = nodes.find((n) => n.id === entryId);
                  if (entry) entry.valid_to = validTo;
                }
                if (sql.includes("INSERT INTO automation_events")) {
                  // no-op for automation event logging
                }
                return { success: true, meta: { last_row_id: nextNodeId++ } };
              },
            };
          },
        };
      },
    },
    ...overrides,
  };
}

describe("persistKnowledgeGraph", () => {
  it("inserts new nodes and edges", async () => {
    const env = createGraphEnv();
    const now = new Date().toISOString();
    const result = await persistKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
      nodes: [
        {
          id: "n1", project_id: "proj_1", room_id: "room_1",
          node_type: "task", label: "Deploy API",
          properties: '{"status":"open"}', source_message_id: 1,
          confidence: 0.9, valid_from: now, valid_to: null,
          created_at: now, updated_at: now,
        },
      ],
      edges: [],
    });
    expect(result.ok).toBe(true);
    expect(result.nodesInserted).toBe(1);
    expect(result.edgesInserted).toBe(0);
  });

  it("skips duplicate edges", async () => {
    const env = createGraphEnv();
    const now = new Date().toISOString();
    const nodes = [
      {
        id: "n1", project_id: "proj_1", room_id: "room_1",
        node_type: "user", label: "alice",
        properties: null, source_message_id: 1,
        confidence: 0.9, valid_from: now, valid_to: null,
        created_at: now, updated_at: now,
      },
      {
        id: "n2", project_id: "proj_1", room_id: "room_1",
        node_type: "task", label: "Fix bug",
        properties: null, source_message_id: 1,
        confidence: 0.9, valid_from: now, valid_to: null,
        created_at: now, updated_at: now,
      },
    ];
    const edges = [
      {
        id: "e1", project_id: "proj_1", room_id: "room_1",
        source_node_id: "n1", target_node_id: "n2",
        edge_type: "assigned_to", properties: null,
        source_message_id: 1, confidence: 0.9,
        valid_from: now, valid_to: null, created_at: now,
      },
    ];

    await persistKnowledgeGraph(env, { projectId: "proj_1", roomId: "room_1", nodes, edges });
    const result2 = await persistKnowledgeGraph(env, {
      projectId: "proj_1", roomId: "room_1", nodes: [], edges,
    });
    expect(result2.edgesInserted).toBe(0);
  });

  it("returns ok with empty arrays", async () => {
    const env = createGraphEnv();
    const result = await persistKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
      nodes: [],
      edges: [],
    });
    expect(result.ok).toBe(true);
    expect(result.nodesInserted).toBe(0);
  });
});

describe("queryKnowledgeGraph", () => {
  it("returns nodes and edges for a room", async () => {
    const env = createGraphEnv();
    const now = new Date().toISOString();
    await persistKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
      nodes: [
        {
          id: "n1", project_id: "proj_1", room_id: "room_1",
          node_type: "decision", label: "Use D1",
          properties: '{"reason":"cost"}', source_message_id: 1,
          confidence: 0.95, valid_from: now, valid_to: null,
          created_at: now, updated_at: now,
        },
      ],
      edges: [],
    });

    const result = await queryKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
    });
    expect(result.ok).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].nodeType).toBe("decision");
  });

  it("filters by node type", async () => {
    const env = createGraphEnv();
    const now = new Date().toISOString();
    await persistKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
      nodes: [
        {
          id: "n1", project_id: "proj_1", room_id: "room_1",
          node_type: "task", label: "Deploy API",
          properties: null, source_message_id: 1,
          confidence: 0.9, valid_from: now, valid_to: null,
          created_at: now, updated_at: now,
        },
        {
          id: "n2", project_id: "proj_1", room_id: "room_1",
          node_type: "decision", label: "Use D1",
          properties: null, source_message_id: 1,
          confidence: 0.9, valid_from: now, valid_to: null,
          created_at: now, updated_at: now,
        },
      ],
      edges: [],
    });

    const result = await queryKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
      nodeType: "task",
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].nodeType).toBe("task");
  });

  it("filters by node ID", async () => {
    const env = createGraphEnv();
    const now = new Date().toISOString();
    await persistKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
      nodes: [
        {
          id: "n1", project_id: "proj_1", room_id: "room_1",
          node_type: "user", label: "alice",
          properties: null, source_message_id: 1,
          confidence: 0.9, valid_from: now, valid_to: null,
          created_at: now, updated_at: now,
        },
      ],
      edges: [],
    });

    const result = await queryKnowledgeGraph(env, {
      projectId: "proj_1",
      nodeId: "n1",
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("n1");
  });
});

describe("getEntityTimeline", () => {
  it("returns timeline for a node", async () => {
    const env = createGraphEnv();
    const now = new Date().toISOString();
    await persistKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
      nodes: [
        {
          id: "n1", project_id: "proj_1", room_id: "room_1",
          node_type: "task", label: "Deploy API",
          properties: '{"status":"open"}', source_message_id: 1,
          confidence: 0.9, valid_from: now, valid_to: null,
          created_at: now, updated_at: now,
        },
      ],
      edges: [],
    });

    const result = await getEntityTimeline(env, {
      projectId: "proj_1",
      nodeId: "n1",
    });
    expect(result.ok).toBe(true);
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].properties.status).toBe("open");
  });

  it("returns error for unknown node", async () => {
    const env = createGraphEnv();
    const result = await getEntityTimeline(env, {
      projectId: "proj_1",
      nodeId: "unknown",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("node_not_found");
  });
});

describe("getRoomGraph", () => {
  it("returns nodes, edges, and stats", async () => {
    const env = createGraphEnv();
    const now = new Date().toISOString();
    await persistKnowledgeGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
      nodes: [
        {
          id: "n1", project_id: "proj_1", room_id: "room_1",
          node_type: "user", label: "alice",
          properties: null, source_message_id: 1,
          confidence: 0.9, valid_from: now, valid_to: null,
          created_at: now, updated_at: now,
        },
        {
          id: "n2", project_id: "proj_1", room_id: "room_1",
          node_type: "task", label: "Deploy API",
          properties: null, source_message_id: 1,
          confidence: 0.9, valid_from: now, valid_to: null,
          created_at: now, updated_at: now,
        },
      ],
      edges: [
        {
          id: "e1", project_id: "proj_1", room_id: "room_1",
          source_node_id: "n1", target_node_id: "n2",
          edge_type: "assigned_to", properties: null,
          source_message_id: 1, confidence: 0.9,
          valid_from: now, valid_to: null, created_at: now,
        },
      ],
    });

    const result = await getRoomGraph(env, {
      projectId: "proj_1",
      roomId: "room_1",
    });
    expect(result.ok).toBe(true);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.stats.totalNodes).toBe(2);
    expect(result.stats.totalEdges).toBe(1);
    expect(result.stats.nodeTypeCounts.user).toBe(1);
    expect(result.stats.nodeTypeCounts.task).toBe(1);
    expect(result.stats.edgeTypeCounts.assigned_to).toBe(1);
  });
});

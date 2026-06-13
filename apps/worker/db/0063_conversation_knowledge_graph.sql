-- P16-B: AI Conversation Knowledge Graph
-- Incremental entity + relation extraction from conversations.
-- Graph is a semantic index, not source of truth — always linked to source messages for auditability.

CREATE TABLE IF NOT EXISTS kg_nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK(node_type IN (
    'user', 'room', 'message', 'thread', 'task', 'decision',
    'file', 'action', 'external_entity', 'concept'
  )),
  label TEXT NOT NULL,
  properties TEXT,              -- JSON: { title, description, status, priority, ... }
  source_message_id INTEGER,    -- linked to messages.id for auditability
  confidence REAL DEFAULT 0.8,
  valid_from TEXT NOT NULL,     -- ISO timestamp when this fact was established
  valid_to TEXT,                -- NULL = currently valid, timestamp = superseded
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_project_room ON kg_nodes(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(project_id, node_type);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_source ON kg_nodes(source_message_id);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_valid ON kg_nodes(project_id, room_id, valid_to);

CREATE TABLE IF NOT EXISTS kg_edges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  edge_type TEXT NOT NULL CHECK(edge_type IN (
    'mentioned_in', 'decided_by', 'assigned_to', 'part_of',
    'replies_to', 'references', 'created_by', 'depends_on',
    'affects', 'authored', 'linked_to'
  )),
  properties TEXT,              -- JSON: { context, role, weight, ... }
  source_message_id INTEGER,
  confidence REAL DEFAULT 0.8,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_project_room ON kg_edges(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source_node ON kg_edges(project_id, source_node_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target_node ON kg_edges(project_id, target_node_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_type ON kg_edges(project_id, edge_type);

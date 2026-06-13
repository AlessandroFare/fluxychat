-- Customer Data Layer (mini-CDP)

CREATE TABLE IF NOT EXISTS customer_profiles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  phone TEXT,
  avatar_url TEXT,
  attributes TEXT,
  segment_ids TEXT,
  lifecycle_stage TEXT DEFAULT 'lead' CHECK (lifecycle_stage IN ('lead', 'prospect', 'customer', 'churned', 'vip')),
  score INTEGER DEFAULT 0,
  tags TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cust_profile_ext
  ON customer_profiles (project_id, external_id);
CREATE INDEX IF NOT EXISTS idx_cust_profile_project
  ON customer_profiles (project_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_cust_profile_email
  ON customer_profiles (project_id, email);
CREATE INDEX IF NOT EXISTS idx_cust_profile_score
  ON customer_profiles (project_id, score DESC);

CREATE TABLE IF NOT EXISTS customer_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  properties TEXT,
  room_id TEXT,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cust_event_customer
  ON customer_events (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cust_event_project
  ON customer_events (project_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cust_event_type
  ON customer_events (project_id, event_name, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_segments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  segment_type TEXT NOT NULL DEFAULT 'dynamic' CHECK (segment_type IN ('static', 'dynamic')),
  rules TEXT,
  customer_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'building', 'archived')),
  last_built_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cust_seg_project
  ON customer_segments (project_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cust_seg_name
  ON customer_segments (project_id, name);

CREATE TABLE IF NOT EXISTS customer_segment_members (
  id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cust_seg_member_seg
  ON customer_segment_members (segment_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_cust_seg_member_cust
  ON customer_segment_members (customer_id);

CREATE TABLE IF NOT EXISTS customer_broadcasts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  segment_id TEXT,
  channel TEXT NOT NULL DEFAULT 'room' CHECK (channel IN ('room', 'email', 'push', 'sms', 'webhook')),
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'html', 'json', 'template')),
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at TEXT,
  sent_at TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cust_broadcast_project
  ON customer_broadcasts (project_id, status);
CREATE INDEX IF NOT EXISTS idx_cust_broadcast_segment
  ON customer_broadcasts (segment_id, status);

CREATE TABLE IF NOT EXISTS customer_broadcast_recipients (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  sent_at TEXT,
  delivered_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cust_bcast_rcpt_broadcast
  ON customer_broadcast_recipients (broadcast_id, status);
CREATE INDEX IF NOT EXISTS idx_cust_bcast_rcpt_customer
  ON customer_broadcast_recipients (customer_id);

CREATE TABLE IF NOT EXISTS customer_properties (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  property_name TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'string' CHECK (property_type IN ('string', 'number', 'boolean', 'date', 'json')),
  description TEXT,
  is_required INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cust_prop_name
  ON customer_properties (project_id, property_name);

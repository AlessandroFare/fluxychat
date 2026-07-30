-- FluxyTrack: GPS fleet tracking schema
-- Raw GPS points (7gg retention)
CREATE TABLE IF NOT EXISTS gps_raw (
  vehicle_id TEXT NOT NULL,
  fleet_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  speed REAL,
  heading REAL,
  accuracy REAL,
  PRIMARY KEY (vehicle_id, timestamp)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_gps_fleet_time ON gps_raw(fleet_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time ON gps_raw(vehicle_id, timestamp);

-- Aggregated 5min buckets (90gg retention)
CREATE TABLE IF NOT EXISTS gps_aggregated_5min (
  fleet_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  avg_lat REAL,
  avg_lng REAL,
  max_speed REAL,
  distance_meters REAL,
  point_count INTEGER,
  PRIMARY KEY (fleet_id, vehicle_id, bucket)
);

-- Vehicles
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id TEXT PRIMARY KEY,
  fleet_id TEXT NOT NULL,
  name TEXT NOT NULL,
  plate TEXT,
  driver_id TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('online','offline','idle','en_route')),
  last_lat REAL,
  last_lng REAL,
  last_heading REAL,
  last_speed REAL,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_fleet ON fleet_vehicles(fleet_id, status);

-- Trips
CREATE TABLE IF NOT EXISTS fleet_trips (
  id TEXT PRIMARY KEY,
  fleet_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','completed','cancelled')),
  started_at TEXT,
  completed_at TEXT,
  driver_id TEXT,
  pickup_lat REAL,
  pickup_lng REAL,
  pickup_address TEXT,
  dropoff_lat REAL,
  dropoff_lng REAL,
  dropoff_address TEXT,
  distance_meters REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fleet_trips_fleet ON fleet_trips(fleet_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_trips_vehicle ON fleet_trips(vehicle_id, status);

-- Geofence zones
CREATE TABLE IF NOT EXISTS fleet_geofences (
  id TEXT PRIMARY KEY,
  fleet_id TEXT NOT NULL,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_meters REAL NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fleet_geofences_fleet ON fleet_geofences(fleet_id);

-- Geofence events
CREATE TABLE IF NOT EXISTS fleet_geofence_events (
  id TEXT PRIMARY KEY,
  fleet_id TEXT NOT NULL,
  geofence_id TEXT,
  vehicle_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('enter','exit')),
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_fleet ON fleet_geofence_events(fleet_id, occurred_at);

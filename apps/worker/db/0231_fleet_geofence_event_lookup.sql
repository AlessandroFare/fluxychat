-- Traccar-shaped enter/exit: last event per vehicle + fence.
CREATE INDEX IF NOT EXISTS idx_geofence_events_vehicle_fence
  ON fleet_geofence_events (fleet_id, geofence_id, vehicle_id, occurred_at DESC);

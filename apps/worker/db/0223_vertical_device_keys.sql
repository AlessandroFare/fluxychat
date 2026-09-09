-- Device tokens for IoT lookup and fleet GPS ingest without an admin JWT.

CREATE INDEX IF NOT EXISTS idx_iot_devices_api_key_hash
  ON iot_devices (api_key_hash);

ALTER TABLE fleet_vehicles ADD COLUMN api_key_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_api_key_hash
  ON fleet_vehicles (api_key_hash);

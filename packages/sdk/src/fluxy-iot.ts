/**
 * FluxyIoT SDK — MQTT bridge & IoT device management.
 * ROADMAP 5.2 — 18.8B → 40B IoT devices by 2030.
 *
 * Features:
 *  - Device provisioning (certificate + API key)
 *  - Rule engine (if-this-then-that)
 *  - Time-series storage
 *  - Alerting (webhook + email + push)
 *  - Device shadow (desired vs reported state)
 *  - Fleet management
 *  - OTA updates
 *  - Geofencing for devices
 *  - AI device doctor (diagnostics)
 *  - Device as room member (IoT device = chat participant)
 */

// ─── Types ────────────────────────────────────────────

export type DeviceStatus = "online" | "offline" | "degraded" | "maintenance";
export type DeviceType = "sensor" | "actuator" | "gateway" | "camera" | "display" | "speaker" | "custom";

export interface IoTDevice {
  id: string;
  name: string;
  type: DeviceType;
  fleetId: string;
  status: DeviceStatus;
  certificate: string;
  apiKey: string;
  firmwareVersion: string;
  lastSeen: string;
  metadata: Record<string, unknown>;
  location?: { lat: number; lng: number; label?: string };
}

export interface SensorReading {
  id: string;
  deviceId: string;
  sensor: string; // "temperature", "humidity", "pressure", etc.
  value: number;
  unit: string;
  timestamp: string;
}

export interface RuleCondition {
  sensor: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
  value: number;
  windowSeconds?: number; // time window for aggregation
}

export interface RuleAction {
  type: "alert" | "webhook" | "email" | "command" | "chat_message";
  target: string;
  payload: string;
}

export interface IotRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  triggeredCount: number;
  lastTriggered?: string;
}

export interface DeviceShadow {
  deviceId: string;
  desired: Record<string, unknown>;
  reported: Record<string, unknown>;
  delta: Record<string, { desired: unknown; reported: unknown }>;
  updatedAt: string;
}

export interface Alert {
  id: string;
  deviceId: string;
  ruleId: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface Fleet {
  id: string;
  name: string;
  deviceCount: number;
  onlineCount: number;
  alertCount: number;
  createdAt: string;
}

export interface OTAUpdate {
  id: string;
  fleetId: string;
  version: string;
  url: string;
  status: "draft" | "rolling_out" | "completed" | "failed";
  devicesUpdated: number;
  devicesTotal: number;
  createdAt: string;
}

export interface Geofence {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  deviceId?: string;
}

// ─── Factory ──────────────────────────────────────────

export function createFluxyIoT() {
  const devices = new Map<string, IoTDevice>();
  const readings: SensorReading[] = [];
  const rules: IotRule[] = [];
  const shadows = new Map<string, DeviceShadow>();
  const alerts: Alert[] = [];
  const fleets = new Map<string, Fleet>();
  const otaUpdates: OTAUpdate[] = [];
  const geofences: Geofence[] = [];

  let deviceCounter = 0;
  let readingCounter = 0;
  let ruleCounter = 0;
  let alertCounter = 0;
  let fleetCounter = 0;
  let otaCounter = 0;

  // ── Device provisioning ──

  function provisionDevice(name: string, type: DeviceType, fleetId: string, metadata?: Record<string, unknown>): IoTDevice {
    const id = `dev_${++deviceCounter}`;
    const certBytes = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const keyBytes = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const device: IoTDevice = {
      id, name, type, fleetId,
      status: "online",
      certificate: `cert_${certBytes}`,
      apiKey: `key_${keyBytes}`,
      firmwareVersion: "1.0.0",
      lastSeen: new Date().toISOString(),
      metadata: metadata || {},
    };
    devices.set(id, device);

    // Update fleet
    const fleet = fleets.get(fleetId);
    if (fleet) { fleet.deviceCount++; fleet.onlineCount++; }

    // Initialize shadow
    shadows.set(id, { deviceId: id, desired: {}, reported: {}, delta: {}, updatedAt: new Date().toISOString() });

    return device;
  }

  function getDevice(id: string): IoTDevice | undefined {
    return devices.get(id);
  }

  function listDevices(fleetId?: string): IoTDevice[] {
    const all = [...devices.values()];
    return fleetId ? all.filter((d) => d.fleetId === fleetId) : all;
  }

  function updateDeviceStatus(id: string, status: DeviceStatus): boolean {
    const device = devices.get(id);
    if (!device) return false;
    device.status = status;
    device.lastSeen = new Date().toISOString();
    return true;
  }

  // ── Sensor readings ──

  function ingestReading(deviceId: string, sensor: string, value: number, unit: string): SensorReading {
    const reading: SensorReading = {
      id: `r_${++readingCounter}`,
      deviceId, sensor, value, unit,
      timestamp: new Date().toISOString(),
    };
    readings.push(reading);

    // Check rules
    checkRules(deviceId, sensor, value);

    // Update shadow reported state
    const shadow = shadows.get(deviceId);
    if (shadow) {
      shadow.reported[sensor] = value;
      recomputeDelta(shadow);
    }

    return reading;
  }

  function getReadings(deviceId: string, sensor?: string, limit = 100): SensorReading[] {
    let result = readings.filter((r) => r.deviceId === deviceId);
    if (sensor) result = result.filter((r) => r.sensor === sensor);
    return result.slice(-limit);
  }

  function getFleetReadings(fleetId: string, sensor: string, limit = 100): SensorReading[] {
    const fleetDeviceIds = new Set(listDevices(fleetId).map((d) => d.id));
    return readings.filter((r) => fleetDeviceIds.has(r.deviceId) && r.sensor === sensor).slice(-limit);
  }

  // ── Rule engine ──

  function createRule(name: string, conditions: RuleCondition[], actions: RuleAction[]): IotRule {
    const rule: IotRule = {
      id: `rule_${++ruleCounter}`,
      name, conditions, actions,
      enabled: true, triggeredCount: 0,
    };
    rules.push(rule);
    return rule;
  }

  function checkRules(deviceId: string, sensor: string, value: number): void {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const matching = rule.conditions.filter((c) => c.sensor === sensor);
      if (matching.length === 0) continue;
      const allMet = matching.every((c) => {
        switch (c.operator) {
          case ">": return value > c.value;
          case "<": return value < c.value;
          case ">=": return value >= c.value;
          case "<=": return value <= c.value;
          case "==": return value === c.value;
          case "!=": return value !== c.value;
        }
      });
      if (allMet) {
        rule.triggeredCount++;
        rule.lastTriggered = new Date().toISOString();
        const severity = value > (matching[0]?.value || 0) * 1.5 ? "critical" : "warning";
        const alert: Alert = {
          id: `alert_${++alertCounter}`,
          deviceId, ruleId: rule.id, severity,
          message: `Rule "${rule.name}" triggered: ${sensor} ${matching[0].operator} ${matching[0].value} (current: ${value})`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        };
        alerts.push(alert);
      }
    }
  }

  function listRules(): IotRule[] { return [...rules]; }
  function toggleRule(ruleId: string): boolean {
    const r = rules.find((r) => r.id === ruleId);
    if (!r) return false;
    r.enabled = !r.enabled;
    return true;
  }

  // ── Alerts ──

  function listAlerts(acknowledged?: boolean, limit = 50): Alert[] {
    let result = [...alerts];
    if (acknowledged !== undefined) result = result.filter((a) => a.acknowledged === acknowledged);
    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  function acknowledgeAlert(alertId: string): boolean {
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  // ── Device shadow ──

  function setDesiredState(deviceId: string, state: Record<string, unknown>): DeviceShadow | undefined {
    const shadow = shadows.get(deviceId);
    if (!shadow) return undefined;
    shadow.desired = { ...shadow.desired, ...state };
    recomputeDelta(shadow);
    shadow.updatedAt = new Date().toISOString();
    return shadow;
  }

  function getShadow(deviceId: string): DeviceShadow | undefined {
    return shadows.get(deviceId);
  }

  function recomputeDelta(shadow: DeviceShadow): void {
    shadow.delta = {};
    const keys = new Set([...Object.keys(shadow.desired), ...Object.keys(shadow.reported)]);
    for (const key of keys) {
      if (JSON.stringify(shadow.desired[key]) !== JSON.stringify(shadow.reported[key])) {
        shadow.delta[key] = { desired: shadow.desired[key], reported: shadow.reported[key] };
      }
    }
  }

  // ── Fleet management ──

  function createFleet(name: string): Fleet {
    const id = `fleet_${++fleetCounter}`;
    const fleet: Fleet = {
      id, name, deviceCount: 0, onlineCount: 0, alertCount: 0,
      createdAt: new Date().toISOString(),
    };
    fleets.set(id, fleet);
    return fleet;
  }

  function listFleets(): Fleet[] {
    for (const fleet of fleets.values()) {
      fleet.deviceCount = listDevices(fleet.id).length;
      fleet.onlineCount = listDevices(fleet.id).filter((d) => d.status === "online").length;
      fleet.alertCount = alerts.filter((a) => {
        const dev = devices.get(a.deviceId);
        return dev?.fleetId === fleet.id && !a.acknowledged;
      }).length;
    }
    return [...fleets.values()];
  }

  // ── OTA updates ──

  function createOTAUpdate(fleetId: string, version: string, url: string): OTAUpdate {
    const update: OTAUpdate = {
      id: `ota_${++otaCounter}`,
      fleetId, version, url,
      status: "rolling_out",
      devicesUpdated: 0,
      devicesTotal: listDevices(fleetId).length,
      createdAt: new Date().toISOString(),
    };
    otaUpdates.push(update);
    // Simulate rollout
    const fleetDevices = listDevices(fleetId);
    fleetDevices.forEach((d) => { d.firmwareVersion = version; });
    update.devicesUpdated = update.devicesTotal;
    update.status = "completed";
    return update;
  }

  function listOTAUpdates(): OTAUpdate[] { return [...otaUpdates]; }

  // ── Geofencing ──

  function createGeofence(name: string, lat: number, lng: number, radiusM: number, deviceId?: string): Geofence {
    const fence: Geofence = { id: `geo_${Date.now()}`, name, lat, lng, radiusM, deviceId };
    geofences.push(fence);
    return fence;
  }

  function checkGeofence(deviceId: string, lat: number, lng: number): { inside: Geofence[]; outside: Geofence[] } {
    const deviceFences = geofences.filter((g) => !g.deviceId || g.deviceId === deviceId);
    const inside: Geofence[] = [];
    const outside: Geofence[] = [];
    for (const fence of deviceFences) {
      const R = 6371000;
      const dLat = (fence.lat - lat) * Math.PI / 180;
      const dLng = (fence.lng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(fence.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist <= fence.radiusM) inside.push(fence);
      else outside.push(fence);
    }
    return { inside, outside };
  }

  function listGeofences(): Geofence[] { return [...geofences]; }

  // ── AI device doctor ──

  function diagnoseDevice(deviceId: string): { diagnosis: string; severity: string; recommendation: string; confidence: number } {
    const device = devices.get(deviceId);
    if (!device) return { diagnosis: "Device not found", severity: "critical", recommendation: "Check device ID", confidence: 1 };

    const deviceReadings = getReadings(deviceId);
    const deviceAlerts = alerts.filter((a) => a.deviceId === deviceId && !a.acknowledged);

    if (device.status === "offline") {
      return { diagnosis: "Device is offline — possible connectivity failure", severity: "critical", recommendation: "Check power supply and network connection. Verify certificate validity.", confidence: 0.9 };
    }
    if (device.status === "degraded") {
      return { diagnosis: "Device is degraded — high latency or packet loss detected", severity: "warning", recommendation: "Check signal strength and firmware version. Consider OTA update.", confidence: 0.75 };
    }
    if (deviceAlerts.length > 5) {
      return { diagnosis: `Device has ${deviceAlerts.length} unacknowledged alerts — possible sensor malfunction`, severity: "warning", recommendation: "Review alert history and recalibrate sensors.", confidence: 0.7 };
    }
    if (deviceReadings.length > 0) {
      const recent = deviceReadings.slice(-10);
      const allSame = recent.every((r) => r.value === recent[0].value);
      if (allSame) {
        return { diagnosis: "Sensor values are stagnant — possible sensor failure or stuck value", severity: "warning", recommendation: "Inspect physical sensor and trigger manual reading.", confidence: 0.65 };
      }
    }
    return { diagnosis: "Device operating normally", severity: "info", recommendation: "No action needed.", confidence: 0.95 };
  }

  // ── Device as room member ──

  function deviceToChatMessage(deviceId: string, event: string): { role: string; content: string } {
    const device = devices.get(deviceId);
    if (!device) return { role: "system", content: "Unknown device" };
    const content = `[${device.name}] ${event}`;
    return { role: "user", content };
  }

  return {
    provisionDevice, getDevice, listDevices, updateDeviceStatus,
    ingestReading, getReadings, getFleetReadings,
    createRule, listRules, toggleRule,
    listAlerts, acknowledgeAlert,
    setDesiredState, getShadow,
    createFleet, listFleets,
    createOTAUpdate, listOTAUpdates,
    createGeofence, checkGeofence, listGeofences,
    diagnoseDevice,
    deviceToChatMessage,
  };
}

export type FluxyIoTApi = ReturnType<typeof createFluxyIoT>;

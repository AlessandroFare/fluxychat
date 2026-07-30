import { describe, expect, it } from "vitest";
import { createFluxyIoT } from "./fluxy-iot";

describe("fluxy-iot", () => {
  it("does not expose credentials on public device views", () => {
    const iot = createFluxyIoT();
    const fleet = iot.createFleet("Plant A");
    const device = iot.provisionDevice("Sensor 1", "sensor", fleet.id);
    expect(device).not.toHaveProperty("apiKey");
    expect(device).not.toHaveProperty("certificate");
    const creds = iot.revealDeviceCredentials(device.id);
    expect(creds?.apiKey).toMatch(/^key_/);
  });

  it("executes rule actions when conditions match", () => {
    const iot = createFluxyIoT();
    const fleet = iot.createFleet("Plant B");
    const device = iot.provisionDevice("Temp", "sensor", fleet.id);
    iot.createRule("Hot", [{ sensor: "temperature", operator: ">", value: 30 }], [
      { type: "webhook", target: "https://example.invalid/hook", payload: "hot" },
    ]);
    iot.ingestReading(device.id, "temperature", 35, "C");
    expect(iot.listRuleActionLog().length).toBeGreaterThan(0);
  });
});

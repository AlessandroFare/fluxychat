import { VerticalStudio } from "@/app/components/vertical-studio";

export default function ContinuityPage() {
  return <VerticalStudio config={{
    id: "continuity", name: "Cross-Reality Continuity", eyebrow: "Device handoff lab", readiness: "Prototype",
    description: "Inspect capabilities and resume the same room across desktop, mobile, embedded displays and XR fallbacks.",
    journey: ["Negotiate device capabilities", "Create session checkpoint", "Handoff active capability", "Resolve viewport state", "Confirm canonical room cursor"],
    metrics: [{ label: "Connected surfaces", value: "3" }, { label: "Room cursor", value: "8,412" }, { label: "Handoff latency", value: "180 ms" }],
    capabilities: [{ name: "Capability handshake", detail: "Versioned form factor, input, viewport, media and spatial support.", status: "Ready" }, { name: "Session checkpoint", detail: "Canonical cursor plus device-specific view state and expiry.", status: "Ready" }, { name: "XR renderer", detail: "Lazy WebXR adapter with 2D fallback and interoperable glTF assets.", status: "Gated" }, { name: "Device shadow", detail: "Event-based critical state and batched non-critical telemetry.", status: "Adapter" }],
    activity: [{ actor: "Desktop", action: "created checkpoint cp_8412", time: "Now" }, { actor: "Mobile", action: "accepted room handoff", time: "1 minute ago" }, { actor: "Policy engine", action: "selected the 2D spatial fallback", time: "1 minute ago" }],
    primaryAction: "Simulate handoff", complianceNote: "The simulator validates protocol behavior without an XR headset. View state is device-local; membership and room events remain canonical and server-authoritative.",
  }} />;
}

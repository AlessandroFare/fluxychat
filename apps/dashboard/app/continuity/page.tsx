import { VerticalStudio } from "@/app/components/vertical-studio";

export default function ContinuityPage() {
  return <VerticalStudio config={{
    id: "continuity", name: "Cross-Reality Continuity", eyebrow: "Handoff", readiness: "Labs",
    description: "Checkpoint the same room across devices. No latency SLA. XR stays in your client.",
    journey: ["Negotiate device capabilities", "Create session checkpoint", "Handoff active capability", "Resolve viewport state", "Confirm canonical room cursor"],
    metrics: [{ label: "Checkpoints", value: "0" }, { label: "Room events", value: "0" }, { label: "Capability ticks", value: "0" }],
    capabilities: [{ name: "Capability handshake", detail: "Versioned form factor, input, viewport, media and spatial support.", status: "Ready" }, { name: "Session checkpoint", detail: "Canonical cursor plus device-specific view state and expiry.", status: "Ready" }, { name: "XR renderer", detail: "Lazy WebXR adapter with 2D fallback and interoperable glTF assets.", status: "Gated" }, { name: "Device shadow", detail: "Event-based critical state and batched non-critical telemetry.", status: "Adapter" }],
    primaryAction: "Simulate handoff",     complianceNote: "Checkpoints persist as capability events. XR renderers stay in your client. No unpublished handoff latency SLA.",
    relatedLinks: [
      { href: "/spatial", label: "Spatial lab", description: "Digital twin rooms and AR overlays." },
      { href: "/iot", label: "Device shadow", description: "HTTP ingest, telemetry and desired state." },
      { href: "/transport", label: "Transport", description: "WebTransport readiness and negotiation." },
      { href: "/docs/platform/vertical-industries", label: "Industry docs", description: "Checkpoint and handoff capability events." },
    ],
  }} />;
}

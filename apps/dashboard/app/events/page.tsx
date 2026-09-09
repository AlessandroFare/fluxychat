import { VerticalStudio } from "@/app/components/vertical-studio";

export default function EventsPage() {
  return <VerticalStudio config={{
    id: "events", name: "FluxyEvent", eyebrow: "Venue", readiness: "Labs",
    description: "Lobby, stage, Q&A, and polls on ordinary rooms. Spatial audio is not included.",
    journey: ["Verify attendee ticket", "Enter venue lobby", "Go live on main stage", "Moderate Q&A", "Publish event recap"],
    metrics: [{ label: "Capability events", value: "0" }, { label: "Stage live events", value: "0" }, { label: "Server fan-out", value: "0" }],
    capabilities: [{ name: "Venue rooms", detail: "Organizer, speaker, sponsor and attendee policy presets.", status: "Ready" }, { name: "Moderated Q&A", detail: "Idempotent upvotes, moderation queue and organizer controls.", status: "Ready" }, { name: "Ticket verification", detail: "Signed lifecycle adapter with revocation and anti-replay checks.", status: "Adapter" }, { name: "Spatial audio", detail: "Progressive enhancement with an accessible non-spatial fallback.", status: "Gated" }],
    primaryAction: "Open control room",     complianceNote: "Ticket processors stay adapters. Stage and Q&A persist on the Worker. Spatial audio is not included.",
    relatedLinks: [
      { href: "/stream", label: "Stream control", description: "Live stage, HLS player and chat overlay." },
      { href: "/stream", label: "Broadcast setup", description: "Configure streams and overlays." },
      { href: "/collab", label: "Backstage notes", description: "Shared run-of-show whiteboard." },
      { href: "/docs/platform/vertical-industries", label: "Industry docs", description: "Stage live, hybrid check-in, live workspace." },
    ],
  }} />;
}

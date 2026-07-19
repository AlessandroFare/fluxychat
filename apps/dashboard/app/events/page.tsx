import { VerticalStudio } from "@/app/components/vertical-studio";

export default function EventsPage() {
  return <VerticalStudio config={{
    id: "events", name: "FluxyEvent", eyebrow: "Live venue control room", readiness: "Beta",
    description: "Build a venue from connected rooms: lobby, stages, backstage, Q&A, polls and sponsor booths.",
    journey: ["Verify attendee ticket", "Enter venue lobby", "Go live on main stage", "Moderate Q&A", "Publish event recap"],
    metrics: [{ label: "Attendees live", value: "1,248" }, { label: "Stage health", value: "Stable" }, { label: "Questions queued", value: "18" }],
    capabilities: [{ name: "Venue rooms", detail: "Organizer, speaker, sponsor and attendee policy presets.", status: "Ready" }, { name: "Moderated Q&A", detail: "Idempotent upvotes, moderation queue and organizer controls.", status: "Ready" }, { name: "Ticket verification", detail: "Signed lifecycle adapter with revocation and anti-replay checks.", status: "Adapter" }, { name: "Spatial audio", detail: "Progressive enhancement with an accessible non-spatial fallback.", status: "Gated" }],
    activity: [{ actor: "Main stage", action: "started the keynote stream", time: "Now" }, { actor: "Moderator", action: "approved 6 audience questions", time: "1 minute ago" }, { actor: "Ticket service", action: "verified 42 new arrivals", time: "2 minutes ago" }],
    primaryAction: "Open control room", complianceNote: "Ticket and media providers remain adapters. Demo attendance and stage telemetry are deterministic fixtures and are not represented as production traffic.",
  }} />;
}

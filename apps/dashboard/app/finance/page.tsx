import { VerticalStudio } from "@/app/components/vertical-studio";

export default function FinancePage() {
  return <VerticalStudio config={{
    id: "finance", name: "FluxyFinance", eyebrow: "Market room", readiness: "Labs",
    description: "Alerts and invoice drafts on the room. No PAN. No trade execution.",
    journey: ["Open market room", "Attach provider snapshot", "Review risk alert", "Approve invoice draft", "Export audit trail"],
    metrics: [{ label: "Risk flags", value: "0" }, { label: "Room events", value: "0" }, { label: "Capability ticks", value: "0" }],
    capabilities: [{ name: "Market event feed", detail: "Sequence-aware provider port with stale-data and reconnect handling.", status: "Adapter" }, { name: "Risk room", detail: "Explainable alerts, provenance and immutable review events.", status: "Ready" }, { name: "Invoice assistant", detail: "Decimal-safe amounts and mandatory human approval.", status: "Ready" }, { name: "Payment execution", detail: "Tokenized provider handoff only; Fluxy never stores PAN data.", status: "Gated" }],
    primaryAction: "Open market room",     complianceNote: "Not financial advice. No PAN storage and no trade execution. PCI/PSD2 stay on your payment provider.",
    relatedLinks: [
      { href: "/rooms", label: "Market room", description: "Discuss signals with audit-friendly events." },
      { href: "/analytics", label: "Usage analytics", description: "Cost and activity estimates per workspace." },
      { href: "/activities", label: "Automation", description: "Webhook and agent workflows for alerts." },
      { href: "/docs/platform/vertical-industries", label: "Industry docs", description: "Risk signals and audit capability events." },
    ],
  }} />;
}

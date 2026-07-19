import { VerticalStudio } from "@/app/components/vertical-studio";

export default function FinancePage() {
  return <VerticalStudio config={{
    id: "finance", name: "FluxyFinance", eyebrow: "Realtime market workspace", readiness: "Preview",
    description: "Discuss market context, route alerts and review finance workflows without storing payment credentials or auto-executing trades.",
    journey: ["Open market room", "Attach provider snapshot", "Review risk alert", "Approve invoice draft", "Export audit trail"],
    metrics: [{ label: "Watchlist signals", value: "12" }, { label: "Stale feeds", value: "0" }, { label: "Approvals pending", value: "3" }],
    capabilities: [{ name: "Market event feed", detail: "Sequence-aware provider port with stale-data and reconnect handling.", status: "Adapter" }, { name: "Risk room", detail: "Explainable alerts, provenance and immutable review events.", status: "Ready" }, { name: "Invoice assistant", detail: "Decimal-safe amounts and mandatory human approval.", status: "Ready" }, { name: "Payment execution", detail: "Tokenized provider handoff only; Fluxy never stores PAN data.", status: "Gated" }],
    activity: [{ actor: "Risk agent", action: "flagged a volatility threshold", time: "Now" }, { actor: "Maya", action: "requested invoice review", time: "3 minutes ago" }, { actor: "Market adapter", action: "confirmed sequence 28419", time: "5 minutes ago" }],
    primaryAction: "Open market room", complianceNote: "This preview is not financial advice and cannot execute trades. PCI DSS, PSD2 and provider-specific controls remain explicit deployment gates.",
  }} />;
}

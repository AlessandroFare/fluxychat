import { VerticalStudio } from "@/app/components/vertical-studio";

export default function HealthPage() {
  return <VerticalStudio config={{
    id: "health", name: "FluxyHealth", eyebrow: "Secure care room", readiness: "Preview",
    description: "Coordinate a synthetic care journey with consent, secure messaging, telehealth adapters and auditable events.",
    journey: ["Verify consent", "Open care room", "Start provider session", "Share FHIR context", "Seal audit record"],
    metrics: [{ label: "Care team online", value: "4" }, { label: "Consent status", value: "Verified" }, { label: "Audit gaps", value: "0" }],
    capabilities: [{ name: "Secure messaging", detail: "Care-team roles, retention policy and immutable audit envelope.", status: "Ready" }, { name: "FHIR R4 context", detail: "SMART on FHIR adapter boundary; no records embedded in chat payloads.", status: "Adapter" }, { name: "Telehealth", detail: "BAA-eligible provider adapter with caption and session controls.", status: "Gated" }],
    activity: [{ actor: "Care coordinator", action: "verified session consent", time: "Now" }, { actor: "Dr. Chen", action: "joined the care room", time: "2 minutes ago" }, { actor: "Audit service", action: "sealed the previous checkpoint", time: "5 minutes ago" }],
    primaryAction: "Open care room", complianceNote: "FluxyHealth is not represented as HIPAA compliant. Production requires a BAA, risk assessment, operational controls and validated vendor chain. This page uses synthetic data only.",
  }} />;
}

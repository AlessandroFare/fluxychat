import { VerticalStudio } from "@/app/components/vertical-studio";

export default function HealthPage() {
  return <VerticalStudio config={{
    id: "health", name: "FluxyHealth", eyebrow: "Care room", readiness: "Labs",
    description: "Consent events and a care-team room. No HIPAA BAA. Do not put PHI in chat payloads.",
    journey: ["Verify consent", "Open care room", "Start provider session", "Share FHIR context", "Seal audit record"],
    metrics: [{ label: "Consent events", value: "0" }, { label: "Care-room events", value: "0" }, { label: "Capability ticks", value: "0" }],
    capabilities: [{ name: "Secure messaging", detail: "Care-team roles, retention policy and immutable audit envelope.", status: "Ready" }, { name: "FHIR R4 context", detail: "SMART on FHIR adapter boundary; no records embedded in chat payloads.", status: "Adapter" }, { name: "Telehealth", detail: "BAA-eligible provider adapter with caption and session controls.", status: "Gated" }],
    primaryAction: "Open care room",     complianceNote: "Consent events persist on the Worker. FluxyHealth is not HIPAA-certified and does not include a BAA. Do not put PHI in chat payloads.",
    relatedLinks: [
      { href: "/rooms", label: "Care room", description: "Secure messaging on the shared room kernel." },
      { href: "/privacy", label: "Privacy controls", description: "Retention, export and deletion policies." },
      { href: "/security", label: "Security checklist", description: "Token encryption and audit boundaries." },
      { href: "/docs/platform/vertical-industries", label: "Industry docs", description: "Capability events and live workspace." },
    ],
  }} />;
}

import { VerticalStudio } from "@/app/components/vertical-studio";

export default function EduPage() {
  return <VerticalStudio config={{
    id: "edu", name: "FluxyEdu", eyebrow: "Classroom", readiness: "Production",
    description: "Same room as chat. Run a poll, open a breakout, keep attendance on the timeline. Video still needs LiveKit or similar. Grading suggestions stay unpublished until a teacher signs off.",
    journey: ["Create classroom", "Open live session", "Run a knowledge check", "Assign breakout groups", "Review the session report"],
    metrics: [{ label: "Attendance heartbeats", value: "0" }, { label: "Room events", value: "—" }, { label: "Poll ticks", value: "0" }],
    capabilities: [
      { name: "Room + attendance", detail: "Membership plus heartbeat attendance events.", status: "Ready" },
      { name: "Polls and quizzes", detail: "One vote per user. Teacher closes and reveals results.", status: "Ready" },
      { name: "Collaborative canvas", detail: "Yjs document on the same room. Snapshot when you need a freeze.", status: "Adapter" },
      { name: "Multiparty media", detail: "Bring your own SFU. We do not ship one.", status: "Adapter" },
      { name: "AI grading", detail: "Rubric draft only. A teacher has to approve before publish.", status: "Gated" },
    ],
    primaryAction: "Start live class",
    complianceNote: "Counts come from Worker capability events on the selected room. FERPA/COPPA and LMS LTI are not included. Video still needs your SFU.",
    relatedLinks: [
      { href: "/collab", label: "Collab whiteboard", description: "Excalidraw on Yjs in the same room." },
      { href: "/stream", label: "Stream", description: "Same poll API, live event overlay." },
      { href: "/docs/platform/vertical-industries", label: "Industry docs", description: "How polls and breakouts are wired." },
      { href: "/agents", label: "Grading agent", description: "Draft a rubric. A teacher still has to publish it." },
    ],
  }} />;
}

import { VerticalStudio } from "@/app/components/vertical-studio";

export default function EduPage() {
  return <VerticalStudio config={{
    id: "edu", name: "FluxyEdu", eyebrow: "Live classroom studio", readiness: "Beta",
    description: "Run a classroom from one room: attendance, breakout groups, polls, whiteboard and human-reviewed grading.",
    journey: ["Create classroom", "Open live session", "Run a knowledge check", "Assign breakout groups", "Review the session report"],
    metrics: [{ label: "Learners present", value: "28 / 32" }, { label: "Participation", value: "87%" }, { label: "Open breakouts", value: "4" }],
    capabilities: [
      { name: "Room + attendance", detail: "Role-aware membership and heartbeat-based attendance events.", status: "Ready" },
      { name: "Polls and quizzes", detail: "Idempotent voting with teacher-controlled close and result reveal.", status: "Ready" },
      { name: "Collaborative canvas", detail: "Yjs document adapter with awareness and snapshot boundaries.", status: "Adapter" },
      { name: "Multiparty media", detail: "Provider-neutral SFU port with captions and transcript hooks.", status: "Adapter" },
      { name: "AI grading", detail: "Rubric suggestions require explicit educator approval before publish.", status: "Gated" },
    ],
    activity: [{ actor: "Prof. Rivera", action: "opened the algebra room", time: "Now" }, { actor: "Classroom agent", action: "published a knowledge check", time: "1 minute ago" }, { actor: "28 learners", action: "confirmed attendance", time: "3 minutes ago" }],
    primaryAction: "Start live class",
    complianceNote: "Demo data is synthetic. FERPA/COPPA controls, retention, consent and learner export must be configured per workspace before production use.",
  }} />;
}

import {
  createVerticalPlatform,
  type CapabilityId,
  type DeviceCapabilities,
  type EventActor,
  type RoomKernelConfig,
  type SessionCheckpoint,
  type VerticalId,
  type VerticalPlatform,
} from "./vertical-platform";

export interface AttendanceRecord {
  userId: string;
  role: string;
  lastHeartbeatAt: string;
  present: boolean;
}

export interface BreakoutAssignment {
  userId: string;
  groupId: string;
  assignedAt: string;
}

export interface GradeSuggestion {
  id: string;
  studentId: string;
  rubricId: string;
  score: number;
  feedback: string;
  status: "draft" | "approved" | "published";
  suggestedBy: "ai" | "teacher";
}

export interface ConsentRecord {
  patientId: string;
  scope: string;
  grantedAt: string;
  expiresAt: string;
  verified: boolean;
}

export interface TicketVerification {
  ticketId: string;
  attendeeId: string;
  valid: boolean;
  reason?: string;
  verifiedAt: string;
}

export interface MarketAlert {
  id: string;
  symbol: string;
  threshold: number;
  direction: "above" | "below";
  triggeredAt?: string;
  sequence: number;
}

export interface InvoiceDraft {
  id: string;
  amountCents: number;
  currency: string;
  description: string;
  status: "draft" | "pending_approval" | "approved";
}

export interface VerticalWorkflowState {
  attendance: Map<string, AttendanceRecord>;
  breakouts: Map<string, BreakoutAssignment>;
  grades: Map<string, GradeSuggestion>;
  consent: ConsentRecord | null;
  tickets: Map<string, TicketVerification>;
  alerts: Map<string, MarketAlert>;
  invoices: Map<string, InvoiceDraft>;
  devices: Map<string, DeviceCapabilities>;
  checkpoints: Map<string, SessionCheckpoint>;
}

export interface VerticalWorkflowApi {
  readonly platform: VerticalPlatform;
  readonly state: Readonly<VerticalWorkflowState>;
  startSession(actor: EventActor): void;
  recordAttendance(userId: string, role: string): AttendanceRecord;
  assignBreakout(userId: string, groupId: string): BreakoutAssignment;
  createKnowledgeCheck(question: string, options: Array<{ id: string; label: string }>): ReturnType<VerticalPlatform["createPoll"]>;
  submitPollVote(pollId: string, optionIds: string[], userId: string): boolean;
  suggestGrade(input: Omit<GradeSuggestion, "id" | "status">): GradeSuggestion;
  approveGrade(gradeId: string, approverId: string): GradeSuggestion | null;
  verifyConsent(patientId: string, scope: string, ttlMinutes?: number): ConsentRecord;
  verifyTicket(ticketId: string, attendeeId: string, signature: string): TicketVerification;
  upvoteQuestion(questionId: string, userId: string): boolean;
  createMarketAlert(input: Omit<MarketAlert, "id" | "sequence">): MarketAlert;
  createInvoiceDraft(input: Omit<InvoiceDraft, "id" | "status">): InvoiceDraft;
  approveInvoice(invoiceId: string, approverId: string): InvoiceDraft | null;
  registerDevice(capabilities: DeviceCapabilities): DeviceCapabilities;
  createHandoffCheckpoint(input: Omit<SessionCheckpoint, "checkpointId" | "createdAt">): SessionCheckpoint;
  resumeFromCheckpoint(actorId: string): SessionCheckpoint | null;
  activityFeed(limit?: number): Array<{ actor: string; action: string; time: string }>;
}

export interface SessionReportLine {
  label: string;
  value: string;
}

export function buildVerticalSessionReport(vertical: VerticalId, workflow: VerticalWorkflowApi): SessionReportLine[] {
  const { state } = workflow;
  switch (vertical) {
    case "edu": {
      const present = [...state.attendance.values()].filter((record) => record.present).length;
      const groups = new Set([...state.breakouts.values()].map((assignment) => assignment.groupId)).size;
      const approvedGrades = [...state.grades.values()].filter((grade) => grade.status === "approved").length;
      return [
        { label: "Learners present", value: String(present) },
        { label: "Breakout groups", value: String(groups) },
        { label: "Grades approved", value: String(approvedGrades) },
        { label: "Room events", value: String(workflow.platform.events().length) },
      ];
    }
    case "health":
      return [
        { label: "Consent", value: state.consent?.verified ? "Verified" : "Pending" },
        { label: "Care team present", value: String(state.attendance.size) },
        { label: "Audit events", value: String(workflow.platform.events().filter((event) => event.type.includes("audit")).length) },
      ];
    case "event":
      return [
        { label: "Tickets verified", value: String([...state.tickets.values()].filter((ticket) => ticket.valid).length) },
        { label: "Q&A upvotes", value: String(workflow.platform.events().filter((event) => event.type.includes("qa.upvoted")).length) },
        { label: "Stage events", value: String(workflow.platform.events().filter((event) => event.type.includes("stage")).length) },
      ];
    case "finance":
      return [
        { label: "Market alerts", value: String(state.alerts.size) },
        { label: "Invoices approved", value: String([...state.invoices.values()].filter((invoice) => invoice.status === "approved").length) },
        { label: "Risk events", value: String(workflow.platform.events().filter((event) => event.type.includes("risk")).length) },
      ];
    case "continuity":
      return [
        { label: "Registered devices", value: String(state.devices.size) },
        { label: "Checkpoints", value: String(state.checkpoints.size) },
        { label: "Canonical cursor", value: String([...state.checkpoints.values()][0]?.cursor ?? "—") },
      ];
    default:
      return [];
  }
}

function actorLabel(actor: EventActor): string {
  return actor.role ? `${actor.id} (${actor.role})` : actor.id;
}

function relativeTime(iso: string): string {
  const deltaMs = Date.now() - Date.parse(iso);
  if (deltaMs < 60_000) return "Now";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export function createVerticalWorkflow(config: RoomKernelConfig): VerticalWorkflowApi {
  const platform = createVerticalPlatform(config);
  const state: VerticalWorkflowState = {
    attendance: new Map(),
    breakouts: new Map(),
    grades: new Map(),
    consent: null,
    tickets: new Map(),
    alerts: new Map(),
    invoices: new Map(),
    devices: new Map(),
    checkpoints: new Map(),
  };
  const questionVotes = new Map<string, Set<string>>();
  let marketSequence = 0;

  function publish(type: string, actor: EventActor, payload: Record<string, unknown>, idempotencyKey: string) {
    return platform.publish({
      workspaceId: config.workspaceId,
      roomId: config.roomId,
      type,
      actor,
      idempotencyKey,
      payload,
    });
  }

  return {
    platform,
    state,

    startSession(actor) {
      publish(`${config.vertical}.session.started`, actor, {}, `${config.vertical}-session-${config.roomId}`);
    },

    recordAttendance(userId, role) {
      const record: AttendanceRecord = {
        userId,
        role,
        lastHeartbeatAt: new Date().toISOString(),
        present: true,
      };
      state.attendance.set(userId, record);
      publish("attendance.heartbeat", { id: userId, type: "user", role }, { userId, role }, `attendance-${userId}-${record.lastHeartbeatAt}`);
      return structuredClone(record);
    },

    assignBreakout(userId, groupId) {
      const assignment: BreakoutAssignment = { userId, groupId, assignedAt: new Date().toISOString() };
      state.breakouts.set(userId, assignment);
      publish("edu.breakout.assigned", { id: "system", type: "system" }, { userId, groupId }, `breakout-${userId}-${groupId}`);
      return structuredClone(assignment);
    },

    createKnowledgeCheck(question, options) {
      const poll = platform.createPoll({ question, allowMultiple: false, options });
      publish("edu.poll.created", { id: "teacher", type: "user", role: "teacher" }, { pollId: poll.id, question }, `poll-create-${poll.id}`);
      return poll;
    },

    submitPollVote(pollId, optionIds, userId) {
      const accepted = platform.vote({ pollId, optionIds, userId, idempotencyKey: `vote-${pollId}-${userId}` });
      if (accepted) {
        publish("poll.voted", { id: userId, type: "user" }, { pollId, optionIds }, `vote-${pollId}-${userId}`);
      }
      return accepted;
    },

    suggestGrade(input) {
      const suggestion: GradeSuggestion = { ...structuredClone(input), id: `grade_${crypto.randomUUID()}`, status: "draft" };
      state.grades.set(suggestion.id, suggestion);
      publish("edu.grade.suggested", { id: input.suggestedBy === "ai" ? "grading-agent" : "teacher", type: input.suggestedBy === "ai" ? "agent" : "user" }, { gradeId: suggestion.id, studentId: input.studentId, score: input.score }, `grade-suggest-${suggestion.id}`);
      return structuredClone(suggestion);
    },

    approveGrade(gradeId, approverId) {
      const grade = state.grades.get(gradeId);
      if (!grade || grade.status !== "draft") return null;
      grade.status = "approved";
      publish("edu.grade.approved", { id: approverId, type: "user", role: "teacher" }, { gradeId }, `grade-approve-${gradeId}`);
      return structuredClone(grade);
    },

    verifyConsent(patientId, scope, ttlMinutes = 60) {
      const grantedAt = new Date().toISOString();
      const record: ConsentRecord = {
        patientId,
        scope,
        grantedAt,
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
        verified: true,
      };
      state.consent = record;
      publish("health.consent.verified", { id: patientId, type: "user", role: "patient" }, { scope }, `consent-${patientId}-${scope}`);
      return structuredClone(record);
    },

    verifyTicket(ticketId, attendeeId, signature) {
      const valid = signature.length >= 8 && !signature.startsWith("revoked");
      const verification: TicketVerification = {
        ticketId,
        attendeeId,
        valid,
        reason: valid ? undefined : "Invalid or revoked signature",
        verifiedAt: new Date().toISOString(),
      };
      state.tickets.set(ticketId, verification);
      publish("event.ticket.verified", { id: "ticket-service", type: "system" }, { ticketId, attendeeId, valid }, `ticket-${ticketId}-${attendeeId}`);
      return structuredClone(verification);
    },

    upvoteQuestion(questionId, userId) {
      const voters = questionVotes.get(questionId) ?? new Set<string>();
      if (voters.has(userId)) return false;
      voters.add(userId);
      questionVotes.set(questionId, voters);
      publish("event.qa.upvoted", { id: userId, type: "user" }, { questionId, total: voters.size }, `qa-upvote-${questionId}-${userId}`);
      return true;
    },

    createMarketAlert(input) {
      marketSequence += 1;
      const alert: MarketAlert = { ...structuredClone(input), id: `alert_${crypto.randomUUID()}`, sequence: marketSequence };
      state.alerts.set(alert.id, alert);
      publish("finance.alert.created", { id: "market-adapter", type: "system" }, { alertId: alert.id, symbol: alert.symbol }, `alert-${alert.id}`);
      return structuredClone(alert);
    },

    createInvoiceDraft(input) {
      const invoice: InvoiceDraft = { ...structuredClone(input), id: `inv_${crypto.randomUUID()}`, status: "draft" };
      state.invoices.set(invoice.id, invoice);
      publish("finance.invoice.draft", { id: "finance-agent", type: "agent" }, { invoiceId: invoice.id, amountCents: invoice.amountCents }, `invoice-${invoice.id}`);
      return structuredClone(invoice);
    },

    approveInvoice(invoiceId, approverId) {
      const invoice = state.invoices.get(invoiceId);
      if (!invoice || invoice.status === "approved") return null;
      invoice.status = "approved";
      publish("finance.invoice.approved", { id: approverId, type: "user" }, { invoiceId }, `invoice-approve-${invoiceId}`);
      return structuredClone(invoice);
    },

    registerDevice(capabilities) {
      state.devices.set(capabilities.deviceId, structuredClone(capabilities));
      publish("continuity.device.registered", { id: capabilities.deviceId, type: "device" }, { formFactor: capabilities.formFactor }, `device-${capabilities.deviceId}`);
      return structuredClone(capabilities);
    },

    createHandoffCheckpoint(input) {
      const checkpoint = platform.checkpoint(input);
      state.checkpoints.set(input.actorId, checkpoint);
      publish("continuity.checkpoint.created", { id: input.actorId, type: "user" }, { checkpointId: checkpoint.checkpointId, cursor: checkpoint.cursor }, `checkpoint-${checkpoint.checkpointId}`);
      return checkpoint;
    },

    resumeFromCheckpoint(actorId) {
      const checkpoint = state.checkpoints.get(actorId) ?? null;
      if (!checkpoint) return null;
      publish("continuity.checkpoint.resumed", { id: actorId, type: "user" }, { checkpointId: checkpoint.checkpointId }, `resume-${checkpoint.checkpointId}`);
      return structuredClone(checkpoint);
    },

    activityFeed(limit = 6) {
      return platform.events()
        .slice(-limit)
        .reverse()
        .map((event) => ({
          actor: actorLabel(event.actor),
          action: event.type.replace(/\./g, " "),
          time: relativeTime(event.occurredAt),
        }));
    },
  };
}

export const VERTICAL_DEMO_SEEDS: Record<VerticalId, RoomKernelConfig> = {
  edu: {
    workspaceId: "ws_demo_edu",
    roomId: "room_algebra_101",
    vertical: "edu",
    capabilities: [
      { id: "poll", readiness: "beta", policy: { allowedRoles: ["teacher", "student"], retentionDays: 90 } },
      { id: "attendance", readiness: "beta", policy: { allowedRoles: ["teacher", "student", "observer"], retentionDays: 365 } },
    ],
  },
  health: {
    workspaceId: "ws_demo_health",
    roomId: "room_care_team",
    vertical: "health",
    capabilities: [{ id: "clinical-data", readiness: "preview", policy: { allowedRoles: ["patient", "clinician"], retentionDays: 30, consentRequired: true } }],
  },
  event: {
    workspaceId: "ws_demo_event",
    roomId: "room_keynote_venue",
    vertical: "event",
    capabilities: [{ id: "ticket", readiness: "beta", policy: { allowedRoles: ["organizer", "attendee"], retentionDays: 14 } }],
  },
  finance: {
    workspaceId: "ws_demo_finance",
    roomId: "room_market_desk",
    vertical: "finance",
    capabilities: [{ id: "market-data", readiness: "preview", policy: { allowedRoles: ["analyst", "approver"], retentionDays: 2555 } }],
  },
  continuity: {
    workspaceId: "ws_demo_continuity",
    roomId: "room_handoff_lab",
    vertical: "continuity",
    capabilities: [{ id: "device-shadow", readiness: "prototype", policy: { allowedRoles: ["member"], retentionDays: 7 } }],
  },
};

export function runVerticalDemoStep(workflow: VerticalWorkflowApi, vertical: VerticalId, step: number): void {
  switch (vertical) {
    case "edu":
      if (step === 0) workflow.startSession({ id: "teacher_rivera", type: "user", role: "teacher" });
      if (step === 1) {
        ["s1", "s2", "s3", "s4"].forEach((id, index) => workflow.recordAttendance(id, index === 0 ? "teacher" : "student"));
      }
      if (step === 2) {
        const poll = workflow.createKnowledgeCheck("Which expression equals 12?", [
          { id: "a", label: "3 × 4" },
          { id: "b", label: "5 + 5" },
        ]);
        workflow.submitPollVote(poll.id, ["a"], "s2");
        workflow.platform.closePoll(poll.id);
      }
      if (step === 3) workflow.assignBreakout("s2", "group_alpha");
      if (step === 4) {
        const grade = workflow.suggestGrade({ studentId: "s2", rubricId: "algebra_quiz_1", score: 92, feedback: "Strong reasoning on factoring.", suggestedBy: "ai" });
        workflow.approveGrade(grade.id, "teacher_rivera");
      }
      break;
    case "health":
      if (step === 0) workflow.verifyConsent("patient_42", "telehealth_session");
      if (step === 1) workflow.startSession({ id: "coordinator", type: "user", role: "coordinator" });
      if (step === 2) workflow.recordAttendance("dr_chen", "clinician");
      if (step === 3) publishFhirContext(workflow);
      if (step === 4) workflow.platform.publish({ workspaceId: workflow.platform.config.workspaceId, roomId: workflow.platform.config.roomId, type: "health.audit.sealed", actor: { id: "audit-service", type: "system" }, idempotencyKey: "audit-seal-1", payload: { tamperEvident: true } });
      break;
    case "event":
      if (step === 0) workflow.verifyTicket("tkt_1001", "attendee_88", "sig_valid_demo_key");
      if (step === 1) workflow.startSession({ id: "venue_lobby", type: "system" });
      if (step === 2) workflow.platform.publish({ workspaceId: workflow.platform.config.workspaceId, roomId: workflow.platform.config.roomId, type: "event.stage.live", actor: { id: "main_stage", type: "system" }, idempotencyKey: "stage-live-1", payload: { stage: "keynote" } });
      if (step === 3) workflow.upvoteQuestion("q_18", "attendee_88");
      if (step === 4) workflow.platform.publish({ workspaceId: workflow.platform.config.workspaceId, roomId: workflow.platform.config.roomId, type: "event.recap.published", actor: { id: "organizer", type: "user" }, idempotencyKey: "recap-1", payload: {} });
      break;
    case "finance":
      if (step === 0) workflow.startSession({ id: "desk_lead", type: "user", role: "analyst" });
      if (step === 1) workflow.createMarketAlert({ symbol: "FLXY", threshold: 42.5, direction: "above" });
      if (step === 2) workflow.platform.publish({ workspaceId: workflow.platform.config.workspaceId, roomId: workflow.platform.config.roomId, type: "finance.risk.flagged", actor: { id: "risk-agent", type: "agent" }, idempotencyKey: "risk-1", payload: { severity: "medium" } });
      if (step === 3) {
        const invoice = workflow.createInvoiceDraft({ amountCents: 125000, currency: "USD", description: "Q2 platform services" });
        workflow.approveInvoice(invoice.id, "maya");
      }
      if (step === 4) workflow.platform.publish({ workspaceId: workflow.platform.config.workspaceId, roomId: workflow.platform.config.roomId, type: "finance.audit.exported", actor: { id: "desk_lead", type: "user" }, idempotencyKey: "audit-export-1", payload: {} });
      break;
    case "continuity":
      if (step === 0) workflow.registerDevice({ deviceId: "desktop_1", formFactor: "desktop", input: ["keyboard"], supportsVideo: true, supportsSpatial: false, maxViewportWidth: 1920 });
      if (step === 1) workflow.createHandoffCheckpoint({ roomId: workflow.platform.config.roomId, actorId: "desktop_1", cursor: 8412, activeCapability: "whiteboard" as CapabilityId, viewState: { scrollY: 120 }, expiresAt: new Date(Date.now() + 3600_000).toISOString() });
      if (step === 2) workflow.registerDevice({ deviceId: "mobile_1", formFactor: "mobile", input: ["touch"], supportsVideo: true, supportsSpatial: false, maxViewportWidth: 430 });
      if (step === 3) workflow.resumeFromCheckpoint("desktop_1");
      if (step === 4) workflow.platform.publish({ workspaceId: workflow.platform.config.workspaceId, roomId: workflow.platform.config.roomId, type: "continuity.cursor.confirmed", actor: { id: "policy-engine", type: "system" }, idempotencyKey: "cursor-confirm-1", payload: { cursor: 8412 } });
      break;
  }
}

function publishFhirContext(workflow: VerticalWorkflowApi) {
  workflow.platform.publish({
    workspaceId: workflow.platform.config.workspaceId,
    roomId: workflow.platform.config.roomId,
    type: "health.fhir.context.attached",
    actor: { id: "fhir-adapter", type: "system" },
    idempotencyKey: "fhir-context-1",
    payload: { resourceType: "Observation", reference: "Observation/demo-vitals" },
  });
}

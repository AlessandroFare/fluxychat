export {
  createVerticalPlatform,
  type VerticalId,
  type RoomKernelConfig,
  type CapabilityId,
  type VerticalPlatform,
} from "./vertical-platform";

export {
  createVerticalWorkflow,
  runVerticalDemoStep,
  VERTICAL_DEMO_SEEDS,
  type VerticalWorkflowApi,
  type GradeSuggestion,
  type AttendanceRecord,
  type BreakoutAssignment,
  buildVerticalSessionReport,
  type SessionReportLine,
} from "./vertical-workflows";

export {
  createCapabilityClient,
  syncWorkflowEventsToWorker,
  type CapabilityClient,
} from "./capability-client";

export {
  DEMO_ADAPTERS,
  type SfuAdapter,
  type SfuSession,
  type SfuSessionConfig,
} from "./vertical-adapters";

export { getReadinessEntry, PLATFORM_READINESS } from "./readiness";

export {
  createYjsCollabPort,
  type YjsCollabPort,
  type YjsSnapshotPolicy,
} from "./yjs-collab";

export {
  createVerticalPlatform,
  type RoomKernelConfig,
  type VerticalPlatform,
} from "./vertical-platform";

export {
  createVerticalWorkflow,
  runVerticalDemoStep,
  VERTICAL_DEMO_SEEDS,
  type VerticalWorkflowApi,
  type MarketAlert,
  type InvoiceDraft,
} from "./vertical-workflows";

export {
  createCapabilityClient,
  syncWorkflowEventsToWorker,
  type CapabilityClient,
} from "./capability-client";

export {
  DEMO_ADAPTERS,
  type MarketDataAdapter,
  type MarketQuote,
} from "./vertical-adapters";

export { getReadinessEntry, PLATFORM_READINESS } from "./readiness";

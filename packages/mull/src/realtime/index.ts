// Real-time trigger system
export { TriggerManager, type TriggerManagerEvents } from './trigger-manager.js';

// Trigger types
export type {
  ForgeTrajectoryEvent,
  PlannerDecisionEvent,
  RelayMessageEvent,
  TriggerConfig,
  TriggerResult,
  TriggerLayer,
  AccumulatorState,
} from './types.js';
export {
  TriggerConfigSchema,
  AccumulatorStateSchema,
  HIGH_SIGNAL_FORGE_EVENTS,
  DECISION_EVENT_TYPES,
  SESSION_END_EVENTS,
} from './types.js';

// Deterministic extraction functions (for direct use/testing)
export {
  extractFromForgeEvent,
  extractFromPlannerEvent,
  extractFromRelayMessage,
  evaluateForgeEvent,
} from './deterministic.js';

// LLM batch evaluation (for direct use/testing)
export { evaluateLlmTrigger, isTimerExpired, type LlmTriggerReason } from './llm-batch.js';

// Accumulator state management
export {
  loadAccumulatorState,
  saveAccumulatorState,
  accumulateEntities,
  markLlmRunComplete,
  readAccumulatorState,
} from './accumulator.js';

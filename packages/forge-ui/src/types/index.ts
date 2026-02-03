/**
 * Forge UI Types - Re-exports
 */

// Run types
export { RunStatus, type Run, type RunSummary, type RunFilter, type RunListResponse } from './run';

// Task types
export {
  TaskStatus,
  type Task,
  type TaskResult,
  type TaskAttempt,
  type TaskSummary,
} from './task';

// Artifact types
export {
  type ArtifactType,
  type PRStatus,
  type ArtifactMetadata,
  type Artifact,
  type ArtifactSummary,
  type ArtifactsResponse,
} from './artifact';

// Gate types
export {
  GateStatus,
  type Gate,
  type GateArtifact,
  type GateContext,
  type AcceptanceCriterion,
  type GateSummary,
  type PendingGatesResponse,
  type GateApprovalRequest,
  type GateRejectionRequest,
} from './gate';

// Question types
export {
  BlockingLevel,
  QuestionStatus,
  type Question,
  type QuestionOption,
  type QuestionSummary,
  type QuestionGroup,
  type PendingQuestionsResponse,
  type QuestionHistoryResponse,
  type AnswerQuestionRequest,
  type AnswerQuestionGroupRequest,
} from './question';

// Agent types
export {
  AgentState,
  AgentStatus,
  type Agent,
  type AgentSummary,
  type ActiveAgent,
  type AgentMessage,
  type AgentArtifact,
} from './agent';

// Preflight types
export {
  type PreflightCheckStatus,
  type PreflightCheck,
  type ForgeStep,
  type ForgePlan,
  type PreflightValidationResult,
  type CreateRunResponse,
  type CreateRunOptions,
  type Environment,
} from './preflight';

// Timeline types
export {
  type ArtifactLink,
  type TimelineEvent,
  type TimelineEventType,
  type TimelineFilterType,
  type TimelineFilter,
  type TimelineResponse,
  type TimelineEventCounts,
  getEventCategory,
  calculateEventCounts,
  filterEventsByCategory,
} from './timeline';

// SSE Event types
export interface ForgeEvent {
  type: string;
  run_id: string;
  timestamp: string;
  data: unknown;
}

export interface RunUpdatedEvent extends ForgeEvent {
  type: 'run_updated';
  data: {
    status: string;
    completed_tasks: number;
    failed_tasks: number;
  };
}

export interface TaskUpdatedEvent extends ForgeEvent {
  type: 'task_updated';
  data: {
    task_id: string;
    status: string;
    assigned_agent_id?: string;
  };
}

export interface GateUpdatedEvent extends ForgeEvent {
  type: 'gate_updated';
  data: {
    gate_id: string;
    status: string;
  };
}

export interface QuestionAskedEvent extends ForgeEvent {
  type: 'question_asked';
  data: {
    question_id: string;
    agent_id: string;
    question_text: string;
    blocking_level: string;
  };
}

export interface QuestionAddedEvent extends ForgeEvent {
  type: 'question_added';
  data: {
    question_id: string;
    question?: import('./question').Question;
  };
}

export interface QuestionAnsweredEvent extends ForgeEvent {
  type: 'question_answered';
  data: {
    question_id: string;
    answer: string;
    answered_by?: string;
  };
}

export interface AgentUpdatedEvent extends ForgeEvent {
  type: 'agent_updated';
  data: {
    agent_id: string;
    state: string;
    current_task_id?: string;
  };
}

export interface AgentProgressEvent extends ForgeEvent {
  type: 'agent_progress';
  data: {
    agent_id: string;
    message: string;
    timestamp: string;
  };
}

export interface AgentExitedEvent extends ForgeEvent {
  type: 'agent_exited';
  data: {
    agent_id: string;
    reason?: string;
  };
}

export interface ArtifactUpdatedEvent extends ForgeEvent {
  type: 'artifact_updated';
  data: {
    artifact_id: string;
    task_id: string;
    metadata?: import('./artifact').ArtifactMetadata;
  };
}

export type ForgeEventUnion =
  | RunUpdatedEvent
  | TaskUpdatedEvent
  | GateUpdatedEvent
  | QuestionAskedEvent
  | QuestionAddedEvent
  | QuestionAnsweredEvent
  | AgentUpdatedEvent
  | AgentProgressEvent
  | AgentExitedEvent
  | ArtifactUpdatedEvent;

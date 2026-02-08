/**
 * Timeline types for the Forge orchestration UI
 *
 * These types support the timeline view which displays chronological
 * execution events during a run.
 */

/**
 * Artifact link that can be associated with a timeline event
 */
export interface ArtifactLink {
  type: 'github_pr' | 'github_commit' | 'deployment' | 'link';
  url: string;
  label: string;
}

/**
 * Timeline event representing an occurrence during a run
 */
export interface TimelineEvent {
  event_id: string;
  run_id: string;
  event_type: TimelineEventType;
  timestamp: string;
  data: Record<string, unknown>;
  task_id?: string;
  agent_id?: string;

  // Computed fields (enriched by API or client)
  task_title?: string;
  agent_name?: string;
  description?: string;
  artifacts?: ArtifactLink[];
}

/**
 * All supported timeline event types
 */
export type TimelineEventType =
  | 'run_started'
  | 'run_completed'
  | 'run_failed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'agent_spawned'
  | 'agent_exited'
  | 'gate_reached'
  | 'gate_approved'
  | 'gate_rejected'
  | 'question_asked'
  | 'question_answered';

/**
 * Filter types for the timeline view
 */
export type TimelineFilterType = 'all' | 'tasks' | 'agents' | 'gates' | 'questions';

/**
 * Filter options for API requests
 */
export interface TimelineFilter {
  type?: TimelineEventType;
  filterType?: TimelineFilterType;
}

/**
 * Response from the timeline API
 */
export interface TimelineResponse {
  events: TimelineEvent[];
}

/**
 * Counts of events by category
 */
export interface TimelineEventCounts {
  all: number;
  tasks: number;
  agents: number;
  gates: number;
  questions: number;
}

/**
 * Map event types to their filter categories
 */
export function getEventCategory(eventType: TimelineEventType): TimelineFilterType {
  switch (eventType) {
    case 'task_started':
    case 'task_completed':
    case 'task_failed':
      return 'tasks';
    case 'agent_spawned':
    case 'agent_exited':
      return 'agents';
    case 'gate_reached':
    case 'gate_approved':
    case 'gate_rejected':
      return 'gates';
    case 'question_asked':
    case 'question_answered':
      return 'questions';
    default:
      return 'all';
  }
}

/**
 * Calculate event counts by category
 */
export function calculateEventCounts(events: TimelineEvent[]): TimelineEventCounts {
  const counts: TimelineEventCounts = {
    all: events.length,
    tasks: 0,
    agents: 0,
    gates: 0,
    questions: 0,
  };

  for (const event of events) {
    const category = getEventCategory(event.event_type);
    if (category !== 'all') {
      counts[category]++;
    }
  }

  return counts;
}

/**
 * Filter events by category
 */
export function filterEventsByCategory(
  events: TimelineEvent[],
  filter: TimelineFilterType
): TimelineEvent[] {
  if (filter === 'all') {
    return events;
  }

  return events.filter((event) => getEventCategory(event.event_type) === filter);
}

/**
 * Deterministic trigger layer.
 *
 * Runs on every significant event with $0 cost and <100ms latency.
 * Extracts entities and facts from structured event data without LLM calls.
 * Results are accumulated for the LLM batch layer.
 *
 * No batching — fires on every qualifying event.
 */

import type { Entity, Fact } from '../types.js';
import type {
  ForgeTrajectoryEvent,
  PlannerDecisionEvent,
  RelayMessageEvent,
  TriggerResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Entity/fact extraction from forge trajectory events
// ---------------------------------------------------------------------------

/**
 * Extract entities and facts from a forge trajectory event payload.
 * This is pure, deterministic extraction — no LLM, no network.
 */
export function extractFromForgeEvent(event: ForgeTrajectoryEvent): {
  entities: Entity[];
  facts: Fact[];
} {
  const entities: Entity[] = [];
  const facts: Fact[] = [];
  const payload = event.payload;

  // Extract agent entity if present
  const agentId = payload.agent_id as string | undefined;
  if (agentId) {
    entities.push({ text: agentId, type: 'person', count: 1 });
  }

  // Extract tool entity from tool calls
  const toolName = payload.tool_name as string | undefined;
  if (toolName) {
    entities.push({ text: toolName, type: 'tool', count: 1 });
  }

  // Extract step/task as concept
  const stepTitle = payload.step_title as string | undefined;
  if (stepTitle) {
    entities.push({ text: stepTitle, type: 'concept', count: 1 });
  }

  // Decision facts
  if (event.event_type === 'decision_recorded') {
    const decision = payload.decision as string | undefined;
    const reasoning = payload.reasoning as string | undefined;
    if (decision) {
      facts.push({
        slug: `decision-${event.event_id}`,
        text: decision,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: entities.map(e => e.text),
        isPreStructured: true,
      });
    }
    if (reasoning) {
      facts.push({
        slug: `reasoning-${event.event_id}`,
        text: reasoning,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: [],
      });
    }
  }

  // Checkpoint facts
  if (event.event_type === 'checkpoint_created') {
    const description = payload.description as string | undefined;
    if (description) {
      facts.push({
        slug: `checkpoint-${event.event_id}`,
        text: description,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: entities.map(e => e.text),
      });
    }
  }

  // Retrospective facts (rich structured data)
  if (event.event_type === 'retrospective_recorded') {
    const summary = payload.summary as string | undefined;
    const approach = payload.approach as string | undefined;
    const learnings = payload.learnings as string[] | undefined;
    const suggestions = payload.suggestions as string[] | undefined;

    if (summary) {
      facts.push({
        slug: `retro-summary-${event.event_id}`,
        text: summary,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: entities.map(e => e.text),
        isPreStructured: true,
      });
    }
    if (approach) {
      facts.push({
        slug: `retro-approach-${event.event_id}`,
        text: approach,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: [],
        isPreStructured: true,
      });
    }
    if (learnings) {
      for (const [i, learning] of learnings.entries()) {
        facts.push({
          slug: `retro-learning-${event.event_id}-${i}`,
          text: learning,
          source: `forge:${event.run_id}`,
          timestamp: event.timestamp,
          entities: [],
          isPreStructured: true,
        });
      }
    }
    if (suggestions) {
      for (const [i, suggestion] of suggestions.entries()) {
        facts.push({
          slug: `retro-suggestion-${event.event_id}-${i}`,
          text: suggestion,
          source: `forge:${event.run_id}`,
          timestamp: event.timestamp,
          entities: [],
          isPreStructured: true,
        });
      }
    }

    // Nested decisions in retrospective
    const decisions = payload.decisions as Array<{
      question?: string;
      chosen?: string;
      reasoning?: string;
    }> | undefined;
    if (decisions) {
      for (const [i, d] of decisions.entries()) {
        if (d.chosen) {
          facts.push({
            slug: `retro-decision-${event.event_id}-${i}`,
            text: `${d.question ?? 'Decision'}: ${d.chosen}${d.reasoning ? ` (${d.reasoning})` : ''}`,
            source: `forge:${event.run_id}`,
            timestamp: event.timestamp,
            entities: [],
            isPreStructured: true,
          });
        }
      }
    }
  }

  // Gate events
  if (event.event_type === 'gate_reached' || event.event_type === 'gate_approved' || event.event_type === 'gate_rejected') {
    const reason = (payload.reason ?? payload.message ?? payload.step_title) as string | undefined;
    if (reason) {
      facts.push({
        slug: `gate-${event.event_type}-${event.event_id}`,
        text: `Gate ${event.event_type.replace('gate_', '')}: ${reason}`,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: entities.map(e => e.text),
      });
    }
  }

  // Task completion/failure
  if (event.event_type === 'task_completed' || event.event_type === 'task_failed') {
    const title = (payload.step_title ?? payload.title) as string | undefined;
    const notes = payload.notes as string | undefined;
    if (title) {
      facts.push({
        slug: `task-${event.event_type}-${event.event_id}`,
        text: `${title}${notes ? `: ${notes}` : ''}`,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: entities.map(e => e.text),
      });
    }
  }

  // Agent spawned
  if (event.event_type === 'agent_spawned') {
    const role = payload.role as string | undefined;
    if (agentId) {
      facts.push({
        slug: `agent-spawn-${event.event_id}`,
        text: `Agent ${agentId} spawned${role ? ` as ${role}` : ''}`,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: entities.map(e => e.text),
      });
    }
  }

  // Budget warning
  if (event.event_type === 'budget_warning') {
    const message = payload.message as string | undefined;
    if (message) {
      facts.push({
        slug: `budget-warning-${event.event_id}`,
        text: message,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: [],
      });
    }
  }

  // Recovery strategy
  if (event.event_type === 'recovery_strategy_selected') {
    const strategy = payload.strategy as string | undefined;
    const reason = payload.reason as string | undefined;
    if (strategy) {
      facts.push({
        slug: `recovery-${event.event_id}`,
        text: `Recovery: ${strategy}${reason ? ` — ${reason}` : ''}`,
        source: `forge:${event.run_id}`,
        timestamp: event.timestamp,
        entities: [],
        isPreStructured: true,
      });
    }
  }

  return { entities, facts };
}

// ---------------------------------------------------------------------------
// Entity/fact extraction from planner decision events
// ---------------------------------------------------------------------------

/**
 * Extract entities and facts from a planner decision event.
 * Planner decisions are already well-structured — nearly 1:1 mapping.
 */
export function extractFromPlannerEvent(event: PlannerDecisionEvent): {
  entities: Entity[];
  facts: Fact[];
} {
  const entities: Entity[] = [];
  const facts: Fact[] = [];

  if (event.asking_agent) {
    entities.push({ text: event.asking_agent, type: 'person', count: 1 });
  }

  // The decision itself is a high-value fact
  const parts = [event.question_text];
  if (event.selected_option) parts.push(`Selected: ${event.selected_option}`);
  if (event.reasoning) parts.push(`Reasoning: ${event.reasoning}`);

  facts.push({
    slug: `planner-decision-${event.event_id}`,
    text: parts.join(' | '),
    source: `planner:${event.plan_id}`,
    timestamp: event.timestamp,
    entities: entities.map(e => e.text),
    isPreStructured: true,
  });

  return { entities, facts };
}

// ---------------------------------------------------------------------------
// Entity/fact extraction from relay messages
// ---------------------------------------------------------------------------

/**
 * Extract entities and facts from a relay message.
 * Most relay messages are low-signal (status updates, ACKs).
 * We extract entities (agent names) from all, but only create facts
 * for substantive messages (not system, not very short).
 */
export function extractFromRelayMessage(event: RelayMessageEvent): {
  entities: Entity[];
  facts: Fact[];
} {
  const entities: Entity[] = [];
  const facts: Fact[] = [];

  // Skip system messages entirely
  if (event.from === '__system__') {
    return { entities, facts };
  }

  // Agent entity
  entities.push({ text: event.from, type: 'person', count: 1 });

  // Target entity (if agent, not channel)
  if (event.to && !event.to.startsWith('#')) {
    entities.push({ text: event.to, type: 'person', count: 1 });
  }

  // Only create facts for substantive messages (>50 chars)
  if (event.body && event.body.length > 50) {
    const timestamp = new Date(event.ts).toISOString();
    const channel = event.channel ?? event.to;

    facts.push({
      slug: `relay-${event.id}`,
      text: event.body.slice(0, 500), // Truncate very long messages
      source: `relay:${channel}`,
      timestamp,
      entities: entities.map(e => e.text),
    });
  }

  return { entities, facts };
}

// ---------------------------------------------------------------------------
// Deterministic trigger evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a forge event should trigger deterministic processing.
 * Returns extracted entities/facts if the event qualifies, null otherwise.
 */
export function evaluateForgeEvent(
  event: ForgeTrajectoryEvent,
  highSignalTypes: ReadonlySet<string>,
): { entities: Entity[]; facts: Fact[] } | null {
  if (!highSignalTypes.has(event.event_type)) {
    return null;
  }
  const result = extractFromForgeEvent(event);
  if (result.entities.length === 0 && result.facts.length === 0) {
    return null;
  }
  return result;
}

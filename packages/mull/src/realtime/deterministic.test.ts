import { describe, it, expect } from 'vitest';
import {
  extractFromForgeEvent,
  extractFromPlannerEvent,
  extractFromRelayMessage,
  evaluateForgeEvent,
} from './deterministic.js';
import { HIGH_SIGNAL_FORGE_EVENTS } from './types.js';
import type { ForgeTrajectoryEvent, PlannerDecisionEvent, RelayMessageEvent } from './types.js';

// ---------------------------------------------------------------------------
// extractFromForgeEvent
// ---------------------------------------------------------------------------

describe('extractFromForgeEvent', () => {
  it('extracts agent entity from payload', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-1',
      run_id: 'run-1',
      event_type: 'agent_spawned',
      payload: { agent_id: 'worker-1', role: 'coder' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const { entities } = extractFromForgeEvent(event);
    expect(entities).toContainEqual({ text: 'worker-1', type: 'person', count: 1 });
  });

  it('extracts decision fact from decision_recorded event', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-2',
      run_id: 'run-1',
      event_type: 'decision_recorded',
      payload: {
        agent_id: 'lead',
        decision: 'Use SQLite for storage',
        reasoning: 'Matches existing stack',
      },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const { facts } = extractFromForgeEvent(event);
    expect(facts).toHaveLength(2); // decision + reasoning
    expect(facts[0].text).toBe('Use SQLite for storage');
    expect(facts[0].isPreStructured).toBe(true);
    expect(facts[1].text).toBe('Matches existing stack');
  });

  it('extracts retrospective data including nested decisions', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-3',
      run_id: 'run-1',
      event_type: 'retrospective_recorded',
      payload: {
        summary: 'Task completed successfully',
        approach: 'Incremental refactoring',
        learnings: ['SQLite handles JSONB well', 'Tests caught edge case'],
        suggestions: ['Add more integration tests'],
        decisions: [
          { question: 'Storage format?', chosen: 'JSONB', reasoning: 'Simplicity' },
        ],
      },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const { facts } = extractFromForgeEvent(event);
    // summary + approach + 2 learnings + 1 suggestion + 1 nested decision = 6
    expect(facts).toHaveLength(6);
    expect(facts[0].slug).toBe('retro-summary-ev-3');
    expect(facts[0].isPreStructured).toBe(true);
  });

  it('extracts gate event facts', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-4',
      run_id: 'run-1',
      event_type: 'gate_approved',
      payload: { reason: 'All criteria met' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const { facts } = extractFromForgeEvent(event);
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toContain('Gate approved');
  });

  it('extracts task completion facts', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-5',
      run_id: 'run-1',
      event_type: 'task_completed',
      payload: { step_title: 'Build API routes', notes: 'All endpoints tested' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const { facts } = extractFromForgeEvent(event);
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toBe('Build API routes: All endpoints tested');
  });

  it('extracts budget warning facts', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-6',
      run_id: 'run-1',
      event_type: 'budget_warning',
      payload: { message: '80% of token budget consumed' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const { facts } = extractFromForgeEvent(event);
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toBe('80% of token budget consumed');
  });
});

// ---------------------------------------------------------------------------
// extractFromPlannerEvent
// ---------------------------------------------------------------------------

describe('extractFromPlannerEvent', () => {
  it('extracts decision with question, selection, and reasoning', () => {
    const event: PlannerDecisionEvent = {
      event_id: 'pe-1',
      plan_id: 'plan-abc',
      type: 'decision',
      question_text: 'Which database?',
      selected_option: 'SQLite',
      reasoning: 'Simplicity for v1',
      asking_agent: 'planner-lead',
      timestamp: '2026-01-01T00:00:00Z',
    };
    const { entities, facts } = extractFromPlannerEvent(event);
    expect(entities).toContainEqual({ text: 'planner-lead', type: 'person', count: 1 });
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toContain('Which database?');
    expect(facts[0].text).toContain('Selected: SQLite');
    expect(facts[0].text).toContain('Reasoning: Simplicity for v1');
    expect(facts[0].isPreStructured).toBe(true);
  });

  it('handles missing optional fields', () => {
    const event: PlannerDecisionEvent = {
      event_id: 'pe-2',
      plan_id: 'plan-abc',
      type: 'question',
      question_text: 'How should we handle auth?',
      timestamp: '2026-01-01T00:00:00Z',
    };
    const { entities, facts } = extractFromPlannerEvent(event);
    expect(entities).toHaveLength(0);
    expect(facts).toHaveLength(1);
    expect(facts[0].text).toBe('How should we handle auth?');
  });
});

// ---------------------------------------------------------------------------
// extractFromRelayMessage
// ---------------------------------------------------------------------------

describe('extractFromRelayMessage', () => {
  it('skips system messages', () => {
    const event: RelayMessageEvent = {
      id: 'msg-1',
      from: '__system__',
      to: '#general',
      kind: 'system',
      body: 'Agent joined channel',
      ts: Date.now(),
    };
    const { entities, facts } = extractFromRelayMessage(event);
    expect(entities).toHaveLength(0);
    expect(facts).toHaveLength(0);
  });

  it('extracts agent entities from sender and direct target', () => {
    const event: RelayMessageEvent = {
      id: 'msg-2',
      from: 'worker-1',
      to: 'lead',
      kind: 'message',
      body: 'Short msg',
      ts: Date.now(),
    };
    const { entities } = extractFromRelayMessage(event);
    expect(entities).toHaveLength(2);
    expect(entities[0].text).toBe('worker-1');
    expect(entities[1].text).toBe('lead');
  });

  it('does not extract target entity for channel messages', () => {
    const event: RelayMessageEvent = {
      id: 'msg-3',
      from: 'worker-1',
      to: '#planner',
      kind: 'message',
      body: 'Short msg',
      ts: Date.now(),
    };
    const { entities } = extractFromRelayMessage(event);
    expect(entities).toHaveLength(1); // only sender
  });

  it('creates fact only for substantive messages (>50 chars)', () => {
    const shortEvent: RelayMessageEvent = {
      id: 'msg-4',
      from: 'worker-1',
      to: '#general',
      kind: 'message',
      body: 'ACK: Starting work',
      ts: 1704067200000,
    };
    const { facts: shortFacts } = extractFromRelayMessage(shortEvent);
    expect(shortFacts).toHaveLength(0);

    const longEvent: RelayMessageEvent = {
      id: 'msg-5',
      from: 'worker-1',
      to: '#general',
      kind: 'message',
      body: 'I have completed the implementation of the authentication module with OAuth2 support and JWT tokens',
      ts: 1704067200000,
    };
    const { facts: longFacts } = extractFromRelayMessage(longEvent);
    expect(longFacts).toHaveLength(1);
  });

  it('truncates very long messages to 500 chars', () => {
    const event: RelayMessageEvent = {
      id: 'msg-6',
      from: 'worker-1',
      to: '#general',
      kind: 'message',
      body: 'x'.repeat(1000),
      ts: 1704067200000,
    };
    const { facts } = extractFromRelayMessage(event);
    expect(facts[0].text).toHaveLength(500);
  });
});

// ---------------------------------------------------------------------------
// evaluateForgeEvent
// ---------------------------------------------------------------------------

describe('evaluateForgeEvent', () => {
  it('returns null for non-high-signal events', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-1',
      run_id: 'run-1',
      event_type: 'agent_progress',
      payload: { message: 'Working...' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    expect(evaluateForgeEvent(event, HIGH_SIGNAL_FORGE_EVENTS)).toBeNull();
  });

  it('returns entities/facts for high-signal events', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-2',
      run_id: 'run-1',
      event_type: 'decision_recorded',
      payload: { agent_id: 'lead', decision: 'Use TypeScript' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const result = evaluateForgeEvent(event, HIGH_SIGNAL_FORGE_EVENTS);
    expect(result).not.toBeNull();
    expect(result!.entities.length).toBeGreaterThan(0);
    expect(result!.facts.length).toBeGreaterThan(0);
  });

  it('returns null when high-signal event produces no extractable data', () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-3',
      run_id: 'run-1',
      event_type: 'budget_warning',
      payload: {}, // No message field
      timestamp: '2026-01-01T00:00:00Z',
    };
    const result = evaluateForgeEvent(event, HIGH_SIGNAL_FORGE_EVENTS);
    expect(result).toBeNull();
  });
});

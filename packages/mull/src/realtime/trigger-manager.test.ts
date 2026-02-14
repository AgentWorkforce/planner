import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TriggerManager } from './trigger-manager.js';
import type { MullAdapter, SessionRef, SessionData } from '../domain/types.js';
import type { ForgeTrajectoryEvent, PlannerDecisionEvent, RelayMessageEvent } from './types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeAdapter(overrides: Partial<MullAdapter> = {}): MullAdapter {
  return {
    name: 'test-adapter',
    supports: () => true,
    listSessions: vi.fn<() => Promise<SessionRef[]>>().mockResolvedValue([]),
    loadSession: vi.fn<(ref: SessionRef, opts?: { after?: string }) => Promise<SessionData>>().mockResolvedValue({
      ref: { type: 'run_id', id: 'run-1' },
      messages: [],
    }),
    getCursor: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
    setCursor: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };
}

let mullDir: string;
let manager: TriggerManager;
let adapter: MullAdapter;

beforeEach(() => {
  mullDir = mkdtempSync(join(tmpdir(), 'mull-trigger-test-'));
  adapter = makeAdapter();
  manager = new TriggerManager({
    config: { mullDir, minEntitiesForLlm: 3 },
    adapters: [adapter],
  });
});

afterEach(() => {
  manager.shutdown();
});

// ---------------------------------------------------------------------------
// onForgeEvent
// ---------------------------------------------------------------------------

describe('TriggerManager.onForgeEvent', () => {
  it('ignores non-high-signal forge events', async () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-1',
      run_id: 'run-1',
      event_type: 'agent_progress',
      payload: { message: 'Working...' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const result = await manager.onForgeEvent(event);
    expect(result.triggered).toBe(false);
    expect(result.reason).toContain('not high-signal');
  });

  it('triggers deterministic extraction for high-signal events', async () => {
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-2',
      run_id: 'run-1',
      event_type: 'decision_recorded',
      payload: { agent_id: 'lead', decision: 'Use TypeScript' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const result = await manager.onForgeEvent(event);
    expect(result.triggered).toBe(true);
    expect(result.layer).toBe('deterministic');
    expect(result.entitiesExtracted).toBeGreaterThan(0);
  });

  it('emits deterministic event', async () => {
    const handler = vi.fn();
    manager.on('deterministic', handler);

    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-3',
      run_id: 'run-1',
      event_type: 'task_completed',
      payload: { step_title: 'Build API' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    await manager.onForgeEvent(event);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not trigger when stopped', async () => {
    manager.shutdown();
    const event: ForgeTrajectoryEvent = {
      event_id: 'ev-4',
      run_id: 'run-1',
      event_type: 'decision_recorded',
      payload: { decision: 'test' },
      timestamp: '2026-01-01T00:00:00Z',
    };
    const result = await manager.onForgeEvent(event);
    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('manager stopped');
  });

  it('handles session end events by flushing', async () => {
    // First accumulate some data
    await manager.onForgeEvent({
      event_id: 'ev-5',
      run_id: 'run-1',
      event_type: 'task_completed',
      payload: { step_title: 'Build API' },
      timestamp: '2026-01-01T00:00:00Z',
    });

    // Then end the session
    const result = await manager.onForgeEvent({
      event_id: 'ev-6',
      run_id: 'run-1',
      event_type: 'run_completed',
      payload: {},
      timestamp: '2026-01-01T00:01:00Z',
    });
    expect(result.triggered).toBe(true);
    expect(result.reason).toContain('session end');
  });
});

// ---------------------------------------------------------------------------
// onPlannerEvent
// ---------------------------------------------------------------------------

describe('TriggerManager.onPlannerEvent', () => {
  it('always triggers for planner decisions', async () => {
    const event: PlannerDecisionEvent = {
      event_id: 'pe-1',
      plan_id: 'plan-abc',
      type: 'decision',
      question_text: 'Which framework?',
      selected_option: 'Express',
      timestamp: '2026-01-01T00:00:00Z',
    };
    const result = await manager.onPlannerEvent(event);
    expect(result.triggered).toBe(true);
    expect(result.layer).toBe('deterministic');
    expect(result.factsExtracted).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// onRelayMessage
// ---------------------------------------------------------------------------

describe('TriggerManager.onRelayMessage', () => {
  it('skips system messages', async () => {
    const event: RelayMessageEvent = {
      id: 'msg-1',
      from: '__system__',
      to: '#general',
      kind: 'system',
      body: 'Agent joined',
      ts: Date.now(),
    };
    const result = await manager.onRelayMessage(event);
    expect(result.triggered).toBe(false);
  });

  it('skips short messages (no facts extracted)', async () => {
    const event: RelayMessageEvent = {
      id: 'msg-2',
      from: 'worker-1',
      to: 'lead',
      kind: 'message',
      body: 'ACK', // Too short for fact
      ts: Date.now(),
    };
    // Still extracts person entities from sender/receiver
    const result = await manager.onRelayMessage(event);
    expect(result.triggered).toBe(true);
    expect(result.entitiesExtracted).toBeGreaterThan(0);
  });

  it('extracts from substantive relay messages', async () => {
    const event: RelayMessageEvent = {
      id: 'msg-3',
      from: 'worker-1',
      to: '#planner',
      kind: 'message',
      body: 'I have completed the implementation of the database adapter with full CRUD support and cursor-based pagination',
      ts: Date.now(),
      channel: '#planner',
    };
    const result = await manager.onRelayMessage(event);
    expect(result.triggered).toBe(true);
    expect(result.factsExtracted).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

describe('TriggerManager timer', () => {
  it('starts and stops without error', () => {
    manager.startTimer();
    // Starting again is a no-op
    manager.startTimer();
    manager.shutdown();
  });
});

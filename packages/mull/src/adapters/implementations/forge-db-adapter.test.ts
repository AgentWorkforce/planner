import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ForgeDbAdapter } from './forge-db-adapter.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal schema DDL for the tables the adapter reads from. */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY NOT NULL,
    plan_id TEXT NOT NULL,
    plan_version INTEGER NOT NULL,
    status TEXT NOT NULL,
    has_pending_gate INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    step_title TEXT NOT NULL,
    status TEXT NOT NULL,
    dependencies TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(run_id)
  );

  CREATE TABLE IF NOT EXISTS trajectory_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT NOT NULL,
    task_id TEXT,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(run_id)
  );

  CREATE TABLE IF NOT EXISTS user_trajectory_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    question_text TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    reasoning TEXT,
    run_id TEXT,
    task_id TEXT,
    project_id TEXT,
    category TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    preference_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    project_id TEXT,
    run_id TEXT,
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL,
    evidence_count INTEGER NOT NULL DEFAULT 1,
    last_expressed TEXT NOT NULL,
    is_override INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

const RUN_ID = 'run-001';
const TASK_ID = 'task-001';

function seedTestData(db: Database.Database): void {
  // Create a run
  db.prepare(`
    INSERT INTO runs (run_id, plan_id, plan_version, status, created_at, updated_at)
    VALUES (?, 'plan-001', 1, 'completed', '2026-01-10T10:00:00Z', '2026-01-10T12:00:00Z')
  `).run(RUN_ID);

  // Create a task
  db.prepare(`
    INSERT INTO tasks (task_id, run_id, step_id, step_title, status, created_at, updated_at)
    VALUES (?, ?, 'step-001', 'Test Step', 'completed', '2026-01-10T10:00:00Z', '2026-01-10T11:00:00Z')
  `).run(TASK_ID, RUN_ID);

  // Trajectory events — mix of high-signal and low-signal types
  const events = [
    { id: 'evt-001', type: 'run_started', payload: '{"plan_id":"plan-001","plan_version":1}', ts: '2026-01-10T10:00:00Z' },
    { id: 'evt-002', type: 'agent_spawned', payload: '{"agent_id":"Worker-1","cli":"claude"}', ts: '2026-01-10T10:01:00Z' },
    { id: 'evt-003', type: 'decision_recorded', payload: '{"agent_id":"Worker-1","decision":"Use SQLite","reasoning":"Simpler for single-node","alternatives":["Postgres","Redis"]}', ts: '2026-01-10T10:05:00Z' },
    { id: 'evt-004', type: 'agent_progress', payload: '{"agent_id":"Worker-1","message":"50% done"}', ts: '2026-01-10T10:10:00Z' },
    { id: 'evt-005', type: 'task_completed', payload: '{"step_id":"step-001","step_title":"Test Step","attempt_number":1}', ts: '2026-01-10T10:15:00Z' },
    { id: 'evt-006', type: 'gate_reached', payload: '{"gate_id":"gate-001","step_id":"step-001","step_title":"Test Step"}', ts: '2026-01-10T10:20:00Z' },
    { id: 'evt-007', type: 'gate_approved', payload: '{"gate_id":"gate-001","step_id":"step-001","step_title":"Test Step","approved_by":"user"}', ts: '2026-01-10T10:25:00Z' },
    {
      id: 'evt-008',
      type: 'retrospective_recorded',
      payload: JSON.stringify({
        task_id: TASK_ID,
        agent_id: 'Worker-1',
        retrospective: {
          summary: 'Implemented the adapter successfully',
          approach: 'Read-only SQLite connection with prepared statements',
          decisions: [{ question: 'Which DB driver?', chosen: 'better-sqlite3', reasoning: 'Sync API, fast' }],
          challenges: ['Schema had undocumented columns'],
          learnings: ['Prepared statements are faster than inline SQL'],
          suggestions: ['Add index on event_type'],
          confidence: 0.9,
        },
      }),
      ts: '2026-01-10T10:30:00Z',
    },
    { id: 'evt-009', type: 'budget_warning', payload: '{"warning_level":"75%","tokens_pct_used":75}', ts: '2026-01-10T10:35:00Z' },
    { id: 'evt-010', type: 'task_failed', payload: '{"step_id":"step-002","step_title":"Another Step","attempt_number":1,"error":"Timeout"}', ts: '2026-01-10T10:40:00Z' },
    { id: 'evt-011', type: 'recovery_strategy_selected', payload: '{"task_id":"task-002","attempt_number":2,"strategy":"retry_with_different_model"}', ts: '2026-01-10T10:45:00Z' },
    { id: 'evt-012', type: 'checkpoint_created', payload: '{"checkpoint_id":"cp-001","task_count":2}', ts: '2026-01-10T10:50:00Z' },
  ];

  const insertEvt = db.prepare(`
    INSERT INTO trajectory_events (event_id, run_id, task_id, event_type, payload, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const evt of events) {
    insertEvt.run(evt.id, RUN_ID, TASK_ID, evt.type, evt.payload, evt.ts);
  }

  // Another run for listSessions test
  db.prepare(`
    INSERT INTO runs (run_id, plan_id, plan_version, status, created_at, updated_at)
    VALUES ('run-002', 'plan-002', 1, 'running', '2026-01-11T08:00:00Z', '2026-01-11T09:00:00Z')
  `).run();
  db.prepare(`
    INSERT INTO trajectory_events (event_id, run_id, task_id, event_type, payload, timestamp)
    VALUES ('evt-020', 'run-002', NULL, 'run_started', '{"plan_id":"plan-002","plan_version":1}', '2026-01-11T08:00:00Z')
  `).run();
  db.prepare(`
    INSERT INTO trajectory_events (event_id, run_id, task_id, event_type, payload, timestamp)
    VALUES ('evt-021', 'run-002', NULL, 'agent_spawned', '{"agent_id":"Worker-2","cli":"claude"}', '2026-01-11T09:00:00Z')
  `).run();

  // User trajectory events
  db.prepare(`
    INSERT INTO user_trajectory_events
      (event_id, user_id, scope, question_text, selected_option, reasoning, run_id, task_id, project_id, category, timestamp)
    VALUES
      ('ute-001', 'user-1', 'global', 'Prefer tabs or spaces?', 'spaces', 'Consistency', ?, ?, 'proj-1', 'code_style', '2026-01-10T10:06:00Z'),
      ('ute-002', 'user-1', 'project', 'Use strict mode?', 'yes', NULL, ?, NULL, 'proj-1', 'typescript', '2026-01-10T10:07:00Z'),
      ('ute-003', 'user-2', 'global', 'Dark or light theme?', 'dark', 'Easier on eyes', NULL, NULL, NULL, 'ui', '2026-01-10T10:08:00Z')
  `).run(RUN_ID, TASK_ID, RUN_ID);

  // Derived preferences
  db.prepare(`
    INSERT INTO user_preferences
      (preference_id, user_id, scope, project_id, run_id, category, value, confidence, evidence_count, last_expressed, is_override, created_at, updated_at)
    VALUES
      ('pref-001', 'user-1', 'global', NULL, NULL, 'code_style', 'spaces', 0.95, 5, '2026-01-10T10:06:00Z', 0, '2026-01-09T00:00:00Z', '2026-01-10T10:06:00Z'),
      ('pref-002', 'user-1', 'project', 'proj-1', NULL, 'typescript', 'strict_mode', 0.8, 3, '2026-01-10T10:07:00Z', 0, '2026-01-09T00:00:00Z', '2026-01-10T10:07:00Z'),
      ('pref-003', 'user-1', 'global', NULL, NULL, 'testing', 'vitest', 0.5, 1, '2026-01-09T00:00:00Z', 0, '2026-01-09T00:00:00Z', '2026-01-09T00:00:00Z')
  `).run();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ForgeDbAdapter', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'forge-adapter-test-'));
    dbPath = join(tmpDir, 'forge-test.db');

    // Create and seed the test database
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA_SQL);
    seedTestData(db);
    db.close();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // read()
  // -------------------------------------------------------------------------

  describe('read()', () => {
    it('returns only high-signal events for a run_id', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const entries = await adapter.read(RUN_ID);
        // run_started (low-signal) and agent_progress (low-signal) should be excluded
        // High-signal: agent_spawned, decision_recorded, task_completed, gate_reached,
        //   gate_approved, retrospective_recorded, budget_warning, task_failed,
        //   recovery_strategy_selected, checkpoint_created = 10 events
        expect(entries.length).toBe(10);

        // Verify all entries have correct source
        for (const entry of entries) {
          expect(entry.source).toBe('forge');
        }

        // Verify sorted by timestamp ascending
        for (let i = 1; i < entries.length; i++) {
          expect(entries[i]!.timestamp >= entries[i - 1]!.timestamp).toBe(true);
        }
      } finally {
        adapter.close();
      }
    });

    it('maps decision_recorded to type "decision" with structured content', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const entries = await adapter.read(RUN_ID);
        const decision = entries.find(e => e.type === 'decision');

        expect(decision).toBeDefined();
        expect(decision!.type).toBe('decision');

        const content = decision!.content as Record<string, unknown>;
        expect(content.id).toBe('evt-003');
        expect(content.description).toBe('Use SQLite');
        expect(content.rationale).toBe('Simpler for single-node');
        expect(content.alternatives).toEqual(['Postgres', 'Redis']);
      } finally {
        adapter.close();
      }
    });

    it('maps retrospective_recorded to type "retrospective" with structured causal links', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const entries = await adapter.read(RUN_ID);
        const retro = entries.find(e => e.type === 'retrospective');

        expect(retro).toBeDefined();
        expect(retro!.type).toBe('retrospective');

        // Content should be a JSON string of the structured retrospective object
        const parsed = JSON.parse(retro!.content as string);
        expect(parsed.summary).toBe('Implemented the adapter successfully');
        expect(parsed.approach).toBe('Read-only SQLite connection with prepared statements');

        // Decisions with causal links
        expect(parsed.decisions).toHaveLength(1);
        expect(parsed.decisions[0].question).toBe('Which DB driver?');
        expect(parsed.decisions[0].chosen).toBe('better-sqlite3');
        expect(parsed.decisions[0].reasoning).toBe('Sync API, fast');
        // linkedEventIds may be undefined if no matches found

        // Array fields converted to newline-separated strings
        expect(parsed.challenges).toBe('Schema had undocumented columns');
        expect(parsed.lessonsLearned).toBe('Prepared statements are faster than inline SQL');
        expect(parsed.suggestions).toBe('Add index on event_type');
        expect(parsed.confidence).toBe(0.9);
      } finally {
        adapter.close();
      }
    });

    it('maps other high-signal events with event_type as entry type', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const entries = await adapter.read(RUN_ID);
        const agentSpawned = entries.find(e => e.type === 'agent_spawned');

        expect(agentSpawned).toBeDefined();
        const content = agentSpawned!.content as Record<string, unknown>;
        expect(content.agent_id).toBe('Worker-1');
        expect(content._event_id).toBe('evt-002');
      } finally {
        adapter.close();
      }
    });

    it('supports cursor-based incremental reads', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const cursor = { last_mulled_at: '2026-01-10T10:20:00Z' };
        const entries = await adapter.read(RUN_ID, cursor);

        // Only events after 10:20 should be returned:
        // gate_approved (10:25), retrospective_recorded (10:30),
        // budget_warning (10:35), task_failed (10:40),
        // recovery_strategy_selected (10:45), checkpoint_created (10:50) = 6
        expect(entries.length).toBe(6);
        for (const entry of entries) {
          expect(entry.timestamp > cursor.last_mulled_at).toBe(true);
        }
      } finally {
        adapter.close();
      }
    });

    it('returns empty array for unknown run_id', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const entries = await adapter.read('nonexistent-run');
        expect(entries).toEqual([]);
      } finally {
        adapter.close();
      }
    });
  });

  // -------------------------------------------------------------------------
  // listSessions()
  // -------------------------------------------------------------------------

  describe('listSessions()', () => {
    it('returns all sessions with time ranges', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const sessions = await adapter.listSessions();

        expect(sessions.length).toBe(2);
        // Ordered by started_at DESC
        expect(sessions[0]!.sessionId).toBe('run-002');
        expect(sessions[1]!.sessionId).toBe('run-001');

        // Verify time ranges
        expect(sessions[1]!.startedAt).toBe('2026-01-10T10:00:00Z');
        expect(sessions[1]!.endedAt).toBe('2026-01-10T10:50:00Z');
      } finally {
        adapter.close();
      }
    });

    it('filters by time range (after)', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const sessions = await adapter.listSessions({ after: '2026-01-11T00:00:00Z' });
        // Only run-002 has events after Jan 11
        expect(sessions.length).toBe(1);
        expect(sessions[0]!.sessionId).toBe('run-002');
      } finally {
        adapter.close();
      }
    });

    it('filters by time range (before)', async () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        const sessions = await adapter.listSessions({ before: '2026-01-10T11:00:00Z' });
        // Only run-001 has events before Jan 10 11:00
        expect(sessions.length).toBe(1);
        expect(sessions[0]!.sessionId).toBe('run-001');
      } finally {
        adapter.close();
      }
    });
  });

  // -------------------------------------------------------------------------
  // loadUserTrajectory()
  // -------------------------------------------------------------------------

  describe('loadUserTrajectory()', () => {
    it('returns empty when includeUserTrajectory is false', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includeUserTrajectory: false });
      try {
        const events = await adapter.loadUserTrajectory('user-1');
        expect(events).toEqual([]);
      } finally {
        adapter.close();
      }
    });

    it('returns user trajectory events when enabled', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includeUserTrajectory: true });
      try {
        const events = await adapter.loadUserTrajectory('user-1');
        expect(events.length).toBe(2);
        expect(events[0]!.event_id).toBe('ute-001');
        expect(events[0]!.question_text).toBe('Prefer tabs or spaces?');
        expect(events[0]!.selected_option).toBe('spaces');
        expect(events[0]!.reasoning).toBe('Consistency');
        expect(events[1]!.event_id).toBe('ute-002');
      } finally {
        adapter.close();
      }
    });

    it('filters by user_id', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includeUserTrajectory: true });
      try {
        const events = await adapter.loadUserTrajectory('user-2');
        expect(events.length).toBe(1);
        expect(events[0]!.question_text).toBe('Dark or light theme?');
      } finally {
        adapter.close();
      }
    });

    it('filters by scope when provided', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includeUserTrajectory: true });
      try {
        const globalEvents = await adapter.loadUserTrajectory('user-1', 'global');
        expect(globalEvents.length).toBe(1);
        expect(globalEvents[0]!.event_id).toBe('ute-001');
        expect(globalEvents[0]!.scope).toBe('global');
        expect(globalEvents[0]!.question_text).toBe('Prefer tabs or spaces?');

        const projectEvents = await adapter.loadUserTrajectory('user-1', 'project');
        expect(projectEvents.length).toBe(1);
        expect(projectEvents[0]!.event_id).toBe('ute-002');
        expect(projectEvents[0]!.scope).toBe('project');
        expect(projectEvents[0]!.question_text).toBe('Use strict mode?');
      } finally {
        adapter.close();
      }
    });

    it('returns empty array when no events match scope filter', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includeUserTrajectory: true });
      try {
        const runEvents = await adapter.loadUserTrajectory('user-1', 'run');
        expect(runEvents).toEqual([]);
      } finally {
        adapter.close();
      }
    });

    it('returns all events when scope is not provided', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includeUserTrajectory: true });
      try {
        const allEvents = await adapter.loadUserTrajectory('user-1');
        expect(allEvents.length).toBe(2);
        // Should include both global and project scope events
        expect(allEvents[0]!.scope).toBe('global');
        expect(allEvents[1]!.scope).toBe('project');
      } finally {
        adapter.close();
      }
    });
  });

  // -------------------------------------------------------------------------
  // loadDerivedPreferences()
  // -------------------------------------------------------------------------

  describe('loadDerivedPreferences()', () => {
    it('returns empty when includePreferences is false', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includePreferences: false });
      try {
        const prefs = await adapter.loadDerivedPreferences('user-1');
        expect(prefs).toEqual([]);
      } finally {
        adapter.close();
      }
    });

    it('returns preferences above default confidence threshold (0.7)', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includePreferences: true });
      try {
        const prefs = await adapter.loadDerivedPreferences('user-1');
        // pref-001 (0.95) and pref-002 (0.8) are above 0.7; pref-003 (0.5) is below
        expect(prefs.length).toBe(2);
        // Ordered by confidence DESC
        expect(prefs[0]!.preference_id).toBe('pref-001');
        expect(prefs[0]!.confidence).toBe(0.95);
        expect(prefs[1]!.preference_id).toBe('pref-002');
        expect(prefs[1]!.confidence).toBe(0.8);
      } finally {
        adapter.close();
      }
    });

    it('respects custom minConfidence threshold', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includePreferences: true });
      try {
        const prefs = await adapter.loadDerivedPreferences('user-1', 0.3);
        // All 3 prefs are above 0.3
        expect(prefs.length).toBe(3);
      } finally {
        adapter.close();
      }
    });

    it('returns empty for unknown user', async () => {
      const adapter = new ForgeDbAdapter({ dbPath, includePreferences: true });
      try {
        const prefs = await adapter.loadDerivedPreferences('nonexistent');
        expect(prefs).toEqual([]);
      } finally {
        adapter.close();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Adapter identity
  // -------------------------------------------------------------------------

  describe('adapter identity', () => {
    it('has type "forge"', () => {
      const adapter = new ForgeDbAdapter({ dbPath });
      try {
        expect(adapter.type).toBe('forge');
      } finally {
        adapter.close();
      }
    });
  });
});

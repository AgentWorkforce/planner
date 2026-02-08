import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { emitPlanQualitySignal } from './quality-signal.js';
import { ALL_SCHEMA_STATEMENTS } from '../storage/schema.js';
import { createPlan, createPlanVersion } from '../domain/plan.js';
import type { PlanSource } from '../domain/plan.js';
import { createPlan as storePlan } from '../storage/sqlite/plans.js';
import { createVersion } from '../storage/sqlite/versions.js';
import { createOrganization } from '../domain/organization.js';
import { createOrganization as storeOrganization } from '../storage/sqlite/organizations.js';

// Mock the tuner client
vi.mock('./client.js', () => ({
  getDefaultTunerClient: vi.fn(() => ({
    getStatus: vi.fn(() => 'connected'),
    url: 'http://localhost:3003',
  })),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('emitPlanQualitySignal', () => {
  let db: Database.Database;
  let orgId: string;

  beforeEach(() => {
    db = new Database(':memory:');
    ALL_SCHEMA_STATEMENTS.forEach((sql) => db.exec(sql));

    // Create a test organization (required for foreign key)
    const org = createOrganization('Test Org', 'test-org');
    storeOrganization(db, org);
    orgId = org.org_id;

    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({ ok: true });
  });

  it('should emit signal for ideation-sourced plans', async () => {
    // Create an ideation-sourced plan
    const sessionId = crypto.randomUUID();
    const source: PlanSource = { type: 'ideation', session_id: sessionId };
    const plan = createPlan(orgId, 'user-1', source);
    storePlan(db, plan);

    const version = createPlanVersion(plan.plan_id, 'Test goal');
    createVersion(db, version);

    // Emit quality signal
    await emitPlanQualitySignal(db, {
      plan_id: plan.plan_id,
      version: version.version,
      source: plan.source,
      created_at: plan.created_at,
    });

    // Wait for async emission
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3003/api/tuner/outcomes/plan-quality',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Verify signal structure
    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body).toMatchObject({
      plan_id: plan.plan_id,
      plan_version: version.version,
      session_id: sessionId,
      question_count: 0,
      version_count: 1,
      improvements_made: 0,
      block_count: 0,
      source: 'production',
    });
    expect(body.timestamp).toBeDefined();
    expect(body.time_to_approval_ms).toBeGreaterThanOrEqual(0);
  });

  it('should skip non-ideation plans', async () => {
    // Create a manual plan
    const source: PlanSource = { type: 'manual' };
    const plan = createPlan(orgId, 'user-1', source);
    storePlan(db, plan);

    const version = createPlanVersion(plan.plan_id, 'Test goal');
    createVersion(db, version);

    // Emit quality signal
    await emitPlanQualitySignal(db, {
      plan_id: plan.plan_id,
      version: version.version,
      source: plan.source,
      created_at: plan.created_at,
    });

    // Wait for async emission
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify fetch was NOT called
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should count questions, versions, and improvements correctly', async () => {
    // Create an ideation-sourced plan
    const sessionId = crypto.randomUUID();
    const source: PlanSource = { type: 'ideation', session_id: sessionId };
    const plan = createPlan(orgId, 'user-1', source);
    storePlan(db, plan);

    // Create multiple versions
    const version1 = createPlanVersion(plan.plan_id, 'Test goal v1');
    createVersion(db, version1);

    const version2 = { ...createPlanVersion(plan.plan_id, 'Test goal v2'), version: 2 };
    createVersion(db, version2);

    // Add some questions
    const addQuestion = db.prepare(`
      INSERT INTO questions (question_id, plan_id, agent_id, agent_role, text, blocking_level, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    addQuestion.run(crypto.randomUUID(), plan.plan_id, 'agent-1', 'planner', 'Q1?', 'soft_block', new Date().toISOString(), new Date().toISOString());
    addQuestion.run(crypto.randomUUID(), plan.plan_id, 'agent-2', 'planner', 'Q2?', 'soft_block', new Date().toISOString(), new Date().toISOString());

    // Add some improvements
    const addImprovement = db.prepare(`
      INSERT INTO improvements (improvement_id, plan_id, version, type, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    addImprovement.run(crypto.randomUUID(), plan.plan_id, 1, 'missing_criteria', 'Add AC', new Date().toISOString(), new Date().toISOString());

    // Emit quality signal
    await emitPlanQualitySignal(db, {
      plan_id: plan.plan_id,
      version: version2.version,
      source: plan.source,
      created_at: plan.created_at,
    });

    // Wait for async emission
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify counts
    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.question_count).toBe(2);
    expect(body.version_count).toBe(2);
    expect(body.improvements_made).toBe(1);
  });

  it('should extract block count from understanding', async () => {
    // Create an ideation-sourced plan with understanding
    const sessionId = crypto.randomUUID();
    const source: PlanSource = { type: 'ideation', session_id: sessionId };
    const plan = createPlan(orgId, 'user-1', source);
    storePlan(db, plan);

    const understanding = {
      _blocks: {
        blocks: [
          { id: '1', keyword: 'auth', content: 'Authentication block' },
          { id: '2', keyword: 'db', content: 'Database block' },
        ],
      },
    };

    const version = createPlanVersion(plan.plan_id, 'Test goal', { understanding });
    createVersion(db, version);

    // Emit quality signal
    await emitPlanQualitySignal(db, {
      plan_id: plan.plan_id,
      version: version.version,
      source: plan.source,
      created_at: plan.created_at,
    });

    // Wait for async emission
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify block count
    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.block_count).toBe(2);
  });
});

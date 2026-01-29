import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import { createPlan, createPlanVersion } from '../domain/plan.js';
import { createStep } from '../domain/step.js';

describe('MCP Bridge Integration Tests', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);
  });

  afterEach(() => {
    storage.close();
  });

  describe('POST /api/mcp/tools/list', () => {
    it('should return list of available tools', async () => {
      const response = await request(app)
        .post('/api/mcp/tools/list')
        .expect(200);

      expect(response.body.tools).toBeDefined();
      expect(Array.isArray(response.body.tools)).toBe(true);
      expect(response.body.tools.length).toBeGreaterThan(0);

      // Verify tool structure
      const tool = response.body.tools[0];
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    });

    it('should include all expected tools', async () => {
      const response = await request(app)
        .post('/api/mcp/tools/list')
        .expect(200);

      const toolNames = response.body.tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain('list_plans');
      expect(toolNames).toContain('read_plan');
      expect(toolNames).toContain('create_plan');
      expect(toolNames).toContain('add_step');
      expect(toolNames).toContain('edit_step');
      expect(toolNames).toContain('remove_step');
      expect(toolNames).toContain('set_dependencies');
      expect(toolNames).toContain('add_criteria');
      expect(toolNames).toContain('add_gate');
      expect(toolNames).toContain('submit_plan');
    });
  });

  describe('POST /api/mcp/tools/call', () => {
    it('should call list_plans tool without auth', async () => {
      // Create a plan first
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({ name: 'list_plans', arguments: {} })
        .expect(200);

      expect(response.body.result).toBeDefined();
      expect(response.body.result.success).toBe(true);
      expect(response.body.result.data.plans).toHaveLength(1);
    });

    it('should call create_plan tool', async () => {
      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'create_plan',
          arguments: { goal: 'New plan via MCP' },
        })
        .expect(200);

      expect(response.body.result).toBeDefined();
      expect(response.body.result.success).toBe(true);
      expect(response.body.result.data.plan.plan_id).toBeDefined();
      expect(response.body.result.data.version.summary.goal).toBe('New plan via MCP');
    });

    it('should call read_plan tool', async () => {
      // Create a plan first
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal', 'Test context');
      storage.createVersion(version);

      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'read_plan',
          arguments: { plan_id: plan.plan_id },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
      expect(response.body.result.data.plan.plan_id).toBe(plan.plan_id);
      expect(response.body.result.data.version.summary.goal).toBe('Test goal');
    });

    it('should call add_step tool and persist to database', async () => {
      // Create a plan first
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'add_step',
          arguments: {
            plan_id: plan.plan_id,
            title: 'New step via MCP',
            description: 'Created via HTTP transport',
          },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
      expect(response.body.result.data.step.title).toBe('New step via MCP');

      // Verify step persisted to database
      const latestVersion = storage.getLatestVersion(plan.plan_id);
      expect(latestVersion?.steps).toHaveLength(1);
      expect(latestVersion?.steps?.[0]?.title).toBe('New step via MCP');
    });

    it('should call edit_step tool and persist to database', async () => {
      // Create a plan with a step
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step = createStep('Original title');
      version.steps = [step];
      storage.createVersion(version);

      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'edit_step',
          arguments: {
            plan_id: plan.plan_id,
            step_id: step.step_id,
            title: 'Updated title',
          },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
      expect(response.body.result.data.step.title).toBe('Updated title');

      // Verify change persisted
      const latestVersion = storage.getLatestVersion(plan.plan_id);
      expect(latestVersion?.steps?.[0]?.title).toBe('Updated title');
    });

    it('should call remove_step tool and persist to database', async () => {
      // Create a plan with a step
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step = createStep('Step to remove');
      version.steps = [step];
      storage.createVersion(version);

      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'remove_step',
          arguments: {
            plan_id: plan.plan_id,
            step_id: step.step_id,
          },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);

      // Verify step removed
      const latestVersion = storage.getLatestVersion(plan.plan_id);
      expect(latestVersion?.steps).toHaveLength(0);
    });

    it('should return TOOL_NOT_FOUND for unknown tool', async () => {
      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'unknown_tool',
          arguments: {},
        })
        .expect(404);

      expect(response.body.error).toBe('TOOL_NOT_FOUND');
    });

    it('should return INVALID_REQUEST for missing name', async () => {
      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({ arguments: {} })
        .expect(400);

      expect(response.body.error).toBe('INVALID_REQUEST');
    });
  });

  describe('Session authentication', () => {
    it('should use session plan_id when no plan_id provided in read_plan', async () => {
      // Create a plan and session
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const now = new Date().toISOString();
      const session = {
        session_id: crypto.randomUUID(),
        token: 'test-token-' + crypto.randomUUID(),
        plan_id: plan.plan_id,
        agent_id: 'test-agent',
        status: 'active' as const,
        started_at: now,
        ended_at: null,
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        created_at: now,
      };
      storage.createSession(session);

      // Call read_plan without plan_id but with session token
      const response = await request(app)
        .post('/api/mcp/tools/call')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          name: 'read_plan',
          arguments: {}, // No plan_id - should use session's plan_id
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
      expect(response.body.result.data.plan.plan_id).toBe(plan.plan_id);
    });

    it('should reject access to other plans when authenticated', async () => {
      // Create two plans
      const plan1 = createPlan();
      storage.createPlan(plan1);
      storage.createVersion(createPlanVersion(plan1.plan_id, 'Plan 1'));

      const plan2 = createPlan();
      storage.createPlan(plan2);
      storage.createVersion(createPlanVersion(plan2.plan_id, 'Plan 2'));

      // Create session for plan1
      const now = new Date().toISOString();
      const session = {
        session_id: crypto.randomUUID(),
        token: 'test-token-' + crypto.randomUUID(),
        plan_id: plan1.plan_id,
        agent_id: 'test-agent',
        status: 'active' as const,
        started_at: now,
        ended_at: null,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        created_at: now,
      };
      storage.createSession(session);

      // Try to access plan2 with plan1's session token
      const response = await request(app)
        .post('/api/mcp/tools/call')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          name: 'add_step',
          arguments: {
            plan_id: plan2.plan_id, // Different plan
            title: 'Should not be allowed',
          },
        })
        .expect(403);

      expect(response.body.error).toBe('ACCESS_DENIED');
    });

    it('should work without auth for backward compatibility', async () => {
      // Create a plan
      const plan = createPlan();
      storage.createPlan(plan);
      storage.createVersion(createPlanVersion(plan.plan_id, 'Test goal'));

      // Call without auth header
      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'read_plan',
          arguments: { plan_id: plan.plan_id },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
    });

    it('should ignore expired tokens', async () => {
      // Create a plan
      const plan = createPlan();
      storage.createPlan(plan);
      storage.createVersion(createPlanVersion(plan.plan_id, 'Test goal'));

      // Create expired session
      const now = new Date().toISOString();
      const session = {
        session_id: crypto.randomUUID(),
        token: 'expired-token-' + crypto.randomUUID(),
        plan_id: plan.plan_id,
        agent_id: 'test-agent',
        status: 'active' as const,
        started_at: now,
        ended_at: null,
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        created_at: now,
      };
      storage.createSession(session);

      // Call with expired token - should work but without session context
      // (need to provide plan_id since session is expired)
      const response = await request(app)
        .post('/api/mcp/tools/call')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          name: 'read_plan',
          arguments: { plan_id: plan.plan_id },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
    });
  });

  describe('Optimistic locking via HTTP', () => {
    it('should succeed with correct expected_version', async () => {
      // Create a plan
      const plan = createPlan();
      storage.createPlan(plan);
      storage.createVersion(createPlanVersion(plan.plan_id, 'Test goal'));

      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'add_step',
          arguments: {
            plan_id: plan.plan_id,
            title: 'New step',
            expected_version: 1,
          },
        })
        .expect(200);

      expect(response.body.result.success).toBe(true);
    });

    it('should return VERSION_CONFLICT with stale version', async () => {
      // Create a plan
      const plan = createPlan();
      storage.createPlan(plan);
      storage.createVersion(createPlanVersion(plan.plan_id, 'Test goal'));

      const response = await request(app)
        .post('/api/mcp/tools/call')
        .send({
          name: 'add_step',
          arguments: {
            plan_id: plan.plan_id,
            title: 'New step',
            expected_version: 0, // Stale version
          },
        })
        .expect(200); // Tool call succeeds, but result contains error

      expect(response.body.result.success).toBe(false);
      expect(response.body.result.error).toBe('VERSION_CONFLICT');
      expect(response.body.result.expected_version).toBe(0);
      expect(response.body.result.current_version).toBe(1);
    });
  });
});

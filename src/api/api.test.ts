import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import { PlanStatus } from '../domain/status.js';

describe('API Integration Tests', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:', { skipSeed: true });
    app = createApp(storage);
  });

  afterEach(() => {
    storage.close();
  });

  describe('POST /api/plans', () => {
    it('should create a new plan with draft version', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal', context: 'Test context' })
        .expect(201);

      expect(response.body.plan).toBeDefined();
      expect(response.body.plan.plan_id).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.version.version).toBe(1);
      expect(response.body.version.status).toBe('draft');
      expect(response.body.version.summary.goal).toBe('Test goal');
      expect(response.body.version.summary.context).toBe('Test context');
    });

    it('should create plan with goal only', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      expect(response.body.version.summary.goal).toBe('Test goal');
      expect(response.body.version.summary.context).toBeUndefined();
    });

    it('should return 400 for missing goal', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for empty goal', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({ goal: '' })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/plans', () => {
    it('should return empty array when no plans exist', async () => {
      const response = await request(app).get('/api/plans').expect(200);

      expect(response.body.plans).toEqual([]);
    });

    it('should return all plans', async () => {
      await request(app).post('/api/plans').send({ goal: 'Plan 1' });
      await request(app).post('/api/plans').send({ goal: 'Plan 2' });

      const response = await request(app).get('/api/plans').expect(200);

      expect(response.body.plans).toHaveLength(2);
    });

    it('should filter plans by status', async () => {
      // Create two plans
      const plan1Response = await request(app)
        .post('/api/plans')
        .send({ goal: 'Plan 1' });
      await request(app).post('/api/plans').send({ goal: 'Plan 2' });

      // Approve first plan
      const planId = plan1Response.body.plan.plan_id;
      storage.updateVersionStatus(planId, 1, PlanStatus.Approved);

      // Filter by draft
      const draftResponse = await request(app)
        .get('/api/plans?status=draft')
        .expect(200);
      expect(draftResponse.body.plans).toHaveLength(1);

      // Filter by approved
      const approvedResponse = await request(app)
        .get('/api/plans?status=approved')
        .expect(200);
      expect(approvedResponse.body.plans).toHaveLength(1);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should return plan with latest version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200);

      expect(response.body.plan.plan_id).toBe(planId);
      expect(response.body.version.version).toBe(1);
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });
  });

  describe('PUT /api/plans/:id', () => {
    it('should update draft version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Original goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .put(`/api/plans/${planId}`)
        .send({ goal: 'Updated goal', context: 'New context' })
        .expect(200);

      expect(response.body.version.version).toBe(2); // New version created
      expect(response.body.version.summary.goal).toBe('Updated goal');
      expect(response.body.version.summary.context).toBe('New context');
    });

    it('should return 400 for approved version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;
      storage.updateVersionStatus(planId, 1, PlanStatus.Approved);

      const response = await request(app)
        .put(`/api/plans/${planId}`)
        .send({ goal: 'Updated goal' })
        .expect(400);

      expect(response.body.error).toBe('Cannot update approved or published version');
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .put('/api/plans/non-existent-id')
        .send({ goal: 'Updated goal' })
        .expect(404);
    });
  });

  describe('GET /api/plans/:id/versions', () => {
    it('should list all versions', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      // Create another version
      await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({ goal: 'Version 2' });

      const response = await request(app)
        .get(`/api/plans/${planId}/versions`)
        .expect(200);

      expect(response.body.versions).toHaveLength(2);
      expect(response.body.versions[0]!.version).toBe(1);
      expect(response.body.versions[1]!.version).toBe(2);
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .get('/api/plans/non-existent-id/versions')
        .expect(404);
    });
  });

  describe('GET /api/plans/:id/versions/:version', () => {
    it('should return specific version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .get(`/api/plans/${planId}/versions/1`)
        .expect(200);

      expect(response.body.version.version).toBe(1);
    });

    it('should return 404 for non-existent version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .get(`/api/plans/${planId}/versions/999`)
        .expect(404);
    });

    it('should return 400 for invalid version number', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .get(`/api/plans/${planId}/versions/invalid`)
        .expect(400);

      expect(response.body.error).toBe('Invalid version number');
    });
  });

  describe('POST /api/plans/:id/versions', () => {
    it('should create new version from latest', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Original goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({ goal: 'New version goal' })
        .expect(201);

      expect(response.body.version.version).toBe(2);
      expect(response.body.version.summary.goal).toBe('New version goal');
    });

    it('should preserve existing values when not provided', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Original goal', context: 'Original context' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({})
        .expect(201);

      expect(response.body.version.summary.goal).toBe('Original goal');
      expect(response.body.version.summary.context).toBe('Original context');
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .post('/api/plans/non-existent-id/versions')
        .send({})
        .expect(404);
    });
  });

  describe('Error handling', () => {
    it('should return JSON error for invalid JSON body', async () => {
      const response = await request(app)
        .post('/api/plans')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('PATCH /api/plans/:id/understanding/:role', () => {
    it('should add observations for new role', async () => {
      // Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Update understanding
      const updateResponse = await request(app)
        .patch(`/api/plans/${planId}/understanding/architect`)
        .send({
          observations: ['Found a pattern'],
          keywords: ['auth', 'security'],
          confidence: 'forming',
        })
        .expect(200);

      expect(updateResponse.body.role).toBe('architect');
      expect(updateResponse.body.observations.observations).toEqual(['Found a pattern']);
      expect(updateResponse.body.observations.keywords).toEqual(['auth', 'security']);
      expect(updateResponse.body.observations.confidence).toBe('forming');
    });

    it('should merge with existing role observations', async () => {
      // Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // First update
      await request(app)
        .patch(`/api/plans/${planId}/understanding/architect`)
        .send({
          observations: ['First observation'],
          keywords: ['keyword1'],
        })
        .expect(200);

      // Second update - should merge
      const updateResponse = await request(app)
        .patch(`/api/plans/${planId}/understanding/architect`)
        .send({
          observations: ['Second observation'],
          keywords: ['keyword2'],
        })
        .expect(200);

      expect(updateResponse.body.observations.observations).toContain('First observation');
      expect(updateResponse.body.observations.observations).toContain('Second observation');
      expect(updateResponse.body.observations.keywords).toContain('keyword1');
      expect(updateResponse.body.observations.keywords).toContain('keyword2');
    });

    it('should return 400 for invalid data', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .patch(`/api/plans/${planId}/understanding/architect`)
        .send({
          confidence: 'invalid-level', // Invalid enum value
        })
        .expect(400);
    });

    it('should return 400 for non-draft plan', async () => {
      // Create, submit, and approve plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Submit first
      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`)
        .expect(200);

      // Then approve the plan
      await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'test-user' })
        .expect(200);

      // Try to update understanding on approved plan
      await request(app)
        .patch(`/api/plans/${planId}/understanding/architect`)
        .send({ observations: ['Should fail'] })
        .expect(400);
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .patch('/api/plans/non-existent-id/understanding/architect')
        .send({ observations: ['Test'] })
        .expect(404);
    });
  });

  describe('PATCH /api/plans/:id/steps/:stepId/specification/:domain', () => {
    it('should add specification to step', async () => {
      // Create plan with a step
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Add steps via PUT
      const stepId = crypto.randomUUID();
      await request(app)
        .put(`/api/plans/${planId}`)
        .send({
          steps: [{ step_id: stepId, title: 'Test step', dependencies: [] }],
        })
        .expect(200);

      // Update specification
      const updateResponse = await request(app)
        .patch(`/api/plans/${planId}/steps/${stepId}/specification/architecture`)
        .send({
          decisions: [
            {
              decision_id: 'd001',
              decision: 'Use PostgreSQL',
              rationale: 'Better for relational data',
            },
          ],
        })
        .expect(200);

      expect(updateResponse.body.step_id).toBe(stepId);
      expect(updateResponse.body.domain).toBe('architecture');
      expect(updateResponse.body.specification.decisions).toHaveLength(1);
      expect(updateResponse.body.specification.decisions[0].decision_id).toBe('d001');
    });

    it('should merge with existing specification', async () => {
      // Create plan with a step
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Add steps via PUT
      const stepId = crypto.randomUUID();
      await request(app)
        .put(`/api/plans/${planId}`)
        .send({
          steps: [{ step_id: stepId, title: 'Test step', dependencies: [] }],
        })
        .expect(200);

      // First update
      await request(app)
        .patch(`/api/plans/${planId}/steps/${stepId}/specification/testing`)
        .send({
          test_cases: [{ case_id: 't1', type: 'happy', priority: 'high', description: 'Test 1' }],
        })
        .expect(200);

      // Second update - should merge
      const updateResponse = await request(app)
        .patch(`/api/plans/${planId}/steps/${stepId}/specification/testing`)
        .send({
          test_cases: [{ case_id: 't2', type: 'edge', priority: 'medium', description: 'Test 2' }],
          coverage_notes: '80% target',
        })
        .expect(200);

      expect(updateResponse.body.specification.test_cases).toHaveLength(2);
      expect(updateResponse.body.specification.coverage_notes).toBe('80% target');
    });

    it('should accept custom domains (freeform)', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;
      const stepId = crypto.randomUUID();

      await request(app)
        .put(`/api/plans/${planId}`)
        .send({
          steps: [{ step_id: stepId, title: 'Test step', dependencies: [] }],
        })
        .expect(200);

      // Freeform specification accepts any domain name
      const response = await request(app)
        .patch(`/api/plans/${planId}/steps/${stepId}/specification/custom-domain`)
        .send({ custom_field: 'custom value', another_field: ['item1', 'item2'] })
        .expect(200);

      expect(response.body.specification.custom_field).toBe('custom value');
      expect(response.body.specification.another_field).toEqual(['item1', 'item2']);
    });

    it('should return 404 for unknown step_id', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .patch(`/api/plans/${planId}/steps/non-existent-step/specification/architecture`)
        .send({ decisions: [] })
        .expect(404);
    });
  });

  describe('GET /api/plans/:id (with understanding and specification)', () => {
    it('should return understanding and step specifications', async () => {
      // Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Add step first (this creates new versions as needed)
      const stepId = crypto.randomUUID();
      await request(app)
        .put(`/api/plans/${planId}`)
        .send({
          steps: [{ step_id: stepId, title: 'Test step', dependencies: [] }],
        })
        .expect(200);

      // Then add understanding (operates on the latest version)
      await request(app)
        .patch(`/api/plans/${planId}/understanding/architect`)
        .send({ observations: ['Test observation'] })
        .expect(200);

      // And add specification to the step
      await request(app)
        .patch(`/api/plans/${planId}/steps/${stepId}/specification/design`)
        .send({ components: [{ component_id: 'c1', name: 'Button' }] })
        .expect(200);

      // Get plan and verify
      const getResponse = await request(app).get(`/api/plans/${planId}`).expect(200);

      expect(getResponse.body.version.understanding?.architect?.observations).toEqual(
        expect.arrayContaining(['Test observation'])
      );
      const step = getResponse.body.version.steps.find(
        (s: { step_id: string }) => s.step_id === stepId
      );
      expect(step?.specification?.design?.components?.[0]?.name).toBe('Button');
    });
  });

  describe('PATCH /api/plans/:id/context/:role', () => {
    it('should add context for designer role', async () => {
      // Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Update context
      const updateResponse = await request(app)
        .patch(`/api/plans/${planId}/context/designer`)
        .send({
          library: 'shadcn/ui',
          theme: 'Dark mode with blue accents',
          typography: 'Inter for body, JetBrains Mono for code',
        })
        .expect(200);

      expect(updateResponse.body.role).toBe('designer');
      expect(updateResponse.body.context.library).toBe('shadcn/ui');
      expect(updateResponse.body.context.theme).toBe('Dark mode with blue accents');
      expect(updateResponse.body.context.typography).toBe('Inter for body, JetBrains Mono for code');
    });

    it('should add context for architect role with boundaries', async () => {
      // Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Update context
      const updateResponse = await request(app)
        .patch(`/api/plans/${planId}/context/architect`)
        .send({
          tech_stack: 'TypeScript, Express, SQLite',
          api_style: 'REST with Zod validation',
          boundaries: {
            planner: 'Plan authoring & versioning',
            orchestrator: 'Plan execution engine',
          },
        })
        .expect(200);

      expect(updateResponse.body.role).toBe('architect');
      expect(updateResponse.body.context.tech_stack).toBe('TypeScript, Express, SQLite');
      expect(updateResponse.body.context.api_style).toBe('REST with Zod validation');
      expect(updateResponse.body.context.boundaries).toEqual({
        planner: 'Plan authoring & versioning',
        orchestrator: 'Plan execution engine',
      });
    });

    it('should merge with existing role context', async () => {
      // Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // First update
      await request(app)
        .patch(`/api/plans/${planId}/context/designer`)
        .send({
          library: 'shadcn/ui',
          theme: 'Dark mode',
        })
        .expect(200);

      // Second update - should merge
      const updateResponse = await request(app)
        .patch(`/api/plans/${planId}/context/designer`)
        .send({
          theme: 'Dark mode with blue accents', // Update existing field
          typography: 'Inter', // Add new field
        })
        .expect(200);

      expect(updateResponse.body.context.library).toBe('shadcn/ui'); // Preserved
      expect(updateResponse.body.context.theme).toBe('Dark mode with blue accents'); // Updated
      expect(updateResponse.body.context.typography).toBe('Inter'); // Added
    });

    it('should return 400 for approved plan', async () => {
      // Create, submit, and approve plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Submit first
      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`)
        .expect(200);

      // Then approve the plan
      await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'test-user' })
        .expect(200);

      // Try to update context on approved plan
      await request(app)
        .patch(`/api/plans/${planId}/context/designer`)
        .send({ library: 'Should fail' })
        .expect(400);
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .patch('/api/plans/non-existent-id/context/designer')
        .send({ library: 'Test' })
        .expect(404);
    });

    it('should delete role context when sending empty object', async () => {
      // Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Add context for designer
      await request(app)
        .patch(`/api/plans/${planId}/context/designer`)
        .send({ library: 'shadcn/ui', theme: 'Dark mode' })
        .expect(200);

      // Verify designer context exists
      const beforeResponse = await request(app).get(`/api/plans/${planId}`).expect(200);
      expect(beforeResponse.body.version.context.designer).toBeDefined();

      // Delete designer context by sending empty object
      const deleteResponse = await request(app)
        .patch(`/api/plans/${planId}/context/designer`)
        .send({})
        .expect(200);

      expect(deleteResponse.body.role).toBe('designer');
      expect(deleteResponse.body.context).toEqual({});

      // Verify designer role is removed from plan
      const afterResponse = await request(app).get(`/api/plans/${planId}`).expect(200);
      expect(afterResponse.body.version.context.designer).toBeUndefined();
    });
  });

  describe('GET /api/plans/:id (with context)', () => {
    it('should return context when present in the plan version', async () => {
      // Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      const planId = createResponse.body.plan.plan_id;

      // Add context for multiple roles
      await request(app)
        .patch(`/api/plans/${planId}/context/designer`)
        .send({ library: 'shadcn/ui', theme: 'Dark mode' })
        .expect(200);

      await request(app)
        .patch(`/api/plans/${planId}/context/architect`)
        .send({ tech_stack: 'TypeScript, Express, SQLite' })
        .expect(200);

      // Get plan and verify context is returned
      const getResponse = await request(app).get(`/api/plans/${planId}`).expect(200);

      expect(getResponse.body.version.context).toBeDefined();
      expect(getResponse.body.version.context.designer).toEqual({
        library: 'shadcn/ui',
        theme: 'Dark mode',
      });
      expect(getResponse.body.version.context.architect).toEqual({
        tech_stack: 'TypeScript, Express, SQLite',
      });
    });
  });
});

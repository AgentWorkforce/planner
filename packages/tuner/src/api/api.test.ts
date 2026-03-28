/**
 * API Integration Tests
 *
 * Tests for all Tuner API endpoints using supertest.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTunerServices } from '../services/factory.js';
import { createOutcomeHandlers } from './handlers/outcomes.js';
import { createConfigHandlers } from './handlers/config.js';
import { createInsightsHandlers } from './handlers/insights.js';

describe('Tuner API Integration Tests', () => {
  let app: express.Application;
  let services: ReturnType<typeof createTunerServices>;

  beforeAll(() => {
    // Create in-memory services
    services = createTunerServices(':memory:');

    // Create handlers
    const outcomeHandlers = createOutcomeHandlers(services);
    const configHandlers = createConfigHandlers(services);
    const insightsHandlers = createInsightsHandlers(services);

    // Create Express app
    app = express();
    app.use(express.json());

    // Mount routes
    app.post('/api/tuner/outcomes/task', outcomeHandlers.recordTaskOutcome);
    app.post('/api/tuner/outcomes/run', outcomeHandlers.recordRunOutcome);
    app.get('/api/tuner/config/forge', configHandlers.getForgeConfig);
    app.get('/api/tuner/config/planner', configHandlers.getPlannerConfig);
    app.get('/api/tuner/config/version', configHandlers.getConfigVersion);
    app.get('/api/tuner/insights/baselines', insightsHandlers.getTaskBaselines);
    app.get('/api/tuner/insights/drift-alerts', insightsHandlers.getDriftAlerts);
    app.post('/api/tuner/insights/drift-alerts/:id/ack', insightsHandlers.acknowledgeDriftAlert);
    app.get('/api/tuner/insights/models', insightsHandlers.getModelPerformance);

    // Health check
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  });

  afterAll(() => {
    // Cleanup
    services.storage.close();
  });

  describe('Health Check', () => {
    it('GET /api/health returns ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('Outcome Endpoints', () => {
    it('POST /api/tuner/outcomes/task accepts valid outcome', async () => {
      const outcome = {
        run_id: 'run-123',
        task_id: 'task-456',
        step_id: 'step-impl',
        model_used: 'claude-sonnet',
        complexity_estimate: 'moderate',
        outcome: 'success',
        attempts: 1,
        duration_seconds: 120,
        tokens_used: 5000,
        cost_usd: 0.015,
        timestamp: new Date().toISOString(),
      };

      const res = await request(app)
        .post('/api/tuner/outcomes/task')
        .send(outcome);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.id).toBe('task-456');
    });

    it('POST /api/tuner/outcomes/task rejects invalid outcome', async () => {
      const invalidOutcome = {
        run_id: 'run-123',
        // Missing required fields
      };

      const res = await request(app)
        .post('/api/tuner/outcomes/task')
        .send(invalidOutcome);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid task outcome');
      expect(res.body.details).toBeDefined();
    });

    it('POST /api/tuner/outcomes/run accepts valid run outcome', async () => {
      const runOutcome = {
        run_id: 'run-789',
        plan_id: 'plan-001',
        outcome: 'completed',
        tasks_total: 5,
        tasks_succeeded: 5,
        tasks_failed: 0,
        total_duration_seconds: 600,
        total_tokens: 50000,
        total_cost_usd: 0.10,
        replan_count: 0,
        escalation_count: 0,
        timestamp: new Date().toISOString(),
      };

      const res = await request(app)
        .post('/api/tuner/outcomes/run')
        .send(runOutcome);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.id).toBe('run-789');
    });
  });

  describe('Config Endpoints', () => {
    it('GET /api/tuner/config/forge returns forge config', async () => {
      const res = await request(app).get('/api/tuner/config/forge');

      expect(res.status).toBe(200);
      expect(res.body.model_selection).toBeDefined();
      expect(res.body.model_selection.default_model).toBeDefined();
      expect(res.body.budgets).toBeDefined();
      expect(res.body.retry).toBeDefined();
    });

    it('GET /api/tuner/config/planner returns planner config', async () => {
      const res = await request(app).get('/api/tuner/config/planner');

      expect(res.status).toBe(200);
      expect(res.body.complexity_weights).toBeDefined();
      expect(res.body.language_complexity_multipliers).toBeDefined();
    });

    it('GET /api/tuner/config/version returns version info', async () => {
      const res = await request(app).get('/api/tuner/config/version');

      expect(res.status).toBe(200);
      expect(res.body.forge_version).toBeDefined();
      expect(res.body.planner_version).toBeDefined();
    });
  });

  describe('Insights Endpoints', () => {
    it('GET /api/tuner/insights/baselines returns baselines list', async () => {
      const res = await request(app).get('/api/tuner/insights/baselines');

      expect(res.status).toBe(200);
      // Handler returns array directly
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/tuner/insights/drift-alerts returns alerts list', async () => {
      const res = await request(app).get('/api/tuner/insights/drift-alerts');

      expect(res.status).toBe(200);
      // Handler returns array directly
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/tuner/insights/models returns model baselines', async () => {
      const res = await request(app).get('/api/tuner/insights/models');

      expect(res.status).toBe(200);
      // Handler returns array directly
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/tuner/insights/drift-alerts/:id/ack returns 400 without acknowledged_by', async () => {
      const res = await request(app)
        .post('/api/tuner/insights/drift-alerts/unknown-id/ack')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('acknowledged_by is required');
    });

    it('POST /api/tuner/insights/drift-alerts/:id/ack returns 404 for unknown alert', async () => {
      const res = await request(app)
        .post('/api/tuner/insights/drift-alerts/unknown-id/ack')
        .send({ acknowledged_by: 'test-user' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Alert not found or already acknowledged');
    });
  });

  describe('Outcome → Baseline Integration', () => {
    it('recording outcomes creates baselines', async () => {
      // Record a task outcome
      const outcome = {
        run_id: 'run-int-1',
        task_id: 'task-int-1',
        step_id: 'step-implementation',
        model_used: 'claude-sonnet',
        complexity_estimate: 'simple',
        language_tier: 'A',
        outcome: 'success',
        attempts: 1,
        duration_seconds: 60,
        tokens_used: 2000,
        cost_usd: 0.006,
        timestamp: new Date().toISOString(),
      };

      await request(app).post('/api/tuner/outcomes/task').send(outcome);

      // Check baseline was created
      const res = await request(app).get('/api/tuner/insights/baselines');

      expect(res.body.length).toBeGreaterThan(0);

      // Find our baseline
      const baseline = res.body.find(
        (b: { pattern: string }) => b.pattern === 'implementation:simple:A'
      );
      expect(baseline).toBeDefined();
      expect(baseline.sample_count).toBeGreaterThanOrEqual(1);
    });
  });
});

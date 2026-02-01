/**
 * SSE Events Endpoint Tests
 *
 * Integration tests for the plan events SSE endpoint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import { emitPlanChange } from '../events/plan-events.js';
import { createPlan, createPlanVersion } from '../domain/plan.js';
import { createOrganization } from '../domain/organization.js';

describe('GET /plans/:id/events', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;
  let planId: string;
  let testOrgId: string;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);

    // Get default org created by migrations, or create a test org
    const orgs = storage.listOrganizations();
    if (orgs.length > 0) {
      testOrgId = orgs[0]!.org_id;
    } else {
      const org = createOrganization('Test Org', 'test-org');
      storage.createOrganization(org);
      testOrgId = org.org_id;
    }

    // Create a test plan
    const plan = createPlan(testOrgId);
    storage.createPlan(plan);
    const version = createPlanVersion(plan.plan_id, 'Test Plan for SSE');
    storage.createVersion(version);
    planId = plan.plan_id;
  });

  afterEach(() => {
    storage.close();
  });

  it('returns 404 for non-existent plan', async () => {
    const response = await request(app)
      .get('/api/plans/nonexistent-plan/events')
      .expect(404);

    expect(response.body.error).toBe('Plan not found');
  });

  it('sets correct SSE headers', (done) => {
    const req = request(app)
      .get(`/api/plans/${planId}/events`)
      .set('Accept', 'text/event-stream');

    req.buffer(false);
    req.parse((res, callback) => {
      // Check headers immediately when response starts
      expect(res.headers['content-type']).toBe('text/event-stream');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['connection']).toBe('keep-alive');

      res.on('data', () => {
        // Close as soon as we get any data
        res.destroy();
        callback(null, '');
      });
      res.on('error', callback);
    });

    req.end((err) => {
      if (err && !err.message.includes('aborted') && !err.message.includes('socket hang up')) {
        done(err);
        return;
      }
      done();
    });
  });

  it('sends initial connection comment', (done) => {
    const req = request(app)
      .get(`/api/plans/${planId}/events`)
      .set('Accept', 'text/event-stream');

    let buffer = '';
    req.buffer(false);
    req.parse((res, callback) => {
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        // Check for connection comment
        if (buffer.includes(':connected')) {
          res.destroy();
          callback(null, buffer);
        }
      });
      res.on('error', callback);
    });

    req.end((err, res) => {
      if (err && !err.message.includes('aborted')) {
        done(err);
        return;
      }
      expect(buffer).toContain(':connected');
      done();
    });
  });

  it('streams plan_change events to connected clients', (done) => {
    const req = request(app)
      .get(`/api/plans/${planId}/events`)
      .set('Accept', 'text/event-stream');

    let buffer = '';
    let receivedEvent = false;

    req.buffer(false);
    req.parse((res, callback) => {
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();

        // After connection is established, emit a plan change
        if (buffer.includes(':connected') && !receivedEvent) {
          receivedEvent = true;
          // Emit event after small delay
          setTimeout(() => {
            emitPlanChange(planId, 2, 'step_added', 'step-123');
          }, 50);
        }

        // Check for plan_change event
        if (buffer.includes('event: plan_change')) {
          res.destroy();
          callback(null, buffer);
        }
      });
      res.on('error', callback);
    });

    req.end((err) => {
      if (err && !err.message.includes('aborted') && !err.message.includes('socket hang up')) {
        done(err);
        return;
      }
      expect(buffer).toContain('event: plan_change');
      expect(buffer).toContain('"changeType":"step_added"');
      expect(buffer).toContain('"stepId":"step-123"');
      expect(buffer).toContain('"version":2');
      done();
    });
  });

  it('only sends events for subscribed plan', (done) => {
    // Create another plan
    const otherPlanData = createPlan(testOrgId);
    storage.createPlan(otherPlanData);
    const otherVersion = createPlanVersion(otherPlanData.plan_id, 'Other Plan');
    storage.createVersion(otherVersion);
    const otherPlan = { plan_id: otherPlanData.plan_id };

    const req = request(app)
      .get(`/api/plans/${planId}/events`)
      .set('Accept', 'text/event-stream');

    let buffer = '';
    let eventEmitted = false;

    req.buffer(false);
    req.parse((res, callback) => {
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();

        // After connection, emit event for OTHER plan
        if (buffer.includes(':connected') && !eventEmitted) {
          eventEmitted = true;
          // Emit to other plan - this should NOT be received
          emitPlanChange(otherPlan.plan_id, 2, 'step_added', 'step-xyz');

          // Then emit to our plan - this SHOULD be received
          setTimeout(() => {
            emitPlanChange(planId, 3, 'step_edited', 'step-abc');
          }, 100);
        }

        if (buffer.includes('event: plan_change')) {
          res.destroy();
          callback(null, buffer);
        }
      });
      res.on('error', callback);
    });

    req.end((err) => {
      if (err && !err.message.includes('aborted') && !err.message.includes('socket hang up')) {
        done(err);
        return;
      }
      // Should only have received event for our plan
      expect(buffer).toContain('"stepId":"step-abc"');
      expect(buffer).not.toContain('"stepId":"step-xyz"');
      done();
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  PlanSchema,
  PlanVersionSchema,
  createPlan,
  createPlanVersion,
} from './plan.js';
import { PlanStatus, PlanStatusSchema } from './status.js';
import { SummarySchema } from './summary.js';

describe('PlanStatus', () => {
  it('should validate draft status', () => {
    expect(PlanStatusSchema.parse('draft')).toBe('draft');
  });

  it('should validate approved status', () => {
    expect(PlanStatusSchema.parse('approved')).toBe('approved');
  });

  it('should validate published status', () => {
    expect(PlanStatusSchema.parse('published')).toBe('published');
  });

  it('should reject invalid status', () => {
    expect(() => PlanStatusSchema.parse('invalid')).toThrow();
  });
});

describe('Summary', () => {
  it('should validate summary with goal only', () => {
    const result = SummarySchema.parse({ goal: 'Test goal' });
    expect(result.goal).toBe('Test goal');
    expect(result.context).toBeUndefined();
  });

  it('should validate summary with goal and context', () => {
    const result = SummarySchema.parse({
      goal: 'Test goal',
      context: 'Test context',
    });
    expect(result.goal).toBe('Test goal');
    expect(result.context).toBe('Test context');
  });

  it('should reject empty goal', () => {
    expect(() => SummarySchema.parse({ goal: '' })).toThrow();
  });

  it('should reject missing goal', () => {
    expect(() => SummarySchema.parse({})).toThrow();
  });
});

describe('Plan', () => {
  const testOrgId = '123e4567-e89b-12d3-a456-426614174001';

  it('should validate a valid plan', () => {
    const plan = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      org_id: testOrgId,
      created_at: '2026-01-28T12:00:00.000Z',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    const result = PlanSchema.parse(plan);
    expect(result.plan_id).toBe(plan.plan_id);
    expect(result.org_id).toBe(testOrgId);
  });

  it('should reject invalid UUID', () => {
    const plan = {
      plan_id: 'not-a-uuid',
      org_id: testOrgId,
      created_at: '2026-01-28T12:00:00.000Z',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    expect(() => PlanSchema.parse(plan)).toThrow();
  });

  it('should reject invalid datetime', () => {
    const plan = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      org_id: testOrgId,
      created_at: 'not-a-date',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    expect(() => PlanSchema.parse(plan)).toThrow();
  });

  it('should reject missing org_id', () => {
    const plan = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      created_at: '2026-01-28T12:00:00.000Z',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    expect(() => PlanSchema.parse(plan)).toThrow();
  });

  it('should accept optional initiative_id', () => {
    const plan = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      org_id: testOrgId,
      initiative_id: '123e4567-e89b-12d3-a456-426614174002',
      created_at: '2026-01-28T12:00:00.000Z',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    const result = PlanSchema.parse(plan);
    expect(result.initiative_id).toBe('123e4567-e89b-12d3-a456-426614174002');
  });

  it('should accept optional owner_user_id', () => {
    const plan = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      org_id: testOrgId,
      owner_user_id: 'user-123',
      created_at: '2026-01-28T12:00:00.000Z',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    const result = PlanSchema.parse(plan);
    expect(result.owner_user_id).toBe('user-123');
  });
});

describe('PlanVersion', () => {
  it('should validate a valid plan version', () => {
    const version = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      version: 1,
      status: 'draft',
      summary: { goal: 'Test goal' },
      steps: [],
      created_at: '2026-01-28T12:00:00.000Z',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    const result = PlanVersionSchema.parse(version);
    expect(result.version).toBe(1);
    expect(result.status).toBe('draft');
  });

  it('should reject version 0', () => {
    const version = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      version: 0,
      status: 'draft',
      summary: { goal: 'Test goal' },
      steps: [],
      created_at: '2026-01-28T12:00:00.000Z',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    expect(() => PlanVersionSchema.parse(version)).toThrow();
  });

  it('should reject negative version', () => {
    const version = {
      plan_id: '123e4567-e89b-12d3-a456-426614174000',
      version: -1,
      status: 'draft',
      summary: { goal: 'Test goal' },
      steps: [],
      created_at: '2026-01-28T12:00:00.000Z',
      updated_at: '2026-01-28T12:00:00.000Z',
    };
    expect(() => PlanVersionSchema.parse(version)).toThrow();
  });
});

describe('createPlan', () => {
  const testOrgId = '123e4567-e89b-12d3-a456-426614174001';

  it('should create a valid plan with UUID', () => {
    const plan = createPlan(testOrgId);
    expect(plan.plan_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(plan.org_id).toBe(testOrgId);
  });

  it('should set timestamps to current time', () => {
    const before = new Date().toISOString();
    const plan = createPlan(testOrgId);
    const after = new Date().toISOString();

    expect(plan.created_at >= before).toBe(true);
    expect(plan.created_at <= after).toBe(true);
    expect(plan.updated_at).toBe(plan.created_at);
  });

  it('should create unique plan_ids', () => {
    const plan1 = createPlan(testOrgId);
    const plan2 = createPlan(testOrgId);
    expect(plan1.plan_id).not.toBe(plan2.plan_id);
  });

  it('should pass schema validation', () => {
    const plan = createPlan(testOrgId);
    expect(() => PlanSchema.parse(plan)).not.toThrow();
  });

  it('should set owner_user_id when provided', () => {
    const plan = createPlan(testOrgId, 'user-123');
    expect(plan.owner_user_id).toBe('user-123');
  });

  it('should leave owner_user_id undefined when not provided', () => {
    const plan = createPlan(testOrgId);
    expect(plan.owner_user_id).toBeUndefined();
  });
});

describe('createPlanVersion', () => {
  it('should create a version with goal only', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const version = createPlanVersion(planId, 'Test goal');

    expect(version.plan_id).toBe(planId);
    expect(version.version).toBe(1);
    expect(version.status).toBe(PlanStatus.Draft);
    expect(version.summary.goal).toBe('Test goal');
    expect(version.summary.context).toBeUndefined();
    expect(version.steps).toEqual([]);
  });

  it('should create a version with goal and context', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const version = createPlanVersion(planId, 'Test goal', { context: 'Test context' });

    expect(version.summary.goal).toBe('Test goal');
    expect(version.summary.context).toBe('Test context');
  });

  it('should set timestamps to current time', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const before = new Date().toISOString();
    const version = createPlanVersion(planId, 'Test goal');
    const after = new Date().toISOString();

    expect(version.created_at >= before).toBe(true);
    expect(version.created_at <= after).toBe(true);
    expect(version.updated_at).toBe(version.created_at);
  });

  it('should pass schema validation', () => {
    const planId = '123e4567-e89b-12d3-a456-426614174000';
    const version = createPlanVersion(planId, 'Test goal');
    expect(() => PlanVersionSchema.parse(version)).not.toThrow();
  });
});

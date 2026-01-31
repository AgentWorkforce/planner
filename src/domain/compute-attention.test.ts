import { describe, it, expect } from 'vitest';
import { computeAttentionTypes, type AttentionInput, type ExecutionStatus } from './compute-attention.js';
import type { Plan, PlanVersion } from './plan.js';
import { PlanStatus } from './status.js';

function createTestPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    plan_id: 'test-plan',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createTestVersion(overrides: Partial<PlanVersion> = {}): PlanVersion {
  return {
    plan_id: 'test-plan',
    version: 1,
    status: PlanStatus.Draft,
    summary: { goal: 'Test goal' },
    steps: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createAttentionInput(overrides: Partial<AttentionInput> = {}): AttentionInput {
  return {
    plan: createTestPlan(),
    latestVersion: createTestVersion(),
    pendingChangeRequests: 0,
    executionStatus: null,
    unresolvedCommentCount: 0,
    ...overrides,
  };
}

describe('computeAttentionTypes', () => {
  describe('awaiting_approval', () => {
    it('returns awaiting_approval when draft has submitted_at', () => {
      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          submitted_at: new Date().toISOString(),
        }),
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('awaiting_approval');
    });

    it('does not return awaiting_approval for draft without submitted_at', () => {
      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
        }),
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('awaiting_approval');
    });
  });

  describe('change_request', () => {
    it('returns change_request when pendingChangeRequests > 0', () => {
      const input = createAttentionInput({
        pendingChangeRequests: 1,
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('change_request');
    });

    it('does not return change_request when pendingChangeRequests = 0', () => {
      const input = createAttentionInput({
        pendingChangeRequests: 0,
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('change_request');
    });
  });

  describe('gate_pending', () => {
    it('returns gate_pending for published plan with blocked gate step', () => {
      const executionStatus: ExecutionStatus = {
        status: 'running',
        blockedSteps: [{ step_id: 'step-1', has_gate: true }],
      };

      const input = createAttentionInput({
        latestVersion: createTestVersion({ status: PlanStatus.Published }),
        executionStatus,
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('gate_pending');
    });

    it('does not return gate_pending for blocked step without gate', () => {
      const executionStatus: ExecutionStatus = {
        status: 'running',
        blockedSteps: [{ step_id: 'step-1', has_gate: false }],
      };

      const input = createAttentionInput({
        latestVersion: createTestVersion({ status: PlanStatus.Published }),
        executionStatus,
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('gate_pending');
    });

    it('does not return gate_pending for draft', () => {
      const executionStatus: ExecutionStatus = {
        status: 'running',
        blockedSteps: [{ step_id: 'step-1', has_gate: true }],
      };

      const input = createAttentionInput({
        latestVersion: createTestVersion({ status: PlanStatus.Draft }),
        executionStatus,
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('gate_pending');
    });
  });

  describe('execution_failed', () => {
    it('returns execution_failed for published plan with failed execution', () => {
      const executionStatus: ExecutionStatus = {
        status: 'failed',
      };

      const input = createAttentionInput({
        latestVersion: createTestVersion({ status: PlanStatus.Published }),
        executionStatus,
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('execution_failed');
    });

    it('does not return execution_failed for running execution', () => {
      const executionStatus: ExecutionStatus = {
        status: 'running',
      };

      const input = createAttentionInput({
        latestVersion: createTestVersion({ status: PlanStatus.Published }),
        executionStatus,
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('execution_failed');
    });
  });

  describe('unread_comments', () => {
    it('returns unread_comments when unresolvedCommentCount > 0', () => {
      const input = createAttentionInput({
        unresolvedCommentCount: 3,
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('unread_comments');
    });

    it('does not return unread_comments when unresolvedCommentCount = 0', () => {
      const input = createAttentionInput({
        unresolvedCommentCount: 0,
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('unread_comments');
    });
  });

  describe('stale_draft', () => {
    it('returns stale_draft for draft not updated in >7 days', () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          updated_at: eightDaysAgo.toISOString(),
        }),
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('stale_draft');
    });

    it('does not return stale_draft for recently updated draft', () => {
      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          updated_at: new Date().toISOString(),
        }),
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('stale_draft');
    });

    it('does not return stale_draft for submitted draft', () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          submitted_at: new Date().toISOString(),
          updated_at: eightDaysAgo.toISOString(),
        }),
      });

      const types = computeAttentionTypes(input);

      // Should return awaiting_approval instead
      expect(types).toContain('awaiting_approval');
      expect(types).not.toContain('stale_draft');
    });

    it('respects custom threshold', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          updated_at: threeDaysAgo.toISOString(),
        }),
      });

      // With 2-day threshold
      const types = computeAttentionTypes(input, {
        stale_draft_threshold_days: 2,
        active_threshold_hours: 24,
      });

      expect(types).toContain('stale_draft');
    });
  });

  describe('active', () => {
    it('returns active for draft updated within 24h', () => {
      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          updated_at: new Date().toISOString(),
        }),
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('active');
    });

    it('returns active for published plan with running execution', () => {
      const executionStatus: ExecutionStatus = {
        status: 'running',
      };

      const input = createAttentionInput({
        latestVersion: createTestVersion({ status: PlanStatus.Published }),
        executionStatus,
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('active');
    });

    it('does not return active for old draft', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          updated_at: twoDaysAgo.toISOString(),
        }),
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('active');
    });

    it('respects custom active threshold', () => {
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          updated_at: twoHoursAgo.toISOString(),
        }),
      });

      // With 1-hour threshold
      const types = computeAttentionTypes(input, {
        stale_draft_threshold_days: 7,
        active_threshold_hours: 1,
      });

      expect(types).not.toContain('active');
    });
  });

  describe('none', () => {
    it('returns none when no other signals apply', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Published,
          updated_at: twoDaysAgo.toISOString(),
        }),
        executionStatus: {
          status: 'completed',
        },
      });

      const types = computeAttentionTypes(input);

      expect(types).toEqual(['none']);
    });
  });

  describe('multiple signals', () => {
    it('returns multiple types when applicable', () => {
      const input = createAttentionInput({
        latestVersion: createTestVersion({
          status: PlanStatus.Draft,
          submitted_at: new Date().toISOString(),
        }),
        pendingChangeRequests: 1,
        unresolvedCommentCount: 2,
      });

      const types = computeAttentionTypes(input);

      expect(types).toContain('awaiting_approval');
      expect(types).toContain('change_request');
      expect(types).toContain('unread_comments');
      expect(types).toContain('active');
      expect(types).not.toContain('none');
    });
  });

  describe('null executionStatus', () => {
    it('does not return gate_pending or execution_failed when executionStatus is null', () => {
      const input = createAttentionInput({
        latestVersion: createTestVersion({ status: PlanStatus.Published }),
        executionStatus: null,
      });

      const types = computeAttentionTypes(input);

      expect(types).not.toContain('gate_pending');
      expect(types).not.toContain('execution_failed');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  createImprovement,
  isImprovementPending,
  acceptImprovement,
  dismissImprovement,
  type Improvement,
  type CreateImprovementInput,
} from './improvement.js';

describe('Improvement domain', () => {
  const baseInput: CreateImprovementInput = {
    plan_id: 'plan-123',
    version: 1,
    type: 'missing_criteria',
    description: 'Step lacks acceptance criteria',
  };

  describe('createImprovement', () => {
    it('creates improvement with required fields', () => {
      const improvement = createImprovement(baseInput);

      expect(improvement.improvement_id).toBeDefined();
      expect(improvement.plan_id).toBe('plan-123');
      expect(improvement.version).toBe(1);
      expect(improvement.type).toBe('missing_criteria');
      expect(improvement.description).toBe('Step lacks acceptance criteria');
      expect(improvement.status).toBe('pending');
      expect(improvement.created_at).toBeDefined();
      expect(improvement.updated_at).toBeDefined();
    });

    it('creates improvement with optional step_id', () => {
      const improvement = createImprovement({
        ...baseInput,
        step_id: 'step-1',
      });

      expect(improvement.step_id).toBe('step-1');
    });

    it('creates improvement with suggested_change', () => {
      const improvement = createImprovement({
        ...baseInput,
        suggested_change: {
          acceptance_criteria: [
            { id: 'ac-1', description: 'Test passes' },
          ],
        },
      });

      expect(improvement.suggested_change).toEqual({
        acceptance_criteria: [
          { id: 'ac-1', description: 'Test passes' },
        ],
      });
    });

    it('generates unique improvement_id', () => {
      const imp1 = createImprovement(baseInput);
      const imp2 = createImprovement(baseInput);

      expect(imp1.improvement_id).not.toBe(imp2.improvement_id);
    });

    it('supports all improvement types', () => {
      const types = [
        'missing_criteria',
        'unclear_description',
        'missing_dependency',
        'redundant_step',
        'scope_suggestion',
      ] as const;

      for (const type of types) {
        const improvement = createImprovement({ ...baseInput, type });
        expect(improvement.type).toBe(type);
      }
    });
  });

  describe('isImprovementPending', () => {
    it('returns true for pending improvement', () => {
      const improvement = createImprovement(baseInput);
      expect(isImprovementPending(improvement)).toBe(true);
    });

    it('returns false for accepted improvement', () => {
      const improvement: Improvement = {
        ...createImprovement(baseInput),
        status: 'accepted',
      };
      expect(isImprovementPending(improvement)).toBe(false);
    });

    it('returns false for dismissed improvement', () => {
      const improvement: Improvement = {
        ...createImprovement(baseInput),
        status: 'dismissed',
      };
      expect(isImprovementPending(improvement)).toBe(false);
    });
  });

  describe('acceptImprovement', () => {
    it('changes status to accepted', () => {
      const improvement = createImprovement(baseInput);
      const accepted = acceptImprovement(improvement);

      expect(accepted.status).toBe('accepted');
    });

    it('sets updated_at to a valid timestamp', () => {
      const improvement = createImprovement(baseInput);
      const accepted = acceptImprovement(improvement);

      // Verify updated_at is a valid ISO timestamp
      expect(accepted.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Verify it's >= the original
      expect(new Date(accepted.updated_at).getTime())
        .toBeGreaterThanOrEqual(new Date(improvement.updated_at).getTime());
    });

    it('preserves other fields', () => {
      const improvement = createImprovement({
        ...baseInput,
        step_id: 'step-1',
        suggested_change: { foo: 'bar' },
      });
      const accepted = acceptImprovement(improvement);

      expect(accepted.improvement_id).toBe(improvement.improvement_id);
      expect(accepted.plan_id).toBe(improvement.plan_id);
      expect(accepted.version).toBe(improvement.version);
      expect(accepted.step_id).toBe(improvement.step_id);
      expect(accepted.type).toBe(improvement.type);
      expect(accepted.description).toBe(improvement.description);
      expect(accepted.suggested_change).toEqual(improvement.suggested_change);
      expect(accepted.created_at).toBe(improvement.created_at);
    });
  });

  describe('dismissImprovement', () => {
    it('changes status to dismissed', () => {
      const improvement = createImprovement(baseInput);
      const dismissed = dismissImprovement(improvement);

      expect(dismissed.status).toBe('dismissed');
    });

    it('sets updated_at to a valid timestamp', () => {
      const improvement = createImprovement(baseInput);
      const dismissed = dismissImprovement(improvement);

      // Verify updated_at is a valid ISO timestamp
      expect(dismissed.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // Verify it's >= the original
      expect(new Date(dismissed.updated_at).getTime())
        .toBeGreaterThanOrEqual(new Date(improvement.updated_at).getTime());
    });

    it('preserves other fields', () => {
      const improvement = createImprovement({
        ...baseInput,
        step_id: 'step-1',
        suggested_change: { foo: 'bar' },
      });
      const dismissed = dismissImprovement(improvement);

      expect(dismissed.improvement_id).toBe(improvement.improvement_id);
      expect(dismissed.plan_id).toBe(improvement.plan_id);
      expect(dismissed.version).toBe(improvement.version);
      expect(dismissed.step_id).toBe(improvement.step_id);
      expect(dismissed.type).toBe(improvement.type);
      expect(dismissed.description).toBe(improvement.description);
      expect(dismissed.suggested_change).toEqual(improvement.suggested_change);
      expect(dismissed.created_at).toBe(improvement.created_at);
    });
  });
});

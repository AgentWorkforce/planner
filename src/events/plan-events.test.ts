/**
 * Plan Events Tests
 *
 * Tests for the plan event emitter module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  emitPlanChange,
  onPlanChange,
  offPlanChange,
  getListenerCount,
  type PlanChangeEvent,
} from './plan-events.js';

describe('plan-events', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('emitPlanChange', () => {
    it('emits event with correct structure', () => {
      const callback = vi.fn();
      const planId = 'plan-123';

      onPlanChange(planId, callback);
      emitPlanChange(planId, 2, 'step_added', 'step-456');

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as PlanChangeEvent;
      expect(event.planId).toBe(planId);
      expect(event.version).toBe(2);
      expect(event.changeType).toBe('step_added');
      expect(event.stepId).toBe('step-456');
      expect(event.timestamp).toBeDefined();

      offPlanChange(planId, callback);
    });

    it('emits event without stepId when not provided', () => {
      const callback = vi.fn();
      const planId = 'plan-789';

      onPlanChange(planId, callback);
      emitPlanChange(planId, 1, 'step_edited');

      const event = callback.mock.calls[0][0] as PlanChangeEvent;
      expect(event.stepId).toBeUndefined();

      offPlanChange(planId, callback);
    });

    it('only notifies listeners for specific planId', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      onPlanChange('plan-a', callback1);
      onPlanChange('plan-b', callback2);

      emitPlanChange('plan-a', 1, 'step_added');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      offPlanChange('plan-a', callback1);
      offPlanChange('plan-b', callback2);
    });
  });

  describe('onPlanChange / offPlanChange', () => {
    it('subscribes and unsubscribes callback', () => {
      const callback = vi.fn();
      const planId = 'plan-sub';

      expect(getListenerCount(planId)).toBe(0);

      onPlanChange(planId, callback);
      expect(getListenerCount(planId)).toBe(1);

      offPlanChange(planId, callback);
      expect(getListenerCount(planId)).toBe(0);
    });

    it('supports multiple listeners for same plan', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const planId = 'plan-multi';

      onPlanChange(planId, callback1);
      onPlanChange(planId, callback2);

      expect(getListenerCount(planId)).toBe(2);

      emitPlanChange(planId, 1, 'step_removed', 'step-x');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      offPlanChange(planId, callback1);
      offPlanChange(planId, callback2);
    });
  });

  describe('getListenerCount', () => {
    it('returns 0 for plan with no listeners', () => {
      expect(getListenerCount('nonexistent-plan')).toBe(0);
    });

    it('returns correct count after subscribe/unsubscribe', () => {
      const callback = vi.fn();
      const planId = 'plan-count';

      expect(getListenerCount(planId)).toBe(0);

      onPlanChange(planId, callback);
      expect(getListenerCount(planId)).toBe(1);

      onPlanChange(planId, callback); // Same callback again
      expect(getListenerCount(planId)).toBe(2);

      offPlanChange(planId, callback);
      expect(getListenerCount(planId)).toBe(1);

      offPlanChange(planId, callback);
      expect(getListenerCount(planId)).toBe(0);
    });
  });

  describe('change types', () => {
    it.each([
      'step_added',
      'step_edited',
      'step_removed',
      'criteria_added',
      'criteria_edited',
    ] as const)('emits %s change type correctly', (changeType) => {
      const callback = vi.fn();
      const planId = `plan-${changeType}`;

      onPlanChange(planId, callback);
      emitPlanChange(planId, 1, changeType, 'step-1');

      const event = callback.mock.calls[0][0] as PlanChangeEvent;
      expect(event.changeType).toBe(changeType);

      offPlanChange(planId, callback);
    });
  });
});

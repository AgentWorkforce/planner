/**
 * StabilityControls Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StabilityControls } from './stability-controls.js';
import { SQLiteTunerStorage } from '../storage/sqlite.js';
import type { StabilityCheckContext } from '../domain/stability.js';

describe('StabilityControls', () => {
  let storage: SQLiteTunerStorage;
  let controls: StabilityControls;

  beforeEach(() => {
    storage = new SQLiteTunerStorage(':memory:');
    controls = new StabilityControls(storage);
  });

  describe('checkBurnIn', () => {
    it('returns true when below burn-in threshold', () => {
      expect(controls.checkBurnIn(30)).toBe(true);
      expect(controls.checkBurnIn(49)).toBe(true);
    });

    it('returns false when at or above burn-in threshold', () => {
      expect(controls.checkBurnIn(50)).toBe(false);
      expect(controls.checkBurnIn(100)).toBe(false);
    });
  });

  describe('checkMinSamples', () => {
    it('returns true when below minimum samples', () => {
      expect(controls.checkMinSamples(10)).toBe(true);
      expect(controls.checkMinSamples(29)).toBe(true);
    });

    it('returns false when at or above minimum samples', () => {
      expect(controls.checkMinSamples(30)).toBe(false);
      expect(controls.checkMinSamples(100)).toBe(false);
    });
  });

  describe('checkRateLimit', () => {
    it('returns true within cool-down period', () => {
      const now = new Date();
      const recentChange = new Date(now.getTime() - 1000 * 60 * 30); // 30 min ago

      // Model selection cool-down is 24 hours
      expect(controls.checkRateLimit('model_selection', recentChange)).toBe(true);
    });

    it('returns false after cool-down period', () => {
      const now = new Date();
      const oldChange = new Date(now.getTime() - 1000 * 60 * 60 * 25); // 25 hours ago

      expect(controls.checkRateLimit('model_selection', oldChange)).toBe(false);
    });
  });

  describe('checkHysteresis', () => {
    it('returns true when improvement below margin', () => {
      // 5% improvement when 15% required
      expect(controls.checkHysteresis(0.50, 0.525)).toBe(true);
    });

    it('returns false when improvement meets margin', () => {
      // 20% improvement when 15% required
      expect(controls.checkHysteresis(0.50, 0.60)).toBe(false);
    });

    it('allows change from zero', () => {
      expect(controls.checkHysteresis(0, 0.50)).toBe(false);
    });
  });

  describe('checkCredibleInterval', () => {
    it('returns true when CI too wide (low sample)', () => {
      // Beta(2, 2) has wide CI
      expect(controls.checkCredibleInterval(2, 2)).toBe(true);
    });

    it('returns false when CI narrow enough (high sample)', () => {
      // Beta(500, 500) has narrow CI (~6.3% width < 10% max)
      // CI width = 4 * sqrt(αβ / (n² * (n+1))) where n = α+β
      expect(controls.checkCredibleInterval(500, 500)).toBe(false);
    });
  });

  describe('computeCredibleIntervalWidth', () => {
    it('computes CI width correctly', () => {
      // Beta(1,1) - uniform, maximum uncertainty
      const width = controls.computeCredibleIntervalWidth(1, 1);
      // CI width should be substantial for uniform
      expect(width).toBeGreaterThan(0.5);
    });

    it('CI width decreases with more data', () => {
      const widthSmall = controls.computeCredibleIntervalWidth(10, 10);
      const widthLarge = controls.computeCredibleIntervalWidth(100, 100);

      expect(widthLarge).toBeLessThan(widthSmall);
    });
  });

  describe('checkStability', () => {
    it('returns canChange=true when all checks pass', () => {
      const context: StabilityCheckContext = {
        totalTrials: 100,
        currentArmSamples: 50,
        parameterType: 'model_selection',
        currentProbability: 0.50,
        candidateProbability: 0.65, // 30% improvement
        alpha: 500,
        beta: 500, // Narrow CI (~6.3% width < 10% max)
      };

      const result = controls.checkStability(context);

      expect(result.canChange).toBe(true);
      expect(result.blockedBy).toBeUndefined();
    });

    it('returns canChange=false with blockedBy reasons', () => {
      const context: StabilityCheckContext = {
        totalTrials: 30, // Below burn-in
        currentArmSamples: 20, // Below min samples
        parameterType: 'model_selection',
        lastChangedAt: new Date(), // Recent change
        currentProbability: 0.50,
        candidateProbability: 0.52, // Only 4% improvement
        alpha: 5,
        beta: 5, // Wide CI
      };

      const result = controls.checkStability(context);

      expect(result.canChange).toBe(false);
      expect(result.blockedBy).toBeDefined();
      expect(result.blockedBy!.length).toBeGreaterThan(0);
    });
  });
});

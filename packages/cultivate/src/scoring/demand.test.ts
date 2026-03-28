/**
 * Tests for demand scoring engine
 */

import { describe, it, expect } from 'vitest';
import { computeDemandScore, DemandScoreSchema } from './demand.js';

describe('computeDemandScore', () => {
  it('should compute basic score with mixed actionable and non-actionable intents', () => {
    const signals = [
      { intent: 'feature_request', score: 0.8 },
      { intent: 'bug_report', score: 0.6 },
      { intent: 'praise', score: 0.9 },
      { intent: 'other', score: 0.4 },
    ];
    const cluster = { velocity_weekly: 5, signal_count: 4 };

    const result = computeDemandScore(signals, cluster);

    // request_ratio = 2/4 = 0.5, velocity_factor = min(5/5, 1) = 1.0
    // quality_factor = (0.8 + 0.6 + 0.9 + 0.4) / 4 = 0.675
    // score = round(0.5 * 1.0 * 0.675 * 100) = round(33.75) = 34
    expect(result.request_ratio).toBe(0.5);
    expect(result.velocity_factor).toBe(1.0);
    expect(result.quality_factor).toBeCloseTo(0.675, 10);
    expect(result.score).toBe(34);
    expect(result.label).toBe('medium');
  });

  it('should set request_ratio to 1.0 when all signals have actionable intents', () => {
    const signals = [
      { intent: 'feature_request', score: 0.7 },
      { intent: 'bug_report', score: 0.8 },
      { intent: 'question', score: 0.9 },
    ];
    const cluster = { velocity_weekly: 5, signal_count: 3 };

    const result = computeDemandScore(signals, cluster);

    expect(result.request_ratio).toBe(1.0);
    // quality_factor = (0.7 + 0.8 + 0.9) / 3 ≈ 0.8
    // score = round(1.0 * 1.0 * 0.8 * 100) = 80
    expect(result.quality_factor).toBeCloseTo(0.8, 10);
    expect(result.score).toBe(80);
  });

  it('should return score of 0 when no signals have actionable intents', () => {
    const signals = [
      { intent: 'praise', score: 0.9 },
      { intent: 'complaint', score: 0.8 },
      { intent: 'other', score: 0.7 },
    ];
    const cluster = { velocity_weekly: 10, signal_count: 3 };

    const result = computeDemandScore(signals, cluster);

    expect(result.request_ratio).toBe(0);
    expect(result.score).toBe(0);
    expect(result.label).toBe('low');
  });

  it('should cap velocity_factor at 1.0 when velocity_weekly exceeds 5', () => {
    const signals = [
      { intent: 'feature_request', score: 1.0 },
    ];
    const cluster = { velocity_weekly: 20, signal_count: 1 };

    const result = computeDemandScore(signals, cluster);

    expect(result.velocity_factor).toBe(1.0);
  });

  it('should cap velocity_factor at exactly 1.0 for velocity_weekly of exactly 5', () => {
    const signals = [
      { intent: 'feature_request', score: 1.0 },
    ];
    const cluster = { velocity_weekly: 5, signal_count: 1 };

    const result = computeDemandScore(signals, cluster);

    expect(result.velocity_factor).toBe(1.0);
  });

  it('should normalize velocity_factor correctly for velocity below 5', () => {
    const signals = [
      { intent: 'feature_request', score: 1.0 },
    ];
    const cluster = { velocity_weekly: 2, signal_count: 1 };

    const result = computeDemandScore(signals, cluster);

    expect(result.velocity_factor).toBe(0.4);
    // score = round(1.0 * 0.4 * 1.0 * 100) = 40
    expect(result.score).toBe(40);
  });

  it('should return score of 0 when velocity_weekly is 0', () => {
    const signals = [
      { intent: 'feature_request', score: 0.9 },
      { intent: 'bug_report', score: 0.8 },
    ];
    const cluster = { velocity_weekly: 0, signal_count: 2 };

    const result = computeDemandScore(signals, cluster);

    expect(result.velocity_factor).toBe(0);
    expect(result.score).toBe(0);
    expect(result.label).toBe('low');
  });

  it('should compute quality_factor as the average of all signal scores', () => {
    const signals = [
      { intent: 'feature_request', score: 0.2 },
      { intent: 'feature_request', score: 0.4 },
      { intent: 'feature_request', score: 0.6 },
      { intent: 'feature_request', score: 0.8 },
    ];
    const cluster = { velocity_weekly: 5, signal_count: 4 };

    const result = computeDemandScore(signals, cluster);

    expect(result.quality_factor).toBe(0.5);
    // score = round(1.0 * 1.0 * 0.5 * 100) = 50
    expect(result.score).toBe(50);
    expect(result.label).toBe('high');
  });

  it('should label score >= 50 as high', () => {
    // score = round(1.0 * 1.0 * 0.5 * 100) = 50 → high
    const signals = [
      { intent: 'feature_request', score: 0.5 },
    ];
    const cluster = { velocity_weekly: 5, signal_count: 1 };

    const result = computeDemandScore(signals, cluster);

    expect(result.score).toBe(50);
    expect(result.label).toBe('high');
  });

  it('should label score of 49 as medium', () => {
    // target: request_ratio=1, velocity_factor=1, quality_factor≈0.49 → score=49
    // Use velocity=4.9 to get velocity_factor=0.98, quality=0.5 → 1.0*0.98*0.5*100=49
    const signals = [
      { intent: 'feature_request', score: 0.5 },
    ];
    const cluster = { velocity_weekly: 4.9, signal_count: 1 };

    const result = computeDemandScore(signals, cluster);

    expect(result.score).toBe(49);
    expect(result.label).toBe('medium');
  });

  it('should label score >= 25 as medium', () => {
    // score = round(1.0 * 0.5 * 0.5 * 100) = 25 → medium
    const signals = [
      { intent: 'feature_request', score: 0.5 },
    ];
    const cluster = { velocity_weekly: 2.5, signal_count: 1 };

    const result = computeDemandScore(signals, cluster);

    expect(result.score).toBe(25);
    expect(result.label).toBe('medium');
  });

  it('should label score of 24 as low', () => {
    // score = round(1.0 * 0.48 * 0.5 * 100) = round(24) = 24 → low
    const signals = [
      { intent: 'feature_request', score: 0.5 },
    ];
    const cluster = { velocity_weekly: 2.4, signal_count: 1 };

    const result = computeDemandScore(signals, cluster);

    expect(result.score).toBe(24);
    expect(result.label).toBe('low');
  });

  it('should return zero score for empty signals array', () => {
    const cluster = { velocity_weekly: 10, signal_count: 0 };

    const result = computeDemandScore([], cluster);

    expect(result.score).toBe(0);
    expect(result.request_ratio).toBe(0);
    expect(result.velocity_factor).toBe(0);
    expect(result.quality_factor).toBe(0);
    expect(result.label).toBe('low');
  });

  it('should not count signals with null intent as actionable', () => {
    const signals = [
      { intent: null, score: 0.9 },
      { intent: null, score: 0.8 },
    ];
    const cluster = { velocity_weekly: 5, signal_count: 2 };

    const result = computeDemandScore(signals, cluster);

    expect(result.request_ratio).toBe(0);
    expect(result.score).toBe(0);
    expect(result.label).toBe('low');
  });

  it('should not count signals with undefined intent as actionable', () => {
    const signals = [
      { score: 0.9 },
      { score: 0.8 },
    ];
    const cluster = { velocity_weekly: 5, signal_count: 2 };

    const result = computeDemandScore(signals, cluster);

    expect(result.request_ratio).toBe(0);
    expect(result.score).toBe(0);
    expect(result.label).toBe('low');
  });

  it('should handle a single signal correctly', () => {
    const signals = [{ intent: 'bug_report', score: 0.6 }];
    const cluster = { velocity_weekly: 5, signal_count: 1 };

    const result = computeDemandScore(signals, cluster);

    expect(result.request_ratio).toBe(1.0);
    expect(result.velocity_factor).toBe(1.0);
    expect(result.quality_factor).toBe(0.6);
    expect(result.score).toBe(60);
    expect(result.label).toBe('high');
  });

  it('should handle real-world scenario with diverse signal data', () => {
    // Simulates a moderately active cluster with mixed intents and quality
    const signals = [
      { intent: 'feature_request', score: 0.85 },
      { intent: 'feature_request', score: 0.72 },
      { intent: 'bug_report', score: 0.91 },
      { intent: 'question', score: 0.60 },
      { intent: 'praise', score: 0.45 },
      { intent: 'other', score: 0.30 },
      { intent: null, score: 0.55 },
    ];
    const cluster = { velocity_weekly: 3.5, signal_count: 7 };

    const result = computeDemandScore(signals, cluster);

    // request_ratio = 4/7 ≈ 0.5714
    expect(result.request_ratio).toBeCloseTo(4 / 7, 10);
    // velocity_factor = 3.5 / 5 = 0.7
    expect(result.velocity_factor).toBeCloseTo(0.7, 10);
    // quality_factor = (0.85 + 0.72 + 0.91 + 0.60 + 0.45 + 0.30 + 0.55) / 7 = 4.38 / 7 ≈ 0.6257
    expect(result.quality_factor).toBeCloseTo(4.38 / 7, 10);
    // score = round((4/7) * 0.7 * (4.38/7) * 100)
    const expected = Math.round((4 / 7) * 0.7 * (4.38 / 7) * 100);
    expect(result.score).toBe(expected);
    expect(['high', 'medium', 'low']).toContain(result.label);
  });

  it('should return a result that passes DemandScoreSchema validation', () => {
    const signals = [
      { intent: 'feature_request', score: 0.75 },
      { intent: 'bug_report', score: 0.65 },
    ];
    const cluster = { velocity_weekly: 4, signal_count: 2 };

    const result = computeDemandScore(signals, cluster);
    const parsed = DemandScoreSchema.safeParse(result);

    expect(parsed.success).toBe(true);
  });
});

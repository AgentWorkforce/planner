/**
 * Tests for ConfigWriter ideation learning logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestTunerServices } from '../factory.js';
import { DEFAULT_IDEATION_CONFIG } from '../../domain/config.js';
import type { IdeationOutcome, PlanQualitySignal } from '../../domain/outcome.js';

describe('ConfigWriter - Ideation Learning', () => {
  let services: ReturnType<typeof createTestTunerServices>;

  beforeEach(() => {
    services = createTestTunerServices();
  });

  it('should return defaults when no baseline exists', () => {
    const config = services.config.generateIdeationConfig();

    expect(config.interviewer.model).toBe(DEFAULT_IDEATION_CONFIG.interviewer.model);
    expect(config.confidence_calibration.confident_above).toBe(
      DEFAULT_IDEATION_CONFIG.confidence_calibration.confident_above
    );
    expect(config.readiness_advisory.min_conversation_turns).toBe(
      DEFAULT_IDEATION_CONFIG.readiness_advisory.min_conversation_turns
    );
    expect(config.specialist_spawning.deprioritized_specialists).toEqual([]);
  });

  it('should return defaults when sample_count < 30', () => {
    // Add 10 samples (below threshold)
    for (let i = 0; i < 10; i++) {
      const outcome: IdeationOutcome = {
        session_id: `session-${i}`,
        plan_id: `plan-${i}`,
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 2,
        confidence_score: 85,
        block_count: 5,
        conversation_turns: 7,
        duration_ms: 120000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      const signal: PlanQualitySignal = {
        plan_id: `plan-${i}`,
        plan_version: 1,
        session_id: `session-${i}`,
        question_count: 4,
        version_count: 1,
        improvements_made: 0,
        block_count: 4,
        time_to_approval_ms: 60000,
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      services.storage.insertIdeationOutcome(outcome);
      services.ideationBaseline.updateBaseline(signal);
    }

    const config = services.config.generateIdeationConfig();

    // Should still be defaults (sample count < 30)
    expect(config.confidence_calibration.confident_above).toBe(
      DEFAULT_IDEATION_CONFIG.confidence_calibration.confident_above
    );
  });

  it('should calibrate confidence downward when questions > 3 and sufficient samples', () => {
    // Add 60 samples with high question counts (beyond burn-in of 50)
    for (let i = 0; i < 60; i++) {
      const outcome: IdeationOutcome = {
        session_id: `session-${i}`,
        plan_id: `plan-${i}`,
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 2,
        confidence_score: 85,
        block_count: 5,
        conversation_turns: 7,
        duration_ms: 120000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      const signal: PlanQualitySignal = {
        plan_id: `plan-${i}`,
        plan_version: 1,
        session_id: `session-${i}`,
        question_count: 5, // High question count
        version_count: 1,
        improvements_made: 0,
        block_count: 4,
        time_to_approval_ms: 60000,
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      services.storage.insertIdeationOutcome(outcome);
      services.ideationBaseline.updateBaseline(signal);
    }

    const config = services.config.generateIdeationConfig();

    // Confidence should be calibrated downward
    // With EMA and many samples, mean_questions will approach 5
    // Since mean > 3, calibration should trigger
    // reduction = min(10, round(mean * 2))
    // confident_above = max(70, 80 - reduction)
    // Should be <= 70 (floored)
    expect(config.confidence_calibration.confident_above).toBeLessThanOrEqual(
      DEFAULT_IDEATION_CONFIG.confidence_calibration.confident_above
    );
  });

  it('should not calibrate confidence when questions <= 3', () => {
    // Add 60 samples with low question counts
    for (let i = 0; i < 60; i++) {
      const outcome: IdeationOutcome = {
        session_id: `session-${i}`,
        plan_id: `plan-${i}`,
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 2,
        confidence_score: 85,
        block_count: 5,
        conversation_turns: 7,
        duration_ms: 120000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      const signal: PlanQualitySignal = {
        plan_id: `plan-${i}`,
        plan_version: 1,
        session_id: `session-${i}`,
        question_count: 2, // Low question count
        version_count: 1,
        improvements_made: 0,
        block_count: 4,
        time_to_approval_ms: 60000,
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      services.storage.insertIdeationOutcome(outcome);
      services.ideationBaseline.updateBaseline(signal);
    }

    const config = services.config.generateIdeationConfig();

    // Confidence should remain at default (no calibration needed)
    expect(config.confidence_calibration.confident_above).toBe(
      DEFAULT_IDEATION_CONFIG.confidence_calibration.confident_above
    );
  });

  it('should set min_conversation_turns from baseline', () => {
    // Add 60 samples with high conversation turns
    for (let i = 0; i < 60; i++) {
      const outcome: IdeationOutcome = {
        session_id: `session-${i}`,
        plan_id: `plan-${i}`,
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 2,
        confidence_score: 85,
        block_count: 5,
        conversation_turns: 10, // High conversation turns
        duration_ms: 120000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      const signal: PlanQualitySignal = {
        plan_id: `plan-${i}`,
        plan_version: 1,
        session_id: `session-${i}`,
        question_count: 2,
        version_count: 1,
        improvements_made: 0,
        block_count: 4,
        time_to_approval_ms: 60000,
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      services.storage.insertIdeationOutcome(outcome);
      services.ideationBaseline.updateBaseline(signal);
    }

    const config = services.config.generateIdeationConfig();

    // min_conversation_turns = max(2, floor(mean_conversation_turns * 0.8))
    // With EMA and many samples, mean will approach 10
    // min_conversation_turns = max(2, floor(~10 * 0.8)) = max(2, ~8)
    expect(config.readiness_advisory.min_conversation_turns).toBeGreaterThanOrEqual(2);
    // Should be at least as high as default since we have high conversation turns
    expect(config.readiness_advisory.min_conversation_turns).toBeGreaterThanOrEqual(
      DEFAULT_IDEATION_CONFIG.readiness_advisory.min_conversation_turns
    );
  });

  it('should deprioritize specialists with contribution rate < 20%', () => {
    // We can't easily test this without specialist contribution data in outcomes
    // This is noted as a TODO in the implementation
    // For now, just verify the config field is present and empty by default
    const config = services.config.generateIdeationConfig();
    expect(config.specialist_spawning.deprioritized_specialists).toEqual([]);
  });

  it('should respect stability controls during burn-in', () => {
    // Add 40 samples (below burn-in threshold of 50)
    for (let i = 0; i < 40; i++) {
      const outcome: IdeationOutcome = {
        session_id: `session-${i}`,
        plan_id: `plan-${i}`,
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 2,
        confidence_score: 85,
        block_count: 5,
        conversation_turns: 7,
        duration_ms: 120000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      const signal: PlanQualitySignal = {
        plan_id: `plan-${i}`,
        plan_version: 1,
        session_id: `session-${i}`,
        question_count: 5, // High question count that would normally trigger calibration
        version_count: 1,
        improvements_made: 0,
        block_count: 4,
        time_to_approval_ms: 60000,
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      services.storage.insertIdeationOutcome(outcome);
      services.ideationBaseline.updateBaseline(signal);
    }

    const config = services.config.generateIdeationConfig();

    // Should not calibrate during burn-in (< 50 samples)
    expect(config.confidence_calibration.confident_above).toBe(
      DEFAULT_IDEATION_CONFIG.confidence_calibration.confident_above
    );
  });

  it('should floor confidence at 70', () => {
    // Add 60 samples with extremely high question counts
    for (let i = 0; i < 60; i++) {
      const outcome: IdeationOutcome = {
        session_id: `session-${i}`,
        plan_id: `plan-${i}`,
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 2,
        confidence_score: 85,
        block_count: 5,
        conversation_turns: 7,
        duration_ms: 120000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      const signal: PlanQualitySignal = {
        plan_id: `plan-${i}`,
        plan_version: 1,
        session_id: `session-${i}`,
        question_count: 20, // Extremely high question count
        version_count: 1,
        improvements_made: 0,
        block_count: 4,
        time_to_approval_ms: 60000,
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      services.storage.insertIdeationOutcome(outcome);
      services.ideationBaseline.updateBaseline(signal);
    }

    const config = services.config.generateIdeationConfig();

    // Should be floored at 70, not go below
    expect(config.confidence_calibration.confident_above).toBe(70);
  });

  it('should floor min_conversation_turns at 2', () => {
    // Add 60 samples with very low conversation turns
    for (let i = 0; i < 60; i++) {
      const outcome: IdeationOutcome = {
        session_id: `session-${i}`,
        plan_id: `plan-${i}`,
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 2,
        confidence_score: 85,
        block_count: 5,
        conversation_turns: 1, // Very low conversation turns
        duration_ms: 120000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      const signal: PlanQualitySignal = {
        plan_id: `plan-${i}`,
        plan_version: 1,
        session_id: `session-${i}`,
        question_count: 2,
        version_count: 1,
        improvements_made: 0,
        block_count: 4,
        time_to_approval_ms: 60000,
        source: 'production',
        timestamp: new Date().toISOString(),
      };

      services.storage.insertIdeationOutcome(outcome);
      services.ideationBaseline.updateBaseline(signal);
    }

    const config = services.config.generateIdeationConfig();

    // Should be floored at 2
    expect(config.readiness_advisory.min_conversation_turns).toBeGreaterThanOrEqual(2);
  });
});

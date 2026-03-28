/**
 * Tests for IdeationBaselineService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IdeationBaselineService } from '../ideation-baseline-service.js';
import { createTestTunerServices } from '../factory.js';
import type { IdeationOutcome, PlanQualitySignal } from '../../domain/outcome.js';

describe('IdeationBaselineService', () => {
  let services: ReturnType<typeof createTestTunerServices>;
  let ideationBaseline: IdeationBaselineService;

  beforeEach(() => {
    services = createTestTunerServices();
    ideationBaseline = services.ideationBaseline;
  });

  it('should create baseline on first signal', () => {
    const outcome: IdeationOutcome = {
      session_id: 'session-1',
      plan_id: 'plan-1',
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
      plan_id: 'plan-1',
      plan_version: 1,
      session_id: 'session-1',
      question_count: 2,
      version_count: 1,
      improvements_made: 0,
      block_count: 4,
      time_to_approval_ms: 60000,
      source: 'production',
      timestamp: new Date().toISOString(),
    };

    // Insert outcome first
    services.storage.insertIdeationOutcome(outcome);

    // Update baseline with signal
    ideationBaseline.updateBaseline(signal);

    // Verify baseline was created
    const baseline = ideationBaseline.getBaseline();
    expect(baseline).toBeDefined();
    expect(baseline?.pattern).toBe('session_quality');
    expect(baseline?.sample_count).toBe(1);
    expect(baseline?.mean_questions_per_plan).toBe(2);
    expect(baseline?.mean_versions_per_plan).toBe(1);
    expect(baseline?.mean_conversation_turns).toBe(7);
    expect(baseline?.mean_time_to_approval_ms).toBe(60000);
  });

  it('should update baseline with EMA on subsequent signals', () => {
    const outcomes: IdeationOutcome[] = [
      {
        session_id: 'session-1',
        plan_id: 'plan-1',
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 2,
        confidence_score: 85,
        block_count: 10,
        conversation_turns: 5,
        duration_ms: 120000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      },
      {
        session_id: 'session-2',
        plan_id: 'plan-2',
        interviewer_model: 'claude-sonnet-4-20250514',
        specialist_count: 3,
        confidence_score: 90,
        block_count: 8,
        conversation_turns: 10,
        duration_ms: 150000,
        outcome: 'approved',
        source: 'production',
        timestamp: new Date().toISOString(),
      },
    ];

    const signals: PlanQualitySignal[] = [
      {
        plan_id: 'plan-1',
        plan_version: 1,
        session_id: 'session-1',
        question_count: 3,
        version_count: 1,
        improvements_made: 0,
        block_count: 8,
        time_to_approval_ms: 60000,
        source: 'production',
        timestamp: new Date().toISOString(),
      },
      {
        plan_id: 'plan-2',
        plan_version: 1,
        session_id: 'session-2',
        question_count: 1,
        version_count: 2,
        improvements_made: 1,
        block_count: 7,
        time_to_approval_ms: 90000,
        source: 'production',
        timestamp: new Date().toISOString(),
      },
    ];

    // Insert outcomes
    outcomes.forEach(o => services.storage.insertIdeationOutcome(o));

    // Process signals
    ideationBaseline.updateBaseline(signals[0]);
    ideationBaseline.updateBaseline(signals[1]);

    // Verify baseline was updated with EMA
    const baseline = ideationBaseline.getBaseline();
    expect(baseline).toBeDefined();
    expect(baseline?.sample_count).toBe(2);

    // EMA formula: new_mean = 0.1 * value + 0.9 * old_mean
    // First: mean_questions = 3
    // Second: mean_questions = 0.1 * 1 + 0.9 * 3 = 0.1 + 2.7 = 2.8
    expect(baseline?.mean_questions_per_plan).toBeCloseTo(2.8, 1);
  });

  it('should calculate block utilization correctly', () => {
    const outcome: IdeationOutcome = {
      session_id: 'session-1',
      plan_id: 'plan-1',
      interviewer_model: 'claude-sonnet-4-20250514',
      specialist_count: 2,
      confidence_score: 85,
      block_count: 10, // Created 10 blocks
      conversation_turns: 7,
      duration_ms: 120000,
      outcome: 'approved',
      source: 'production',
      timestamp: new Date().toISOString(),
    };

    const signal: PlanQualitySignal = {
      plan_id: 'plan-1',
      plan_version: 1,
      session_id: 'session-1',
      question_count: 2,
      version_count: 1,
      improvements_made: 0,
      block_count: 8, // 8 blocks made it to plan
      time_to_approval_ms: 60000,
      source: 'production',
      timestamp: new Date().toISOString(),
    };

    services.storage.insertIdeationOutcome(outcome);
    ideationBaseline.updateBaseline(signal);

    const baseline = ideationBaseline.getBaseline();
    expect(baseline).toBeDefined();
    // Block utilization = 8 / 10 = 0.8
    expect(baseline?.mean_block_utilization).toBe(0.8);
  });

  it('should update Thompson sampling alpha/beta on approval', () => {
    const outcome: IdeationOutcome = {
      session_id: 'session-1',
      plan_id: 'plan-1',
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
      plan_id: 'plan-1',
      plan_version: 1,
      session_id: 'session-1',
      question_count: 2,
      version_count: 1,
      improvements_made: 0,
      block_count: 4,
      time_to_approval_ms: 60000,
      source: 'production',
      timestamp: new Date().toISOString(),
    };

    services.storage.insertIdeationOutcome(outcome);
    ideationBaseline.updateBaseline(signal);

    const baseline = ideationBaseline.getBaseline();
    expect(baseline).toBeDefined();
    // Started with alpha=1, beta=1
    // Approved, so alpha += 1
    expect(baseline?.alpha).toBe(2);
    expect(baseline?.beta).toBe(1);
    expect(baseline?.approval_rate).toBe(2 / 3); // 2/(2+1)
  });

  it('should update Thompson sampling beta on rejection', () => {
    const outcome: IdeationOutcome = {
      session_id: 'session-1',
      plan_id: 'plan-1',
      interviewer_model: 'claude-sonnet-4-20250514',
      specialist_count: 2,
      confidence_score: 85,
      block_count: 5,
      conversation_turns: 7,
      duration_ms: 120000,
      outcome: 'rejected', // Rejected
      source: 'production',
      timestamp: new Date().toISOString(),
    };

    const signal: PlanQualitySignal = {
      plan_id: 'plan-1',
      plan_version: 1,
      session_id: 'session-1',
      question_count: 2,
      version_count: 1,
      improvements_made: 0,
      block_count: 4,
      time_to_approval_ms: 60000,
      source: 'production',
      timestamp: new Date().toISOString(),
    };

    services.storage.insertIdeationOutcome(outcome);
    ideationBaseline.updateBaseline(signal);

    const baseline = ideationBaseline.getBaseline();
    expect(baseline).toBeDefined();
    // Started with alpha=1, beta=1
    // Rejected, so beta += 1
    expect(baseline?.alpha).toBe(1);
    expect(baseline?.beta).toBe(2);
    expect(baseline?.approval_rate).toBe(1 / 3); // 1/(1+2)
  });

  it('should handle missing ideation outcome gracefully', () => {
    const signal: PlanQualitySignal = {
      plan_id: 'plan-1',
      plan_version: 1,
      session_id: 'nonexistent-session',
      question_count: 2,
      version_count: 1,
      improvements_made: 0,
      block_count: 4,
      time_to_approval_ms: 60000,
      source: 'production',
      timestamp: new Date().toISOString(),
    };

    // Should not throw
    ideationBaseline.updateBaseline(signal);

    // Baseline should not be created
    const baseline = ideationBaseline.getBaseline();
    expect(baseline).toBeNull();
  });

});

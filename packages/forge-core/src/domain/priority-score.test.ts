import { describe, it, expect } from 'vitest';
import {
  calculateQuestionPriorityScore,
  BLOCKING_LEVEL_VALUES,
  QuestionBlockingLevel,
} from './types.js';

describe('calculateQuestionPriorityScore', () => {
  it('should implement the correct formula', () => {
    // Formula: blocking_level_value*100 + steps_blocked*10 + subscribers.length*15 + cascade_depth*5 - (can_use_default ? 30 : 0)
    const blockingLevel = QuestionBlockingLevel.HardBlock;
    const stepsBlocked = 5;
    const subscribersCount = 3;
    const cascadeDepth = 2;
    const canUseDefault = false;

    const score = calculateQuestionPriorityScore(
      blockingLevel,
      stepsBlocked,
      subscribersCount,
      cascadeDepth,
      canUseDefault
    );

    // Expected: 3*100 + 5*10 + 3*15 + 2*5 - 0 = 300 + 50 + 45 + 10 = 405
    expect(score).toBe(405);
  });

  it('should calculate correct values for different blocking levels', () => {
    const common = {
      stepsBlocked: 0,
      subscribersCount: 0,
      cascadeDepth: 0,
      canUseDefault: false,
    };

    const hardBlockScore = calculateQuestionPriorityScore(
      QuestionBlockingLevel.HardBlock,
      ...Object.values(common)
    );
    expect(hardBlockScore).toBe(BLOCKING_LEVEL_VALUES[QuestionBlockingLevel.HardBlock] * 100);
    expect(hardBlockScore).toBe(300);

    const softBlockScore = calculateQuestionPriorityScore(
      QuestionBlockingLevel.SoftBlock,
      ...Object.values(common)
    );
    expect(softBlockScore).toBe(BLOCKING_LEVEL_VALUES[QuestionBlockingLevel.SoftBlock] * 100);
    expect(softBlockScore).toBe(200);

    const preferenceScore = calculateQuestionPriorityScore(
      QuestionBlockingLevel.Preference,
      ...Object.values(common)
    );
    expect(preferenceScore).toBe(BLOCKING_LEVEL_VALUES[QuestionBlockingLevel.Preference] * 100);
    expect(preferenceScore).toBe(100);

    const fyiScore = calculateQuestionPriorityScore(
      QuestionBlockingLevel.FYI,
      ...Object.values(common)
    );
    expect(fyiScore).toBe(BLOCKING_LEVEL_VALUES[QuestionBlockingLevel.FYI] * 100);
    expect(fyiScore).toBe(0);
  });

  it('should add 10 points per blocked step', () => {
    const base = calculateQuestionPriorityScore(
      QuestionBlockingLevel.Preference,
      0, // stepsBlocked
      0, // subscribersCount
      0, // cascadeDepth
      false // canUseDefault
    );

    const withBlockedSteps = calculateQuestionPriorityScore(
      QuestionBlockingLevel.Preference,
      5, // stepsBlocked
      0,
      0,
      false
    );

    expect(withBlockedSteps - base).toBe(50); // 5 steps * 10 points each
  });

  it('should add 15 points per subscriber', () => {
    const base = calculateQuestionPriorityScore(
      QuestionBlockingLevel.Preference,
      0,
      0, // subscribersCount
      0,
      false
    );

    const withSubscribers = calculateQuestionPriorityScore(
      QuestionBlockingLevel.Preference,
      0,
      4, // subscribersCount
      0,
      false
    );

    expect(withSubscribers - base).toBe(60); // 4 subscribers * 15 points each
  });

  it('should add 5 points per cascade depth', () => {
    const base = calculateQuestionPriorityScore(
      QuestionBlockingLevel.Preference,
      0,
      0,
      0, // cascadeDepth
      false
    );

    const withCascade = calculateQuestionPriorityScore(
      QuestionBlockingLevel.Preference,
      0,
      0,
      3, // cascadeDepth
      false
    );

    expect(withCascade - base).toBe(15); // 3 levels * 5 points each
  });

  it('should subtract 30 points if can_use_default is true', () => {
    const withoutDefault = calculateQuestionPriorityScore(
      QuestionBlockingLevel.SoftBlock,
      5,
      2,
      1,
      false // canUseDefault
    );

    const withDefault = calculateQuestionPriorityScore(
      QuestionBlockingLevel.SoftBlock,
      5,
      2,
      1,
      true // canUseDefault
    );

    expect(withoutDefault - withDefault).toBe(30);
  });

  it('should handle complex scenarios correctly', () => {
    // High priority: hard block, many steps, many subscribers, deep cascade, no default
    const highPriority = calculateQuestionPriorityScore(
      QuestionBlockingLevel.HardBlock,
      10, // stepsBlocked
      5, // subscribersCount
      3, // cascadeDepth
      false
    );
    // Expected: 300 + 100 + 75 + 15 = 490
    expect(highPriority).toBe(490);

    // Low priority: FYI, no blocks, few subscribers, can default
    const lowPriority = calculateQuestionPriorityScore(
      QuestionBlockingLevel.FYI,
      0,
      1,
      0,
      true // can use default
    );
    // Expected: 0 + 0 + 15 + 0 - 30 = -15
    expect(lowPriority).toBe(-15);

    // Priority queue should favor high priority
    expect(highPriority).toBeGreaterThan(lowPriority);
  });

  it('should allow negative scores for very low priority questions', () => {
    // A question that can use default with minimal other factors
    const score = calculateQuestionPriorityScore(
      QuestionBlockingLevel.FYI,
      0,
      0,
      0,
      true // can use default
    );

    // Expected: 0 + 0 + 0 + 0 - 30 = -30
    expect(score).toBe(-30);
  });
});

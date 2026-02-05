/**
 * ConfidenceHandler - DOT Framework Confidence Threshold Handling
 *
 * Uses captured confidence scores in control flow decisions.
 * Research basis: Multi-Agent Taxonomy 2025 - 98% of silent failures detectable with validation
 *
 * Features:
 * - Confidence < 0.3 fails task immediately (escalation threshold)
 * - Confidence < 0.5 triggers clarification or rerun (review threshold)
 * - Confidence >= 0.5 allows task to continue normally
 * - All low confidence events captured in trajectory for learning
 */

import type { ForgeStorage } from '../storage/interface.js';
import type { TrajectoryCapture } from './trajectory-capture.js';
import type { ConfidenceConfig, Task } from '../domain/types.js';
import { DEFAULT_EXECUTION_POLICY } from '../domain/types.js';

// ============================================
// Types
// ============================================

/**
 * Result of confidence evaluation
 */
export enum ConfidenceAction {
  /** Confidence is high enough, continue normally */
  Continue = 'continue',
  /** Confidence is low, needs review/clarification */
  NeedsReview = 'needs_review',
  /** Confidence is too low, fail immediately */
  Fail = 'fail',
}

/**
 * Detailed result of confidence check
 */
export interface ConfidenceCheckResult {
  /** Action to take based on confidence */
  action: ConfidenceAction;
  /** The confidence value that was evaluated */
  confidence: number;
  /** The threshold that triggered the action */
  threshold?: number;
  /** Human-readable message */
  message: string;
}

/**
 * Options for checking confidence
 */
export interface CheckConfidenceOptions {
  /** The task being evaluated */
  task: Task;
  /** Run ID for trajectory events */
  runId: string;
  /** Reported confidence score (0-1) */
  confidence: number;
  /** Optional context about the task completion */
  completionContext?: string;
}

// ============================================
// ConfidenceHandler
// ============================================

/**
 * ConfidenceHandler evaluates agent confidence scores and determines
 * appropriate control flow actions.
 *
 * Threshold levels (configurable via ExecutionPolicy):
 * - escalation_threshold (default: 0.3): Below this, fail immediately
 * - review_threshold (default: 0.5): Below this, trigger review/clarification
 *
 * This helps catch the 36% silent failure rate by validating agent confidence.
 */
export class ConfidenceHandler {
  private storage: ForgeStorage;
  private trajectoryCapture: TrajectoryCapture | null;
  private config: ConfidenceConfig;

  constructor(
    storage: ForgeStorage,
    config?: Partial<ConfidenceConfig>,
    trajectoryCapture?: TrajectoryCapture
  ) {
    this.storage = storage;
    this.trajectoryCapture = trajectoryCapture ?? null;

    // Merge with defaults
    const defaults = DEFAULT_EXECUTION_POLICY.confidence;
    this.config = {
      escalation_threshold: config?.escalation_threshold ?? defaults.escalation_threshold,
      review_threshold: config?.review_threshold ?? defaults.review_threshold,
    };
  }

  /**
   * Checks confidence and determines the appropriate action.
   *
   * @param options - Check options including task, runId, and confidence
   * @returns Result with action to take
   */
  checkConfidence(options: CheckConfidenceOptions): ConfidenceCheckResult {
    const { task, runId, confidence, completionContext } = options;

    let result: ConfidenceCheckResult;

    if (confidence < this.config.escalation_threshold) {
      // Very low confidence - fail immediately
      result = {
        action: ConfidenceAction.Fail,
        confidence,
        threshold: this.config.escalation_threshold,
        message: `Confidence ${(confidence * 100).toFixed(1)}% is below escalation threshold ${(this.config.escalation_threshold * 100).toFixed(1)}% - task failed`,
      };
    } else if (confidence < this.config.review_threshold) {
      // Low confidence - needs review
      result = {
        action: ConfidenceAction.NeedsReview,
        confidence,
        threshold: this.config.review_threshold,
        message: `Confidence ${(confidence * 100).toFixed(1)}% is below review threshold ${(this.config.review_threshold * 100).toFixed(1)}% - clarification needed`,
      };
    } else {
      // Sufficient confidence - continue
      result = {
        action: ConfidenceAction.Continue,
        confidence,
        message: `Confidence ${(confidence * 100).toFixed(1)}% is acceptable - task can continue`,
      };
    }

    // Emit trajectory event for low confidence cases (for Tuner learning)
    if (result.action !== ConfidenceAction.Continue && this.trajectoryCapture) {
      this.trajectoryCapture.capture(
        runId,
        'confidence_threshold_triggered' as any,
        {
          task_id: task.task_id,
          confidence,
          action: result.action,
          threshold: result.threshold,
          message: result.message,
          completion_context: completionContext,
        },
        task.task_id
      );
    }

    return result;
  }

  /**
   * Evaluates whether a task completion should be accepted based on confidence.
   *
   * @param options - Check options
   * @returns true if task should be accepted, false if it needs intervention
   */
  shouldAcceptCompletion(options: CheckConfidenceOptions): boolean {
    const result = this.checkConfidence(options);
    return result.action === ConfidenceAction.Continue;
  }

  /**
   * Gets the action to take for a given confidence level without emitting events.
   * Useful for preview/planning purposes.
   *
   * @param confidence - Confidence score (0-1)
   * @returns The action that would be taken
   */
  getActionForConfidence(confidence: number): ConfidenceAction {
    if (confidence < this.config.escalation_threshold) {
      return ConfidenceAction.Fail;
    } else if (confidence < this.config.review_threshold) {
      return ConfidenceAction.NeedsReview;
    }
    return ConfidenceAction.Continue;
  }

  /**
   * Updates the confidence thresholds.
   * Useful when Tuner adjusts thresholds dynamically.
   *
   * @param newConfig - New threshold values
   */
  updateConfig(newConfig: Partial<ConfidenceConfig>): void {
    if (newConfig.escalation_threshold !== undefined) {
      this.config.escalation_threshold = newConfig.escalation_threshold;
    }
    if (newConfig.review_threshold !== undefined) {
      this.config.review_threshold = newConfig.review_threshold;
    }
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): ConfidenceConfig {
    return { ...this.config };
  }

  /**
   * Validates that a confidence value is in the valid range.
   *
   * @param confidence - Value to validate
   * @returns true if valid (0-1), false otherwise
   */
  static isValidConfidence(confidence: unknown): confidence is number {
    return (
      typeof confidence === 'number' &&
      !isNaN(confidence) &&
      confidence >= 0 &&
      confidence <= 1
    );
  }
}

/**
 * Factory function to create ConfidenceHandler.
 */
export function createConfidenceHandler(
  storage: ForgeStorage,
  config?: Partial<ConfidenceConfig>,
  trajectoryCapture?: TrajectoryCapture
): ConfidenceHandler {
  return new ConfidenceHandler(storage, config, trajectoryCapture);
}

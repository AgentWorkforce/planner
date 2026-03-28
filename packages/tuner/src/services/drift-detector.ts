/**
 * DriftDetector Service
 *
 * Compares current execution metrics against baselines and generates alerts
 * when values exceed statistical thresholds (2σ = warning, 3σ = critical).
 */

import type { TaskOutcome } from '../domain/outcome.js';
import type { TaskBaseline } from '../domain/baseline.js';
import type { DriftAlert, DriftType } from '../domain/drift.js';
import {
  createDriftAlert,
  isSignificantDeviation,
  MIN_SAMPLES_FOR_DRIFT,
  WARNING_THRESHOLD_SIGMAS,
  CRITICAL_THRESHOLD_SIGMAS,
} from '../domain/drift.js';
import type { TunerStorage } from '../storage/interface.js';
import type { BaselineService } from './baseline-service.js';

/**
 * DriftDetector service.
 * Detects when metrics deviate significantly from baselines.
 */
export class DriftDetector {
  constructor(
    private storage: TunerStorage,
    private baselineService: BaselineService
  ) {}

  /**
   * Check for drift in a task outcome.
   * Returns alerts for any metrics that deviate significantly from baseline.
   */
  checkDrift(outcome: TaskOutcome): DriftAlert[] {
    const pattern = this.baselineService.normalizePattern(outcome);
    const baseline = this.baselineService.getBaseline(pattern);

    // Not enough data for drift detection
    if (!baseline || baseline.sample_count < MIN_SAMPLES_FOR_DRIFT) {
      return [];
    }

    const alerts: DriftAlert[] = [];

    // Check duration drift
    const durationAlert = this.checkMetricDrift(
      'duration',
      pattern,
      outcome.duration_seconds,
      baseline.mean_duration_seconds,
      baseline.stddev_duration_seconds
    );
    if (durationAlert) alerts.push(durationAlert);

    // Check token drift
    const tokenAlert = this.checkMetricDrift(
      'tokens',
      pattern,
      outcome.tokens_used,
      baseline.mean_tokens,
      baseline.stddev_tokens
    );
    if (tokenAlert) alerts.push(tokenAlert);

    // Check attempts drift (if baseline has data)
    if (baseline.mean_attempts > 0) {
      // For attempts, we use a simple threshold since we don't track stddev
      // Alert if attempts is significantly above average
      const attemptDeviation = outcome.attempts - baseline.mean_attempts;
      if (attemptDeviation > 2) {
        const alert = createDriftAlert(
          'attempts',
          pattern,
          outcome.attempts,
          baseline.mean_attempts,
          1 // Use 1 as stddev estimate for attempts
        );
        alerts.push(alert);
      }
    }

    // Persist alerts
    for (const alert of alerts) {
      this.storage.insertDriftAlert(alert);
    }

    return alerts;
  }

  /**
   * Check a single metric for drift.
   */
  private checkMetricDrift(
    type: DriftType,
    pattern: string,
    currentValue: number,
    baselineValue: number,
    stddev: number
  ): DriftAlert | null {
    // Avoid division by zero
    if (stddev === 0 || !isFinite(stddev)) {
      return null;
    }

    const deviationSigmas = (currentValue - baselineValue) / stddev;

    if (!isSignificantDeviation(deviationSigmas)) {
      return null;
    }

    return createDriftAlert(type, pattern, currentValue, baselineValue, stddev);
  }

  /**
   * Get active (unacknowledged) drift alerts.
   */
  getActiveAlerts(): DriftAlert[] {
    return this.storage.getDriftAlerts({ acknowledged: false });
  }

  /**
   * Get all drift alerts with optional filtering.
   */
  getAlerts(filter?: {
    severity?: 'warning' | 'critical';
    acknowledged?: boolean;
    pattern?: string;
    limit?: number;
  }): DriftAlert[] {
    return this.storage.getDriftAlerts(filter);
  }

  /**
   * Acknowledge a drift alert.
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    return this.storage.acknowledgeDriftAlert(alertId, acknowledgedBy);
  }

  /**
   * Get count of active alerts.
   */
  getActiveAlertCount(): number {
    return this.storage.getActiveAlertCount();
  }
}

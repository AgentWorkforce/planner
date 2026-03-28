import type { HealthScore } from '../domain/types.js';
import type { PlanData } from '../domain/scoring.js';
import { daysSince } from '../domain/utils.js';

/**
 * Cultivate data for health calculation
 */
export interface HealthCultivateData {
  linked_rising_signal_count: number;
}

/**
 * Forge data for health calculation
 */
export interface HealthForgeData {
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  last_run_status: 'completed' | 'failed' | 'running' | null;
}

/**
 * Signal dimension weights for overall score computation.
 * Must sum to 1.0.
 */
const WEIGHTS = {
  recency: 0.20,
  velocity: 0.15,
  completeness: 0.20,
  attention: 0.15,
  decision_density: 0.05,
  external_pressure: 0.15,
  execution_health: 0.10,
} as const;

/**
 * Compute execution health from forge data.
 * Returns 0-100 score based on run statistics.
 */
function computeExecutionHealth(forge: HealthForgeData): number {
  if (forge.total_runs === 0) {
    return 50; // No data yet, neutral
  }

  const successRate = forge.completed_runs / forge.total_runs;
  let score = Math.round(successRate * 80);

  // Adjust based on last run status
  if (forge.last_run_status === 'failed') {
    score = Math.max(score - 20, 0);
  } else if (forge.last_run_status === 'completed') {
    score = Math.min(score + 20, 100);
  }

  return Math.max(0, Math.min(score, 100));
}

/**
 * Compute health score for a plan based on aggregated data.
 * Pure function — no storage access, no side effects.
 *
 * Seven signal dimensions (all 0-100):
 * - recency: How recently the plan was updated
 * - velocity: Version iteration rate
 * - completeness: Steps with acceptance criteria
 * - attention: Unresolved comments + change requests
 * - decision_density: Trajectory events per step
 * - external_pressure: Linked rising signals (from cultivate)
 * - execution_health: Run success rate (from forge)
 */
export function computePlanHealth(
  plan: PlanData,
  cultivate?: HealthCultivateData,
  forge?: HealthForgeData,
): HealthScore {
  const staleness = daysSince(plan.updated_at);

  // Recency: 100 - (days * 2), clamped to 0-100
  const recency = Math.max(0, Math.min(100 - staleness * 2, 100));

  // Velocity: 20 points per version, clamped to 100
  const velocity = Math.min(plan.version_count * 20, 100);

  // Completeness: percentage of steps with acceptance criteria
  const completeness =
    plan.step_count > 0
      ? Math.round((plan.steps_with_criteria / plan.step_count) * 100)
      : 0;

  // Attention: 100 - (issues * 10), clamped to 0
  const issueCount = plan.unresolved_comments + plan.pending_change_requests;
  const attention = Math.max(100 - issueCount * 10, 0);

  // Decision density: trajectory events per step, 25 points per event, clamped to 100
  const decision_density =
    plan.step_count > 0
      ? Math.min(
          Math.round((plan.trajectory_event_count / plan.step_count) * 25),
          100,
        )
      : 0;

  // External pressure: from cultivate (neutral 50 if unavailable)
  const external_pressure = cultivate
    ? Math.min(cultivate.linked_rising_signal_count * 15, 100)
    : 50;

  // Execution health: from forge (neutral 50 if unavailable)
  const execution_health = forge ? computeExecutionHealth(forge) : 50;

  // Compute weighted overall score
  const overall = Math.round(
    recency * WEIGHTS.recency +
      velocity * WEIGHTS.velocity +
      completeness * WEIGHTS.completeness +
      attention * WEIGHTS.attention +
      decision_density * WEIGHTS.decision_density +
      external_pressure * WEIGHTS.external_pressure +
      execution_health * WEIGHTS.execution_health,
  );

  return {
    entity_type: 'plan',
    entity_id: plan.plan_id,
    overall: Math.max(0, Math.min(overall, 100)),
    signals: {
      recency,
      velocity,
      completeness,
      attention,
      decision_density,
      external_pressure,
      execution_health,
    },
    staleness_days: staleness,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Compute health score for an initiative by aggregating child plan healths.
 * Pure function — no storage access, no side effects.
 *
 * Uses recency-weighted averaging: more recent plan healths weighted higher.
 * Weight = 1 / (1 + daysSince(computed_at))
 */
export function computeInitiativeHealth(
  initiativeId: string,
  planHealths: HealthScore[],
): HealthScore {
  if (planHealths.length === 0) {
    // No child plans, return all signals at 0
    return {
      entity_type: 'initiative',
      entity_id: initiativeId,
      overall: 0,
      signals: {
        recency: 0,
        velocity: 0,
        completeness: 0,
        attention: 0,
        decision_density: 0,
        external_pressure: 0,
        execution_health: 0,
      },
      staleness_days: 0,
      computed_at: new Date().toISOString(),
    };
  }

  // Compute recency weights for each plan health
  const weights = planHealths.map((health) => {
    const days = daysSince(health.computed_at);
    return 1 / (1 + days);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Compute weighted average for each signal
  const signals = {
    recency: 0,
    velocity: 0,
    completeness: 0,
    attention: 0,
    decision_density: 0,
    external_pressure: 0,
    execution_health: 0,
  };

  for (let i = 0; i < planHealths.length; i++) {
    const weight = weights[i] / totalWeight;
    const health = planHealths[i];

    signals.recency += health.signals.recency * weight;
    signals.velocity += health.signals.velocity * weight;
    signals.completeness += health.signals.completeness * weight;
    signals.attention += health.signals.attention * weight;
    signals.decision_density += health.signals.decision_density * weight;
    signals.external_pressure += health.signals.external_pressure * weight;
    signals.execution_health += health.signals.execution_health * weight;
  }

  // Round all signals
  const roundedSignals = {
    recency: Math.round(signals.recency),
    velocity: Math.round(signals.velocity),
    completeness: Math.round(signals.completeness),
    attention: Math.round(signals.attention),
    decision_density: Math.round(signals.decision_density),
    external_pressure: Math.round(signals.external_pressure),
    execution_health: Math.round(signals.execution_health),
  };

  // Compute overall from weighted signals (same weights as plan-level)
  const overall = Math.round(
    roundedSignals.recency * WEIGHTS.recency +
      roundedSignals.velocity * WEIGHTS.velocity +
      roundedSignals.completeness * WEIGHTS.completeness +
      roundedSignals.attention * WEIGHTS.attention +
      roundedSignals.decision_density * WEIGHTS.decision_density +
      roundedSignals.external_pressure * WEIGHTS.external_pressure +
      roundedSignals.execution_health * WEIGHTS.execution_health,
  );

  // Staleness: average staleness of child plans weighted by recency
  const avgStaleness = planHealths.reduce((sum, health, i) => {
    const weight = weights[i] / totalWeight;
    return sum + health.staleness_days * weight;
  }, 0);

  return {
    entity_type: 'initiative',
    entity_id: initiativeId,
    overall: Math.max(0, Math.min(overall, 100)),
    signals: roundedSignals,
    staleness_days: Math.round(avgStaleness),
    computed_at: new Date().toISOString(),
  };
}

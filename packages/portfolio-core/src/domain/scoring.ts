import type { Suggestion } from './types.js';
import { daysSince } from './utils.js';

/**
 * Aggregated plan data from planner storage
 */
export interface PlanData {
  plan_id: string;
  plan_goal: string;
  priority: number; // 1-5
  value_score: number; // 1-10
  initiative_id: string | null;
  initiative_name: string | null;
  project_id: string | null;
  status: string; // latest version status: 'draft' | 'approved' | 'published'
  version_count: number;
  updated_at: string; // ISO datetime
  step_count: number;
  steps_with_criteria: number;
  unresolved_comments: number;
  pending_change_requests: number;
  trajectory_event_count: number;
  avg_step_complexity: number | null; // null if no complexity estimates
  phase: 'ideating' | 'planning' | 'forging' | null;
}

/**
 * Cultivate data for a plan (from linked signals)
 */
export interface PlanCultivateData {
  linked_rising_signal_count: number;
}

/**
 * Cultivate cluster for opportunity scoring
 */
export interface ClusterData {
  cluster_id: string;
  label: string;
  signal_count: number;
  velocity_weekly: number;
  avg_signal_score: number;
  has_linked_plan: boolean;
  top_quote?: string;
  top_segment?: string;
  demand_score?: number;
}

/**
 * Forge execution data for a plan
 */
export interface PlanForgeData {
  last_run_status: 'completed' | 'failed' | 'running' | null;
}

/**
 * Score a plan based on multiple signals.
 * Pure function — no storage access, no side effects.
 */
export function scorePlan(
  plan: PlanData,
  cultivate?: PlanCultivateData,
  forge?: PlanForgeData,
): { score: number; reasons: string[] } {
  const base = plan.priority * 2 + plan.value_score * 1.5;
  let score = base;
  const reasons: string[] = [];

  // Internal signals
  // Momentum: +4 if daysSince(updated_at) === 0, +2 if < 3
  const daysSinceUpdate = daysSince(plan.updated_at);
  if (daysSinceUpdate === 0) {
    score += 4;
    reasons.push('Active momentum — worked on recently');
  } else if (daysSinceUpdate < 3) {
    score += 2;
    reasons.push('Active momentum — worked on recently');
  }

  // Status: +5 if 'approved' (ready to execute), +3 if submitted, +2 if version_count > 1
  if (plan.status === 'approved') {
    score += 5;
    reasons.push('Approved and ready for execution');
  } else if (plan.status === 'submitted') {
    score += 3;
    reasons.push('Submitted for review');
  } else if (plan.version_count > 1) {
    score += 2;
    reasons.push(`Active iteration (${plan.version_count} versions)`);
  }

  // Staleness: +5 if daysSince > 28, +3 if > 14
  if (daysSinceUpdate > 28) {
    score += 5;
    reasons.push(`Stale for ${daysSinceUpdate} days — needs attention`);
  } else if (daysSinceUpdate > 14) {
    score += 3;
    reasons.push(`Stale for ${daysSinceUpdate} days — needs attention`);
  }

  // Attention: +4 if pending_change_requests > 0, +2 if unresolved_comments > 0
  if (plan.pending_change_requests > 0) {
    score += 4;
    reasons.push(`Has ${plan.pending_change_requests} pending change requests`);
  }
  if (plan.unresolved_comments > 0) {
    score += 2;
    reasons.push(`Has ${plan.unresolved_comments} unresolved comments`);
  }

  // Complexity: -2 if avg_step_complexity > 70, +1 if avg_step_complexity < 30 (skip if null)
  if (plan.avg_step_complexity !== null) {
    if (plan.avg_step_complexity > 70) {
      score -= 2;
      reasons.push('High complexity — may need decomposition');
    } else if (plan.avg_step_complexity < 30) {
      score += 1;
      reasons.push('Low complexity — quick win');
    }
  }

  // External signals (cultivate — skip if undefined)
  if (cultivate) {
    if (cultivate.linked_rising_signal_count > 5) {
      score += 6;
      reasons.push(`High external demand — ${cultivate.linked_rising_signal_count} signals`);
    } else if (cultivate.linked_rising_signal_count > 2) {
      score += 3;
      reasons.push(`Growing external interest — ${cultivate.linked_rising_signal_count} signals`);
    }
  }

  // Execution signals (forge — skip if undefined)
  if (forge) {
    if (forge.last_run_status === 'failed') {
      score += 5;
      reasons.push('Last execution failed — needs attention');
    } else if (forge.last_run_status === 'completed') {
      score -= 3;
    }
  }

  return { score, reasons };
}

/**
 * Score an opportunity (unlinked rising cluster).
 * Only scores clusters where has_linked_plan === false and signal_count >= 3.
 * Applies demand multiplier when demand_score is available:
 *   - demand_score >= 50 (high): 1.5x
 *   - demand_score >= 25 (medium): 1.2x
 *   - otherwise: 1.0x
 * Pure function — no storage access, no side effects.
 */
export function scoreOpportunity(cluster: ClusterData): {
  score: number;
  reasons: string[];
  top_quote?: string;
  top_segment?: string;
  demand_score?: number;
} | null {
  if (cluster.has_linked_plan || cluster.signal_count < 3) {
    return null;
  }

  let score = cluster.velocity_weekly * cluster.avg_signal_score * 10;
  const reasons = [
    `Rising trend: '${cluster.label}' — ${cluster.signal_count} signals, no plan yet`,
  ];

  // Apply demand multiplier if demand_score is present
  if (cluster.demand_score != null) {
    if (cluster.demand_score >= 50) {
      score *= 1.5;
      reasons.push(`High demand (score: ${cluster.demand_score}) — 1.5x boost`);
    } else if (cluster.demand_score >= 25) {
      score *= 1.2;
      reasons.push(`Medium demand (score: ${cluster.demand_score}) — 1.2x boost`);
    }
  }

  return { score, reasons, top_quote: cluster.top_quote, top_segment: cluster.top_segment, demand_score: cluster.demand_score };
}

/**
 * Generate suggestions from plans and clusters.
 * Pure function — no storage access, no side effects.
 */
export function generateSuggestions(
  plans: PlanData[],
  clusters?: ClusterData[],
  cultivateByPlan?: Map<string, PlanCultivateData>,
  forgeByPlan?: Map<string, PlanForgeData>,
  limit = 10,
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Score all non-published plans
  for (const plan of plans) {
    if (plan.status === 'published') {
      continue;
    }

    const cultivateData = cultivateByPlan?.get(plan.plan_id);
    const forgeData = forgeByPlan?.get(plan.plan_id);
    const { score, reasons } = scorePlan(plan, cultivateData, forgeData);

    suggestions.push({
      type: 'plan',
      plan_id: plan.plan_id,
      plan_goal: plan.plan_goal,
      initiative_id: plan.initiative_id,
      initiative_name: plan.initiative_name,
      score,
      reasons,
      project_id: plan.project_id,
      phase: plan.phase,
      cluster_id: null,
      cluster_label: null,
      signal_count: cultivateData?.linked_rising_signal_count ?? 0,
    });
  }

  // Score all unlinked rising clusters
  if (clusters) {
    for (const cluster of clusters) {
      const result = scoreOpportunity(cluster);
      if (result) {
        suggestions.push({
          type: 'opportunity',
          plan_id: null,
          plan_goal: cluster.label,
          initiative_id: null,
          initiative_name: null,
          score: result.score,
          reasons: result.reasons,
          project_id: null,
          phase: null,
          cluster_id: cluster.cluster_id,
          cluster_label: cluster.label,
          signal_count: cluster.signal_count,
          top_quote: result.top_quote,
          top_segment: result.top_segment,
          demand_score: result.demand_score,
        });
      }
    }
  }

  // Sort by score descending, return top N
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, limit);
}

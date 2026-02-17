/**
 * Suggestion Engine Service
 *
 * Orchestration layer that fetches data from cross-domain storages
 * and feeds it to the pure scoring/health functions.
 */

import type { Suggestion, HealthScore, PortfolioOverview } from '../domain/types.js';
import type {
  PlanData,
  PlanCultivateData,
  ClusterData,
  PlanForgeData,
} from '../domain/scoring.js';
import { generateSuggestions } from '../domain/scoring.js';
import {
  computePlanHealth,
  computeInitiativeHealth,
  type HealthCultivateData,
  type HealthForgeData,
} from './health-calculator.js';

// =============================================================================
// Minimal interfaces for external storages (no hard dependencies)
// =============================================================================

/**
 * Minimal cultivate storage interface — only methods portfolio needs
 */
export interface CultivateStorageReader {
  listSignals(filters: {
    greenhouse_id?: string;
    cluster_id?: string;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      cluster_id?: string;
      linked_plan_id?: string | null;
      score: number;
      scoring_factors?: { strategic_fit?: number };
    }>
  >;
  listClustersByGreenhouse(
    greenhouseId: string,
  ): Promise<
    Array<{
      id: string;
      label: string;
      signal_count: number;
      trend: string;
      velocity_weekly: number;
    }>
  >;
  listGreenhouses(): Promise<Array<{ id: string }>>;
}

/**
 * Minimal forge storage interface — only methods portfolio needs
 */
export interface ForgeStorageReader {
  listRuns(status?: string): Array<{
    run_id: string;
    plan_id: string;
    status: string;
  }>;
  findCompletedRunsForPlan(
    planId: string,
  ): Array<{ run_id: string; completed_at: string | null }>;
}

/**
 * Minimal planner storage interface — only what portfolio queries
 */
export interface PlannerStorageReader {
  listPlansWithAttention(filter?: { org_id?: string }): Array<{
    plan: {
      plan_id: string;
      org_id: string;
      initiative_id?: string | null;
      priority: number;
      value_score: number;
      updated_at: string;
      source?: {
        type: string;
      } | null;
    };
    latestVersion: {
      version: number;
      status: string;
      summary: { goal: string };
      steps: Array<{
        step_id: string;
        acceptance_criteria?: Array<unknown>;
        complexity_estimate?: { score?: number };
        sub_plan_id?: string | null;
      }>;
    };
    pendingChangeRequestCount: number;
    unresolvedCommentCount: number;
  }>;
  getInitiative?(initiativeId: string): {
    initiative_id: string;
    name: string;
  } | null;
  listInitiatives?(
    orgId: string,
  ): Array<{
    initiative_id: string;
    name: string;
  }>;
  listTrajectoryEvents?(planId: string): Array<unknown>;
  listProjects?(filter?: {
    plan_id?: string;
  }): Array<{ id: string; plan_id?: string | null; run_id?: string | null }>;
}

// =============================================================================
// SuggestionEngine class
// =============================================================================

/**
 * SuggestionEngine orchestrates cross-domain data fetching and delegates
 * to pure scoring/health functions.
 */
export class SuggestionEngine {
  private plannerStorage: PlannerStorageReader;
  private cultivateStorage?: CultivateStorageReader;
  private forgeStorage?: ForgeStorageReader;

  constructor(config: {
    plannerStorage: PlannerStorageReader;
    cultivateStorage?: CultivateStorageReader;
    forgeStorage?: ForgeStorageReader;
  }) {
    this.plannerStorage = config.plannerStorage;
    this.cultivateStorage = config.cultivateStorage;
    this.forgeStorage = config.forgeStorage;
  }

  /**
   * Get top suggestions for portfolio action
   */
  async getSuggestions(limit = 10): Promise<Suggestion[]> {
    // 1. Fetch all plans with attention data
    const attentionData = this.plannerStorage.listPlansWithAttention();

    // 2. Build initiative names map
    const initiativeNames = this.getInitiativeNames(attentionData);

    // 3. Convert planner data to PlanData[]
    const planData = this.buildPlanData(attentionData, initiativeNames);

    // 4. Fetch cultivate data (rising clusters + linked signals per plan)
    let clusters: ClusterData[] | undefined;
    let cultivateByPlan: Map<string, PlanCultivateData> | undefined;

    if (this.cultivateStorage) {
      try {
        const cultivateData = await this.getCultivateData(planData);
        clusters = cultivateData.clusters;
        cultivateByPlan = cultivateData.cultivateByPlan;
      } catch (err) {
        console.warn('[portfolio] Failed to fetch cultivate data:', err);
      }
    }

    // 5. Fetch forge data (run status per plan)
    let forgeByPlan: Map<string, PlanForgeData> | undefined;

    if (this.forgeStorage) {
      try {
        const planIds = planData.map((p) => p.plan_id);
        forgeByPlan = await this.getForgeDataByPlan(planIds);
      } catch (err) {
        console.warn('[portfolio] Failed to fetch forge data:', err);
      }
    }

    // 6. Call pure scoring function
    return generateSuggestions(
      planData,
      clusters,
      cultivateByPlan,
      forgeByPlan,
      limit,
    );
  }

  /**
   * Get health score for a single plan
   */
  async getHealthForPlan(planId: string): Promise<HealthScore> {
    // 1. Fetch plan data
    const attentionData = this.plannerStorage.listPlansWithAttention();
    const planEntry = attentionData.find((p) => p.plan.plan_id === planId);

    if (!planEntry) {
      throw new Error(`Plan ${planId} not found`);
    }

    // 2. Build initiative names map and plan data (single plan, fast)
    const initiativeNames = this.getInitiativeNames([planEntry]);
    const planData = this.buildPlanData([planEntry], initiativeNames);
    const plan = planData[0];

    // 3. Aggregate cultivate data for this plan
    let cultivateData: HealthCultivateData | undefined;

    if (this.cultivateStorage) {
      try {
        const cultivateMap = await this.getCultivateData([plan]);
        const data = cultivateMap.cultivateByPlan.get(planId);
        if (data) {
          cultivateData = {
            linked_rising_signal_count: data.linked_rising_signal_count,
          };
        }
      } catch (err) {
        console.warn(
          `[portfolio] Failed to fetch cultivate data for plan ${planId}:`,
          err,
        );
      }
    }

    // 4. Aggregate forge data for this plan
    let forgeData: HealthForgeData | undefined;

    if (this.forgeStorage) {
      try {
        const runs = this.forgeStorage.listRuns().filter((r) => r.plan_id === planId);
        if (runs.length > 0) {
          const completed = runs.filter((r) => r.status === 'completed').length;
          const failed = runs.filter((r) => r.status === 'failed').length;
          runs.sort((a, b) => b.run_id.localeCompare(a.run_id));
          const lastStatus = runs[0].status;

          forgeData = {
            total_runs: runs.length,
            completed_runs: completed,
            failed_runs: failed,
            last_run_status:
              lastStatus === 'completed' || lastStatus === 'failed' || lastStatus === 'running'
                ? (lastStatus as 'completed' | 'failed' | 'running')
                : null,
          };
        }
      } catch (err) {
        console.warn(
          `[portfolio] Failed to fetch forge data for plan ${planId}:`,
          err,
        );
      }
    }

    // 5. Call pure health function
    return computePlanHealth(plan, cultivateData, forgeData);
  }

  /**
   * Get health scores for all initiatives
   *
   * Fetches all data once, computes health per plan, then aggregates by initiative.
   */
  async getAllInitiativeHealth(): Promise<HealthScore[]> {
    // 1. Fetch all data once
    const attentionData = this.plannerStorage.listPlansWithAttention();
    const initiativeNames = this.getInitiativeNames(attentionData);
    const planData = this.buildPlanData(attentionData, initiativeNames);

    // 2. Pre-fetch forge runs once for all plans
    const allRuns = this.forgeStorage ? this.forgeStorage.listRuns() : [];
    const runsByPlanId = new Map<string, Array<{ run_id: string; plan_id: string; status: string }>>();
    for (const run of allRuns) {
      const existing = runsByPlanId.get(run.plan_id) || [];
      existing.push(run);
      runsByPlanId.set(run.plan_id, existing);
    }

    // 3. Pre-fetch cultivate data once
    let cultivateByPlan = new Map<string, PlanCultivateData>();
    if (this.cultivateStorage) {
      try {
        const cultivateData = await this.getCultivateData(planData);
        cultivateByPlan = cultivateData.cultivateByPlan;
      } catch (err) {
        console.warn('[portfolio] Failed to fetch cultivate data for health:', err);
      }
    }

    // 4. Compute health for every plan using pre-fetched data
    const planHealths: HealthScore[] = [];

    for (const plan of planData) {
      try {
        // Build cultivate data for this plan
        let cultivateData: HealthCultivateData | undefined;
        const cultivateEntry = cultivateByPlan.get(plan.plan_id);
        if (cultivateEntry) {
          cultivateData = {
            linked_rising_signal_count: cultivateEntry.linked_rising_signal_count,
          };
        }

        // Build forge data for this plan
        let forgeData: HealthForgeData | undefined;
        const planRuns = runsByPlanId.get(plan.plan_id);
        if (planRuns && planRuns.length > 0) {
          const completed = planRuns.filter((r) => r.status === 'completed').length;
          const failed = planRuns.filter((r) => r.status === 'failed').length;
          planRuns.sort((a, b) => b.run_id.localeCompare(a.run_id));
          const lastStatus = planRuns[0].status;

          forgeData = {
            total_runs: planRuns.length,
            completed_runs: completed,
            failed_runs: failed,
            last_run_status:
              lastStatus === 'completed' || lastStatus === 'failed' || lastStatus === 'running'
                ? (lastStatus as 'completed' | 'failed' | 'running')
                : null,
          };
        }

        const health = computePlanHealth(plan, cultivateData, forgeData);
        planHealths.push(health);
      } catch (err) {
        console.warn(
          `[portfolio] Failed to compute health for plan ${plan.plan_id}:`,
          err,
        );
      }
    }

    // 5. Group by initiative_id
    const byInitiative = new Map<string, HealthScore[]>();

    for (const health of planHealths) {
      const plan = planData.find((p) => p.plan_id === health.entity_id);
      if (!plan?.initiative_id) continue;

      const existing = byInitiative.get(plan.initiative_id) || [];
      existing.push(health);
      byInitiative.set(plan.initiative_id, existing);
    }

    // 6. For each initiative, call computeInitiativeHealth
    const initiativeHealths: HealthScore[] = [];

    for (const [initiativeId, childHealths] of byInitiative.entries()) {
      const health = computeInitiativeHealth(initiativeId, childHealths);
      initiativeHealths.push(health);
    }

    return initiativeHealths;
  }

  /**
   * Get portfolio overview
   */
  async getOverview(): Promise<PortfolioOverview> {
    // 1. Get all initiative healths
    const initiativeHealths = await this.getAllInitiativeHealth();

    // 2. Get top suggestion
    const suggestions = await this.getSuggestions(1);
    const topSuggestion = suggestions[0] || null;

    // 3. Count opportunities (unlinked rising clusters)
    let opportunityCount = 0;

    if (this.cultivateStorage) {
      try {
        const cultivateData = await this.getCultivateData([]);
        opportunityCount = cultivateData.clusters.filter(
          (c) => !c.has_linked_plan && c.signal_count >= 3,
        ).length;
      } catch (err) {
        console.warn('[portfolio] Failed to count opportunities:', err);
      }
    }

    // 4. Compute health summary
    const healthSummary = {
      healthy: initiativeHealths.filter((h) => h.overall > 70).length,
      warning: initiativeHealths.filter((h) => h.overall >= 40 && h.overall <= 70)
        .length,
      critical: initiativeHealths.filter((h) => h.overall < 40).length,
    };

    // 5. Count initiatives and active plans
    const attentionData = this.plannerStorage.listPlansWithAttention();
    const initiativeIds = new Set(
      attentionData
        .map((p) => p.plan.initiative_id)
        .filter((id): id is string => !!id),
    );
    const activePlans = attentionData.filter(
      (p) => p.latestVersion.status !== 'published',
    );

    return {
      initiative_count: initiativeIds.size,
      active_plan_count: activePlans.length,
      health_summary: healthSummary,
      top_suggestion: topSuggestion,
      opportunity_count: opportunityCount,
    };
  }

  // ===========================================================================
  // Private helper methods
  // ===========================================================================

  /**
   * Build initiative names map from planner storage
   */
  private getInitiativeNames(
    attentionData: ReturnType<PlannerStorageReader['listPlansWithAttention']>,
  ): Map<string, string> {
    const initiativeNames = new Map<string, string>();

    // Collect unique initiative IDs
    const initiativeIds = new Set(
      attentionData
        .map((p) => p.plan.initiative_id)
        .filter((id): id is string => !!id),
    );

    // Fetch initiative names (if method exists)
    if (this.plannerStorage.listInitiatives) {
      try {
        // Get unique org IDs
        const orgIds = new Set(attentionData.map((p) => p.plan.org_id));

        for (const orgId of orgIds) {
          const initiatives = this.plannerStorage.listInitiatives(orgId);
          for (const init of initiatives) {
            if (initiativeIds.has(init.initiative_id)) {
              initiativeNames.set(init.initiative_id, init.name);
            }
          }
        }
      } catch (err) {
        console.warn('[portfolio] Failed to fetch initiative names:', err);
      }
    }

    return initiativeNames;
  }

  /**
   * Convert planner attention data to PlanData[]
   *
   * Pre-fetches all shared data once to avoid N+1 queries:
   * - Projects fetched once and indexed by plan_id
   * - Forge runs fetched once and indexed by run_id
   * - Attention data already available (passed in)
   */
  private buildPlanData(
    attentionData: ReturnType<PlannerStorageReader['listPlansWithAttention']>,
    initiativeNames: Map<string, string>,
  ): PlanData[] {
    // Pre-fetch: all projects indexed by plan_id
    const projectsByPlanId = new Map<string, { id: string; plan_id?: string | null; run_id?: string | null }>();
    if (this.plannerStorage.listProjects) {
      try {
        const allProjects = this.plannerStorage.listProjects();
        for (const p of allProjects) {
          if (p.plan_id) {
            projectsByPlanId.set(p.plan_id, p);
          }
        }
      } catch (err) {
        console.warn('[portfolio] Failed to fetch projects:', err);
      }
    }

    // Pre-fetch: all forge runs indexed by run_id
    const runsByRunId = new Map<string, { run_id: string; plan_id: string; status: string }>();
    if (this.forgeStorage) {
      try {
        const allRuns = this.forgeStorage.listRuns();
        for (const r of allRuns) {
          runsByRunId.set(r.run_id, r);
        }
      } catch (err) {
        console.warn('[portfolio] Failed to fetch forge runs:', err);
      }
    }

    const planData: PlanData[] = [];

    for (const entry of attentionData) {
      const { plan, latestVersion, pendingChangeRequestCount, unresolvedCommentCount } =
        entry;

      // Compute avg_step_complexity
      const stepsWithComplexity = latestVersion.steps.filter(
        (s) => s.complexity_estimate?.score != null,
      );
      const avgComplexity =
        stepsWithComplexity.length > 0
          ? stepsWithComplexity.reduce(
              (sum, s) => sum + (s.complexity_estimate?.score || 0),
              0,
            ) / stepsWithComplexity.length
          : null;

      // Compute trajectory event count (if method exists)
      let trajectoryEventCount = 0;
      if (this.plannerStorage.listTrajectoryEvents) {
        try {
          trajectoryEventCount = this.plannerStorage.listTrajectoryEvents(
            plan.plan_id,
          ).length;
        } catch (err) {
          // Non-critical, skip silently
        }
      }

      // Determine phase using pre-fetched data
      const phase = this.determinePlanPhase(
        plan,
        latestVersion,
        projectsByPlanId.get(plan.plan_id),
        runsByRunId,
      );

      // Count steps with acceptance criteria
      const stepsWithCriteria = latestVersion.steps.filter(
        (s) => s.acceptance_criteria && s.acceptance_criteria.length > 0,
      ).length;

      // Get project_id from pre-fetched map
      const projectId = projectsByPlanId.get(plan.plan_id)?.id || null;

      planData.push({
        plan_id: plan.plan_id,
        plan_goal: latestVersion.summary.goal,
        priority: plan.priority,
        value_score: plan.value_score,
        initiative_id: plan.initiative_id || null,
        initiative_name:
          (plan.initiative_id && initiativeNames.get(plan.initiative_id)) || null,
        project_id: projectId,
        status: latestVersion.status,
        version_count: latestVersion.version,
        updated_at: plan.updated_at,
        step_count: latestVersion.steps.length,
        steps_with_criteria: stepsWithCriteria,
        unresolved_comments: unresolvedCommentCount,
        pending_change_requests: pendingChangeRequestCount,
        trajectory_event_count: trajectoryEventCount,
        avg_step_complexity: avgComplexity,
        phase,
      });
    }

    return planData;
  }

  /**
   * Determine plan phase using pre-fetched data (no DB queries)
   */
  private determinePlanPhase(
    plan: { plan_id: string; source?: { type: string } | null },
    latestVersion: { status: string; version: number },
    project?: { id: string; plan_id?: string | null; run_id?: string | null },
    runsByRunId?: Map<string, { run_id: string; status: string }>,
  ): 'ideating' | 'planning' | 'forging' | null {
    // Check if plan has a project with an active run (forging phase)
    if (project?.run_id && runsByRunId) {
      const run = runsByRunId.get(project.run_id);
      if (run && run.status === 'running') {
        return 'forging';
      }
    }

    // Check if plan is in ideation phase
    if (
      plan.source?.type === 'ideation' &&
      latestVersion.status === 'draft' &&
      latestVersion.version === 1
    ) {
      return 'ideating';
    }

    // Default: planning phase
    if (latestVersion.status === 'draft' || latestVersion.status === 'approved') {
      return 'planning';
    }

    return null;
  }

  /**
   * Fetch cultivate data (rising clusters + linked signals per plan)
   */
  private async getCultivateData(
    planData: PlanData[],
  ): Promise<{
    clusters: ClusterData[];
    cultivateByPlan: Map<string, PlanCultivateData>;
  }> {
    if (!this.cultivateStorage) {
      return { clusters: [], cultivateByPlan: new Map() };
    }

    const clusters: ClusterData[] = [];
    const cultivateByPlan = new Map<string, PlanCultivateData>();

    // Fetch all greenhouses
    const greenhouses = await this.cultivateStorage.listGreenhouses();

    // Fetch rising clusters for each greenhouse
    for (const greenhouse of greenhouses) {
      const greenhouseClusters =
        await this.cultivateStorage.listClustersByGreenhouse(greenhouse.id);

      for (const cluster of greenhouseClusters) {
        // Fetch signals for this cluster
        const signals = await this.cultivateStorage.listSignals({
          greenhouse_id: greenhouse.id,
          cluster_id: cluster.id,
          limit: 100,
        });

        // Compute avg signal score
        const avgScore =
          signals.length > 0
            ? signals.reduce((sum, s) => sum + s.score, 0) / signals.length
            : 0;

        // Check if any signal is linked to a plan
        const linkedPlanIds = new Set(
          signals
            .map((s) => s.linked_plan_id)
            .filter((id): id is string => !!id),
        );
        const hasLinkedPlan = linkedPlanIds.size > 0;

        clusters.push({
          cluster_id: cluster.id,
          label: cluster.label,
          signal_count: cluster.signal_count,
          velocity_weekly: cluster.velocity_weekly,
          avg_signal_score: avgScore,
          has_linked_plan: hasLinkedPlan,
        });

        // Track linked signals per plan
        for (const planId of linkedPlanIds) {
          const existing = cultivateByPlan.get(planId) || {
            linked_rising_signal_count: 0,
          };
          existing.linked_rising_signal_count += signals.filter(
            (s) => s.linked_plan_id === planId,
          ).length;
          cultivateByPlan.set(planId, existing);
        }
      }
    }

    // Fetch all signals once and check for linked plans not yet counted
    const planIdsNotCounted = planData
      .filter((p) => !cultivateByPlan.has(p.plan_id))
      .map((p) => p.plan_id);

    if (planIdsNotCounted.length > 0) {
      try {
        const allSignals = await this.cultivateStorage.listSignals({
          limit: 1000,
        });

        const notCountedSet = new Set(planIdsNotCounted);
        for (const signal of allSignals) {
          if (signal.linked_plan_id && notCountedSet.has(signal.linked_plan_id)) {
            const existing = cultivateByPlan.get(signal.linked_plan_id) || {
              linked_rising_signal_count: 0,
            };
            existing.linked_rising_signal_count += 1;
            cultivateByPlan.set(signal.linked_plan_id, existing);
          }
        }
      } catch (err) {
        console.warn('[portfolio] Failed to fetch unclustered signals:', err);
      }
    }

    return { clusters, cultivateByPlan };
  }

  /**
   * Fetch forge data for multiple plans
   */
  private async getForgeDataByPlan(
    planIds: string[],
  ): Promise<Map<string, PlanForgeData>> {
    if (!this.forgeStorage) {
      return new Map();
    }

    const forgeByPlan = new Map<string, PlanForgeData>();

    // Fetch all runs
    const runs = this.forgeStorage.listRuns();

    for (const planId of planIds) {
      const planRuns = runs.filter((r) => r.plan_id === planId);

      if (planRuns.length === 0) {
        forgeByPlan.set(planId, { last_run_status: null });
        continue;
      }

      // Sort by most recent first (assumes run_id is chronological or has timestamp)
      planRuns.sort((a, b) => b.run_id.localeCompare(a.run_id));
      const lastRun = planRuns[0];

      const lastRunStatus =
        lastRun.status === 'completed' ||
        lastRun.status === 'failed' ||
        lastRun.status === 'running'
          ? (lastRun.status as 'completed' | 'failed' | 'running')
          : null;

      forgeByPlan.set(planId, { last_run_status: lastRunStatus });
    }

    return forgeByPlan;
  }
}

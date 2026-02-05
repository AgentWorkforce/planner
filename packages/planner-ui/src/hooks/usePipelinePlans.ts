import { useState, useEffect, useMemo } from 'react';
import { listPlans } from '../api/plans';
import type { PlanSummary, AttentionType } from '@/types';

export interface WaveGroup {
  wave: string; // 'NOW', 'Wave 2', 'Wave 3', 'DONE'
  plans: PlanSummary[];
}

export interface StatusGroup {
  status: 'drafting' | 'gate' | 'approved' | 'running' | 'complete';
  label: string;
  plans: PlanSummary[];
}

/**
 * Check if a plan has a specific attention type.
 */
function hasAttention(plan: PlanSummary, type: AttentionType): boolean {
  if (!plan.attention_types) return false;
  return plan.attention_types.includes(type);
}

/**
 * Hook to fetch plans and organize them for pipeline views.
 *
 * Provides two grouping strategies:
 * - waveGroups: Organize by sequence waves (NOW, Wave 2, Wave 3, DONE)
 * - statusGroups: Organize by execution status (drafting, gate, approved, running, complete)
 */
export function usePipelinePlans(initiativeId?: string | null) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch plans
  useEffect(() => {
    let isCancelled = false;

    async function fetchPlans() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await listPlans({ include_attention: true });

        if (isCancelled) return;

        // Filter by initiative if specified
        let filteredPlans = result.plans;
        if (initiativeId) {
          filteredPlans = filteredPlans.filter(p => p.initiative_id === initiativeId);
        }

        setPlans(filteredPlans);
      } catch (err) {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch plans');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPlans();

    return () => {
      isCancelled = true;
    };
  }, [initiativeId]);

  // Organize into waves (for sequence view)
  // Based on status: draft->NOW, approved->Wave 2, published/running->Wave 3, complete->DONE
  const waveGroups = useMemo<WaveGroup[]>(() => {
    const now: PlanSummary[] = [];
    const wave2: PlanSummary[] = [];
    const wave3: PlanSummary[] = [];
    const done: PlanSummary[] = [];

    for (const plan of plans) {
      if (plan.status === 'draft') {
        now.push(plan);
      } else if (plan.status === 'approved') {
        wave2.push(plan);
      } else if (plan.status === 'published') {
        // Check if actually complete vs still running
        if (hasAttention(plan, 'active')) {
          wave3.push(plan);
        } else {
          done.push(plan);
        }
      }
    }

    return [
      { wave: 'NOW', plans: now },
      { wave: 'Wave 2', plans: wave2 },
      { wave: 'Wave 3', plans: wave3 },
      { wave: 'DONE', plans: done },
    ].filter(group => group.plans.length > 0); // Only include non-empty waves
  }, [plans]);

  // Organize into status groups (for board view)
  const statusGroups = useMemo<StatusGroup[]>(() => {
    const drafting = plans.filter(
      p => p.status === 'draft' && !hasAttention(p, 'awaiting_approval')
    );
    const gate = plans.filter(
      p => hasAttention(p, 'awaiting_approval') || hasAttention(p, 'gate_pending')
    );
    const approved = plans.filter(p => p.status === 'approved');
    const running = plans.filter(
      p => p.status === 'published' && hasAttention(p, 'active')
    );
    const complete = plans.filter(
      p => p.status === 'published' && !hasAttention(p, 'active')
    );

    return [
      { status: 'drafting', label: 'Drafting', plans: drafting },
      { status: 'gate', label: 'At Gate', plans: gate },
      { status: 'approved', label: 'Approved', plans: approved },
      { status: 'running', label: 'Running', plans: running },
      { status: 'complete', label: 'Complete', plans: complete },
    ];
  }, [plans]);

  return { plans, waveGroups, statusGroups, isLoading, error };
}

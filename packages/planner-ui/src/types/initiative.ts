/**
 * Initiative status lifecycle
 */
export type InitiativeStatus = 'active' | 'completed' | 'archived';

/**
 * Initiative represents a strategic goal or project within an organization.
 * Plans are associated with initiatives to provide context and organization.
 */
export interface Initiative {
  initiative_id: string;
  org_id: string;
  name: string;
  description?: string;
  status: InitiativeStatus;
  icon?: string;
  color?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Plan counts by status within an initiative
 */
export interface PlanCounts {
  total: number;
  draft: number;
  approved: number;
  published: number;
}

/**
 * Initiative with aggregated plan counts
 */
export interface InitiativeWithPlanCounts extends Initiative {
  plan_counts: PlanCounts;
}

/**
 * Initiative with nested plans array
 * Used by detail view to show full initiative with all associated plans
 */
export interface InitiativeWithPlans extends Initiative {
  plans: Array<{
    plan_id: string;
    goal: string;
    status: string;
    latest_version: number;
    created_at: string;
    updated_at: string;
  }>;
}

/**
 * Input for creating a new initiative
 */
export interface CreateInitiativeInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

/**
 * Input for updating an existing initiative
 */
export interface UpdateInitiativeInput {
  name?: string;
  description?: string;
  status?: InitiativeStatus;
  icon?: string;
  color?: string;
  display_order?: number;
}

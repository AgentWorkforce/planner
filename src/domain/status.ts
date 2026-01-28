import { z } from 'zod';

/**
 * Plan status lifecycle: draft -> approved -> published
 * - draft: editable, can be working or submitted for review
 * - approved: locked, immutable
 * - published: released to orchestrator
 */
export const PlanStatus = {
  Draft: 'draft',
  Approved: 'approved',
  Published: 'published',
} as const;

export type PlanStatus = (typeof PlanStatus)[keyof typeof PlanStatus];

export const PlanStatusSchema = z.enum(['draft', 'approved', 'published']);

import { z } from 'zod';

// ── BuildStatus ──────────────────────────────────────────────────────────────

export const BuildStatus = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Paused: 'paused',
  Cancelled: 'cancelled',
} as const;

export type BuildStatus = (typeof BuildStatus)[keyof typeof BuildStatus];

export const BuildStatusSchema = z.enum([
  'pending', 'running', 'completed', 'failed', 'paused', 'cancelled',
]);

// ── BuildRunStatus ───────────────────────────────────────────────────────────

export const BuildRunStatus = {
  Pending: 'pending',
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Skipped: 'skipped',
} as const;

export type BuildRunStatus = (typeof BuildRunStatus)[keyof typeof BuildRunStatus];

export const BuildRunStatusSchema = z.enum([
  'pending', 'running', 'completed', 'failed', 'skipped',
]);

// ── Build State Machine ──────────────────────────────────────────────────────

export const VALID_BUILD_TRANSITIONS: Record<BuildStatus, BuildStatus[]> = {
  [BuildStatus.Pending]: [BuildStatus.Running, BuildStatus.Cancelled],
  [BuildStatus.Running]: [BuildStatus.Completed, BuildStatus.Failed, BuildStatus.Paused, BuildStatus.Cancelled],
  [BuildStatus.Paused]: [BuildStatus.Running, BuildStatus.Cancelled],
  [BuildStatus.Failed]: [BuildStatus.Running, BuildStatus.Cancelled],
  [BuildStatus.Completed]: [],
  [BuildStatus.Cancelled]: [],
};

export function validateBuildTransition(from: BuildStatus, to: BuildStatus): void {
  const validTransitions = VALID_BUILD_TRANSITIONS[from];
  if (!validTransitions?.includes(to)) {
    throw new Error(
      `Invalid Build state transition: ${from} -> ${to}. ` +
        `Valid transitions from ${from}: [${validTransitions?.join(', ') ?? 'none'}]`
    );
  }
}

// ── ForgeExecutionMode ─────────────────────────────────────────────────────

export const ForgeExecutionModeSchema = z.enum(['test', 'real', 'training']);

// ── BuildTier ──────────────────────────────────────────────────────────────

export const BuildTierSchema = z.object({
  tier: z.number().int().nonnegative(),
  plan_ids: z.array(z.string().uuid()).min(1),
});

export type BuildTier = z.infer<typeof BuildTierSchema>;

// ── BuildRequest ───────────────────────────────────────────────────────────

export const BuildRequestSchema = z
  .object({
    tiers: z.array(BuildTierSchema).min(1),
    mode: ForgeExecutionModeSchema.optional(),
    workspace_path: z.string().optional(),
    concurrency_limit: z.number().int().positive().default(5),
    skip_completed: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const tierNumbers = data.tiers.map((t) => t.tier);
      return new Set(tierNumbers).size === tierNumbers.length;
    },
    { message: 'Tier numbers must be unique', path: ['tiers'] }
  )
  .refine(
    (data) => {
      const sorted = [...data.tiers].sort((a, b) => a.tier - b.tier);
      return sorted.every((t, i) => t.tier === i);
    },
    {
      message: 'Tier numbers must be sequential starting from 0 (0, 1, 2, ...)',
      path: ['tiers'],
    }
  )
  .refine(
    (data) => {
      const allPlanIds = data.tiers.flatMap((t) => t.plan_ids);
      return new Set(allPlanIds).size === allPlanIds.length;
    },
    {
      message: 'Plan IDs must be unique across all tiers — no duplicates allowed',
      path: ['tiers'],
    }
  );

export type BuildRequest = z.infer<typeof BuildRequestSchema>;

// ── Build (stored entity) ───────────────────────────────────────────────────

export const BuildSchema = z.object({
  build_id: z.string().uuid(),
  status: BuildStatusSchema,
  tiers: z.array(BuildTierSchema),
  concurrency_limit: z.number(),
  skip_completed: z.boolean(),
  mode: z.string(),
  workspace_path: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  updated_at: z.string(),
});

export type Build = z.infer<typeof BuildSchema>;

// ── BuildRun (stored entity) ────────────────────────────────────────────────

export const BuildRunSchema = z.object({
  build_id: z.string().uuid(),
  run_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  plan_version: z.number().int().nullable(),
  tier: z.number().int(),
  status: BuildRunStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type BuildRun = z.infer<typeof BuildRunSchema>;

// ── Factory Functions ───────────────────────────────────────────────────────

/**
 * Creates a new Build from a BuildRequest.
 * Generates UUID, sets status='pending', applies defaults, validates via BuildSchema.parse().
 */
export function createBuild(request: BuildRequest): Build {
  const now = new Date().toISOString();
  const build: Build = {
    build_id: crypto.randomUUID(),
    status: 'pending',
    tiers: request.tiers,
    concurrency_limit: request.concurrency_limit,
    skip_completed: request.skip_completed,
    mode: request.mode ?? 'real',
    workspace_path: request.workspace_path ?? null,
    error: null,
    created_at: now,
    started_at: null,
    completed_at: null,
    updated_at: now,
  };
  return BuildSchema.parse(build);
}

/**
 * Options for creating a BuildRun
 */
export interface CreateBuildRunOptions {
  build_id: string;
  run_id: string;
  plan_id: string;
  plan_version?: number;
  tier: number;
}

/**
 * Creates a new BuildRun linking a Build to a Run for a specific plan/tier.
 * Sets status='pending', timestamps, validates via BuildRunSchema.parse().
 */
export function createBuildRun(opts: CreateBuildRunOptions): BuildRun {
  const now = new Date().toISOString();
  const buildRun: BuildRun = {
    build_id: opts.build_id,
    run_id: opts.run_id,
    plan_id: opts.plan_id,
    plan_version: opts.plan_version ?? null,
    tier: opts.tier,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };
  return BuildRunSchema.parse(buildRun);
}

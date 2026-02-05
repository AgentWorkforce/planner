import { z } from 'zod';
import { VerificationSchema } from '../verification/schema.js';

// ============================================
// Difficulty
// ============================================

export const DifficultySchema = z.enum(['trivial', 'simple', 'moderate', 'complex']);
export type Difficulty = z.infer<typeof DifficultySchema>;

// ============================================
// Expected characteristics
// ============================================

export const RangeSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
}).refine((r) => r.max >= r.min, { message: 'max must be >= min' });

export type Range = z.infer<typeof RangeSchema>;

export const ExpectedSchema = z.object({
  language_tier: z.enum(['s', 'a', 'b', 'c', 'd']).optional(),
  complexity_level: z.enum(['trivial', 'simple', 'moderate', 'complex']).optional(),
  step_count: RangeSchema.optional(),
  time_minutes: RangeSchema.optional(),
});

export type Expected = z.infer<typeof ExpectedSchema>;

// ============================================
// Ideation Configuration
// ============================================

export const IdeationBlockInputSchema = z.object({
  type: z.string(),
  title: z.string(),
  keyword: z.string(),
  emoji: z.string(),
  content: z.string().optional().default(''),
});

export type IdeationBlockInput = z.infer<typeof IdeationBlockInputSchema>;

export const IdeationConfigSchema = z.object({
  ideation_strategy: z.enum(['preconfigured', 'ai']),
  understanding: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  blocks: z.array(IdeationBlockInputSchema).optional(),
  messages: z.array(z.string()).optional(),
  handoff_goal: z.string().optional(),
  handoff_context: z.string().optional(),
  timeout_ms: z.number().positive().optional().default(120_000),
});

export type IdeationConfig = z.infer<typeof IdeationConfigSchema>;

// ============================================
// Scenario
// ============================================

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  difficulty: DifficultySchema,
  goal: z.string().min(1),
  expected: ExpectedSchema.optional(),
  verification: VerificationSchema,
  tags: z.array(z.string()).optional(),
  planning_strategy: z.enum(['hardcoded', 'ai']).default('hardcoded'),
  ideation: IdeationConfigSchema.optional(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

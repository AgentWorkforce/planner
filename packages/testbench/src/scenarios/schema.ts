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
});

export type Scenario = z.infer<typeof ScenarioSchema>;

import { z } from 'zod';

export const TestbenchConfigSchema = z.object({
  planner_url: z.string().default('http://localhost:3001'),
  forge_url: z.string().default('http://localhost:3001/api/forge'),
  tuner_url: z.string().default('http://localhost:4002'),
  ideation_url: z.string().optional(),
  workspace_base: z.string().default('/tmp/testbench'),
  default_timeout_minutes: z.number().positive().default(30),
  auto_approve_plans: z.boolean().default(true),
  cleanup_on_success: z.boolean().default(true),
  cleanup_on_failure: z.boolean().default(false),
  results_dir: z.string().default('./results'),
});

export type TestbenchConfig = z.infer<typeof TestbenchConfigSchema>;

export const DEFAULT_TESTBENCH_CONFIG: TestbenchConfig = TestbenchConfigSchema.parse({});

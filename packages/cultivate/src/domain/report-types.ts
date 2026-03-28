/**
 * Synthesis Report domain types
 *
 * Reports aggregate cluster insights into periodic or ad-hoc summaries.
 * Generated from cluster data with AI-powered markdown content.
 */

import { z } from 'zod';

export const SynthesisReportSchema = z.object({
  id: z.string(),
  greenhouse_id: z.string(),
  title: z.string(),
  report_type: z.enum(['weekly', 'monthly', 'custom']).default('custom'),
  cluster_ids: z.array(z.string()).default([]),
  markdown_content: z.string(),
  metadata: z.record(z.unknown()).default({}),
  generated_at: z.string(),
  created_at: z.string(),
});

export type SynthesisReport = z.infer<typeof SynthesisReportSchema>;

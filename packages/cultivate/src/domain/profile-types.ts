/**
 * Profile and ICP Segment domain types
 *
 * Profiles aggregate author data from signals to build customer segments.
 * As signals flow through the pipeline, profiles accumulate per-author statistics.
 */

import { z } from 'zod';

export const ProfileSchema = z.object({
  id: z.string(),
  greenhouse_id: z.string(),
  author: z.string(),
  author_type: z.string(),
  signal_count: z.number(),
  top_intents: z.array(z.string()),
  top_clusters: z.array(z.string()),
  source_distribution: z.record(z.number()),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  segment: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const IcpSegmentSchema = z.object({
  id: z.string(),
  greenhouse_id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  criteria: z.record(z.unknown()),
  profile_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IcpSegment = z.infer<typeof IcpSegmentSchema>;

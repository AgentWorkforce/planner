import { z } from 'zod';
import { SessionRefSchema } from '../domain/types.js';

// ===========================
// Request Schemas
// ===========================

export const TriggerRunRequestSchema = z.object({
  session_ref: SessionRefSchema.optional(),
  force: z.boolean().optional(),
  dry_run: z.boolean().optional(),
});

// ===========================
// Response Schemas
// ===========================

const ErrorDetailSchema = z.object({
  stage: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
});

export const TriggerRunResponseSchema = z.object({
  topicsUpdated: z.number(),
  topicsCreated: z.number(),
  nuggetsWritten: z.number(),
  errors: z.array(ErrorDetailSchema),
  llmFailed: z.boolean(),
  // Batch-specific fields (present when processing multiple sessions)
  sessionsProcessed: z.number().optional(),
  sessionsSkipped: z.number().optional(),
  sessionsFailed: z.number().optional(),
});

export const StatusResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded']),
  memoryDir: z.string(),
  topicCount: z.number(),
  error: z.string().optional(),
});

export const TopicListResponseSchema = z.object({
  topics: z.array(z.string()),
});

const TopicNuggetSchema = z.object({
  slug: z.string(),
  category: z.string(),
  body: z.string(),
  caused: z.array(z.string()).optional(),
  when: z.string().optional(),
});

const TopicFrontmatterSchema = z.object({
  topic: z.string(),
  updated: z.string(),
  sessions: z.array(z.string()),
  tags: z.array(z.string()),
});

export const TopicDetailResponseSchema = z.object({
  slug: z.string(),
  frontmatter: TopicFrontmatterSchema,
  nuggets: z.array(TopicNuggetSchema),
});

// ===========================
// TypeScript Type Exports
// ===========================

export type TriggerRunRequest = z.infer<typeof TriggerRunRequestSchema>;
export type TriggerRunResponse = z.infer<typeof TriggerRunResponseSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
export type TopicListResponse = z.infer<typeof TopicListResponseSchema>;
export type TopicDetailResponse = z.infer<typeof TopicDetailResponseSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type TopicNugget = z.infer<typeof TopicNuggetSchema>;
export type TopicFrontmatter = z.infer<typeof TopicFrontmatterSchema>;

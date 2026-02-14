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
  jobId: z.string(),
  status: z.literal('accepted'),
});

export const JobResultSchema = z.object({
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

export const JobStatusResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(['accepted', 'running', 'completed', 'failed']),
  result: JobResultSchema.optional(),
  error: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

const AdapterStatusSchema = z.object({
  name: z.string(),
  type: z.string(),
  status: z.enum(['connected', 'error']),
  error: z.string().optional(),
});

const RecentSessionSchema = z.object({
  sessionId: z.string(),
  adapterType: z.string(),
  lastMulledAt: z.string(),
});

export const StatusResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded']),
  memoryDir: z.string(),
  topicCount: z.number(),
  lastUpdated: z.string().optional(),
  recentSessions: z.array(RecentSessionSchema).optional(),
  adapterStatus: z.array(AdapterStatusSchema).optional(),
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
export type JobResult = z.infer<typeof JobResultSchema>;
export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
export type TopicListResponse = z.infer<typeof TopicListResponseSchema>;
export type TopicDetailResponse = z.infer<typeof TopicDetailResponseSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type TopicNugget = z.infer<typeof TopicNuggetSchema>;
export type TopicFrontmatter = z.infer<typeof TopicFrontmatterSchema>;
export type AdapterStatus = z.infer<typeof AdapterStatusSchema>;
export type RecentSession = z.infer<typeof RecentSessionSchema>;

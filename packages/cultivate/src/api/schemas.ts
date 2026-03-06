/**
 * Zod validation schemas for Cultivate REST API endpoints
 */

import { z } from 'zod';
import {
  GreenhouseModeSchema,
  SignalStatusSchema,
  AdapterTypeSchema,
  FilterRuleTypeSchema,
  IngestionJobStatusSchema,
  CultivateWeightsSchema,
  AuthTypeSchema,
} from '../domain/types.js';

// ========== Greenhouse Schemas ==========

export const CreateGreenhouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  mode: GreenhouseModeSchema,
  keyword_require: z.array(z.string()),
  keyword_exclude: z.array(z.string()),
  source_ids: z.array(z.string()),
  weight_overrides: CultivateWeightsSchema.partial().optional(),
});

export type CreateGreenhouseRequest = z.infer<typeof CreateGreenhouseSchema>;

export const UpdateGreenhouseSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  mode: GreenhouseModeSchema.optional(),
  keyword_require: z.array(z.string()).optional(),
  keyword_exclude: z.array(z.string()).optional(),
  source_ids: z.array(z.string()).optional(),
  weight_overrides: CultivateWeightsSchema.partial().optional(),
});

export type UpdateGreenhouseRequest = z.infer<typeof UpdateGreenhouseSchema>;

// ========== Signal Schemas ==========

export const ListSignalsQuerySchema = z.object({
  greenhouse_id: z.string().optional(),
  status: SignalStatusSchema.optional(),
  cluster_id: z.string().optional(),
  intent: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListSignalsQuery = z.infer<typeof ListSignalsQuerySchema>;

export const LinkSignalSchema = z.object({
  plan_id: z.string().min(1, 'Plan ID is required'),
});

export type LinkSignalRequest = z.infer<typeof LinkSignalSchema>;

export const DismissSignalSchema = z.object({
  reason: z.string().optional(),
});

export type DismissSignalRequest = z.infer<typeof DismissSignalSchema>;

// ========== Source Config Schemas ==========

export const CreateSourceConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  adapter_type: AdapterTypeSchema,
  preset: z.string().optional(),
  endpoint_template: z.string().optional(),
  auth: z
    .object({
      type: AuthTypeSchema,
      encrypted_credentials: z.string(),
    })
    .optional(),
  poll_interval_ms: z.number().int().min(1000, 'Poll interval must be at least 1000ms'),
  greenhouse_ids: z.array(z.string()),
  enabled: z.boolean().default(true),
});

export type CreateSourceConfigRequest = z.infer<typeof CreateSourceConfigSchema>;

export const UpdateSourceConfigSchema = z.object({
  name: z.string().min(1).optional(),
  adapter_type: AdapterTypeSchema.optional(),
  preset: z.string().optional(),
  endpoint_template: z.string().optional(),
  auth: z
    .object({
      type: AuthTypeSchema,
      encrypted_credentials: z.string(),
    })
    .optional(),
  poll_interval_ms: z.number().int().min(1000).optional(),
  greenhouse_ids: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateSourceConfigRequest = z.infer<typeof UpdateSourceConfigSchema>;

// ========== Cluster Schemas ==========

export const ListClustersQuerySchema = z.object({
  greenhouse_id: z.string().optional(),
});

export type ListClustersQuery = z.infer<typeof ListClustersQuerySchema>;

// ========== Filter Rule Schemas ==========

export const CreateFilterRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  type: FilterRuleTypeSchema,
  condition: z.string().min(1, 'Condition is required'),
  enabled: z.boolean().default(true),
});

export type CreateFilterRuleRequest = z.infer<typeof CreateFilterRuleSchema>;

export const UpdateFilterRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: FilterRuleTypeSchema.optional(),
  condition: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateFilterRuleRequest = z.infer<typeof UpdateFilterRuleSchema>;

// ========== Quick Start Schema ==========

export const QuickStartSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  preset_ids: z.array(z.string()).min(1, 'At least one source preset required'),
});

export type QuickStartRequest = z.infer<typeof QuickStartSchema>;

// ========== Ingestion Job Schemas ==========

export const CreateIngestionJobSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  greenhouse_id: z.string().min(1, 'Greenhouse ID is required'),
  total_chunks: z.number().int().min(1, 'Total chunks must be at least 1'),
});

export type CreateIngestionJobRequest = z.infer<typeof CreateIngestionJobSchema>;

export const ListIngestionJobsQuerySchema = z.object({
  status: IngestionJobStatusSchema.optional(),
});

export type ListIngestionJobsQuery = z.infer<typeof ListIngestionJobsQuerySchema>;

// ========== PRD Generation Schema ==========

export const GeneratePrdSchema = z.object({
  cluster_id: z.string().min(1, 'Cluster ID is required'),
  greenhouse_id: z.string().min(1, 'Greenhouse ID is required'),
});

export type GeneratePrdRequest = z.infer<typeof GeneratePrdSchema>;

import { z } from 'zod';

// ============================================
// Script Verification
// ============================================

export const ScriptVerificationSchema = z.object({
  type: z.literal('script'),
  commands: z.array(z.string()).min(1),
  expect_output: z.string().optional(),
  expect_exit_code: z.number().int().default(0),
  timeout_seconds: z.number().positive().default(60),
});

export type ScriptVerification = z.infer<typeof ScriptVerificationSchema>;

// ============================================
// Test Verification
// ============================================

export const TestVerificationSchema = z.object({
  type: z.literal('test'),
  command: z.string().default('npm test'),
  expect_exit_code: z.number().int().default(0),
  timeout_seconds: z.number().positive().default(120),
});

export type TestVerification = z.infer<typeof TestVerificationSchema>;

// ============================================
// HTTP Verification
// ============================================

export const HttpRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  url: z.string(),
  body: z.unknown().optional(),
  headers: z.record(z.string()).optional(),
  expect_status: z.number().int().optional(),
  expect_body: z.string().optional(),
});

export type HttpRequest = z.infer<typeof HttpRequestSchema>;

export const HttpVerificationSchema = z.object({
  type: z.literal('http'),
  setup: z.string().optional(),
  requests: z.array(HttpRequestSchema).min(1),
  teardown: z.string().optional(),
  timeout_seconds: z.number().positive().default(60),
});

export type HttpVerification = z.infer<typeof HttpVerificationSchema>;

// ============================================
// File Verification
// ============================================

export const FileCheckSchema = z.object({
  path: z.string().min(1),
  exists: z.boolean().optional(),
  contains: z.string().optional(),
});

export type FileCheck = z.infer<typeof FileCheckSchema>;

export const FileVerificationSchema = z.object({
  type: z.literal('file'),
  checks: z.array(FileCheckSchema).min(1),
});

export type FileVerification = z.infer<typeof FileVerificationSchema>;

// ============================================
// Verification union
// ============================================

export const VerificationSchema = z.discriminatedUnion('type', [
  ScriptVerificationSchema,
  TestVerificationSchema,
  HttpVerificationSchema,
  FileVerificationSchema,
]);

export type Verification = z.infer<typeof VerificationSchema>;

// ============================================
// Verification Result
// ============================================

export const VerificationResultSchema = z.object({
  passed: z.boolean(),
  details: z.string(),
  duration_ms: z.number().nonnegative().optional(),
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

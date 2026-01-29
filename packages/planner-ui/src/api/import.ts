/**
 * Document Import API client
 */

import { post } from './client';
import type { DocumentFormat } from '../components/FormatDetectionBadge';

export interface ImportedScope {
  id: string;
  name: string;
  stepCount: number;
  steps: ImportedStep[];
}

export interface ImportedStep {
  step_id: string;
  title: string;
  description?: string;
  scope?: string;
  dependencies?: string[];
}

export interface ImportResponse {
  format: DocumentFormat;
  confidence: 'high' | 'medium' | 'low';
  scopes: ImportedScope[];
  steps: ImportedStep[];
  suggestedGoal?: string;
  suggestedContext?: string;
  filename?: string;
}

export interface DetectResponse {
  format: DocumentFormat;
  confidence: 'high' | 'medium' | 'low';
  indicators?: string[];
}

export interface CreateFromImportRequest {
  goal: string;
  context?: string;
  steps: Array<{
    step_id?: string;
    title: string;
    description?: string;
    scope?: string;
    dependencies?: string[];
  }>;
  source?: {
    filename?: string;
    format?: DocumentFormat;
  };
}

export interface CreateFromImportResponse {
  plan: {
    plan_id: string;
    created_at: string;
    updated_at: string;
  };
  version: {
    plan_id: string;
    version: number;
    status: string;
    summary: {
      goal: string;
      context?: string;
    };
    steps: ImportedStep[];
    created_at: string;
    updated_at: string;
  };
}

/**
 * Import a document and extract plan structure.
 */
export async function importDocument(
  content: string,
  options?: { formatHint?: DocumentFormat; filename?: string }
): Promise<ImportResponse> {
  return post<ImportResponse>('/plans/import', {
    content,
    formatHint: options?.formatHint,
    filename: options?.filename,
  });
}

/**
 * Detect document format without full parsing.
 */
export async function detectFormat(
  content: string,
  filename?: string
): Promise<DetectResponse> {
  return post<DetectResponse>('/plans/import/detect', { content, filename });
}

/**
 * Create a plan from imported document structure.
 */
export async function createPlanFromImport(
  request: CreateFromImportRequest
): Promise<CreateFromImportResponse> {
  return post<CreateFromImportResponse>('/plans/import/create', request);
}

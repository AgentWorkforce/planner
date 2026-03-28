/**
 * Document Import API Handlers
 *
 * Provides endpoints for importing documents and converting them to plans.
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { badRequest, unprocessableEntity } from '../middleware.js';
import { parseDocument, type DocumentFormat } from '../../domain/document-parser.js';
import { detectFormat, detectFormatWithHint, type DetectedFormat } from '../../domain/format-detection.js';
import { documentToPlan, extractedStepsToSteps } from '../../domain/document-converter.js';
import { createPlan, createPlanVersion } from '../../domain/plan.js';

/**
 * Import request body.
 */
interface ImportRequestBody {
  /** Document content to import */
  content: string;
  /** Optional format hint (auto-detected if not provided) */
  formatHint?: DocumentFormat;
  /** Optional filename for format detection */
  filename?: string;
}

/**
 * Format detection request body.
 */
interface DetectRequestBody {
  /** Content to analyze */
  content: string;
  /** Optional filename for format detection */
  filename?: string;
}

/**
 * Create import error response with proper status code.
 */
function createImportError(message: string, details?: Record<string, unknown>) {
  const error = unprocessableEntity(message);
  if (details) {
    (error as Error & { details?: Record<string, unknown> }).details = details;
  }
  return error;
}

/**
 * Creates import route handlers with injected storage dependency.
 */
export function createImportHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /plans/import
     * Import a document and extract plan structure.
     *
     * Request: { content, formatHint?, filename? }
     * Response: { format, confidence, scopes, steps, suggestedGoal, suggestedContext? }
     */
    import: async (req: Request<unknown, unknown, ImportRequestBody>, res: Response, next: NextFunction) => {
      try {
        const { content, formatHint, filename } = req.body;

        // Validate content
        if (!content || typeof content !== 'string') {
          throw badRequest('content is required');
        }

        const trimmedContent = content.trim();
        if (!trimmedContent) {
          throw badRequest('content cannot be empty');
        }

        // Detect format
        const detection = filename
          ? detectFormatWithHint(trimmedContent, filename)
          : detectFormat(trimmedContent);

        const formatToUse = formatHint || detection.format;

        // Parse document
        const parseResult = parseDocument(trimmedContent, formatToUse);

        if (!parseResult.success) {
          throw createImportError(parseResult.error.message, {
            line: parseResult.error.line,
            column: parseResult.error.column,
          });
        }

        // Convert to plan structure
        const extractedPlan = documentToPlan(parseResult.document);

        // Format response for UI
        const response = {
          format: detection.format,
          confidence: detection.confidence,
          scopes: extractedPlan.scopes.map((scope) => ({
            id: scope.id,
            name: scope.name,
            stepCount: scope.steps.length,
            steps: scope.steps.map((step) => ({
              step_id: step.step_id,
              title: step.title,
              description: step.description,
            })),
          })),
          steps: extractedPlan.steps.map((step) => ({
            step_id: step.step_id,
            title: step.title,
            description: step.description,
            scope: step.scope,
            dependencies: step.dependencies,
          })),
          suggestedGoal: extractedPlan.goal,
          suggestedContext: extractedPlan.context,
          filename: filename || undefined,
        };

        res.json(response);
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/import/detect
     * Detect document format without full parsing.
     *
     * Request: { content, filename? }
     * Response: { format, confidence, indicators }
     */
    detect: async (req: Request<unknown, unknown, DetectRequestBody>, res: Response, next: NextFunction) => {
      try {
        const { content, filename } = req.body;

        // Validate content
        if (!content || typeof content !== 'string') {
          throw badRequest('content is required');
        }

        // Detect format
        const detection = filename
          ? detectFormatWithHint(content.trim(), filename)
          : detectFormat(content.trim());

        res.json({
          format: detection.format,
          confidence: detection.confidence,
          indicators: detection.indicators,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/import/create
     * Create a plan from imported document structure.
     *
     * This endpoint accepts the edited structure from ExtractionPreview
     * and creates the actual plan.
     *
     * Request: { goal, context?, steps[], source? }
     * Response: { plan, version }
     */
    createFromImport: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { goal, context, steps, source } = req.body;

        // Validate goal
        if (!goal || typeof goal !== 'string') {
          throw badRequest('goal is required');
        }

        // Validate steps
        if (!Array.isArray(steps)) {
          throw badRequest('steps must be an array');
        }

        // Create plan with default org
        const orgId = storage.listOrganizations().find((o) => o.slug === 'default')?.org_id;
        if (!orgId) {
          throw new Error('Default organization not found');
        }
        const plan = createPlan(orgId);
        storage.createPlan(plan);

        // Create initial version with steps
        const version = createPlanVersion(plan.plan_id, goal, context);

        // Add steps to version
        version.steps = steps.map((step: Record<string, unknown>) => ({
          step_id: (step.step_id as string) || crypto.randomUUID(),
          title: step.title as string,
          description: step.description as string | undefined,
          scope: step.scope as string | undefined,
          dependencies: (step.dependencies as string[]) || [],
        }));

        storage.createVersion(version);

        res.status(201).json({
          plan,
          version,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

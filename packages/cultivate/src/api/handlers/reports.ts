/**
 * Synthesis Report handlers
 * Generates multi-cluster synthesis reports and manages stored reports.
 */

import type { RequestHandler } from 'express';
import { notFound } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import { GenerateReportSchema, ListReportsQuerySchema } from '../schemas.js';
import { generateReport } from '../../reports/generator.js';

/**
 * Create report handlers with storage and API key dependency injection
 */
export function createReportHandlers(
  storage: CultivateStorage,
  anthropicApiKey?: string,
) {
  /**
   * POST /reports/generate
   * Generate a synthesis report from greenhouse clusters
   */
  const generate: RequestHandler = async (req, res, next) => {
    try {
      const body = GenerateReportSchema.parse(req.body);
      const report = await generateReport(storage, body, anthropicApiKey);
      res.json({ data: report });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /reports?greenhouse_id=...
   * List all reports for a greenhouse
   */
  const list: RequestHandler = async (req, res, next) => {
    try {
      const query = ListReportsQuerySchema.parse(req.query);
      const reports = await storage.listReports(query.greenhouse_id);
      res.json({ data: reports });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /reports/:id
   * Get a single report by ID
   */
  const get: RequestHandler = async (req, res, next) => {
    try {
      const id = req.params.id as string;
      const report = await storage.getReportById(id);
      if (!report) throw notFound('Report');
      res.json({ data: report });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /reports/:id
   * Remove a report
   */
  const remove: RequestHandler = async (req, res, next) => {
    try {
      const id = req.params.id as string;
      await storage.deleteReport(id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  return { generate, list, get, remove };
}

import type { Request, Response, NextFunction } from 'express';
import { FileTopicStore } from '../../defaults/topic-store.js';
import { readTopicFile } from '../../memory/read-topic-file.js';
import { notFound } from '@plannr/errors';
import type { MullHandlerDeps } from './run.js';

export function createListTopicsHandler(deps: MullHandlerDeps) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const topicStore = new FileTopicStore();
      const topics = await topicStore.listTopics(deps.memoryDir);

      res.status(200).json({ topics });
    } catch (err) {
      console.error('[mull:topics] List error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({
        error: 'Failed to list topics',
        details: message,
      });
    }
  };
}

export function createGetTopicHandler(deps: MullHandlerDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawSlug = req.params.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

      if (!slug) {
        res.status(400).json({ error: 'Missing slug parameter' });
        return;
      }

      const topicData = readTopicFile(slug, deps.memoryDir);

      if (!topicData) {
        throw notFound('Topic');
      }

      res.status(200).json({
        slug,
        frontmatter: topicData.frontmatter,
        nuggets: topicData.nuggets,
      });
    } catch (err) {
      // Let HttpError (404 etc.) propagate to the centralized error handler
      next(err);
    }
  };
}

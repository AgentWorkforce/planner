import type { Request, Response, NextFunction } from 'express';
import { FileTopicStore } from '../../defaults/topic-store.js';
import { readTopicFile } from '../../memory/read-topic-file.js';
import { notFound, badRequest } from '@plannr/errors';
import type { MullHandlerDeps } from './run.js';

export function createListTopicsHandler(deps: MullHandlerDeps) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const topicStore = new FileTopicStore();
      const topics = await topicStore.listTopics(deps.memoryDir);

      res.status(200).json({ topics });
    } catch (err) {
      next(err);
    }
  };
}

export function createGetTopicHandler(deps: MullHandlerDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawSlug = req.params.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

      if (!slug) {
        throw badRequest('Missing slug parameter');
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
      next(err);
    }
  };
}

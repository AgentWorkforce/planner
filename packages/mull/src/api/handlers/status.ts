import type { Request, Response } from 'express';
import { FileTopicStore } from '../../defaults/topic-store.js';
import type { MullHandlerDeps } from './run.js';

export function createStatusHandler(deps: MullHandlerDeps) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const topicStore = new FileTopicStore();
      const topics = await topicStore.listTopics(deps.memoryDir);

      res.status(200).json({
        status: 'healthy',
        memoryDir: deps.memoryDir,
        topicCount: topics.length,
      });
    } catch (err) {
      console.error('[mull:status] Error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';

      res.status(200).json({
        status: 'degraded',
        memoryDir: deps.memoryDir,
        topicCount: 0,
        error: message,
      });
    }
  };
}

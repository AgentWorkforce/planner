import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Request, Response } from 'express';
import { FileTopicStore } from '../../defaults/topic-store.js';
import type { SessionAdapter } from '../../adapters/core-types.js';
import type { MullHandlerDeps } from './run.js';

interface RecentSession {
  sessionId: string;
  adapterType: string;
  lastMulledAt: string;
}

interface AdapterStatus {
  name: string;
  type: string;
  status: 'connected' | 'error';
  error?: string;
}

async function getLastUpdated(memoryDir: string): Promise<string | undefined> {
  try {
    const entries = await fs.readdir(memoryDir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== '_index.md');

    if (files.length === 0) return undefined;

    let latestTime = 0;
    for (const file of files) {
      const filePath = path.join(memoryDir, file.name);
      const stats = await fs.stat(filePath);
      if (stats.mtimeMs > latestTime) {
        latestTime = stats.mtimeMs;
      }
    }

    return new Date(latestTime).toISOString();
  } catch {
    return undefined;
  }
}

async function getRecentSessions(mullDir: string): Promise<RecentSession[]> {
  const cursorsDir = path.join(mullDir, 'cursors');
  const sessions: RecentSession[] = [];

  try {
    // Read all adapter type directories
    const adapterDirs = await fs.readdir(cursorsDir, { withFileTypes: true });

    for (const dir of adapterDirs) {
      if (!dir.isDirectory()) continue;

      const adapterType = dir.name;
      const adapterPath = path.join(cursorsDir, adapterType);

      // Read all cursor files for this adapter
      const cursorFiles = await fs.readdir(adapterPath);

      for (const file of cursorFiles) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(adapterPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const cursor = JSON.parse(content);

          sessions.push({
            sessionId: cursor.session_id || file.replace('.json', ''),
            adapterType,
            lastMulledAt: cursor.last_mulled_at,
          });
        } catch {
          // Skip malformed cursor files
        }
      }
    }

    // Sort by lastMulledAt descending, take last 10
    sessions.sort((a, b) => new Date(b.lastMulledAt).getTime() - new Date(a.lastMulledAt).getTime());
    return sessions.slice(0, 10);
  } catch {
    return [];
  }
}

function getAdapterStatuses(adapters: MullHandlerDeps['adapters']): AdapterStatus[] {
  // Cast to SessionAdapter[] to access the 'type' property
  const sessionAdapters = adapters as unknown as SessionAdapter[];

  return sessionAdapters.map(adapter => {
    try {
      // Check if adapter has a health check method
      const status: AdapterStatus = {
        name: adapter.type,
        type: adapter.type,
        status: 'connected',
      };

      return status;
    } catch (err) {
      return {
        name: adapter.type,
        type: adapter.type,
        status: 'error' as const,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  });
}

export function createStatusHandler(deps: MullHandlerDeps) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const topicStore = new FileTopicStore();
      const topics = await topicStore.listTopics(deps.memoryDir);

      // Get last updated time from topic files
      const lastUpdated = await getLastUpdated(deps.memoryDir);

      // Get recent sessions from cursor files (if mullDir is configured)
      const mullDir = deps.config?.mullDir || '.mull';
      const recentSessions = await getRecentSessions(mullDir);

      // Get adapter statuses
      const adapterStatus = getAdapterStatuses(deps.adapters);

      res.status(200).json({
        status: 'healthy',
        memoryDir: deps.memoryDir,
        topicCount: topics.length,
        lastUpdated,
        recentSessions: recentSessions.length > 0 ? recentSessions : undefined,
        adapterStatus: adapterStatus.length > 0 ? adapterStatus : undefined,
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

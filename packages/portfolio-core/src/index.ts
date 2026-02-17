import { Router } from 'express';
import { SqlitePortfolioStorage } from './storage/index.js';
import { SuggestionEngine } from './services/suggestion-engine.js';
import type { PlannerStorageReader, CultivateStorageReader, ForgeStorageReader } from './services/suggestion-engine.js';
import { createPortfolioRouter } from './api/index.js';
import type { PortfolioStorage } from './storage/interface.js';

export interface PortfolioServiceConfig {
  dbPath?: string;
  plannerStorage: PlannerStorageReader;
  cultivateStorage?: CultivateStorageReader;
  forgeStorage?: ForgeStorageReader;
}

export interface PortfolioService {
  router: Router;
  initialize: () => Promise<void>;
  shutdown: () => void;
  getStorage: () => PortfolioStorage;
}

export function createPortfolioService(config: PortfolioServiceConfig): PortfolioService {
  const dbPath = config.dbPath || './portfolio.db';
  const storage = new SqlitePortfolioStorage(dbPath);

  const engine = new SuggestionEngine({
    plannerStorage: config.plannerStorage,
    cultivateStorage: config.cultivateStorage,
    forgeStorage: config.forgeStorage,
  });

  const router = createPortfolioRouter(engine, storage);

  return {
    router,

    initialize: async () => {
      // Schema is initialized in constructor via BaseSqliteStorage.initializeSchema()
      console.log('[portfolio] Initialized');
    },

    shutdown: () => {
      storage.close();
      console.log('[portfolio] Shutdown complete');
    },

    getStorage: () => storage,
  };
}

// Re-export domain types
export * from './domain/index.js';

// Re-export storage types
export type { PortfolioStorage } from './storage/interface.js';

// Re-export service types
export type { PlannerStorageReader, CultivateStorageReader, ForgeStorageReader } from './services/suggestion-engine.js';

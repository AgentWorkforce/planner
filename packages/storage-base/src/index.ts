/**
 * Base SQLite Storage Class
 *
 * Provides common database initialization, transaction support, and utility methods
 * for all domain-specific storage implementations.
 */

import Database from 'better-sqlite3';

export abstract class BaseSqliteStorage {
  protected db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }

  /**
   * Initialize database schema.
   * Subclasses must implement this to create tables, indexes, and run migrations.
   */
  protected abstract initializeSchema(): void;

  /**
   * Wraps a function in a SQLite transaction.
   * All operations within the function will be committed atomically.
   */
  protected transaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  /**
   * Safely parse JSON with a default fallback value.
   * Returns the default value if JSON is null/undefined or fails to parse.
   */
  protected safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
    if (json === null || json === undefined) {
      return defaultValue;
    }
    try {
      return JSON.parse(json) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Close the database connection.
   * Should be called when the storage instance is no longer needed.
   */
  close(): void {
    this.db.close();
  }
}

// Re-export Database type for consumers
export type { Database };

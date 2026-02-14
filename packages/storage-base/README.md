# Storage Base

Shared SQLite storage abstraction for domain packages.

## What This Is

Base class for SQLite-backed storage implementations. Provides common initialization (WAL mode, foreign keys), transaction support, and utility methods. Domain packages (planner, ideation, forge) extend this for their specific schemas.

## Core Concept

```typescript
abstract class BaseSqliteStorage {
  protected db: Database.Database;
  protected abstract initializeSchema(): void;
  protected transaction<T>(fn: () => T): T;
  protected safeJsonParse<T>(json: string | null, defaultValue: T): T;
  close(): void;
}
```

Subclasses implement `initializeSchema()` to define tables, indexes, and migrations. Everything else is handled by the base class.

## Usage

### Extending for a Domain

```typescript
import { BaseSqliteStorage } from '@plannr/storage-base';

export class PlannerStorage extends BaseSqliteStorage {
  protected initializeSchema(): void {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        plan_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_plans_created
      ON plans(created_at);
    `);

    // Run migrations if needed
    this.runMigrations();
  }

  private runMigrations(): void {
    // Migration logic here
  }
}
```

### Using Transactions

```typescript
class MyStorage extends BaseSqliteStorage {
  createPlanWithSteps(plan: Plan, steps: Step[]): void {
    this.transaction(() => {
      // Insert plan
      this.db.prepare('INSERT INTO plans ...').run(plan);

      // Insert steps
      for (const step of steps) {
        this.db.prepare('INSERT INTO steps ...').run(step);
      }

      // All-or-nothing: both succeed or both roll back
    });
  }
}
```

### Safe JSON Parsing

```typescript
class MyStorage extends BaseSqliteStorage {
  getPlan(id: string): Plan {
    const row = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id);

    // Safely parse JSONB column with default fallback
    const metadata = this.safeJsonParse(row.metadata, {});

    return { ...row, metadata };
  }
}
```

## Features

### Automatic SQLite Optimization

Constructor sets:
- `journal_mode = WAL` (Write-Ahead Logging for better concurrency)
- `foreign_keys = ON` (Referential integrity enforcement)

### Transaction Wrapping

The `transaction<T>()` method wraps any function in a SQLite transaction:
- Commits if function completes successfully
- Rolls back on any thrown error
- Returns function result

### JSON Safety

`safeJsonParse()` handles common edge cases:
- `null` or `undefined` → returns default value
- Invalid JSON → returns default value
- Valid JSON → returns parsed value

Prevents crashes from corrupted JSONB columns.

## Exports

```typescript
import { BaseSqliteStorage, type Database } from '@plannr/storage-base';
```

- `BaseSqliteStorage` - Abstract base class to extend
- `Database` - Type re-export from `better-sqlite3`

## Design Rationale

### Why SQLite?

- Single-file database (easy deployment, backups)
- ACID transactions (data integrity)
- JSONB support (LLM-friendly document storage)
- No separate server process (simplicity)

### Why Base Class?

Avoids duplication across domain packages:
- Common setup (WAL, foreign keys)
- Transaction boilerplate
- JSON parsing edge cases
- Database lifecycle (close)

Each domain package just implements schema initialization.

## Dependencies

- `better-sqlite3` - Node.js SQLite3 bindings (synchronous API)

## Development

```bash
npm run build   # Compile TypeScript
npm run clean   # Remove dist/
```

No tests in this package (domain packages test their concrete implementations).

## Related Packages

Domain packages that extend this:
- `planner-core` - Plan storage (SqliteStorage)
- `ideation-core` - Ideation session storage
- `forge-core` - Forge run storage

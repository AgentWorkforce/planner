import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAdapter } from './factory.js';
import { TrajectoryAdapter } from './implementations/trajectory-adapter.js';
import { RelayJsonlAdapter } from './implementations/relay-jsonl-adapter.js';
import { TranscriptAdapter } from './implementations/transcript-adapter.js';
import { ForgeDbAdapter } from './implementations/forge-db-adapter.js';
import { ValidationError } from '@plannr/errors';
import type { SessionAdapter } from './core-types.js';

describe('createAdapter', () => {
  let tmpDir: string;
  let plannerDbPath: string;
  let forgeDbPath: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'factory-test-'));
    plannerDbPath = join(tmpDir, 'planner-test.db');
    forgeDbPath = join(tmpDir, 'forge-test.db');

    // Create a minimal planner db so TrajectoryAdapter can open it
    const plannerDb = new Database(plannerDbPath);
    plannerDb.exec(`CREATE TABLE IF NOT EXISTS trajectory_events (
      event_id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL DEFAULT 'decision',
      question_id TEXT NOT NULL,
      asking_agent TEXT NOT NULL,
      question_text TEXT NOT NULL,
      context_provided TEXT,
      options_presented_json TEXT NOT NULL,
      selected_option TEXT,
      free_text_response TEXT,
      reasoning TEXT,
      plan_id TEXT NOT NULL,
      step_id TEXT,
      agent_trajectory_ref TEXT,
      timestamp TEXT NOT NULL
    )`);
    plannerDb.close();

    // Create a minimal forge db so ForgeDbAdapter can open it
    const forgeDb = new Database(forgeDbPath);
    forgeDb.exec(`CREATE TABLE IF NOT EXISTS trajectory_events (
      event_id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      task_id TEXT,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )`);
    forgeDb.close();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates TrajectoryAdapter with valid config', () => {
    const adapter = createAdapter('trail', { dbPath: plannerDbPath });
    expect(adapter).toBeInstanceOf(TrajectoryAdapter);
    expect(adapter.type).toBe('trail');
    (adapter as TrajectoryAdapter).close();
  });

  it('creates RelayJsonlAdapter with valid config', () => {
    const adapter = createAdapter('relay', { dataDir: './.agent-relay' });
    expect(adapter).toBeInstanceOf(RelayJsonlAdapter);
    expect(adapter.type).toBe('relay');
  });

  it('creates TranscriptAdapter with valid config', () => {
    const adapter = createAdapter('transcript', { transcriptsDir: './transcripts' });
    expect(adapter).toBeInstanceOf(TranscriptAdapter);
    expect(adapter.type).toBe('transcript');
  });

  it('creates ForgeDbAdapter with valid config', () => {
    const adapter = createAdapter('forge', { dbPath: forgeDbPath });
    expect(adapter).toBeInstanceOf(ForgeDbAdapter);
    expect(adapter.type).toBe('forge');
    (adapter as ForgeDbAdapter).close();
  });

  it('creates ForgeDbAdapter with optional flags', () => {
    const adapter = createAdapter('forge', {
      dbPath: forgeDbPath,
      includeUserTrajectory: true,
      includePreferences: true,
    });
    expect(adapter).toBeInstanceOf(ForgeDbAdapter);
    expect(adapter.type).toBe('forge');
    (adapter as ForgeDbAdapter).close();
  });

  it('throws ValidationError with Zod details for invalid config', () => {
    try {
      createAdapter('trail', { /* missing dbPath */ });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.message).toContain("Invalid config for 'trail' adapter");
      expect(ve.details).toBeDefined();
      expect(Array.isArray(ve.details)).toBe(true);
      // Zod error format: array of issues
      const details = ve.details as Array<{ path: string[]; message: string }>;
      expect(details.length).toBeGreaterThan(0);
      expect(details[0]!.path).toContain('dbPath');
    }
  });

  it('throws ValidationError for invalid config values', () => {
    try {
      createAdapter('relay', { dataDir: '' }); // empty string fails min(1)
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as ValidationError;
      expect(ve.details).toBeDefined();
    }
  });

  it('throws ValidationError for unknown adapter type', () => {
    try {
      createAdapter('unknown' as any, {});
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toContain('Unknown adapter type');
    }
  });

  it('passes through custom adapter objects implementing SessionAdapter', () => {
    const customAdapter: SessionAdapter = {
      type: 'custom',
      read: async () => [],
    };

    const result = createAdapter(customAdapter);
    expect(result).toBe(customAdapter); // exact same reference
    expect(result.type).toBe('custom');
  });

  it('throws for non-adapter objects', () => {
    try {
      createAdapter({ notAnAdapter: true } as any);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toContain('SessionAdapter interface');
    }
  });
});

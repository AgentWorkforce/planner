/**
 * Accumulator state persistence for real-time triggers.
 *
 * State is stored as JSON files in {mullDir}/realtime/{sessionId}.json
 * and protected by file locks for concurrent trigger safety.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { withLock } from '../memory/file-lock.js';
import { AccumulatorStateSchema, type AccumulatorState } from './types.js';
import type { Entity, Fact } from '../types.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function stateDir(mullDir: string): string {
  return resolve(mullDir, 'realtime');
}

function statePath(mullDir: string, sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return resolve(stateDir(mullDir), `${safe}.json`);
}

function lockName(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `rt-${safe}`;
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

/** Load accumulator state from disk. Returns fresh state if file doesn't exist. */
export function loadAccumulatorState(mullDir: string, sessionId: string): AccumulatorState {
  const path = statePath(mullDir, sessionId);
  try {
    const raw = readFileSync(path, 'utf-8');
    return AccumulatorStateSchema.parse(JSON.parse(raw));
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return AccumulatorStateSchema.parse({ sessionId });
    }
    // Corrupted state file — start fresh rather than crash
    console.warn(`[mull:realtime] Corrupted state for ${sessionId}, resetting:`, err);
    return AccumulatorStateSchema.parse({ sessionId });
  }
}

/** Persist accumulator state to disk. Creates directories as needed. */
export function saveAccumulatorState(mullDir: string, state: AccumulatorState): void {
  const dir = stateDir(mullDir);
  mkdirSync(dir, { recursive: true });
  const path = statePath(mullDir, state.sessionId);
  writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Atomic mutations (under file lock)
// ---------------------------------------------------------------------------

/**
 * Atomically add entities and facts to the accumulator.
 * Returns the updated state (useful for checking trigger thresholds).
 */
export async function accumulateEntities(
  mullDir: string,
  sessionId: string,
  entities: Entity[],
  facts: Fact[],
): Promise<AccumulatorState> {
  return withLock(lockName(sessionId), mullDir, async () => {
    const state = loadAccumulatorState(mullDir, sessionId);

    state.entitiesSinceLastLlm.push(...entities);
    state.factsSinceLastLlm.push(...facts);
    state.lastDeterministicAt = new Date().toISOString();

    saveAccumulatorState(mullDir, state);
    return state;
  });
}

/**
 * Mark LLM run as completed: clear accumulated entities/facts
 * and update the lastLlmRunAt timestamp.
 */
export async function markLlmRunComplete(
  mullDir: string,
  sessionId: string,
): Promise<AccumulatorState> {
  return withLock(lockName(sessionId), mullDir, async () => {
    const state = loadAccumulatorState(mullDir, sessionId);

    state.entitiesSinceLastLlm = [];
    state.factsSinceLastLlm = [];
    state.lastLlmRunAt = new Date().toISOString();

    saveAccumulatorState(mullDir, state);
    return state;
  });
}

/**
 * Read the current accumulator state without modifying it (still locked).
 */
export async function readAccumulatorState(
  mullDir: string,
  sessionId: string,
): Promise<AccumulatorState> {
  return withLock(lockName(sessionId), mullDir, async () => {
    return loadAccumulatorState(mullDir, sessionId);
  });
}

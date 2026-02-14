import type { SessionRef, MullAdapter } from '../domain/types.js';

// ---------------------------------------------------------------------------
// SessionRef type → expected adapter name mapping
// ---------------------------------------------------------------------------

/**
 * Maps each SessionRef type to the adapter name(s) expected to handle it.
 * Used for descriptive error messages when no adapter is found.
 */
const REF_TYPE_ADAPTER_HINTS: Record<SessionRef['type'], string> = {
  plan_id: 'trail',
  run_id: 'forge/relay',
  channel: 'relay',
};

// ---------------------------------------------------------------------------
// normalizeSessionRef — coerce strings to plan_id refs
// ---------------------------------------------------------------------------

/**
 * Normalize a session identifier into a typed SessionRef.
 *
 * - If the input is already a SessionRef object, return it as-is.
 * - If the input is a plain string, treat it as a plan_id ref (the default).
 *
 * @param input - A SessionRef object or plain string session ID
 * @returns A properly typed SessionRef
 */
export function normalizeSessionRef(input: SessionRef | string): SessionRef {
  if (typeof input === 'string') {
    return { type: 'plan_id', id: input };
  }
  return input;
}

// ---------------------------------------------------------------------------
// routeSessionRef — find the adapter(s) that handle a given ref
// ---------------------------------------------------------------------------

/**
 * Route a SessionRef to the correct adapter from a configured set.
 *
 * Routing rules (by SessionRef type):
 * - `plan_id`  → trajectory adapter
 * - `run_id`   → forge/relay adapter
 * - `channel`  → relay adapter
 *
 * The actual matching is delegated to each adapter's `supports()` method,
 * which allows adapters to self-declare their capabilities. The routing
 * rules above describe the expected convention — the error message references
 * the expected adapter type to help diagnose misconfigurations.
 *
 * @param ref - The session reference to route
 * @param adapters - The set of configured adapters to search
 * @returns The first adapter that supports the given ref
 * @throws Error with descriptive message if no adapter matches
 */
export function routeSessionRef(ref: SessionRef, adapters: MullAdapter[]): MullAdapter {
  if (adapters.length === 0) {
    throw new Error(
      'No adapters configured. Cannot route SessionRef. ' +
      'Pass adapters via MullOptions.adapters or configure them in mull.config.json.'
    );
  }

  const adapter = adapters.find(a => a.supports(ref));

  if (!adapter) {
    const expectedAdapter = REF_TYPE_ADAPTER_HINTS[ref.type];
    throw new Error(
      `No adapter found for SessionRef { type: '${ref.type}', id: '${ref.id}' }. ` +
      `Expected a '${expectedAdapter}' adapter to handle '${ref.type}' refs. ` +
      `Configured adapters: [${adapters.map(a => a.name).join(', ')}]. ` +
      `Ensure the appropriate adapter is included in the adapters list.`
    );
  }

  return adapter;
}

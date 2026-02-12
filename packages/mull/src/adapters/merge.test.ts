import { describe, it, expect } from 'vitest';
import { mergeSessionData } from './merge.js';
import type { SessionData, SessionMessage, SessionEvent, SessionDecision, SessionArtifact } from './core-types.js';

function makeSessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    messages: [],
    events: [],
    decisions: [],
    retrospective: null,
    artifacts: [],
    metadata: { session_id: 'test-session' },
    ...overrides,
  };
}

describe('mergeSessionData', () => {
  it('throws on empty results array', () => {
    expect(() => mergeSessionData([])).toThrow('at least one');
  });

  it('returns the single result unchanged for length-1 array', () => {
    const data = makeSessionData({ retrospective: 'notes here' });
    const merged = mergeSessionData([data]);
    expect(merged).toBe(data); // exact same reference
  });

  describe('messages', () => {
    it('interleaves messages by timestamp', () => {
      const a = makeSessionData({
        messages: [
          { timestamp: '2026-01-01T00:00:00Z', source: 'relay', role: 'user', content: 'first' },
          { timestamp: '2026-01-01T00:02:00Z', source: 'relay', role: 'user', content: 'third' },
        ],
      });
      const b = makeSessionData({
        messages: [
          { timestamp: '2026-01-01T00:01:00Z', source: 'transcript', role: 'assistant', content: 'second' },
          { timestamp: '2026-01-01T00:03:00Z', source: 'transcript', role: 'assistant', content: 'fourth' },
        ],
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.messages.map(m => m.content)).toEqual(['first', 'second', 'third', 'fourth']);
    });

    it('preserves order for same-timestamp messages', () => {
      const ts = '2026-01-01T00:00:00Z';
      const a = makeSessionData({
        messages: [
          { timestamp: ts, source: 'relay', role: 'user', content: 'a1' },
          { timestamp: ts, source: 'relay', role: 'user', content: 'a2' },
        ],
      });
      const b = makeSessionData({
        messages: [
          { timestamp: ts, source: 'transcript', role: 'assistant', content: 'b1' },
        ],
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.messages).toHaveLength(3);
      // All have same timestamp — stable sort preserves flat() order (a1, a2, b1)
      const contents = merged.messages.map(m => m.content);
      expect(contents).toEqual(['a1', 'a2', 'b1']);
    });

    it('handles empty messages from one adapter', () => {
      const a = makeSessionData({ messages: [] });
      const b = makeSessionData({
        messages: [
          { timestamp: '2026-01-01T00:00:00Z', source: 'relay', role: 'user', content: 'only' },
        ],
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.messages).toHaveLength(1);
      expect(merged.messages[0]!.content).toBe('only');
    });
  });

  describe('events', () => {
    it('interleaves events by timestamp', () => {
      const a = makeSessionData({
        events: [
          { timestamp: '2026-01-01T00:00:00Z', source: 'trajectory', type: 'start', payload: {} },
          { timestamp: '2026-01-01T00:02:00Z', source: 'trajectory', type: 'end', payload: {} },
        ],
      });
      const b = makeSessionData({
        events: [
          { timestamp: '2026-01-01T00:01:00Z', source: 'relay', type: 'message', payload: { text: 'hi' } },
        ],
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.events.map(e => e.type)).toEqual(['start', 'message', 'end']);
    });
  });

  describe('decisions', () => {
    it('combines decisions from multiple adapters', () => {
      const a = makeSessionData({
        decisions: [
          { id: 'd1', timestamp: '2026-01-01T00:00:00Z', source: 'trajectory', description: 'Use SQLite' },
        ],
      });
      const b = makeSessionData({
        decisions: [
          { id: 'd2', timestamp: '2026-01-01T00:01:00Z', source: 'relay', description: 'Use REST API' },
        ],
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.decisions).toHaveLength(2);
      expect(merged.decisions.map(d => d.id)).toEqual(['d1', 'd2']);
    });

    it('deduplicates decisions by id (first occurrence wins)', () => {
      const a = makeSessionData({
        decisions: [
          { id: 'd1', timestamp: '2026-01-01T00:00:00Z', source: 'trajectory', description: 'from-trajectory' },
        ],
      });
      const b = makeSessionData({
        decisions: [
          { id: 'd1', timestamp: '2026-01-01T00:00:00Z', source: 'relay', description: 'from-relay' },
        ],
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.decisions).toHaveLength(1);
      expect(merged.decisions[0]!.description).toBe('from-trajectory');
      expect(merged.decisions[0]!.source).toBe('trajectory');
    });
  });

  describe('retrospective', () => {
    it('takes first non-null retrospective', () => {
      const a = makeSessionData({ retrospective: null });
      const b = makeSessionData({ retrospective: 'Lessons learned from this session.' });
      const c = makeSessionData({ retrospective: 'Another retro that should be ignored.' });

      const merged = mergeSessionData([a, b, c]);
      expect(merged.retrospective).toBe('Lessons learned from this session.');
    });

    it('returns null if all retrospectives are null', () => {
      const a = makeSessionData({ retrospective: null });
      const b = makeSessionData({ retrospective: null });

      const merged = mergeSessionData([a, b]);
      expect(merged.retrospective).toBeNull();
    });

    it('takes first adapter retrospective when all provide one', () => {
      const a = makeSessionData({ retrospective: 'first wins' });
      const b = makeSessionData({ retrospective: 'second loses' });

      const merged = mergeSessionData([a, b]);
      expect(merged.retrospective).toBe('first wins');
    });
  });

  describe('artifacts', () => {
    it('combines artifacts from multiple adapters', () => {
      const a = makeSessionData({
        artifacts: [
          { id: 'a1', source: 'trajectory', type: 'file', path: '/src/main.ts' },
        ],
      });
      const b = makeSessionData({
        artifacts: [
          { id: 'a2', source: 'relay', type: 'snippet', content: 'console.log("hi")' },
        ],
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.artifacts).toHaveLength(2);
      expect(merged.artifacts.map(a => a.id)).toEqual(['a1', 'a2']);
    });

    it('deduplicates artifacts by id (first occurrence wins)', () => {
      const a = makeSessionData({
        artifacts: [
          { id: 'a1', source: 'trajectory', type: 'file', path: '/src/v1.ts' },
        ],
      });
      const b = makeSessionData({
        artifacts: [
          { id: 'a1', source: 'relay', type: 'file', path: '/src/v2.ts' },
        ],
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.artifacts).toHaveLength(1);
      expect(merged.artifacts[0]!.path).toBe('/src/v1.ts');
    });
  });

  describe('metadata', () => {
    it('first adapter takes precedence for conflicting scalar fields', () => {
      const a = makeSessionData({
        metadata: { session_id: 'ses-1', started_at: '2026-01-01T00:00:00Z' },
      });
      const b = makeSessionData({
        metadata: { session_id: 'ses-1', started_at: '2026-01-01T00:00:05Z', ended_at: '2026-01-01T01:00:00Z' },
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.metadata.session_id).toBe('ses-1');
      // First adapter's started_at wins
      expect(merged.metadata.started_at).toBe('2026-01-01T00:00:00Z');
      // Second adapter's ended_at fills the gap
      expect(merged.metadata.ended_at).toBe('2026-01-01T01:00:00Z');
    });

    it('fills gaps from later adapters', () => {
      const a = makeSessionData({
        metadata: { session_id: 'ses-1' },
      });
      const b = makeSessionData({
        metadata: { session_id: 'ses-1', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T01:00:00Z' },
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.metadata.started_at).toBe('2026-01-01T00:00:00Z');
      expect(merged.metadata.ended_at).toBe('2026-01-01T01:00:00Z');
    });

    it('ignores null/undefined metadata values from earlier adapters', () => {
      const a = makeSessionData({
        metadata: { session_id: 'ses-1', started_at: undefined },
      });
      const b = makeSessionData({
        metadata: { session_id: 'ses-1', started_at: '2026-01-01T00:00:00Z' },
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.metadata.started_at).toBe('2026-01-01T00:00:00Z');
    });

    it('preserves custom metadata fields', () => {
      const a = makeSessionData({
        metadata: { session_id: 'ses-1', agent_name: 'Worker-1' },
      });
      const b = makeSessionData({
        metadata: { session_id: 'ses-1', relay_channel: '#plan-abc' },
      });

      const merged = mergeSessionData([a, b]);
      expect(merged.metadata.agent_name).toBe('Worker-1');
      expect(merged.metadata.relay_channel).toBe('#plan-abc');
    });
  });

  describe('three-adapter merge', () => {
    it('merges data from trajectory, relay, and transcript adapters', () => {
      const trajectory = makeSessionData({
        messages: [
          { timestamp: '2026-01-01T00:00:00Z', source: 'trajectory', role: 'system', content: 'session started' },
        ],
        events: [
          { timestamp: '2026-01-01T00:00:00Z', source: 'trajectory', type: 'session_start', payload: {} },
        ],
        decisions: [
          { id: 'd1', timestamp: '2026-01-01T00:05:00Z', source: 'trajectory', description: 'Chose SQLite' },
        ],
        retrospective: null,
        artifacts: [],
        metadata: { session_id: 'ses-1', started_at: '2026-01-01T00:00:00Z' },
      });

      const relay = makeSessionData({
        messages: [
          { timestamp: '2026-01-01T00:01:00Z', source: 'relay', role: 'user', content: 'hello agent' },
          { timestamp: '2026-01-01T00:03:00Z', source: 'relay', role: 'agent', content: 'working on it' },
        ],
        events: [
          { timestamp: '2026-01-01T00:02:00Z', source: 'relay', type: 'channel_join', payload: { channel: '#plan-1' } },
        ],
        decisions: [],
        retrospective: 'Session went well overall.',
        artifacts: [
          { id: 'art-1', source: 'relay', type: 'file', path: '/output/plan.json' },
        ],
        metadata: { session_id: 'ses-1', relay_channel: '#plan-1' },
      });

      const transcript = makeSessionData({
        messages: [
          { timestamp: '2026-01-01T00:02:30Z', source: 'transcript', role: 'assistant', content: 'analyzing requirements' },
        ],
        events: [],
        decisions: [
          { id: 'd2', timestamp: '2026-01-01T00:04:00Z', source: 'transcript', description: 'REST over GraphQL' },
        ],
        retrospective: null,
        artifacts: [
          { id: 'art-2', source: 'transcript', type: 'snippet', content: 'const app = express()' },
        ],
        metadata: { session_id: 'ses-1', ended_at: '2026-01-01T01:00:00Z' },
      });

      const merged = mergeSessionData([trajectory, relay, transcript]);

      // Messages interleaved by timestamp
      expect(merged.messages.map(m => m.source)).toEqual([
        'trajectory', 'relay', 'transcript', 'relay',
      ]);

      // Events interleaved by timestamp
      expect(merged.events.map(e => e.type)).toEqual([
        'session_start', 'channel_join',
      ]);

      // Decisions union
      expect(merged.decisions).toHaveLength(2);
      expect(merged.decisions.map(d => d.id)).toEqual(['d1', 'd2']);

      // Retrospective: first non-null (relay)
      expect(merged.retrospective).toBe('Session went well overall.');

      // Artifacts union
      expect(merged.artifacts).toHaveLength(2);
      expect(merged.artifacts.map(a => a.id)).toEqual(['art-1', 'art-2']);

      // Metadata: trajectory first for started_at, transcript fills ended_at, relay fills relay_channel
      expect(merged.metadata.session_id).toBe('ses-1');
      expect(merged.metadata.started_at).toBe('2026-01-01T00:00:00Z');
      expect(merged.metadata.ended_at).toBe('2026-01-01T01:00:00Z');
      expect(merged.metadata.relay_channel).toBe('#plan-1');
    });
  });
});

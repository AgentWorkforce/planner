import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RelayDaemonAdapter } from './relay-daemon-adapter.js';

describe('RelayDaemonAdapter', () => {
  let tmpDir: string;
  let messagesDir: string;
  let sessionsFile: string;

  // Session timestamps: 2026-02-10 12:00 to 14:00
  const sessionStartTs = new Date('2026-02-10T12:00:00Z').getTime();
  const sessionEndTs = new Date('2026-02-10T14:00:00Z').getTime();
  const sessionId = 'test-session-001';
  const agentName = 'Worker-abc';

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'relay-daemon-test-'));
    messagesDir = join(tmpDir, 'messages');
    mkdirSync(messagesDir, { recursive: true });
    sessionsFile = join(tmpDir, 'sessions.jsonl');

    // Write sessions.jsonl
    const sessionEvents = [
      JSON.stringify({
        type: 'session-start',
        session: {
          id: sessionId,
          agentName,
          projectId: 'proj-123',
          startedAt: sessionStartTs,
        },
      }),
      JSON.stringify({
        type: 'session-end',
        id: sessionId,
        endedAt: sessionEndTs,
        closedBy: 'released',
      }),
      // System agent session (should be filtered in listSessions)
      JSON.stringify({
        type: 'session-start',
        session: {
          id: 'sys-session-001',
          agentName: '__status__',
          startedAt: sessionStartTs,
        },
      }),
      JSON.stringify({
        type: 'session-end',
        id: 'sys-session-001',
        endedAt: sessionStartTs + 100,
        closedBy: 'disconnect',
      }),
      // Dashboard session (should be filtered in listSessions)
      JSON.stringify({
        type: 'session-start',
        session: {
          id: 'dash-session-001',
          agentName: 'Dashboard',
          startedAt: sessionStartTs,
        },
      }),
    ].join('\n');
    writeFileSync(sessionsFile, sessionEvents);

    // Write messages JSONL for 2026-02-10
    const messages = [
      // System message — should be filtered out
      JSON.stringify({
        type: 'message',
        message: {
          id: 'msg-sys',
          ts: sessionStartTs + 1000,
          from: '__system__',
          to: '#general',
          kind: 'state',
          body: 'join:Worker-abc',
          data: { _channelMembership: { member: 'Worker-abc', action: 'join' } },
          status: 'read',
          is_urgent: false,
          is_broadcast: true,
        },
      }),
      // Agent message FROM our agent
      JSON.stringify({
        type: 'message',
        message: {
          id: 'msg-1',
          ts: sessionStartTs + 5000,
          from: agentName,
          to: 'Lead',
          kind: 'message',
          body: 'ACK: Starting task',
          status: 'unread',
          is_urgent: false,
          is_broadcast: false,
        },
      }),
      // Message TO our agent
      JSON.stringify({
        type: 'message',
        message: {
          id: 'msg-2',
          ts: sessionStartTs + 10000,
          from: 'Lead',
          to: agentName,
          kind: 'message',
          body: 'Good, proceed with implementation',
          status: 'read',
          is_urgent: false,
          is_broadcast: false,
        },
      }),
      // Agent status event
      JSON.stringify({
        type: 'message',
        message: {
          id: 'msg-3',
          ts: sessionStartTs + 15000,
          from: 'Relay',
          to: agentName,
          kind: 'agent_status',
          body: 'agent_left',
          data: { type: 'agent_left', agentId: 'OtherWorker', reason: 'released' },
          status: 'unread',
          is_urgent: false,
          is_broadcast: true,
        },
      }),
      // Unrelated message (different agent, should be filtered)
      JSON.stringify({
        type: 'message',
        message: {
          id: 'msg-unrelated',
          ts: sessionStartTs + 20000,
          from: 'OtherWorker',
          to: 'Lead',
          kind: 'message',
          body: 'Different agent conversation',
          status: 'unread',
          is_urgent: false,
          is_broadcast: false,
        },
      }),
      // Message outside session time window (after endTs)
      JSON.stringify({
        type: 'message',
        message: {
          id: 'msg-late',
          ts: sessionEndTs + 5000,
          from: agentName,
          to: 'Lead',
          kind: 'message',
          body: 'This is after the session ended',
          status: 'unread',
          is_urgent: false,
          is_broadcast: false,
        },
      }),
      // Status envelope (not a message — should be skipped)
      JSON.stringify({
        type: 'status',
        id: 'msg-1',
        status: 'acked',
        ts: sessionStartTs + 6000,
      }),
    ].join('\n');
    writeFileSync(join(messagesDir, '2026-02-10.jsonl'), messages);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('has type relay-daemon', () => {
    const adapter = new RelayDaemonAdapter({ dataDir: tmpDir });
    expect(adapter.type).toBe('relay-daemon');
  });

  describe('read', () => {
    it('returns messages for the agent within session boundaries', async () => {
      const adapter = new RelayDaemonAdapter({ dataDir: tmpDir, sessionsFile });
      const entries = await adapter.read(sessionId);

      // Should get: msg-1 (from agent), msg-2 (to agent), msg-3 (agent_status to agent)
      // Should NOT get: system message, unrelated message, late message, status envelope
      expect(entries).toHaveLength(3);

      // Verify sorted by timestamp (ISO strings compare lexicographically)
      expect(entries[0]!.timestamp < entries[1]!.timestamp).toBe(true);
      expect(entries[1]!.timestamp < entries[2]!.timestamp).toBe(true);
    });

    it('returns message entries with correct format', async () => {
      const adapter = new RelayDaemonAdapter({ dataDir: tmpDir, sessionsFile });
      const entries = await adapter.read(sessionId);

      const msg1 = entries[0]!;
      expect(msg1.source).toBe('relay-daemon');
      expect(msg1.type).toBe('message');
      const content = msg1.content as Record<string, unknown>;
      expect(content.role).toBe(agentName);
      expect(content.content).toBe('ACK: Starting task');
      expect(content.to).toBe('Lead');
    });

    it('returns event entries for agent_status messages', async () => {
      const adapter = new RelayDaemonAdapter({ dataDir: tmpDir, sessionsFile });
      const entries = await adapter.read(sessionId);

      const statusEntry = entries[2]!;
      expect(statusEntry.type).toBe('event');
      const content = statusEntry.content as Record<string, unknown>;
      expect(content.type).toBe('agent_status');
    });

    it('applies cursor filter', async () => {
      const adapter = new RelayDaemonAdapter({ dataDir: tmpDir, sessionsFile });
      // Set cursor to after msg-1 but before msg-2
      const cursorTs = new Date(sessionStartTs + 7000).toISOString();
      const entries = await adapter.read(sessionId, { last_mulled_at: cursorTs });

      // Should only get msg-2 and msg-3
      expect(entries).toHaveLength(2);
    });

    it('returns empty for unknown session', async () => {
      const adapter = new RelayDaemonAdapter({ dataDir: tmpDir, sessionsFile });
      const entries = await adapter.read('nonexistent-session');
      expect(entries).toHaveLength(0);
    });

    it('returns empty when messages dir does not exist', async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'relay-daemon-empty-'));
      const emptySessions = join(emptyDir, 'sessions.jsonl');
      writeFileSync(emptySessions, JSON.stringify({
        type: 'session-start',
        session: { id: 'x', agentName: 'A', startedAt: Date.now() },
      }));

      const adapter = new RelayDaemonAdapter({ dataDir: emptyDir, sessionsFile: emptySessions });
      const entries = await adapter.read('x');
      expect(entries).toHaveLength(0);

      rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe('listSessions', () => {
    it('lists agent sessions, filtering out system and dashboard', async () => {
      const adapter = new RelayDaemonAdapter({ dataDir: tmpDir, sessionsFile });
      const sessions = await adapter.listSessions();

      // Should only include Worker-abc session, not __status__ or Dashboard
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.sessionId).toBe(sessionId);
      expect(sessions[0]!.startedAt).toBeDefined();
      expect(sessions[0]!.endedAt).toBeDefined();
    });

    it('filters by time range (after)', async () => {
      const adapter = new RelayDaemonAdapter({ dataDir: tmpDir, sessionsFile });
      // After the session ended → no results
      const sessions = await adapter.listSessions({
        after: new Date(sessionEndTs + 10000).toISOString(),
      });
      expect(sessions).toHaveLength(0);
    });

    it('filters by time range (before)', async () => {
      const adapter = new RelayDaemonAdapter({ dataDir: tmpDir, sessionsFile });
      // Before the session started → no results
      const sessions = await adapter.listSessions({
        before: new Date(sessionStartTs - 10000).toISOString(),
      });
      expect(sessions).toHaveLength(0);
    });

    it('returns empty when sessions file does not exist', async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'relay-daemon-nosess-'));
      const adapter = new RelayDaemonAdapter({ dataDir: emptyDir });
      const sessions = await adapter.listSessions();
      expect(sessions).toHaveLength(0);
      rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe('factory integration', () => {
    it('can be created via createAdapter', async () => {
      const { createAdapter } = await import('../factory.js');
      const adapter = createAdapter('relay-daemon', { dataDir: tmpDir });
      expect(adapter.type).toBe('relay-daemon');
    });

    it('validates config via createAdapter', async () => {
      const { createAdapter } = await import('../factory.js');
      expect(() => createAdapter('relay-daemon', {})).toThrow();
      expect(() => createAdapter('relay-daemon', { dataDir: '' })).toThrow();
    });
  });
});

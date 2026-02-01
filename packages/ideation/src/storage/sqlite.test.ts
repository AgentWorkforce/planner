/**
 * Ideation Storage Tests
 *
 * Tests for SQLiteIdeationStorage implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteIdeationStorage } from './sqlite.js';
import type { SessionSource, TranscriptMessage, ActiveSpecialist, PlannerSend } from '../domain/index.js';

describe('SQLiteIdeationStorage', () => {
  let storage: SQLiteIdeationStorage;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  // ==========================================================================
  // Session CRUD Lifecycle
  // ==========================================================================

  describe('Session CRUD', () => {
    it('creates a session with initial values', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Build a todo app' };
      const session = await storage.createSession(source);

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.source.type).toBe('human');
      expect(session.source.initial_intent).toBe('Build a todo app');
      expect(session.transcript).toEqual([]);
      expect(session.understanding).toEqual({});
      expect(session.active_specialists).toEqual([]);
      expect(session.planner_sends).toEqual([]);
      expect(session.created_at).toBeDefined();
      expect(session.updated_at).toBeDefined();
    });

    it('creates a session with initiative_id', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source, 'init-123');

      expect(session.initiative_id).toBe('init-123');
    });

    it('gets a session by ID', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const created = await storage.createSession(source);

      const retrieved = await storage.getSession(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.source.initial_intent).toBe('Test');
    });

    it('returns null for non-existent session', async () => {
      const session = await storage.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('lists sessions sorted by updated_at DESC', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'First' };
      await storage.createSession(source);

      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));

      const source2: SessionSource = { type: 'human', initial_intent: 'Second' };
      await storage.createSession(source2);

      const sessions = await storage.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.source.initial_intent).toBe('Second');
      expect(sessions[1]?.source.initial_intent).toBe('First');
    });

    it('filters sessions by status', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Active' };
      const session1 = await storage.createSession(source);

      const source2: SessionSource = { type: 'human', initial_intent: 'Abandoned' };
      const session2 = await storage.createSession(source2);
      await storage.updateSessionStatus(session2.id, 'abandoned');

      const active = await storage.listSessions({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0]?.id).toBe(session1.id);

      const abandoned = await storage.listSessions({ status: 'abandoned' });
      expect(abandoned).toHaveLength(1);
      expect(abandoned[0]?.id).toBe(session2.id);
    });

    it('filters sessions by initiative_id', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      await storage.createSession(source, 'init-a');
      await storage.createSession(source, 'init-b');
      await storage.createSession(source); // no initiative

      const filtered = await storage.listSessions({ initiative_id: 'init-a' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.initiative_id).toBe('init-a');
    });

    it('updates session status', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source);

      await new Promise(r => setTimeout(r, 10));

      const updated = await storage.updateSessionStatus(session.id, 'abandoned');
      expect(updated.status).toBe('abandoned');
      expect(updated.updated_at).not.toBe(session.updated_at);
    });

    it('throws when updating non-existent session', async () => {
      await expect(
        storage.updateSessionStatus('non-existent', 'abandoned')
      ).rejects.toThrow('Session not found');
    });
  });

  // ==========================================================================
  // Transcript Append
  // ==========================================================================

  describe('Transcript Append', () => {
    it('appends messages preserving existing ones', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source);

      const msg1: TranscriptMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };

      const after1 = await storage.appendTranscript(session.id, msg1);
      expect(after1.transcript).toHaveLength(1);
      expect(after1.transcript[0]?.content).toBe('Hello');

      const msg2: TranscriptMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date().toISOString(),
      };

      const after2 = await storage.appendTranscript(session.id, msg2);
      expect(after2.transcript).toHaveLength(2);
      expect(after2.transcript[0]?.content).toBe('Hello');
      expect(after2.transcript[1]?.content).toBe('Hi there!');
    });

    it('updates updated_at on append', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source);

      await new Promise(r => setTimeout(r, 10));

      const msg: TranscriptMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };

      const updated = await storage.appendTranscript(session.id, msg);
      expect(updated.updated_at).not.toBe(session.updated_at);
    });
  });

  // ==========================================================================
  // Understanding Update
  // ==========================================================================

  describe('Understanding Update', () => {
    it('updates specialist observations without overwriting others', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source);

      // Add Architect observations
      const after1 = await storage.updateUnderstanding(session.id, 'Architect', {
        patterns: ['microservices'],
        confidence: 'exploring',
      });

      expect(after1.understanding['Architect']).toEqual({
        patterns: ['microservices'],
        confidence: 'exploring',
      });

      // Add Designer observations - Architect should be preserved
      const after2 = await storage.updateUnderstanding(session.id, 'Designer', {
        user_flows: ['onboarding'],
        confidence: 'forming',
      });

      expect(after2.understanding['Architect']).toEqual({
        patterns: ['microservices'],
        confidence: 'exploring',
      });
      expect(after2.understanding['Designer']).toEqual({
        user_flows: ['onboarding'],
        confidence: 'forming',
      });

      // Update Architect observations - Designer should be preserved
      const after3 = await storage.updateUnderstanding(session.id, 'Architect', {
        patterns: ['microservices', 'event-sourcing'],
        confidence: 'confident',
      });

      expect(after3.understanding['Architect']).toEqual({
        patterns: ['microservices', 'event-sourcing'],
        confidence: 'confident',
      });
      expect(after3.understanding['Designer']).toEqual({
        user_flows: ['onboarding'],
        confidence: 'forming',
      });
    });

    it('accepts freeform specialist names', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source);

      // Custom specialist name
      const updated = await storage.updateUnderstanding(session.id, 'CustomAPIExpert', {
        integrations: ['stripe', 'auth0'],
      });

      expect(updated.understanding['CustomAPIExpert']).toEqual({
        integrations: ['stripe', 'auth0'],
      });
    });
  });

  // ==========================================================================
  // Active Specialists
  // ==========================================================================

  describe('Active Specialists', () => {
    it('adds and removes active specialists', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source);

      const specialist: ActiveSpecialist = {
        name: 'Architect',
        agent_id: 'agent-123',
        spawned_at: new Date().toISOString(),
        role_hint: 'System design expert',
      };

      // Add specialist
      const after1 = await storage.addActiveSpecialist(session.id, specialist);
      expect(after1.active_specialists).toHaveLength(1);
      expect(after1.active_specialists[0]?.name).toBe('Architect');
      expect(after1.active_specialists[0]?.agent_id).toBe('agent-123');

      // Add another
      const specialist2: ActiveSpecialist = {
        name: 'Designer',
        agent_id: 'agent-456',
        spawned_at: new Date().toISOString(),
      };

      const after2 = await storage.addActiveSpecialist(session.id, specialist2);
      expect(after2.active_specialists).toHaveLength(2);

      // Remove first one
      const after3 = await storage.removeActiveSpecialist(session.id, 'Architect');
      expect(after3.active_specialists).toHaveLength(1);
      expect(after3.active_specialists[0]?.name).toBe('Designer');
    });
  });

  // ==========================================================================
  // Planner Send
  // ==========================================================================

  describe('Planner Send', () => {
    it('appends planner sends preserving history', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source);

      const send1: PlannerSend = {
        sent_at: new Date().toISOString(),
        payload: {
          goal: 'Build a todo app',
          source: { type: 'ideation', session_id: session.id },
          understanding: { Architect: { patterns: ['CRUD'] } },
        },
        result: {
          plan_id: 'plan-1',
          plan_version: 1,
        },
      };

      const after1 = await storage.appendPlannerSend(session.id, send1);
      expect(after1.planner_sends).toHaveLength(1);
      expect(after1.planner_sends[0]?.result.plan_id).toBe('plan-1');

      const send2: PlannerSend = {
        sent_at: new Date().toISOString(),
        payload: {
          goal: 'Build a todo app with auth',
          source: { type: 'ideation', session_id: session.id },
          understanding: { Architect: { patterns: ['CRUD', 'auth'] } },
        },
        result: {
          plan_id: 'plan-1',
          plan_version: 2,
        },
      };

      const after2 = await storage.appendPlannerSend(session.id, send2);
      expect(after2.planner_sends).toHaveLength(2);
      expect(after2.planner_sends[0]?.result.plan_version).toBe(1);
      expect(after2.planner_sends[1]?.result.plan_version).toBe(2);
    });

    it('captures full payload snapshot', async () => {
      const source: SessionSource = { type: 'human', initial_intent: 'Test' };
      const session = await storage.createSession(source);

      const send: PlannerSend = {
        sent_at: new Date().toISOString(),
        payload: {
          goal: 'Build an API',
          context: 'REST API for mobile app',
          source: { type: 'ideation', session_id: session.id },
          understanding: {
            Architect: { patterns: ['REST'], confidence: 'confident' },
            Security: { concerns: ['auth', 'rate-limiting'] },
          },
          initiative_id: 'init-123',
        },
        result: {
          plan_id: 'plan-1',
          plan_version: 1,
        },
      };

      const updated = await storage.appendPlannerSend(session.id, send);
      const recorded = updated.planner_sends[0];

      expect(recorded?.payload.goal).toBe('Build an API');
      expect(recorded?.payload.context).toBe('REST API for mobile app');
      expect(recorded?.payload.understanding['Architect']).toEqual({
        patterns: ['REST'],
        confidence: 'confident',
      });
      expect(recorded?.payload.understanding['Security']).toEqual({
        concerns: ['auth', 'rate-limiting'],
      });
      expect(recorded?.payload.initiative_id).toBe('init-123');
    });
  });
});

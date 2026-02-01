/**
 * SQLite Storage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteIdeationStorage } from './sqlite.js';

describe('SQLiteIdeationStorage', () => {
  let storage: SQLiteIdeationStorage;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('Session Operations', () => {
    it('creates a session with initial intent', async () => {
      const session = await storage.createSession({
        initial_intent: 'I want to build a user authentication system',
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.initial_intent).toBe('I want to build a user authentication system');
      expect(session.transcript).toEqual([]);
      expect(session.understanding).toEqual({});
      expect(session.source.type).toBe('human_initiated');
    });

    it('retrieves a session by ID', async () => {
      const created = await storage.createSession({
        initial_intent: 'Test session',
      });

      const retrieved = await storage.getSession(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.initial_intent).toBe('Test session');
    });

    it('returns null for non-existent session', async () => {
      const session = await storage.getSession('non-existent-id');
      expect(session).toBeNull();
    });

    it('lists sessions filtered by status', async () => {
      await storage.createSession({ initial_intent: 'Session 1' });
      await storage.createSession({ initial_intent: 'Session 2' });

      const activeSessions = await storage.listSessions({ status: 'active' });
      expect(activeSessions.length).toBe(2);

      const crystallizedSessions = await storage.listSessions({ status: 'crystallized' });
      expect(crystallizedSessions.length).toBe(0);
    });

    it('appends messages to transcript', async () => {
      const session = await storage.createSession({ initial_intent: 'Test' });

      const updated = await storage.appendMessage(session.id, {
        role: 'user',
        content: 'Hello, I need help with authentication',
      });

      expect(updated.transcript.length).toBe(1);
      expect(updated.transcript[0]!.role).toBe('user');
      expect(updated.transcript[0]!.content).toBe('Hello, I need help with authentication');
      expect(updated.transcript[0]!.timestamp).toBeDefined();
    });

    it('updates observations for a specific role', async () => {
      const session = await storage.createSession({ initial_intent: 'Test' });

      const updated = await storage.updateObservations(session.id, 'architect', {
        observations: ['JWT tokens mentioned', 'OAuth consideration'],
        keywords: ['authentication', 'JWT', 'OAuth'],
        confidence: 'forming',
      });

      expect(updated.understanding.architect).toBeDefined();
      expect(updated.understanding.architect!.observations).toContain('JWT tokens mentioned');
      expect(updated.understanding.architect!.confidence).toBe('forming');
    });

    it('preserves other roles when updating observations', async () => {
      const session = await storage.createSession({ initial_intent: 'Test' });

      await storage.updateObservations(session.id, 'architect', {
        observations: ['Arch note'],
        confidence: 'exploring',
      });

      const updated = await storage.updateObservations(session.id, 'security', {
        concerns: ['Token storage security'],
        confidence: 'forming',
      });

      expect(updated.understanding.architect).toBeDefined();
      expect(updated.understanding.security).toBeDefined();
      expect(updated.understanding.architect!.observations).toContain('Arch note');
      expect(updated.understanding.security!.concerns).toContain('Token storage security');
    });
  });

  describe('Nugget Operations', () => {
    it('crystallizes a session into a nugget', async () => {
      const session = await storage.createSession({ initial_intent: 'Build auth' });

      await storage.updateObservations(session.id, 'architect', {
        observations: ['JWT preferred'],
        confidence: 'confident',
      });

      const nugget = await storage.crystallizeSession(session.id, {
        goal: 'Implement JWT-based user authentication',
        context: 'We need secure user sessions',
        constraints: ['Must support refresh tokens', 'No third-party auth initially'],
      });

      expect(nugget.id).toBeDefined();
      expect(nugget.session_id).toBe(session.id);
      expect(nugget.goal).toBe('Implement JWT-based user authentication');
      expect(nugget.constraints).toContain('Must support refresh tokens');
      expect(nugget.understanding.architect).toBeDefined();

      // Check session was updated
      const updatedSession = await storage.getSession(session.id);
      expect(updatedSession!.status).toBe('crystallized');
      expect(updatedSession!.nugget_id).toBe(nugget.id);
    });

    it('prevents crystallizing non-active sessions', async () => {
      const session = await storage.createSession({ initial_intent: 'Test' });

      await storage.crystallizeSession(session.id, {
        goal: 'First crystallization',
      });

      await expect(
        storage.crystallizeSession(session.id, {
          goal: 'Second crystallization',
        })
      ).rejects.toThrow('Session is not active');
    });

    it('retrieves nugget by session ID', async () => {
      const session = await storage.createSession({ initial_intent: 'Test' });
      const nugget = await storage.crystallizeSession(session.id, {
        goal: 'Test goal',
      });

      const retrieved = await storage.getNuggetBySession(session.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(nugget.id);
    });

    it('promotes nugget with plan ID', async () => {
      const session = await storage.createSession({ initial_intent: 'Test' });
      const nugget = await storage.crystallizeSession(session.id, {
        goal: 'Test goal',
      });

      const promoted = await storage.promoteNugget(nugget.id, 'plan-123');

      expect(promoted.plan_id).toBe('plan-123');

      const updatedSession = await storage.getSession(session.id);
      expect(updatedSession!.status).toBe('promoted');
    });
  });

  describe('Cleanup', () => {
    it('deletes session and associated nugget', async () => {
      const session = await storage.createSession({ initial_intent: 'Test' });
      const nugget = await storage.crystallizeSession(session.id, {
        goal: 'Test goal',
      });

      await storage.deleteSession(session.id);

      expect(await storage.getSession(session.id)).toBeNull();
      expect(await storage.getNugget(nugget.id)).toBeNull();
    });
  });
});

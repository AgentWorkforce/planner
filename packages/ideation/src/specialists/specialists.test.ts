/**
 * Specialists Module Tests
 *
 * Tests for specialist templates, tools, and lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SPECIALIST_TEMPLATES,
  getSpecialistPrompt,
  getTemplateNames,
  hasTemplate,
} from './templates.js';
import {
  SPECIALIST_TOOLS,
} from './tools.js';
import {
  executeSpecialistTool,
  getMockSpecialistToolResult,
} from './tool-executor.js';
import {
  releaseSpecialists,
  releaseSpecialist,
  hasActiveSpecialists,
  getActiveSpecialistCount,
} from './lifecycle.js';
import { SQLiteIdeationStorage } from '../storage/sqlite.js';
import { specialistQueue } from '../interviewer/specialist-queue.js';

// =============================================================================
// Template Tests
// =============================================================================

describe('Templates', () => {
  describe('SPECIALIST_TEMPLATES', () => {
    it('should have all common specialist types', () => {
      const expectedTypes = ['Architect', 'DataModeller', 'Designer', 'QA', 'Security', 'APIDesigner'];

      for (const type of expectedTypes) {
        expect(SPECIALIST_TEMPLATES.has(type)).toBe(true);
        const template = SPECIALIST_TEMPLATES.get(type);
        expect(template).toBeDefined();
        expect(template?.displayName).toBeDefined();
        expect(template?.focus).toBeDefined();
        expect(template?.basePrompt).toBeDefined();
      }
    });

    it('should have templates with correct structure', () => {
      for (const [name, template] of SPECIALIST_TEMPLATES) {
        expect(typeof template.displayName).toBe('string');
        expect(typeof template.focus).toBe('string');
        expect(typeof template.basePrompt).toBe('string');
        // Template prompts should mention being invisible
        expect(template.basePrompt.toLowerCase()).toContain('invisible');
      }
    });
  });

  describe('getSpecialistPrompt', () => {
    it('should use template when available', () => {
      const prompt = getSpecialistPrompt({
        name: 'Architect',
        focus: 'System design',
        sessionId: 'test-session',
      });

      expect(prompt).toContain('System Architect');
      expect(prompt).toContain('test-session');
    });

    it('should build custom prompt for non-template specialists', () => {
      const prompt = getSpecialistPrompt({
        name: 'CustomSpecialist',
        focus: 'Special focus area',
        sessionId: 'test-session',
      });

      expect(prompt).toContain('CustomSpecialist');
      expect(prompt).toContain('Special focus area');
      expect(prompt).toContain('test-session');
    });

    it('should include initial intent when provided', () => {
      const prompt = getSpecialistPrompt({
        name: 'Designer',
        focus: 'UX',
        sessionId: 'test-session',
        initialIntent: 'Build a todo app',
      });

      expect(prompt).toContain('Build a todo app');
    });

    it('should include custom context when provided', () => {
      const prompt = getSpecialistPrompt({
        name: 'QA',
        focus: 'Testing',
        sessionId: 'test-session',
        customContext: 'Focus on mobile testing',
      });

      expect(prompt).toContain('Focus on mobile testing');
    });
  });

  describe('getTemplateNames', () => {
    it('should return all template names', () => {
      const names = getTemplateNames();
      expect(names).toContain('Architect');
      expect(names).toContain('Designer');
      expect(names).toContain('Security');
    });
  });

  describe('hasTemplate', () => {
    it('should return true for known templates', () => {
      expect(hasTemplate('Architect')).toBe(true);
      expect(hasTemplate('Designer')).toBe(true);
    });

    it('should return false for unknown templates', () => {
      expect(hasTemplate('CustomSpecialist')).toBe(false);
      expect(hasTemplate('Unknown')).toBe(false);
    });
  });
});

// =============================================================================
// Tools Tests
// =============================================================================

describe('Tools', () => {
  describe('SPECIALIST_TOOLS', () => {
    it('should define all required tools', () => {
      const toolNames = SPECIALIST_TOOLS.map(t => t.name);

      expect(toolNames).toContain('update_observations');
      expect(toolNames).toContain('read_understanding');
      expect(toolNames).toContain('queue_insight');
    });

    it('should have valid tool schemas', () => {
      for (const tool of SPECIALIST_TOOLS) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.input_schema).toBeDefined();
        expect(tool.input_schema.type).toBe('object');
      }
    });
  });
});

// =============================================================================
// Tool Executor Tests
// =============================================================================

describe('Tool Executor', () => {
  let storage: SQLiteIdeationStorage;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    specialistQueue.clearAll();
  });

  describe('executeSpecialistTool', () => {
    it('should execute update_observations', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      const result = await executeSpecialistTool(
        'Architect',
        'update_observations',
        {
          session_id: session.id,
          observations: {
            components: ['API', 'Database', 'Frontend'],
            confidence: 'forming',
          },
        },
        { storage }
      );

      expect(result.success).toBe(true);

      // Verify observations were stored
      const updated = await storage.getSession(session.id);
      expect(updated?.understanding.Architect).toBeDefined();
      expect(updated?.understanding.Architect.components).toEqual(['API', 'Database', 'Frontend']);
    });

    it('should execute read_understanding', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Add some understanding
      await storage.updateUnderstanding(session.id, 'Architect', { test: true });

      const result = await executeSpecialistTool(
        'Designer',
        'read_understanding',
        { session_id: session.id },
        { storage }
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('understanding');
      expect((result.data as { understanding: Record<string, unknown> }).understanding.Architect).toBeDefined();
    });

    it('should execute queue_insight', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      const result = await executeSpecialistTool(
        'Security',
        'queue_insight',
        {
          session_id: session.id,
          type: 'concern',
          content: 'Authentication needs attention',
          priority: 8,
        },
        { storage }
      );

      expect(result.success).toBe(true);

      // Verify insight was queued
      const pending = specialistQueue.getAllInputs(session.id.slice(0, 8));
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].content).toBe('Authentication needs attention');
    });

    it('should return error for non-existent session', async () => {
      const result = await executeSpecialistTool(
        'Architect',
        'read_understanding',
        { session_id: 'non-existent' },
        { storage }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for unknown tool', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      const result = await executeSpecialistTool(
        'Architect',
        'unknown_tool',
        { session_id: session.id },
        { storage }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('getMockSpecialistToolResult', () => {
    it('should return mock result for update_observations', () => {
      const result = getMockSpecialistToolResult(
        'Architect',
        'update_observations',
        { session_id: 'test', observations: {} }
      );

      expect(result.success).toBe(true);
    });

    it('should return mock result for read_understanding', () => {
      const result = getMockSpecialistToolResult(
        'Architect',
        'read_understanding',
        { session_id: 'test' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('understanding');
    });

    it('should return mock result for queue_insight', () => {
      const result = getMockSpecialistToolResult(
        'Architect',
        'queue_insight',
        { session_id: 'test', type: 'observation', content: 'test', priority: 5 }
      );

      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Lifecycle Tests
// =============================================================================

describe('Lifecycle', () => {
  let storage: SQLiteIdeationStorage;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('releaseSpecialists', () => {
    it('should release all specialists for a session', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Add specialists
      await storage.addActiveSpecialist(session.id, {
        name: 'Architect',
        agent_id: 'arch-123',
        focus: 'System design',
        spawned_at: new Date().toISOString(),
      });
      await storage.addActiveSpecialist(session.id, {
        name: 'Designer',
        agent_id: 'design-456',
        focus: 'UX',
        spawned_at: new Date().toISOString(),
      });

      const releaseAgent = vi.fn();

      const released = await releaseSpecialists(session.id, { storage, releaseAgent });

      expect(released).toHaveLength(2);
      expect(released).toContain('arch-123');
      expect(released).toContain('design-456');
      expect(releaseAgent).toHaveBeenCalledTimes(2);

      // Verify specialists were removed
      const updated = await storage.getSession(session.id);
      expect(updated?.active_specialists).toHaveLength(0);
    });

    it('should handle session with no specialists', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      const released = await releaseSpecialists(session.id, { storage });

      expect(released).toHaveLength(0);
    });

    it('should throw for non-existent session', async () => {
      await expect(
        releaseSpecialists('non-existent', { storage })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('releaseSpecialist', () => {
    it('should release a single specialist', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      await storage.addActiveSpecialist(session.id, {
        name: 'Architect',
        agent_id: 'arch-123',
        focus: 'System design',
        spawned_at: new Date().toISOString(),
      });

      const releaseAgent = vi.fn();

      const released = await releaseSpecialist(session.id, 'Architect', { storage, releaseAgent });

      expect(released).toBe('arch-123');
      expect(releaseAgent).toHaveBeenCalledWith('arch-123');
    });

    it('should return null for non-existent specialist', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      const released = await releaseSpecialist(session.id, 'NonExistent', { storage });

      expect(released).toBeNull();
    });
  });

  describe('hasActiveSpecialists', () => {
    it('should return true when specialists exist', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      await storage.addActiveSpecialist(session.id, {
        name: 'Architect',
        agent_id: 'arch-123',
        focus: 'System design',
        spawned_at: new Date().toISOString(),
      });

      const has = await hasActiveSpecialists(session.id, storage);
      expect(has).toBe(true);
    });

    it('should return false when no specialists', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      const has = await hasActiveSpecialists(session.id, storage);
      expect(has).toBe(false);
    });
  });

  describe('getActiveSpecialistCount', () => {
    it('should return correct count', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      expect(await getActiveSpecialistCount(session.id, storage)).toBe(0);

      await storage.addActiveSpecialist(session.id, {
        name: 'Architect',
        agent_id: 'arch-123',
        focus: 'System design',
        spawned_at: new Date().toISOString(),
      });

      expect(await getActiveSpecialistCount(session.id, storage)).toBe(1);

      await storage.addActiveSpecialist(session.id, {
        name: 'Designer',
        agent_id: 'design-456',
        focus: 'UX',
        spawned_at: new Date().toISOString(),
      });

      expect(await getActiveSpecialistCount(session.id, storage)).toBe(2);
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration', () => {
  let storage: SQLiteIdeationStorage;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    specialistQueue.clearAll();
  });

  it('should support custom (non-template) specialist spawning', async () => {
    const session = await storage.createSession({
      type: 'human',
      initial_intent: 'Build a video streaming app',
    });

    // Spawn a custom specialist (no template)
    await storage.addActiveSpecialist(session.id, {
      name: 'VideoStreamingExpert',
      agent_id: 'video-123',
      focus: 'Video encoding and streaming protocols',
      spawned_at: new Date().toISOString(),
    });

    // Build prompt for custom specialist
    const prompt = getSpecialistPrompt({
      name: 'VideoStreamingExpert',
      focus: 'Video encoding and streaming protocols',
      sessionId: session.id,
      initialIntent: session.source.initial_intent,
      customContext: 'Focus on HLS vs DASH comparison',
    });

    expect(prompt).toContain('VideoStreamingExpert');
    expect(prompt).toContain('Video encoding');
    expect(prompt).toContain('HLS vs DASH');
    expect(prompt).toContain('video streaming app');
  });

  it('should allow freeform observations without validation', async () => {
    const session = await storage.createSession({
      type: 'human',
      initial_intent: 'Test',
    });

    // Update with arbitrary structure - no schema enforcement
    const result = await executeSpecialistTool(
      'CustomSpecialist',
      'update_observations',
      {
        session_id: session.id,
        observations: {
          arbitrary: { nested: { deeply: { value: 42 } } },
          arrays: [1, 2, 3],
          customField: 'anything goes',
          confidence: 'exploring',
        },
      },
      { storage }
    );

    expect(result.success).toBe(true);

    // Verify freeform structure was preserved
    const updated = await storage.getSession(session.id);
    expect(updated?.understanding.CustomSpecialist.arbitrary).toEqual({
      nested: { deeply: { value: 42 } },
    });
    expect(updated?.understanding.CustomSpecialist.arrays).toEqual([1, 2, 3]);
  });
});

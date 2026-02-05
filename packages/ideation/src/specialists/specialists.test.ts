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

    it('should execute create_block', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Add a transcript message to establish turn context
      await storage.appendTranscript(session.id, {
        role: 'user',
        content: 'I need authentication',
        timestamp: new Date().toISOString(),
      });

      const result = await executeSpecialistTool(
        'Security',
        'create_block',
        {
          session_id: session.id,
          type: 'feature',
          title: 'User Authentication',
          keyword: 'Auth',
          emoji: '🔐',
          content: '## Authentication Feature\n\nOAuth 2.0 implementation with JWT tokens.',
          confidence: 75,
        },
        { storage }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const block = (result.data as { block: { id: string; title: string; specialist: string; confidence: number; status: string } }).block;
      expect(block.id).toBeDefined();
      expect(block.title).toBe('User Authentication');
      expect(block.specialist).toBe('Security');
      expect(block.confidence).toBe(75);
      expect(block.status).toBe('developing'); // 75 confidence -> developing

      // Verify block was added to session
      const updated = await storage.getSession(session.id);
      expect(updated?.blocks).toHaveLength(1);
      expect(updated?.blocks[0]?.id).toBe(block.id);
    });

    it('should normalize confidence values in create_block', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Test confidence clamping
      const result = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'entity',
          title: 'User Model',
          keyword: 'User',
          emoji: '👤',
          content: 'User entity with profile data',
          confidence: 150, // Over 100
        },
        { storage }
      );

      expect(result.success).toBe(true);
      const block = (result.data as { block: { confidence: number; status: string } }).block;
      expect(block.confidence).toBe(100);
      expect(block.status).toBe('ready'); // 100 confidence -> ready
    });

    it('should set correct status based on confidence', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Test forming status (0-29)
      const result1 = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'feature',
          title: 'Block 1',
          keyword: 'B1',
          emoji: '📦',
          content: 'Test',
          confidence: 20,
        },
        { storage }
      );
      expect((result1.data as { block: { status: string } }).block.status).toBe('forming');

      // Test emerging status (30-59)
      const result2 = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'feature',
          title: 'Block 2',
          keyword: 'B2',
          emoji: '📦',
          content: 'Test',
          confidence: 45,
        },
        { storage }
      );
      expect((result2.data as { block: { status: string } }).block.status).toBe('emerging');

      // Test developing status (60-89)
      const result3 = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'feature',
          title: 'Block 3',
          keyword: 'B3',
          emoji: '📦',
          content: 'Test',
          confidence: 75,
        },
        { storage }
      );
      expect((result3.data as { block: { status: string } }).block.status).toBe('developing');

      // Test ready status (90+)
      const result4 = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'feature',
          title: 'Block 4',
          keyword: 'B4',
          emoji: '📦',
          content: 'Test',
          confidence: 95,
        },
        { storage }
      );
      expect((result4.data as { block: { status: string } }).block.status).toBe('ready');
    });

    it('should execute update_block with confidence update', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Create a block first
      const createResult = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'feature',
          title: 'User Authentication',
          keyword: 'Auth',
          emoji: '🔐',
          content: 'Initial auth design',
          confidence: 25,
        },
        { storage }
      );
      const blockId = (createResult.data as { block: { id: string; status: string } }).block.id;
      expect((createResult.data as { block: { status: string } }).block.status).toBe('forming');

      // Update confidence
      const updateResult = await executeSpecialistTool(
        'Architect',
        'update_block',
        {
          session_id: session.id,
          block_id: blockId,
          confidence: 75,
        },
        { storage }
      );

      expect(updateResult.success).toBe(true);
      const updatedBlock = (updateResult.data as { block: { confidence: number; status: string } }).block;
      expect(updatedBlock.confidence).toBe(75);
      expect(updatedBlock.status).toBe('developing'); // Auto-adjusted based on confidence
    });

    it('should execute update_block with content update', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Create a block
      const createResult = await executeSpecialistTool(
        'Security',
        'create_block',
        {
          session_id: session.id,
          type: 'feature',
          title: 'Auth',
          keyword: 'Auth',
          emoji: '🔐',
          content: 'Initial content',
          confidence: 50,
        },
        { storage }
      );
      const blockId = (createResult.data as { block: { id: string } }).block.id;

      // Update content
      const newContent = '## Updated Auth Design\n\nOAuth 2.0 with PKCE flow';
      const updateResult = await executeSpecialistTool(
        'Security',
        'update_block',
        {
          session_id: session.id,
          block_id: blockId,
          content: newContent,
        },
        { storage }
      );

      expect(updateResult.success).toBe(true);
      const updatedBlock = (updateResult.data as { block: { content: string } }).block;
      expect(updatedBlock.content).toBe(newContent);
    });

    it('should execute update_block with valid status transition', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Create a forming block
      const createResult = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'entity',
          title: 'User',
          keyword: 'User',
          emoji: '👤',
          content: 'User entity',
          confidence: 20,
        },
        { storage }
      );
      const blockId = (createResult.data as { block: { id: string; status: string } }).block.id;
      expect((createResult.data as { block: { status: string } }).block.status).toBe('forming');

      // Transition forming → emerging
      const updateResult = await executeSpecialistTool(
        'Architect',
        'update_block',
        {
          session_id: session.id,
          block_id: blockId,
          status: 'emerging',
        },
        { storage }
      );

      expect(updateResult.success).toBe(true);
      expect((updateResult.data as { block: { status: string } }).block.status).toBe('emerging');
    });

    it('should reject invalid status transition (skip stage)', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Create a forming block
      const createResult = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'feature',
          title: 'Feature',
          keyword: 'Feat',
          emoji: '✨',
          content: 'Test',
          confidence: 15,
        },
        { storage }
      );
      const blockId = (createResult.data as { block: { id: string } }).block.id;

      // Try to skip from forming → developing (invalid)
      const updateResult = await executeSpecialistTool(
        'Architect',
        'update_block',
        {
          session_id: session.id,
          block_id: blockId,
          status: 'developing',
        },
        { storage }
      );

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('Invalid status transition');
      expect(updateResult.error).toContain('forming → developing');
    });

    it('should auto-adjust status when confidence changes', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Create a forming block (low confidence)
      const createResult = await executeSpecialistTool(
        'Designer',
        'create_block',
        {
          session_id: session.id,
          type: 'flow',
          title: 'Onboarding',
          keyword: 'Onboard',
          emoji: '🚀',
          content: 'User onboarding flow',
          confidence: 10,
        },
        { storage }
      );
      const blockId = (createResult.data as { block: { id: string } }).block.id;

      // Update confidence to trigger auto-status adjustment
      const updateResult = await executeSpecialistTool(
        'Designer',
        'update_block',
        {
          session_id: session.id,
          block_id: blockId,
          confidence: 95,
        },
        { storage }
      );

      expect(updateResult.success).toBe(true);
      const updatedBlock = (updateResult.data as { block: { confidence: number; status: string } }).block;
      expect(updatedBlock.confidence).toBe(95);
      expect(updatedBlock.status).toBe('ready'); // Auto-adjusted
    });

    it('should allow explicit status to override auto-adjustment', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Create a forming block
      const createResult = await executeSpecialistTool(
        'QA',
        'create_block',
        {
          session_id: session.id,
          type: 'constraint',
          title: 'Test Coverage',
          keyword: 'Tests',
          emoji: '🧪',
          content: 'Test requirements',
          confidence: 25,
        },
        { storage }
      );
      const blockId = (createResult.data as { block: { id: string } }).block.id;

      // Update both confidence and status explicitly
      const updateResult = await executeSpecialistTool(
        'QA',
        'update_block',
        {
          session_id: session.id,
          block_id: blockId,
          confidence: 45, // Would normally trigger "emerging"
          status: 'emerging', // Explicit status
        },
        { storage }
      );

      expect(updateResult.success).toBe(true);
      const updatedBlock = (updateResult.data as { block: { confidence: number; status: string } }).block;
      expect(updatedBlock.confidence).toBe(45);
      expect(updatedBlock.status).toBe('emerging'); // Uses explicit status
    });

    it('should normalize confidence values in update_block', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      // Create a block
      const createResult = await executeSpecialistTool(
        'Architect',
        'create_block',
        {
          session_id: session.id,
          type: 'entity',
          title: 'Entity',
          keyword: 'Ent',
          emoji: '📊',
          content: 'Test',
          confidence: 50,
        },
        { storage }
      );
      const blockId = (createResult.data as { block: { id: string } }).block.id;

      // Update with out-of-range confidence
      const updateResult = await executeSpecialistTool(
        'Architect',
        'update_block',
        {
          session_id: session.id,
          block_id: blockId,
          confidence: 150, // Over 100
        },
        { storage }
      );

      expect(updateResult.success).toBe(true);
      expect((updateResult.data as { block: { confidence: number } }).block.confidence).toBe(100);
    });

    it('should return error for non-existent block', async () => {
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test',
      });

      const updateResult = await executeSpecialistTool(
        'Architect',
        'update_block',
        {
          session_id: session.id,
          block_id: 'non-existent-block',
          confidence: 50,
        },
        { storage }
      );

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('Block not found');
    });

    it('should return error for update_block with non-existent session', async () => {
      const updateResult = await executeSpecialistTool(
        'Architect',
        'update_block',
        {
          session_id: 'non-existent-session',
          block_id: 'some-block',
          confidence: 50,
        },
        { storage }
      );

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toContain('Session not found');
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

/**
 * Interviewer Module Tests
 *
 * Tests for the Interviewer service, tool execution,
 * conversation history, and specialist queue.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  INTERVIEWER_CONFIG,
  IDEATION_CHANNEL,
  sessionChannelId,
  isIdeationChannel,
  extractSessionPrefix,
  LLM_CONFIG,
} from './config.js';
import {
  getInterviewerPrompt,
  getWelcomeMessage,
  getMockResponse,
} from './prompt.js';
import {
  INTERVIEWER_TOOLS,
} from './tools.js';
import {
  executeTool,
  getMockToolResult,
} from './tool-executor.js';
import {
  conversationHistory,
} from './history.js';
import {
  specialistQueue,
  formatPendingInsights,
} from './specialist-queue.js';
import {
  interviewer,
  initInterviewer,
  stopInterviewer,
  isInterviewerActive,
} from './service.js';
import { SQLiteIdeationStorage } from '../storage/sqlite.js';

// =============================================================================
// Config Tests
// =============================================================================

describe('Config', () => {
  describe('INTERVIEWER_CONFIG', () => {
    it('should have required configuration values', () => {
      expect(INTERVIEWER_CONFIG.name).toBe('Interviewer');
      expect(INTERVIEWER_CONFIG.role).toBe('interviewer');
      expect(INTERVIEWER_CONFIG.displayName).toBe('Brainstorming Facilitator');
      expect(INTERVIEWER_CONFIG.agentId).toBe('ideation-interviewer');
    });
  });

  describe('sessionChannelId', () => {
    it('should create session-specific channel ID', () => {
      // sessionChannelId takes full sessionId but uses first 8 chars
      const channelId = sessionChannelId('abc123456789');
      expect(channelId).toBe('#ideation-abc12345');
    });

    it('should truncate long session IDs', () => {
      const channelId = sessionChannelId('abcdefghijklmnop');
      expect(channelId).toBe('#ideation-abcdefgh');
    });
  });

  describe('isIdeationChannel', () => {
    it('should recognize ideation channels', () => {
      expect(isIdeationChannel('#ideation')).toBe(true);
      expect(isIdeationChannel('#ideation-abc123')).toBe(true);
      expect(isIdeationChannel('#other-channel')).toBe(false);
      expect(isIdeationChannel('#planning')).toBe(false);
    });
  });

  describe('extractSessionPrefix', () => {
    it('should extract session prefix from channel ID', () => {
      expect(extractSessionPrefix('#ideation-abc123')).toBe('abc123');
    });

    it('should return undefined for main ideation channel', () => {
      expect(extractSessionPrefix('#ideation')).toBeUndefined();
    });

    it('should return undefined for non-ideation channels', () => {
      expect(extractSessionPrefix('#other')).toBeUndefined();
    });
  });

  describe('LLM_CONFIG', () => {
    it('should have required LLM settings', () => {
      expect(LLM_CONFIG.model).toBe('claude-sonnet-4-20250514');
      expect(typeof LLM_CONFIG.maxTokens).toBe('number');
      expect(typeof LLM_CONFIG.temperature).toBe('number');
    });
  });
});

// =============================================================================
// Prompt Tests
// =============================================================================

describe('Prompt', () => {
  describe('getInterviewerPrompt', () => {
    it('should generate system prompt with context', () => {
      const prompt = getInterviewerPrompt({
        sessionId: 'test-session',
        initialIntent: 'Build a todo app',
        understanding: {},
      });

      expect(prompt).toContain('Brainstorming Facilitator');
      expect(prompt).toContain('Build a todo app');
      expect(prompt).toContain('test-session');
    });

    it('should include understanding keys when provided', () => {
      const prompt = getInterviewerPrompt({
        sessionId: 'test-session',
        initialIntent: 'Build a todo app',
        understanding: {
          technical: { framework: 'React', confidence: 'confident' },
        },
      });

      // Should mention the specialist name at minimum
      expect(prompt).toContain('technical');
    });

    it('should include pending insights when provided', () => {
      const prompt = getInterviewerPrompt({
        sessionId: 'test-session',
        initialIntent: 'Build something',
        understanding: {},
        pendingInsights: 'Consider asking: What tech stack?',
      });

      expect(prompt).toContain('Consider asking: What tech stack?');
    });
  });

  describe('getWelcomeMessage', () => {
    it('should generate welcome message with intent', () => {
      const message = getWelcomeMessage('Build a todo app');
      expect(message).toContain('todo app');
    });
  });

  describe('getMockResponse', () => {
    it('should generate mock response for user message', () => {
      const response = getMockResponse('I want to build a web app');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Tools Tests
// =============================================================================

describe('Tools', () => {
  describe('INTERVIEWER_TOOLS', () => {
    it('should define all required tools', () => {
      const toolNames = INTERVIEWER_TOOLS.map((t) => t.name);

      expect(toolNames).toContain('start_session');
      expect(toolNames).toContain('read_session');
      expect(toolNames).toContain('add_message');
      expect(toolNames).toContain('update_understanding');
      expect(toolNames).toContain('send_to_planner');
      expect(toolNames).toContain('spawn_specialist');
    });

    it('should have valid tool schemas', () => {
      for (const tool of INTERVIEWER_TOOLS) {
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
  });

  describe('executeTool', () => {
    it('should execute start_session tool', async () => {
      const result = await executeTool(
        'start_session',
        { initial_intent: 'Build a todo app' },
        { storage }
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('session_id');
    });

    it('should execute read_session tool', async () => {
      // Create a session first
      const session = await storage.createSession(
        { type: 'human', initial_intent: 'Test' }
      );

      const result = await executeTool(
        'read_session',
        { session_id: session.id },
        { storage }
      );

      expect(result.success).toBe(true);
      // read_session returns the full session object
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('status');
    });

    it('should execute add_message tool', async () => {
      const session = await storage.createSession(
        { type: 'human', initial_intent: 'Test' }
      );

      const result = await executeTool(
        'add_message',
        {
          session_id: session.id,
          role: 'user',
          content: 'Hello',
        },
        { storage }
      );

      expect(result.success).toBe(true);
    });

    it('should execute update_understanding tool', async () => {
      const session = await storage.createSession(
        { type: 'human', initial_intent: 'Test' }
      );

      const result = await executeTool(
        'update_understanding',
        {
          session_id: session.id,
          specialist_name: 'technical',
          observations: { framework: 'React' },
        },
        { storage }
      );

      expect(result.success).toBe(true);
    });

    it('should execute update_synthesis tool', async () => {
      const session = await storage.createSession(
        { type: 'human', initial_intent: 'Build a todo app' }
      );

      const result = await executeTool(
        'update_synthesis',
        {
          session_id: session.id,
          idea_summary: 'Building a simple todo list app with React',
          specialist_perspectives: {
            Architect: {
              take: 'Component architecture looks solid',
              concerns: ['State management needs consideration'],
              confidence: 'forming',
            },
            Designer: {
              take: 'UI patterns are clear',
              concerns: ['Accessibility needs attention'],
              confidence: 'confident',
            },
          },
        },
        { storage }
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('updated', true);

      // Verify synthesis was stored
      const updatedSession = await storage.getSession(session.id);
      expect(updatedSession?.synthesized).toBeDefined();
      expect(updatedSession?.synthesized?.idea_summary).toBe('Building a simple todo list app with React');
      expect(updatedSession?.synthesized?.specialist_perspectives?.Architect).toBeDefined();
      expect(updatedSession?.synthesized?.specialist_perspectives?.Architect.confidence).toBe('forming');
    });

    it('should fail spawn_specialist tool without spawnAgent callback', async () => {
      const session = await storage.createSession(
        { type: 'human', initial_intent: 'Test' }
      );

      const result = await executeTool(
        'spawn_specialist',
        {
          session_id: session.id,
          name: 'Architect',
          focus: 'Evaluate frameworks',
        },
        { storage }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('spawnAgent');
    });

    it('should execute spawn_specialist tool with spawnAgent callback', async () => {
      const session = await storage.createSession(
        { type: 'human', initial_intent: 'Test' }
      );

      const spawnAgent = vi.fn().mockResolvedValue('real-agent-123');

      const result = await executeTool(
        'spawn_specialist',
        {
          session_id: session.id,
          name: 'Designer',
          focus: 'UI patterns',
        },
        { storage, spawnAgent }
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('agent_id', 'real-agent-123');
      expect(spawnAgent).toHaveBeenCalledWith(session.id, 'Designer', 'UI patterns', undefined);
    });

    it('should return error for unknown tool', async () => {
      const result = await executeTool(
        'unknown_tool',
        {},
        { storage }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should handle tool execution errors', async () => {
      const result = await executeTool(
        'read_session',
        { session_id: 'non-existent' },
        { storage }
      );

      expect(result.success).toBe(false);
    });
  });

  describe('getMockToolResult', () => {
    it('should fail loudly for all tools in mock mode', () => {
      const tools = [
        'start_session',
        'read_session',
        'add_message',
        'update_understanding',
        'spawn_specialist',
        'send_to_planner',
      ];

      for (const tool of tools) {
        const result = getMockToolResult(tool, {});
        expect(result.success).toBe(false);
        expect(result.error).toContain('Mock mode');
        expect(result.error).toContain('ANTHROPIC_API_KEY');
      }
    });
  });
});

// =============================================================================
// Conversation History Tests
// =============================================================================

describe('Conversation History', () => {
  beforeEach(() => {
    conversationHistory.clearHistory('test-channel');
  });

  describe('addMessage and getHistory', () => {
    it('should add messages to history', () => {
      conversationHistory.addMessage('test-channel', 'user', 'Hello');
      conversationHistory.addMessage('test-channel', 'assistant', 'Hi there!');

      const history = conversationHistory.getHistory('test-channel');
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
      expect(history[1].role).toBe('assistant');
    });

    it('should return empty array for unknown channel', () => {
      const history = conversationHistory.getHistory('unknown-channel');
      expect(history).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('should clear history for channel', () => {
      conversationHistory.addMessage('test-channel', 'user', 'Hello');
      conversationHistory.clearHistory('test-channel');

      const history = conversationHistory.getHistory('test-channel');
      expect(history).toEqual([]);
    });
  });

  describe('getAnthropicMessages', () => {
    it('should format history for Anthropic API', () => {
      conversationHistory.addMessage('test-channel', 'user', 'Hello');
      conversationHistory.addMessage('test-channel', 'assistant', 'Hi!');

      const messages = conversationHistory.getAnthropicMessages('test-channel');
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi!' });
    });
  });
});

// =============================================================================
// Specialist Queue Tests
// =============================================================================

describe('Specialist Queue', () => {
  beforeEach(() => {
    specialistQueue.clearQueue('test-session');
  });

  describe('queueInput and getNextInput', () => {
    it('should queue specialist input', () => {
      specialistQueue.queueInput('test-session', {
        specialist_name: 'Architect',
        type: 'observation',
        content: 'Using React',
        priority: 1,
      });

      const pending = specialistQueue.getAllInputs('test-session');
      expect(pending).toHaveLength(1);
      expect(pending[0].specialist_name).toBe('Architect');
      expect(pending[0].content).toBe('Using React');
    });

    it('should dequeue in priority order (highest first)', () => {
      specialistQueue.queueInput('test-session', {
        specialist_name: 'Architect',
        type: 'observation',
        content: 'Low priority',
        priority: 1,
      });
      specialistQueue.queueInput('test-session', {
        specialist_name: 'Security',
        type: 'concern',
        content: 'High priority',
        priority: 10,
      });

      const first = specialistQueue.getNextInput('test-session');
      expect(first?.content).toBe('High priority');

      const second = specialistQueue.getNextInput('test-session');
      expect(second?.content).toBe('Low priority');

      const empty = specialistQueue.getNextInput('test-session');
      expect(empty).toBeUndefined();
    });
  });

  describe('getAllInputs', () => {
    it('should return all pending items without removing', () => {
      specialistQueue.queueInput('test-session', {
        specialist_name: 'Architect',
        type: 'observation',
        content: 'Test',
        priority: 1,
      });

      const pending1 = specialistQueue.getAllInputs('test-session');
      const pending2 = specialistQueue.getAllInputs('test-session');

      expect(pending1).toHaveLength(1);
      expect(pending2).toHaveLength(1);
    });
  });

  describe('clearQueue', () => {
    it('should clear all pending items', () => {
      specialistQueue.queueInput('test-session', {
        specialist_name: 'Architect',
        type: 'observation',
        content: 'Test',
        priority: 1,
      });
      specialistQueue.clearQueue('test-session');

      const pending = specialistQueue.getAllInputs('test-session');
      expect(pending).toHaveLength(0);
    });
  });

  describe('formatPendingInsights', () => {
    it('should format pending insights as string', () => {
      specialistQueue.queueInput('test-session', {
        specialist_name: 'Architect',
        type: 'observation',
        content: 'Should use TypeScript',
        priority: 1,
      });
      specialistQueue.queueInput('test-session', {
        specialist_name: 'PM',
        type: 'question',
        content: 'What is the timeline?',
        priority: 2,
      });

      const formatted = formatPendingInsights('test-session');
      expect(formatted).toContain('TypeScript');
      expect(formatted).toContain('timeline');
    });

    it('should return undefined when no pending inputs', () => {
      const formatted = formatPendingInsights('empty-session');
      expect(formatted).toBeUndefined();
    });
  });
});

// =============================================================================
// Interviewer Service Tests
// =============================================================================

describe('Interviewer Service', () => {
  let storage: SQLiteIdeationStorage;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();
  });

  afterEach(async () => {
    stopInterviewer();
    await storage.close();
  });

  describe('initInterviewer and stopInterviewer', () => {
    it('should initialize and stop service', () => {
      initInterviewer({ storage });
      expect(isInterviewerActive()).toBe(true);

      stopInterviewer();
      expect(isInterviewerActive()).toBe(false);
    });
  });

  describe('handleMessage', () => {
    beforeEach(() => {
      initInterviewer({ storage });
    });

    it('should ignore messages from self', async () => {
      const response = await interviewer.handleMessage(
        '#ideation',
        'Hello',
        'Interviewer'
      );

      expect(response).toBeNull();
    });

    it('should ignore non-ideation channels', async () => {
      const response = await interviewer.handleMessage(
        '#general',
        'Hello',
        'user123'
      );

      expect(response).toBeNull();
    });

    it('should process messages on ideation channel (mock mode)', async () => {
      // Without ANTHROPIC_API_KEY, should use mock mode
      const response = await interviewer.handleMessage(
        '#ideation',
        'I want to build a todo app',
        'user123'
      );

      // In mock mode, returns a response (may be string or object)
      expect(response).toBeDefined();
    });

    it('should track sessions per channel', async () => {
      // Create a session
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Test app',
      });

      // Register session with channel
      const channelId = sessionChannelId(session.id);

      const response = await interviewer.handleMessage(
        channelId,
        'Tell me more',
        'user123'
      );

      // Should have processed without error
      expect(response).toBeDefined();
    });
  });

  describe('specialist message handling', () => {
    beforeEach(() => {
      initInterviewer({ storage });
    });

    it('should handle messages from active specialists', async () => {
      // Simulate specialist message (from a specialist agent)
      const session = await storage.createSession({
        type: 'human',
        initial_intent: 'Build app',
      });

      // Add specialist to session
      await storage.addActiveSpecialist(session.id, {
        name: 'Architect',
        agent_id: 'arch-123',
        focus: 'Evaluate tech stack',
        spawned_at: new Date().toISOString(),
      });

      const channelId = sessionChannelId(session.id);

      // Specialist sends insight - should not cause error
      await interviewer.handleMessage(
        channelId,
        JSON.stringify({
          type: 'observation',
          content: 'Should use React',
        }),
        'Architect'
      );

      // Should process without error
      expect(true).toBe(true);
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
    initInterviewer({ storage });
  });

  afterEach(async () => {
    stopInterviewer();
    conversationHistory.clearAll();
    await storage.close();
  });

  it('should complete full ideation flow in mock mode', async () => {
    // 1. Create session
    const session = await storage.createSession({
      type: 'human',
      initial_intent: 'Build a task management app',
    });

    const channelId = sessionChannelId(session.id);

    // 2. User sends message
    const response = await interviewer.handleMessage(
      channelId,
      'I want it to have priorities and due dates',
      'user123'
    );

    expect(response).toBeDefined();

    // 3. Check conversation history
    const history = conversationHistory.getHistory(channelId);
    expect(history.length).toBeGreaterThanOrEqual(1);

    // 4. Simulate understanding update
    await storage.updateUnderstanding(session.id, 'technical', {
      features: ['priorities', 'due dates'],
      confidence: 'forming',
    });

    // 5. Check session has understanding
    const updated = await storage.getSession(session.id);
    expect(updated?.understanding.technical).toBeDefined();
  });
});

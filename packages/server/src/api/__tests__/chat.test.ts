/**
 * Tests for Chat API Handlers
 *
 * These tests verify the relay-aware chat functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createChatHandlers } from '../handlers/chat.js';

// Mock relay module
vi.mock('../../relay/index.js', () => ({
  getRelayMode: vi.fn(),
  sendToAgent: vi.fn(),
}));

// Mock planner package - path must match the import in chat.ts (from handlers dir)
vi.mock('../../../../planner/src/index.js', () => ({
  createMockChatResponse: vi.fn(),
  notFound: vi.fn((name: string) => {
    const error = new Error(`${name} not found`);
    (error as any).status = 404;
    (error as any).code = 'NOT_FOUND';
    return error;
  }),
  badRequest: vi.fn((message: string) => {
    const error = new Error(message);
    (error as any).status = 400;
    (error as any).code = 'BAD_REQUEST';
    return error;
  }),
}));

import { getRelayMode, sendToAgent } from '../../relay/index.js';
import { createMockChatResponse, notFound, badRequest } from '../../../../planner/src/index.js';

describe('Chat Handlers', () => {
  let mockStorage: {
    getPlan: ReturnType<typeof vi.fn>;
    getSessionByPlanId: ReturnType<typeof vi.fn>;
    getLatestVersion: ReturnType<typeof vi.fn>;
  };
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let handlers: ReturnType<typeof createChatHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorage = {
      getPlan: vi.fn(),
      getSessionByPlanId: vi.fn(),
      getLatestVersion: vi.fn(),
    };

    mockReq = {
      body: {},
    };

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();

    handlers = createChatHandlers(mockStorage);

    // Default mocks
    vi.mocked(getRelayMode).mockReturnValue('disconnected');
    vi.mocked(createMockChatResponse).mockReturnValue({
      message: 'Mock response',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /ai/chat', () => {
    it('requires message field', async () => {
      mockReq.body = {
        context: { plan_id: 'test-plan' },
      };

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'message is required',
        })
      );
    });

    it('requires context with plan_id', async () => {
      mockReq.body = {
        message: 'Hello',
      };

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'context with plan_id is required',
        })
      );
    });

    it('requires context.plan_id specifically', async () => {
      mockReq.body = {
        message: 'Hello',
        context: {}, // context without plan_id
      };

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'context with plan_id is required',
        })
      );
    });

    it('returns 404 for non-existent plan', async () => {
      mockReq.body = {
        message: 'Hello',
        context: { plan_id: 'non-existent' },
      };

      mockStorage.getPlan.mockReturnValue(null);

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStorage.getPlan).toHaveBeenCalledWith('non-existent');
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Plan not found',
        })
      );
    });

    it('returns mock response when no active session', async () => {
      const planId = 'test-plan-id';
      const context = {
        plan_id: planId,
        version: 1,
        goal: 'Test goal',
        steps: [],
      };

      mockReq.body = {
        message: 'Help me with criteria',
        context,
      };

      mockStorage.getPlan.mockReturnValue({ plan_id: planId });
      mockStorage.getSessionByPlanId.mockReturnValue(null);
      mockStorage.getLatestVersion.mockReturnValue({
        steps: [{ title: 'Step 1' }],
      });

      vi.mocked(createMockChatResponse).mockReturnValue({
        message: 'For robust acceptance criteria...',
      });

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockStorage.getSessionByPlanId).toHaveBeenCalledWith(planId);
      expect(createMockChatResponse).toHaveBeenCalledWith(
        'Help me with criteria',
        context,
        expect.any(Object)
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'For robust acceptance criteria...',
          session_status: 'none',
        })
      );
    });

    it('returns mock response when relay is not connected', async () => {
      const planId = 'test-plan-id';
      const context = {
        plan_id: planId,
        version: 1,
        goal: 'Test goal',
        steps: [],
      };

      mockReq.body = {
        message: 'Hello',
        context,
      };

      mockStorage.getPlan.mockReturnValue({ plan_id: planId });
      mockStorage.getSessionByPlanId.mockReturnValue({
        session_id: 'sess-123',
        agent_id: 'agent-abc',
      });
      mockStorage.getLatestVersion.mockReturnValue({
        steps: [{ title: 'Step 1' }],
      });

      vi.mocked(getRelayMode).mockReturnValue('disconnected');

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          session_status: 'none',
          mode: 'disconnected',
        })
      );
      expect(sendToAgent).not.toHaveBeenCalled();
    });

    it('routes to agent via relay when session exists and connected', async () => {
      const planId = 'test-plan-id';
      const context = {
        plan_id: planId,
        version: 1,
        goal: 'Test goal',
        steps: [],
      };

      mockReq.body = {
        message: 'Hello agent',
        context,
        history: [{ role: 'user', content: 'Previous message' }],
      };

      mockStorage.getPlan.mockReturnValue({ plan_id: planId });
      mockStorage.getSessionByPlanId.mockReturnValue({
        session_id: 'sess-123',
        agent_id: 'agent-abc',
      });

      vi.mocked(getRelayMode).mockReturnValue('connected');
      vi.mocked(sendToAgent).mockResolvedValue({
        text: 'Agent response',
        metadata: {},
      });

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(sendToAgent).toHaveBeenCalledWith('agent-abc', 'Hello agent', {
        plan_id: planId,
        context,
        history: [{ role: 'user', content: 'Previous message' }],
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Agent response',
        suggestion: undefined,
        session_status: 'active',
      });
    });

    it('parses suggestion from agent response', async () => {
      const planId = 'test-plan-id';
      const context = {
        plan_id: planId,
        version: 1,
        goal: 'Test goal',
        steps: [],
      };

      mockReq.body = {
        message: 'Add a step',
        context,
      };

      mockStorage.getPlan.mockReturnValue({ plan_id: planId });
      mockStorage.getSessionByPlanId.mockReturnValue({
        session_id: 'sess-123',
        agent_id: 'agent-abc',
      });

      vi.mocked(getRelayMode).mockReturnValue('connected');
      vi.mocked(sendToAgent).mockResolvedValue({
        text: `Here's my suggestion:
[SUGGESTION type="add_step" description="Add documentation step" preview="+ Document API"]
{"title": "Document API", "description": "Create docs"}
[/SUGGESTION]`,
        metadata: {},
      });

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Here's my suggestion:",
        suggestion: {
          type: 'add_step',
          description: 'Add documentation step',
          preview: '+ Document API',
          data: { title: 'Document API', description: 'Create docs' },
        },
        session_status: 'active',
      });
    });

    it('returns timeout message when agent times out', async () => {
      const planId = 'test-plan-id';
      const context = {
        plan_id: planId,
        version: 1,
        goal: 'Test goal',
        steps: [],
      };

      mockReq.body = {
        message: 'Hello',
        context,
      };

      mockStorage.getPlan.mockReturnValue({ plan_id: planId });
      mockStorage.getSessionByPlanId.mockReturnValue({
        session_id: 'sess-123',
        agent_id: 'agent-abc',
      });

      vi.mocked(getRelayMode).mockReturnValue('connected');
      vi.mocked(sendToAgent).mockRejectedValue(new Error('TIMEOUT: Agent did not respond'));

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'The AI agent is taking too long to respond. Please try again.',
        session_status: 'active',
      });
    });

    it('falls back to mock response on agent communication error', async () => {
      const planId = 'test-plan-id';
      const context = {
        plan_id: planId,
        version: 1,
        goal: 'Test goal',
        steps: [],
      };

      mockReq.body = {
        message: 'Hello',
        context,
      };

      mockStorage.getPlan.mockReturnValue({ plan_id: planId });
      mockStorage.getSessionByPlanId.mockReturnValue({
        session_id: 'sess-123',
        agent_id: 'agent-abc',
      });
      mockStorage.getLatestVersion.mockReturnValue({
        steps: [{ title: 'Step 1' }],
      });

      vi.mocked(getRelayMode).mockReturnValue('connected');
      vi.mocked(sendToAgent).mockRejectedValue(new Error('Connection lost'));
      vi.mocked(createMockChatResponse).mockReturnValue({
        message: 'Fallback response',
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Fallback response',
          session_status: 'active',
          error: 'Agent temporarily unavailable, showing fallback response',
        })
      );

      consoleSpy.mockRestore();
    });

    it('returns response for criteria request', async () => {
      const planId = 'test-plan-id';
      const context = {
        plan_id: planId,
        version: 1,
        goal: 'Build a feature',
        steps: [],
      };

      mockReq.body = {
        message: 'Help me add acceptance criteria',
        context,
      };

      mockStorage.getPlan.mockReturnValue({ plan_id: planId });
      mockStorage.getSessionByPlanId.mockReturnValue(null);
      mockStorage.getLatestVersion.mockReturnValue({
        steps: [{ title: 'Step 1' }],
      });

      vi.mocked(createMockChatResponse).mockReturnValue({
        message: 'For robust acceptance criteria, consider including...',
      });

      await handlers.chat(mockReq as Request, mockRes as Response, mockNext);

      expect(createMockChatResponse).toHaveBeenCalledWith(
        'Help me add acceptance criteria',
        context,
        expect.any(Object)
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'For robust acceptance criteria, consider including...',
          session_status: 'none',
        })
      );
    });
  });
});

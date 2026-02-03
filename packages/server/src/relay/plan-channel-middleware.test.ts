/**
 * Tests for Plan Channel Middleware
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { planChannelMiddleware } from './plan-channel-middleware.js';

// Mock the dependencies
vi.mock('./channels.js', () => ({
  createPlanChannel: vi.fn(),
}));

vi.mock('./client.js', () => ({
  isConnected: vi.fn(),
}));

vi.mock('./planner-lead.js', () => ({
  notifyNewPlan: vi.fn(),
}));

import { createPlanChannel } from './channels.js';
import { isConnected } from './client.js';
import { notifyNewPlan } from './planner-lead.js';

describe('planChannelMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let originalJson: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    originalJson = vi.fn().mockReturnThis();

    mockReq = {
      method: 'POST',
      path: '/plans',
    };

    mockRes = {
      statusCode: 201,
      json: originalJson,
    };

    mockNext = vi.fn();

    // Default to connected
    vi.mocked(isConnected).mockReturnValue(true);
    vi.mocked(createPlanChannel).mockReturnValue('#plan-abc12345');
    vi.mocked(notifyNewPlan).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call next() for non-POST requests', () => {
    mockReq.method = 'GET';

    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.json).toBe(originalJson); // json should not be overridden
  });

  it('should call next() for non-plans paths', () => {
    mockReq.path = '/initiatives';

    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.json).toBe(originalJson);
  });

  it('should intercept POST /plans and override json method', () => {
    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.json).not.toBe(originalJson);
  });

  it('should create channel when plan is created successfully', async () => {
    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    // Call the overridden json method
    const responseBody = {
      plan: { plan_id: 'abc12345-full-uuid' },
      version: { summary: { goal: 'Test goal', context: 'Test context' } },
    };

    mockRes.json!(responseBody);

    // Wait for setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    expect(createPlanChannel).toHaveBeenCalledWith('abc12345-full-uuid', 'Test goal');
    expect(notifyNewPlan).toHaveBeenCalledWith(
      '#plan-abc12345',
      'abc12345-full-uuid',
      'Test goal',
      'Test context'
    );
  });

  it('should not create channel when relay is not connected', async () => {
    vi.mocked(isConnected).mockReturnValue(false);

    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const responseBody = {
      plan: { plan_id: 'abc12345-full-uuid' },
      version: { summary: { goal: 'Test goal' } },
    };

    mockRes.json!(responseBody);

    await new Promise((resolve) => setImmediate(resolve));

    expect(createPlanChannel).not.toHaveBeenCalled();
    expect(notifyNewPlan).not.toHaveBeenCalled();
  });

  it('should not create channel for non-201 responses', async () => {
    mockRes.statusCode = 400;

    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const responseBody = {
      error: 'Bad request',
    };

    mockRes.json!(responseBody);

    await new Promise((resolve) => setImmediate(resolve));

    expect(createPlanChannel).not.toHaveBeenCalled();
  });

  it('should handle missing plan_id gracefully', async () => {
    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const responseBody = {
      plan: {},
      version: { summary: { goal: 'Test goal' } },
    };

    mockRes.json!(responseBody);

    await new Promise((resolve) => setImmediate(resolve));

    expect(createPlanChannel).not.toHaveBeenCalled();
  });

  it('should handle createPlanChannel errors gracefully', async () => {
    vi.mocked(createPlanChannel).mockImplementation(() => {
      throw new Error('Channel creation failed');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const responseBody = {
      plan: { plan_id: 'abc12345-full-uuid' },
      version: { summary: { goal: 'Test goal' } },
    };

    mockRes.json!(responseBody);

    await new Promise((resolve) => setImmediate(resolve));

    expect(consoleSpy).toHaveBeenCalledWith(
      '[plan-channel-middleware] Error creating channel:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should call original json with the response body', () => {
    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const responseBody = {
      plan: { plan_id: 'abc12345-full-uuid' },
      version: { summary: { goal: 'Test goal' } },
    };

    mockRes.json!(responseBody);

    expect(originalJson).toHaveBeenCalledWith(responseBody);
  });

  it('should use default goal when goal is missing', async () => {
    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const responseBody = {
      plan: { plan_id: 'abc12345-full-uuid' },
      version: { summary: {} },
    };

    mockRes.json!(responseBody);

    await new Promise((resolve) => setImmediate(resolve));

    expect(notifyNewPlan).toHaveBeenCalledWith(
      '#plan-abc12345',
      'abc12345-full-uuid',
      'New plan',
      undefined
    );
  });

  it('should match /plans and /plans/ paths', () => {
    // Test /plans
    mockReq.path = '/plans';
    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.json).not.toBe(originalJson);

    // Reset
    mockRes.json = originalJson;

    // Test /plans/
    mockReq.path = '/plans/';
    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.json).not.toBe(originalJson);
  });

  it('should not match /plans/:id paths', () => {
    mockReq.path = '/plans/abc12345';

    planChannelMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.json).toBe(originalJson);
  });
});

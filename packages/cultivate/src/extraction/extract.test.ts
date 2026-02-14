/**
 * Tests for the signal extraction module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { extractSignal, type ExtractionContext } from './extract.js';
import { ExtractionResultSchema } from '../domain/types.js';
import { SignalProcessingError } from '../errors.js';

describe('extractSignal', () => {
  let mockAnthropicClient: Anthropic;

  beforeEach(() => {
    // Create a mock Anthropic client
    mockAnthropicClient = new Anthropic({
      apiKey: 'test-key',
      defaultHeaders: { 'X-VITEST': 'true' },
    });
  });

  it('should extract and validate a valid ExtractionResult', async () => {
    // Mock the Anthropic API call with tool_use structured output
    const mockResult = {
      summary: 'Test summary',
      keywords: ['test', 'extraction'],
      entities: [{ name: 'TestEntity', type: 'TEST' }],
      aspects: ['test aspect'],
      quotes: ['test quote'],
      reasoning: 'Test reasoning',
      specificity: 0.5,
      emotional_intensity: 0.3,
      actionability: 0.7,
    };

    // Spy on the messages.create method
    vi.spyOn(mockAnthropicClient.messages, 'create').mockResolvedValueOnce({
      id: 'msg-123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-123',
          name: 'extract_signal_insights',
          input: mockResult,
        },
      ],
      model: 'claude-sonnet-4-latest',
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 200 },
    } as any);

    const context: ExtractionContext = {
      signal_id: 'sig-123',
      title: 'Test Signal',
      body: 'Test signal body content',
      author: 'Test Author',
      source: 'test-source',
      timestamp: '2026-02-14T10:30:00Z',
      anthropic: mockAnthropicClient,
    };

    const result = await extractSignal('', context);

    // Verify the result matches schema
    expect(result).toEqual(mockResult);
    expect(ExtractionResultSchema.safeParse(result).success).toBe(true);

    // Verify API was called with tool for structured output
    const createSpy = mockAnthropicClient.messages.create as any;
    expect(createSpy).toHaveBeenCalled();
    const callArgs = createSpy.mock.calls[0][0];
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools[0].name).toBe('extract_signal_insights');
    expect(callArgs.tools[0].input_schema).toBeDefined();
  });

  it('should throw SignalProcessingError on missing tool_use response', async () => {
    vi.spyOn(mockAnthropicClient.messages, 'create').mockResolvedValueOnce({
      id: 'msg-123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I cannot extract this',
        },
      ],
      model: 'claude-sonnet-4-latest',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 200 },
    } as any);

    const context: ExtractionContext = {
      signal_id: 'sig-456',
      title: 'Test Signal',
      body: 'Test signal body content',
      anthropic: mockAnthropicClient,
    };

    await expect(extractSignal('', context)).rejects.toThrow(SignalProcessingError);
  });

  it('should throw SignalProcessingError on validation error', async () => {
    // Missing required fields in tool input
    const invalidResult = {
      summary: 'Test summary',
      // Missing many required fields
    };

    vi.spyOn(mockAnthropicClient.messages, 'create').mockResolvedValueOnce({
      id: 'msg-123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-123',
          name: 'extract_signal_insights',
          input: invalidResult,
        },
      ],
      model: 'claude-sonnet-4-latest',
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 200 },
    } as any);

    const context: ExtractionContext = {
      signal_id: 'sig-789',
      title: 'Test Signal',
      body: 'Test signal body content',
      anthropic: mockAnthropicClient,
    };

    await expect(extractSignal('', context)).rejects.toThrow(SignalProcessingError);
  });

  it('should throw SignalProcessingError on missing tool_use content', async () => {
    vi.spyOn(mockAnthropicClient.messages, 'create').mockResolvedValueOnce({
      id: 'msg-123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'No tool use here',
        },
      ],
      model: 'claude-sonnet-4-latest',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 200 },
    } as any);

    const context: ExtractionContext = {
      signal_id: 'sig-000',
      title: 'Test Signal',
      body: 'Test signal body content',
      anthropic: mockAnthropicClient,
    };

    await expect(extractSignal('', context)).rejects.toThrow(SignalProcessingError);
  });

  it('should wrap API errors (rate limit, auth) in SignalProcessingError', async () => {
    const apiError = new Error('Rate limit exceeded');
    vi.spyOn(mockAnthropicClient.messages, 'create').mockRejectedValueOnce(apiError);

    const context: ExtractionContext = {
      signal_id: 'sig-rate-limit',
      title: 'Test Signal',
      body: 'Test signal body content',
      anthropic: mockAnthropicClient,
    };

    try {
      await extractSignal('', context);
      expect.fail('Should have thrown SignalProcessingError');
    } catch (error) {
      expect(error).toBeInstanceOf(SignalProcessingError);
      const processingError = error as SignalProcessingError;
      expect(processingError.signal_id).toBe('sig-rate-limit');
      expect(processingError.pipeline_step).toBe('tier3-extraction');
      expect(processingError.cause.message).toBe('Rate limit exceeded');
    }
  });

  it('should include signal_id in SignalProcessingError for dead-letter tracking', async () => {
    const apiError = new Error('Network error');
    vi.spyOn(mockAnthropicClient.messages, 'create').mockRejectedValueOnce(apiError);

    const context: ExtractionContext = {
      signal_id: 'sig-network-error-123',
      title: 'Test Signal',
      body: 'Test signal body content',
      anthropic: mockAnthropicClient,
    };

    try {
      await extractSignal('', context);
      expect.fail('Should have thrown SignalProcessingError');
    } catch (error) {
      expect(error).toBeInstanceOf(SignalProcessingError);
      const processingError = error as SignalProcessingError;
      expect(processingError.signal_id).toBe('sig-network-error-123');
      // Verify error can be serialized for logging
      const json = processingError.toJSON();
      expect(json.signal_id).toBe('sig-network-error-123');
      expect(json.pipeline_step).toBe('tier3-extraction');
    }
  });
});

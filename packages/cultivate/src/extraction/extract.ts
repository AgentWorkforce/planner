/**
 * Signal extraction module
 *
 * Core extraction pipeline that calls Anthropic SDK to analyze raw signal content
 * and produce validated ExtractionResult objects using JSON schema structured output.
 *
 * Error handling: All extraction failures (LLM API errors, rate limits, validation failures)
 * are wrapped in SignalProcessingError for BullMQ dead-letter routing. No errors are caught
 * and swallowed — failures propagate cleanly.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ExtractionResultSchema, type ExtractionResult } from '../domain/types.js';
import { SignalProcessingError } from '../errors.js';
import {
  EXTRACTION_SYSTEM_PROMPT,
  createExtractionUserPrompt,
  EXTRACTION_EXAMPLES,
} from '../prompts/extraction-prompt.js';

/**
 * Tool definition for extraction task with JSON schema structured output
 * Uses tool_use to guarantee the API returns valid JSON conforming to the schema
 */
const EXTRACTION_TOOL = {
  name: 'extract_signal_insights',
  description: 'Extract structured insights from signal content',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description: 'Brief summary of the extracted content',
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of key terms and phrases extracted from content',
      },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Entity name or value',
            },
            type: {
              type: 'string',
              description: 'Entity type classification (e.g., PERSON, ORGANIZATION, LOCATION)',
            },
          },
          required: ['name', 'type'],
        },
        description: 'Named entities found in content with their types',
      },
      aspects: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key aspects, themes, or dimensions discussed',
      },
      quotes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Notable direct quotes from the source',
      },
      reasoning: {
        type: 'string',
        description: 'AI reasoning explaining the extraction choices and key findings',
      },
      specificity: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Score 0-1 indicating how specific/general the content is',
      },
      emotional_intensity: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Score 0-1 indicating emotional charge or intensity',
      },
      actionability: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Score 0-1 indicating how actionable the signal is',
      },
    },
    required: [
      'summary',
      'keywords',
      'entities',
      'aspects',
      'quotes',
      'reasoning',
      'specificity',
      'emotional_intensity',
      'actionability',
    ],
  },
};

/**
 * Context required for signal extraction
 * Includes signal metadata and dependencies for LLM extraction
 */
export interface ExtractionContext {
  /** Signal ID for dead-letter tracking and error correlation */
  signal_id: string;

  /** Raw signal title */
  title: string;

  /** Raw signal body content */
  body: string;

  /** Signal author (optional) */
  author?: string;

  /** Signal source system or channel (optional) */
  source?: string;

  /** Signal timestamp in ISO 8601 format (optional) */
  timestamp?: string;

  /** Anthropic SDK client for making API calls */
  anthropic: Anthropic;

  /** Model name for extraction (default: claude-sonnet-4-latest) */
  model?: string;
}

/**
 * Extract structured insights from raw signal content
 *
 * This function analyzes raw signal content using the Anthropic SDK with:
 * - System prompt defining the extraction task and output schema
 * - Few-shot examples for improved accuracy
 * - User prompt with the specific signal content
 *
 * The response is parsed and validated against ExtractionResultSchema using JSON schema structured output.
 * Any validation failure throws an error to ensure no partial extractions.
 *
 * Error handling (for BullMQ dead-letter routing):
 * - LLM API errors (network, auth, rate limits) are wrapped in SignalProcessingError
 * - Validation failures are wrapped in SignalProcessingError
 * - Errors propagate cleanly without try/catch swallowing
 * - BullMQ worker catches SignalProcessingError for retry and dead-letter routing
 *
 * @param _rawContent - The raw signal content to analyze (passed for documentation, context contains body)
 * @param context - Extraction context with signal metadata, signal_id, and Anthropic client
 * @returns Validated ExtractionResult
 * @throws SignalProcessingError if extraction fails (API error, validation failure, etc)
 *
 * @example
 * ```typescript
 * const result = await extractSignal(
 *   'Raw signal body text...',
 *   {
 *     signal_id: 'sig-123',
 *     title: 'Signal Title',
 *     body: 'Raw signal body text...',
 *     author: 'John Doe',
 *     source: 'Slack #alerts',
 *     timestamp: '2026-02-14T10:30:00Z',
 *     anthropic: anthropicClient,
 *   }
 * );
 * ```
 */
export async function extractSignal(
  _rawContent: string,
  context: ExtractionContext
): Promise<ExtractionResult> {
  const {
    signal_id,
    title,
    body,
    author,
    source,
    timestamp,
    anthropic,
    model = process.env.CULTIVATE_EXTRACT_MODEL ?? 'claude-sonnet-4-latest',
  } = context;

  // Create user prompt with signal metadata
  const userPrompt = createExtractionUserPrompt({
    title,
    body,
    author,
    source,
    timestamp,
  });

  // Format examples for few-shot learning
  // Each example becomes a user-assistant message pair
  const exampleMessages = EXTRACTION_EXAMPLES.flatMap((example) => [
    {
      role: 'user' as const,
      content: createExtractionUserPrompt(example.input),
    },
    {
      role: 'assistant' as const,
      content: JSON.stringify(example.output),
    },
  ]);

  // Call Anthropic API with tool_use for structured output
  // The tool definition enforces JSON schema, ensuring the API returns valid structured data
  // API errors (network, auth, rate limits) are wrapped in SignalProcessingError for dead-letter routing
  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL as any],
      messages: [
        ...exampleMessages,
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });
  } catch (apiError) {
    // Wrap API errors (network, auth, rate limits, etc.) for BullMQ to handle
    const cause = apiError instanceof Error ? apiError : new Error(String(apiError));
    throw new SignalProcessingError('tier3-extraction', signal_id, cause);
  }

  // Extract tool use content from response
  // With tool_use, the response is guaranteed to include a tool_use block with structured JSON
  const toolUseContent = response.content.find(
    (block: any) => block.type === 'tool_use'
  );
  if (!toolUseContent || (toolUseContent as any).type !== 'tool_use') {
    const responseTypes = response.content.map((c: any) => c.type).join(', ') || 'no content';
    const cause = new Error(
      `Expected tool_use response from model, got ${responseTypes}`
    );
    throw new SignalProcessingError('tier3-extraction', signal_id, cause);
  }

  // Parse JSON from tool input
  // The API guarantees this is valid JSON matching the schema when tool_use is used with input_schema
  const toolUseBlock = toolUseContent as any;
  const parsedResult = toolUseBlock.input;

  // Validate against ExtractionResultSchema
  // This is a secondary validation to ensure type safety, though the API schema guarantees should prevent failures
  // Validation errors are wrapped in SignalProcessingError for dead-letter routing
  let result: ExtractionResult;
  try {
    result = ExtractionResultSchema.parse(parsedResult);
  } catch (validationError) {
    const cause = new Error(
      `Extraction result validation failed: ${
        validationError instanceof Error ? validationError.message : String(validationError)
      }`
    );
    throw new SignalProcessingError('tier3-extraction', signal_id, cause);
  }

  return result;
}

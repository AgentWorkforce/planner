/**
 * Specialist Tool Executor
 *
 * Executes specialist MCP tools.
 * Observations are NOT validated - intelligence lives in prompts.
 */

import type { IdeationStorage } from '../storage/index.js';
import { specialistQueue } from '../interviewer/specialist-queue.js';
import { ideationEvents } from '../api/events.js';
import { createBlock, type BlockStatus } from '../domain/block.js';
import type {
  SpecialistToolResult,
  UpdateObservationsInput,
  ReadUnderstandingInput,
  QueueInsightInput,
  CreateBlockInput,
  UpdateBlockInput,
  ListBlocksInput,
} from './tools.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine status based on confidence level.
 *
 * @param confidence - Confidence level 0-100
 * @returns Corresponding status
 */
function getStatusFromConfidence(confidence: number): BlockStatus {
  if (confidence < 30) return 'forming';
  if (confidence < 60) return 'emerging';
  if (confidence < 90) return 'developing';
  return 'ready';
}

/**
 * Check if a status transition is valid.
 * Valid transitions: forming → emerging → developing → ready
 * Cannot skip stages when transitioning manually.
 *
 * @param from - Current status
 * @param to - Target status
 * @returns True if transition is valid
 */
function isValidStatusTransition(from: BlockStatus, to: BlockStatus): boolean {
  // Can always stay the same
  if (from === to) return true;

  // Cannot transition to/from curated via this tool
  if (from === 'curated' || to === 'curated') return false;

  // Define valid forward transitions
  const validTransitions: Record<BlockStatus, BlockStatus[]> = {
    forming: ['emerging'],
    emerging: ['developing'],
    developing: ['ready'],
    ready: [],
    curated: [],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

// =============================================================================
// Tool Executor Dependencies
// =============================================================================

export interface SpecialistToolExecutorDeps {
  storage: IdeationStorage;
}

// =============================================================================
// Tool Executor
// =============================================================================

/**
 * Execute a specialist tool.
 *
 * @param specialistName - Name of the specialist executing the tool
 * @param toolName - Name of the tool to execute
 * @param input - Tool input (varies by tool)
 * @param deps - Dependencies (storage)
 * @returns Tool result
 */
export async function executeSpecialistTool(
  specialistName: string,
  toolName: string,
  input: unknown,
  deps: SpecialistToolExecutorDeps
): Promise<SpecialistToolResult> {
  const { storage } = deps;

  try {
    switch (toolName) {
      case 'update_observations': {
        const { session_id, observations } = input as UpdateObservationsInput;

        // Update understanding for this specialist
        // Note: No validation - freeform observations
        const session = await storage.updateUnderstanding(session_id, specialistName, observations);

        // Emit event so SSE clients get notified
        ideationEvents.emitSessionEvent('session:understanding', session);

        return { success: true, data: { updated: true } };
      }

      case 'read_understanding': {
        const { session_id } = input as ReadUnderstandingInput;

        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        return {
          success: true,
          data: {
            understanding: session.understanding,
            active_specialists: session.active_specialists.map(s => s.name),
          },
        };
      }

      case 'queue_insight': {
        const { session_id, type, content, priority } = input as QueueInsightInput;

        // Get session to verify it exists
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Queue insight for Interviewer
        // Use first 8 chars of session ID as key (matches Interviewer's format)
        specialistQueue.queueInput(session_id.slice(0, 8), {
          specialist_name: specialistName,
          type,
          content,
          priority: Math.max(1, Math.min(10, priority)),
        });

        return { success: true, data: { queued: true } };
      }

      case 'create_block': {
        const { session_id, type, title, keyword, emoji, content, confidence, merge_suggestion, split_suggestion } = input as CreateBlockInput;

        // Get current session
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Validate confidence range
        const normalizedConfidence = Math.max(0, Math.min(100, confidence));

        // Create the new block with specialist attribution
        // sourceContext captures conversation turn reference (transcript length = turn number)
        const newBlock = createBlock({
          type,
          title,
          keyword,
          emoji,
          content,
          specialist: specialistName,
          sourceContext: `Turn ${session.transcript.length}`,
        });

        // Override confidence from the default
        newBlock.confidence = normalizedConfidence;

        // Determine status based on confidence
        newBlock.status = getStatusFromConfidence(normalizedConfidence);

        // Add block to session
        const updatedBlocks = [...session.blocks, newBlock];
        const updatedSession = await storage.updateBlocks(session_id, updatedBlocks);

        // Emit event so SSE clients get notified
        ideationEvents.emitSessionEvent('session:block_created', updatedSession);

        // If merge/split suggestions provided, queue insights for user
        if (merge_suggestion) {
          const blockTitles = merge_suggestion.block_ids
            .map(id => session.blocks.find(b => b.id === id)?.title)
            .filter(Boolean)
            .join(', ');

          specialistQueue.queueInput(session_id.slice(0, 8), {
            specialist_name: specialistName,
            type: 'observation',
            content: `Merge suggestion: Consider merging blocks [${blockTitles}]. Rationale: ${merge_suggestion.rationale}`,
            priority: 6,
          });
        }

        if (split_suggestion) {
          specialistQueue.queueInput(session_id.slice(0, 8), {
            specialist_name: specialistName,
            type: 'observation',
            content: `Split suggestion for "${title}": ${split_suggestion.rationale}`,
            priority: 6,
          });
        }

        return { success: true, data: { block: newBlock } };
      }

      case 'update_block': {
        const { session_id, block_id, confidence, content, status, merge_suggestion, split_suggestion } = input as UpdateBlockInput;

        // Get current session
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Find the block
        const blockIndex = session.blocks.findIndex(b => b.id === block_id);
        if (blockIndex === -1) {
          return { success: false, error: `Block not found: ${block_id}` };
        }

        // existingBlock is guaranteed to exist since we check blockIndex !== -1
        const existingBlock = session.blocks[blockIndex]!;

        // Build updated block - spread preserves all required fields
        const updatedBlock = { ...existingBlock } as typeof existingBlock;

        // Update confidence if provided
        if (confidence !== undefined) {
          updatedBlock.confidence = Math.max(0, Math.min(100, confidence));
          // Auto-adjust status based on confidence unless explicit status provided
          if (status === undefined) {
            updatedBlock.status = getStatusFromConfidence(updatedBlock.confidence);
          }
        }

        // Update content if provided
        if (content !== undefined) {
          updatedBlock.content = content;
        }

        // Update status if provided (with validation)
        if (status !== undefined) {
          // Validate transition
          if (!isValidStatusTransition(existingBlock.status, status)) {
            return {
              success: false,
              error: `Invalid status transition: ${existingBlock.status} → ${status}. Valid transitions: forming → emerging → developing → ready (cannot skip stages)`,
            };
          }
          updatedBlock.status = status;
        }

        // Update in storage
        const updatedBlocks = [...session.blocks];
        updatedBlocks[blockIndex] = updatedBlock;
        const updatedSession = await storage.updateBlocks(session_id, updatedBlocks);

        // Emit event so SSE clients get notified
        ideationEvents.emitSessionEvent('session:block_updated', updatedSession);

        // If merge/split suggestions provided, queue insights for user
        if (merge_suggestion) {
          const blockTitles = merge_suggestion.block_ids
            .map(id => session.blocks.find(b => b.id === id)?.title)
            .filter(Boolean)
            .join(', ');

          specialistQueue.queueInput(session_id.slice(0, 8), {
            specialist_name: specialistName,
            type: 'observation',
            content: `Merge suggestion: Consider merging blocks [${blockTitles}]. Rationale: ${merge_suggestion.rationale}`,
            priority: 6,
          });
        }

        if (split_suggestion) {
          specialistQueue.queueInput(session_id.slice(0, 8), {
            specialist_name: specialistName,
            type: 'observation',
            content: `Split suggestion for "${existingBlock.title}": ${split_suggestion.rationale}`,
            priority: 6,
          });
        }

        return { success: true, data: { block: updatedBlock } };
      }

      case 'list_blocks': {
        const { session_id } = input as ListBlocksInput;

        // Get current session
        const session = await storage.getSession(session_id);
        if (!session) {
          return { success: false, error: `Session not found: ${session_id}` };
        }

        // Return block summaries (not full content for brevity)
        const blockSummaries = session.blocks.map(block => ({
          id: block.id,
          type: block.type,
          title: block.title,
          keyword: block.keyword,
          emoji: block.emoji,
          status: block.status,
          confidence: block.confidence,
          specialist: block.specialist,
          content_preview: block.content.slice(0, 200) + (block.content.length > 200 ? '...' : ''),
        }));

        return {
          success: true,
          data: {
            blocks: blockSummaries,
            total: blockSummaries.length
          }
        };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

// =============================================================================
// Mock Tool Results (for testing without LLM)
// =============================================================================

export function getMockSpecialistToolResult(
  specialistName: string,
  toolName: string,
  input: unknown
): SpecialistToolResult {
  switch (toolName) {
    case 'update_observations':
      return { success: true, data: { updated: true } };

    case 'read_understanding':
      return {
        success: true,
        data: {
          understanding: {
            [specialistName]: { mock: true, confidence: 'exploring' },
          },
          active_specialists: [specialistName],
        },
      };

    case 'queue_insight':
      return { success: true, data: { queued: true } };

    case 'create_block':
      return {
        success: true,
        data: {
          block: {
            id: 'mock-block-id',
            type: 'feature',
            title: 'Mock Block',
            keyword: 'Mock',
            emoji: '📦',
            status: 'forming',
            confidence: 50,
            content: 'Mock block content',
            userEdits: [],
            specialist: specialistName,
            sourceContext: 'Mock Turn',
            createdAt: new Date().toISOString(),
            curatedAt: null,
            sources: [],
            userEdited: false,
          },
        },
      };

    case 'update_block':
      return {
        success: true,
        data: {
          block: {
            id: (input as UpdateBlockInput).block_id,
            type: 'feature',
            title: 'Updated Block',
            keyword: 'Updated',
            emoji: '📦',
            status: (input as UpdateBlockInput).status || 'forming',
            confidence: (input as UpdateBlockInput).confidence || 50,
            content: (input as UpdateBlockInput).content || 'Updated content',
            userEdits: [],
            specialist: specialistName,
            sourceContext: 'Mock Turn',
            createdAt: new Date().toISOString(),
            curatedAt: null,
            sources: [],
            userEdited: false,
          },
        },
      };

    case 'list_blocks':
      return {
        success: true,
        data: {
          blocks: [
            {
              id: 'mock-block-1',
              type: 'feature',
              title: 'Mock Feature',
              keyword: 'Feature',
              emoji: '🎯',
              status: 'forming',
              confidence: 40,
              specialist: 'Architect',
              content_preview: 'This is a mock feature block...',
            },
            {
              id: 'mock-block-2',
              type: 'entity',
              title: 'Mock Entity',
              keyword: 'Entity',
              emoji: '📦',
              status: 'emerging',
              confidence: 55,
              specialist: 'DataModeller',
              content_preview: 'This is a mock entity block...',
            },
          ],
          total: 2,
        },
      };

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Ideation Domain - Block Schema
 *
 * Blocks are the individual pieces of understanding surfaced by specialists
 * for the ideation canvas. Each block represents a discrete concept, feature,
 * entity, flow, or other structured piece of the emerging plan.
 */

import { z } from 'zod';

// =============================================================================
// Block Status Enum
// =============================================================================

/**
 * Block lifecycle status - represents confidence/maturity progression.
 */
export const BlockStatus = z.enum([
  'forming',    // Initial emergence, low confidence
  'emerging',   // Taking shape, patterns visible
  'developing', // Structure solidifying
  'ready',      // High confidence, ready for curation
  'curated',    // Human-reviewed and refined
]);

export type BlockStatus = z.infer<typeof BlockStatus>;

// =============================================================================
// BlockSource Schema (V3-Prep)
// =============================================================================

/**
 * Traces block content back to source documents/conversations.
 * Empty in MVP; populated by doc ingestion in V3.
 */
export const BlockSourceSchema = z.object({
  /** ID of the source document/image/turn */
  source_id: z.string(),
  /** Type of source */
  source_type: z.enum(['document', 'image', 'conversation']),
  /** Optional reference (line range, turn ID, etc.) */
  reference: z.string().optional(),
});

export type BlockSource = z.infer<typeof BlockSourceSchema>;

// =============================================================================
// UserEdit Schema
// =============================================================================

/**
 * Tracks individual user modifications to block content.
 * Each edit captures the range and content of the change.
 */
export const UserEditSchema = z.object({
  /** Unique identifier for this edit */
  id: z.string(),
  /** Character positions in the content string */
  range: z.object({
    start: z.number(),
    end: z.number(),
  }),
  /** The text user added/modified */
  content: z.string(),
  /** When this edit was made (ISO 8601) */
  timestamp: z.string(),
});

export type UserEdit = z.infer<typeof UserEditSchema>;

// =============================================================================
// Block Schema
// =============================================================================

/**
 * A Block represents a discrete piece of understanding from a specialist.
 *
 * Key characteristics:
 * - type is freeform (feature, entity, flow, constraint, etc.)
 * - status drives visual effects (attention ripples)
 * - confidence (0-100) determines urgency of attention effects
 * - userEdits[] tracks all user modifications
 * - V3-prep fields (sources, mergedFrom, etc.) included now with defaults
 */
export const BlockSchema = z.object({
  /** Unique identifier */
  id: z.string(),
  /** Freeform type (feature, entity, flow, constraint, etc.) */
  type: z.string(),
  /** Human-readable title */
  title: z.string(),
  /** Short label for physics block display */
  keyword: z.string(),
  /** Visual identifier on block */
  emoji: z.string(),
  /** Lifecycle status */
  status: BlockStatus,
  /** Confidence score (0-100) - drives attention effects */
  confidence: z.number().min(0).max(100),
  /** Markdown mini-spec content */
  content: z.string(),
  /** Tracked user modifications */
  userEdits: z.array(UserEditSchema),
  /** Which specialist created this block */
  specialist: z.string(),
  /** Conversation turn references */
  sourceContext: z.string(),
  /** When this block was created (ISO 8601) */
  createdAt: z.string(),
  /** When this block was curated (ISO 8601) */
  curatedAt: z.string().nullable(),

  // V3-Prep fields (included now with empty defaults)
  /** Source document/image references (empty in MVP) */
  sources: z.array(BlockSourceSchema),
  /** True if user has modified this block */
  userEdited: z.boolean(),
  /** Which fields user modified (for highlighting) */
  userEditedFields: z.array(z.string()).optional(),
  /** Block IDs if this was merged from others */
  mergedFrom: z.array(z.string()).optional(),
  /** Block ID if this was split from another */
  splitFrom: z.string().optional(),
});

export type Block = z.infer<typeof BlockSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a new Block with sensible defaults.
 *
 * @param data - Partial block data to override defaults
 * @returns A new Block instance
 */
export function createBlock(
  data: Pick<Block, 'type' | 'title' | 'keyword' | 'emoji' | 'content' | 'specialist' | 'sourceContext'>
): Block {
  return {
    id: crypto.randomUUID(),
    status: 'forming',
    confidence: 0,
    userEdits: [],
    createdAt: new Date().toISOString(),
    curatedAt: null,
    sources: [],
    userEdited: false,
    ...data,
  };
}

/**
 * Creates a UserEdit record for tracking modifications.
 *
 * @param range - Character positions of the edit
 * @param content - The modified text
 * @returns A new UserEdit instance
 */
export function createUserEdit(
  range: { start: number; end: number },
  content: string
): UserEdit {
  return {
    id: crypto.randomUUID(),
    range,
    content,
    timestamp: new Date().toISOString(),
  };
}

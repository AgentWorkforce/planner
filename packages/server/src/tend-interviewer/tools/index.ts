/**
 * Tend Interviewer Tools
 *
 * Unified tool set combining ideation + planning + forging capabilities.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { IDEATION_TOOLS } from './ideation-tools.js';
import { PLANNER_TOOLS } from './planner-tools.js';
import { BRIDGE_TOOLS } from './bridge-tools.js';
import { INTERACTION_TOOLS } from './interaction-tools.js';

// =============================================================================
// Merged Tool Set
// =============================================================================

export const TEND_TOOLS: Anthropic.Tool[] = [
  ...IDEATION_TOOLS,
  ...PLANNER_TOOLS,
  ...BRIDGE_TOOLS,
  ...INTERACTION_TOOLS,
];

// =============================================================================
// Tool Input Types
// =============================================================================

export type TendToolInput = Record<string, unknown>;

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

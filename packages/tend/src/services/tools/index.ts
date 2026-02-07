/**
 * Unified tool definitions export
 */

import { ideationTools, type ToolDefinition } from './ideation-tools';
import { plannerTools } from './planner-tools';
import { bridgeTools } from './bridge-tools';

export type { ToolDefinition };

export { ideationTools, plannerTools, bridgeTools };

export const allTools: ToolDefinition[] = [
  ...ideationTools,
  ...plannerTools,
  ...bridgeTools,
];

export function getToolsByCategory() {
  return {
    ideation: ideationTools,
    planner: plannerTools,
    bridge: bridgeTools,
  };
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find((tool) => tool.name === name);
}

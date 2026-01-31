/**
 * Agent Roles Configuration
 *
 * Defines the visual representation and labels for each agent role type.
 * Used by AgentAvatar and related components.
 */

import type { AgentRole } from '@/hooks/useAgentOrchestration';

export interface AgentRoleConfig {
  id: AgentRole;
  icon: string;
  label: string;
}

/**
 * Configuration for all agent roles.
 * Icons are emojis for simplicity and cross-platform support.
 */
export const AGENT_ROLES: Record<AgentRole, AgentRoleConfig> = {
  architect: {
    id: 'architect',
    icon: '🏗️',
    label: 'Architect',
  },
  'ui-designer': {
    id: 'ui-designer',
    icon: '🎨',
    label: 'UI/UX Designer',
  },
  'data-modeler': {
    id: 'data-modeler',
    icon: '💾',
    label: 'Data Modeler',
  },
  coder: {
    id: 'coder',
    icon: '💻',
    label: 'Coder',
  },
  tester: {
    id: 'tester',
    icon: '🧪',
    label: 'Tester',
  },
  security: {
    id: 'security',
    icon: '🔒',
    label: 'Security',
  },
  'planner-lead': {
    id: 'planner-lead',
    icon: '📋',
    label: 'Planning Assistant',
  },
};

/**
 * Get role configuration by ID.
 * Returns a fallback for unknown roles.
 */
export function getRoleConfig(role: AgentRole): AgentRoleConfig {
  return AGENT_ROLES[role] ?? {
    id: role,
    icon: '🤖',
    label: role,
  };
}

/**
 * Get all role configurations as an array.
 */
export function getAllRoles(): AgentRoleConfig[] {
  return Object.values(AGENT_ROLES);
}

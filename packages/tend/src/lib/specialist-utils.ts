/**
 * Maps ideation specialist data to UI display formats.
 */

import type { AgentRole, AgentState, Agent } from '@/hooks/useAgentOrchestration';
import type { SpecialistPresence } from '@/components/canvas/CanvasHeader';

interface ActiveSpecialist {
  name: string;
  role_hint?: string;
  joined_at: string;
}

const ROLE_HINT_TO_AGENT_ROLE: Record<string, AgentRole> = {
  architecture: 'architect',
  design: 'ui-designer',
  ui: 'ui-designer',
  ux: 'ui-designer',
  data: 'data-modeler',
  code: 'coder',
  develop: 'coder',
  test: 'tester',
  qa: 'tester',
  security: 'security',
};

const ROLE_HINT_TO_EMOJI: Record<string, string> = {
  architecture: '🏛️',
  design: '🎨',
  ui: '🎨',
  ux: '👥',
  data: '📊',
  code: '💻',
  develop: '💻',
  test: '🧪',
  qa: '🧪',
  security: '🔒',
  product: '🎯',
  performance: '⚡',
  devops: '⚙️',
  infra: '⚙️',
};

function matchRoleHint(roleHint: string | undefined, map: Record<string, string>): string | undefined {
  if (!roleHint) return undefined;
  const hint = roleHint.toLowerCase();

  // Direct match
  if (map[hint]) return map[hint];

  // Substring match
  for (const [key, value] of Object.entries(map)) {
    if (hint.includes(key)) return value;
  }

  return undefined;
}

/**
 * Maps an active specialist to the tend StatusBar's Agent format.
 */
export function specialistToAgent(specialist: ActiveSpecialist): Agent {
  const role = (matchRoleHint(specialist.role_hint, ROLE_HINT_TO_AGENT_ROLE) ?? 'planner-lead') as AgentRole;

  return {
    id: `specialist-${specialist.name}`,
    role,
    state: 'normal' as AgentState,
    displayName: specialist.name,
    hasQuestion: false,
  };
}

/**
 * Maps an active specialist to the IdeationStatusBar's SpecialistPresence format.
 */
export function specialistToPresence(specialist: ActiveSpecialist): SpecialistPresence {
  const avatar = matchRoleHint(specialist.role_hint, ROLE_HINT_TO_EMOJI) ?? '🧠';

  return {
    name: specialist.name,
    avatar,
    status: 'contributing',
  };
}

/**
 * Maps an array of active specialists to Agent[] for the tend StatusBar.
 */
export function specialistsToAgents(specialists: ActiveSpecialist[]): Agent[] {
  return specialists.map(specialistToAgent);
}

/**
 * Maps an array of active specialists to SpecialistPresence[] for the IdeationStatusBar.
 */
export function specialistsToPresences(specialists: ActiveSpecialist[]): SpecialistPresence[] {
  return specialists.map(specialistToPresence);
}

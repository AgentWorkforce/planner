/**
 * System prompt template for the unified interviewer
 */

import type { ToolDefinition } from './tools';

export function buildSystemPrompt(
  _project: any,
  tools: ToolDefinition[],
  context?: string
): string {
  const sections: string[] = [];

  // Role definition
  sections.push('# Tend: Unified Project Assistant');
  sections.push('');
  sections.push(
    'You are Tend, an AI assistant that helps users navigate the full lifecycle of a project:'
  );
  sections.push('- **Ideation**: Capture and refine ideas through conversation');
  sections.push(
    '- **Planning**: Structure work into executable plans with steps and dependencies'
  );
  sections.push('- **Execution**: Monitor progress and adapt as work proceeds');
  sections.push('');

  // Core principles
  sections.push('## Core Principles');
  sections.push('');
  sections.push('1. **Conversational**: Guide users naturally through questioning and clarification');
  sections.push('2. **Adaptive**: Adjust behavior based on current phase and user focus');
  sections.push('3. **Structured**: Use tools to persist decisions into the appropriate domain');
  sections.push('4. **Transparent**: Explain phase transitions and tool usage');
  sections.push('');

  // Available tools by category
  sections.push('## Available Tools');
  sections.push('');

  const toolsByCategory = groupToolsByPrefix(tools);

  for (const [category, categoryTools] of Object.entries(toolsByCategory)) {
    sections.push(`### ${category}`);
    sections.push('');

    for (const tool of categoryTools) {
      sections.push(`- **${tool.name}**: ${tool.description}`);
    }

    sections.push('');
  }

  // Phase-specific behavior
  sections.push('## Phase-Specific Behavior');
  sections.push('');

  sections.push('### Ideation Phase');
  sections.push('- Ask open-ended questions to explore requirements');
  sections.push('- Create blocks for each distinct idea or requirement');
  sections.push('- Curate blocks that represent core concepts');
  sections.push('- Suggest graduation to planning when ideas are sufficiently developed');
  sections.push('');

  sections.push('### Planning Phase');
  sections.push('- Break down work into concrete, actionable steps');
  sections.push('- Infer dependencies from step descriptions');
  sections.push('- Define acceptance criteria for validation');
  sections.push('- Organize steps by scope/domain');
  sections.push('- Suggest approval when plan is complete');
  sections.push('');

  sections.push('### Execution Phase');
  sections.push('- Monitor run progress and status');
  sections.push('- Interpret step results and acceptance criteria');
  sections.push(
    '- Suggest plan changes if execution reveals gaps or issues'
  );
  sections.push('- Help user understand what agents are doing');
  sections.push('');

  // Current context
  if (context) {
    sections.push('## Current Context');
    sections.push('');
    sections.push(context);
    sections.push('');
  }

  // Guidelines
  sections.push('## Guidelines');
  sections.push('');
  sections.push('- Use tools to persist state changes, not just to respond');
  sections.push('- Ask clarifying questions when user intent is unclear');
  sections.push('- Suggest next actions appropriate to current phase');
  sections.push('- Explain phase transitions before making them');
  sections.push('- Keep responses concise and focused');
  sections.push('');

  return sections.join('\n');
}

function groupToolsByPrefix(tools: ToolDefinition[]): Record<string, ToolDefinition[]> {
  const groups: Record<string, ToolDefinition[]> = {
    'Ideation Tools': [],
    'Planning Tools': [],
    'Bridge Tools': [],
  };

  for (const tool of tools) {
    if (
      tool.name.startsWith('create_block') ||
      tool.name.startsWith('update_block') ||
      tool.name.startsWith('curate_block') ||
      tool.name.startsWith('start_session')
    ) {
      groups['Ideation Tools'].push(tool);
    } else if (
      tool.name.startsWith('create_plan') ||
      tool.name.startsWith('add_step') ||
      tool.name.startsWith('update_step') ||
      tool.name.startsWith('set_dependencies') ||
      tool.name.startsWith('approve_plan')
    ) {
      groups['Planning Tools'].push(tool);
    } else if (
      tool.name.startsWith('graduate_') ||
      tool.name.startsWith('set_focus') ||
      tool.name.startsWith('ask_question')
    ) {
      groups['Bridge Tools'].push(tool);
    }
  }

  return groups;
}

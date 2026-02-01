/**
 * Mock Chat Responses
 *
 * Provides mock AI responses for development and when no planning agent is available.
 */

import type { PlanVersion } from '../../domain/plan.js';
import type { ChatSuggestion } from './chat.js';

interface ChatContext {
  plan_id: string;
  version: number;
  goal: string;
  context?: string;
  steps: {
    step_id: string;
    title: string;
    description?: string;
    scope?: string;
    dependencies: string[];
    acceptance_criteria_count: number;
    has_gate: boolean;
  }[];
}

interface MockChatResponse {
  message: string;
  suggestion?: ChatSuggestion;
}

/**
 * Create a mock AI response for development/testing.
 * This is used when no planning agent is available.
 */
export function createMockChatResponse(
  message: string,
  context: ChatContext,
  version: PlanVersion
): MockChatResponse {
  const lowerMsg = message.toLowerCase();

  // Analyze step clarity
  if (lowerMsg.includes('step') && (lowerMsg.includes('clear') || lowerMsg.includes('enough'))) {
    const firstStep = version.steps?.[0];
    return {
      message: `Looking at your steps, I can see they have good structure. However, some steps could benefit from more detailed acceptance criteria to make them more actionable and verifiable.\n\nFor example, step "${firstStep?.title || 'N/A'}" could specify:\n- Success metrics\n- Edge cases to handle\n- Integration requirements`,
    };
  }

  // Acceptance criteria help
  if (lowerMsg.includes('criteria') || lowerMsg.includes('acceptance')) {
    return {
      message: `For robust acceptance criteria, consider including:\n\n1. **Specific outcomes** - What exactly should happen?\n2. **Measurable results** - How will you verify success?\n3. **Edge cases** - What happens in unusual situations?\n4. **Performance** - Are there time/resource constraints?\n\nWould you like me to suggest specific criteria for a particular step?`,
    };
  }

  // Dependency analysis
  if (lowerMsg.includes('dependencies') || lowerMsg.includes('depend')) {
    const steps = version.steps || [];
    const depCount = steps.reduce((acc, s) => acc + (s.dependencies?.length || 0), 0);
    const noDeps = steps.filter((s) => !s.dependencies || s.dependencies.length === 0).length;
    const maxDeps = Math.max(...steps.map((s) => s.dependencies?.length || 0), 0);
    return {
      message: `I've analyzed the dependency graph of your ${steps.length} steps:\n\n- **Total dependencies:** ${depCount}\n- **Steps without dependencies:** ${noDeps}\n- **Most dependencies:** ${maxDeps}\n\nThe current dependencies look reasonable. Steps without explicit dependencies can be executed in parallel.`,
    };
  }

  // Add criteria suggestion
  if (lowerMsg.includes('add') && lowerMsg.includes('criteria')) {
    const firstStep = version.steps?.[0];
    return {
      message: `I can help you add acceptance criteria. Here's a suggestion based on the step context:`,
      suggestion: {
        type: 'add_criteria',
        description: 'Add acceptance criterion for test coverage',
        preview: '+ All unit tests pass with >80% code coverage',
        data: {
          step_id: firstStep?.step_id,
          description: 'All unit tests pass with >80% code coverage',
          type: 'test',
        },
      },
    };
  }

  // Add step suggestion
  if (lowerMsg.includes('add') && lowerMsg.includes('step')) {
    return {
      message: `Based on your plan's goal, here's a step suggestion:`,
      suggestion: {
        type: 'add_step',
        description: 'Add documentation step',
        preview: '+ Document API endpoints and usage',
        data: {
          title: 'Document API endpoints and usage',
          description: 'Create comprehensive API documentation including endpoint descriptions, request/response examples, and error handling.',
          scope: 'documentation',
          dependencies: [],
        },
      },
    };
  }

  // Help / generic
  if (lowerMsg.includes('help') || lowerMsg.includes('what can')) {
    return {
      message: `I can help you with planning tasks:\n\n- **Analyze steps** - Check clarity, dependencies, and coverage\n- **Suggest acceptance criteria** - Make steps more verifiable\n- **Review dependencies** - Identify bottlenecks or parallelism\n- **Add steps** - Suggest missing steps based on your goal\n- **Scope analysis** - Understand multi-scope impact\n\nWhat would you like to focus on?`,
    };
  }

  // Default response
  const truncatedMsg = message.slice(0, 50) + (message.length > 50 ? '...' : '');
  return {
    message: `I understand you're asking about "${truncatedMsg}".\n\nBased on your plan's goal "${context.goal}", I can help with:\n- Analyzing step clarity\n- Suggesting acceptance criteria\n- Reviewing dependencies\n- Identifying scope coverage\n\nWhat specific aspect would you like to focus on?`,
  };
}

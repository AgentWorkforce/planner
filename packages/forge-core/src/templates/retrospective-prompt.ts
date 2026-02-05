// ============================================
// Retrospective Prompt Template
// ============================================

/**
 * Context parameters for the retrospective prompt.
 */
export interface RetrospectivePromptContext {
  /** The title of the completed task */
  taskTitle: string;
  /** Optional description of the task */
  taskDescription?: string;
  /** The step ID for reference */
  stepId: string;
  /** Optional acceptance criteria that were being verified */
  acceptanceCriteria?: string[];
  /** Optional project-specific context or instructions */
  projectContext?: string;
  /** Optional additional instructions to include */
  additionalInstructions?: string;
}

/**
 * Default retrospective prompt template.
 * Requests structured reflection from an agent after task completion.
 */
const DEFAULT_RETROSPECTIVE_TEMPLATE = `
Now that you've completed the task, please provide a brief retrospective reflection.

Task completed: {{taskTitle}}
{{#if taskDescription}}
Task description: {{taskDescription}}
{{/if}}
{{#if acceptanceCriteria}}
Acceptance criteria:
{{#each acceptanceCriteria}}
- {{this}}
{{/each}}
{{/if}}
{{#if projectContext}}

Project context:
{{projectContext}}
{{/if}}
{{#if additionalInstructions}}

{{additionalInstructions}}
{{/if}}

Please respond with ONLY a JSON object in the following format (no markdown code blocks, no additional text):

{
  "summary": "Brief summary of what was accomplished (1-2 sentences)",
  "approach": "Description of the approach you took to complete this task",
  "decisions": [
    {
      "question": "The question or problem that required a decision",
      "chosen": "The option or approach you chose",
      "reasoning": "Why you made this choice"
    }
  ],
  "challenges": [
    "Any challenge or difficulty encountered during the task"
  ],
  "learnings": [
    "Key insight or learning from completing this task"
  ],
  "suggestions": [
    "Suggestion for future improvements or considerations"
  ],
  "confidence": 0.85
}

Guidelines:
- "summary" should be a concise description of what was actually accomplished
- "approach" should explain your methodology or strategy
- "decisions" should list important choices you made (can be empty array if none)
- "challenges" should list difficulties encountered (can be empty array if none)
- "learnings" should capture insights gained (can be empty array if none)
- "suggestions" should include recommendations for future work (can be empty array if none)
- "confidence" should be a number between 0 and 1 indicating your confidence in the work (1 = very confident)

Respond with ONLY the JSON object, no additional text or formatting.
`;

/**
 * Simple template variable replacement.
 * Supports {{variable}}, {{#if variable}}...{{/if}}, and {{#each variable}}...{{/each}}.
 */
function renderTemplate(template: string, context: Record<string, unknown>): string {
  let result = template;

  // Handle {{#each variable}}...{{/each}} blocks
  const eachPattern = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  result = result.replace(eachPattern, (_match, varName: string, content: string) => {
    const value = context[varName];
    if (Array.isArray(value) && value.length > 0) {
      return value
        .map((item) => {
          // Replace {{this}} with the array item
          return content.replace(/\{\{this\}\}/g, String(item));
        })
        .join('');
    }
    return '';
  });

  // Handle {{#if variable}}...{{/if}} blocks
  const ifPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(ifPattern, (_match, varName: string, content: string) => {
    const value = context[varName];
    if (value && (!Array.isArray(value) || value.length > 0)) {
      return content;
    }
    return '';
  });

  // Handle simple {{variable}} replacements
  const varPattern = /\{\{(\w+)\}\}/g;
  result = result.replace(varPattern, (_match, varName: string) => {
    const value = context[varName];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return '';
  });

  // Clean up extra blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Generates a retrospective prompt for an agent.
 *
 * @param context - Context parameters for the prompt
 * @param customTemplate - Optional custom template to use instead of default
 * @returns The rendered prompt string
 */
export function generateRetrospectivePrompt(
  context: RetrospectivePromptContext,
  customTemplate?: string
): string {
  const template = customTemplate ?? DEFAULT_RETROSPECTIVE_TEMPLATE;

  const templateContext: Record<string, unknown> = {
    taskTitle: context.taskTitle,
    taskDescription: context.taskDescription,
    stepId: context.stepId,
    acceptanceCriteria: context.acceptanceCriteria,
    projectContext: context.projectContext,
    additionalInstructions: context.additionalInstructions,
  };

  return renderTemplate(template, templateContext);
}

/**
 * Returns the default retrospective prompt template.
 * Useful for customization or reference.
 */
export function getDefaultRetrospectiveTemplate(): string {
  return DEFAULT_RETROSPECTIVE_TEMPLATE;
}

/**
 * Configuration for retrospective prompting behavior.
 */
export interface RetrospectivePromptConfig {
  /** Timeout in milliseconds for waiting for retrospective response (default: 30000) */
  timeoutMs: number;
  /** Custom prompt template to use instead of default */
  customTemplate?: string;
  /** Project-specific context to include in prompt */
  projectContext?: string;
  /** Additional instructions to append to prompt */
  additionalInstructions?: string;
  /** Whether to enable retrospective prompting (default: true) */
  enabled: boolean;
}

/**
 * Default configuration for retrospective prompting.
 */
export const DEFAULT_RETROSPECTIVE_CONFIG: RetrospectivePromptConfig = {
  timeoutMs: 30000, // 30 seconds
  enabled: true,
};

/**
 * Creates a retrospective prompt configuration with overrides.
 */
export function createRetrospectiveConfig(
  overrides?: Partial<RetrospectivePromptConfig>
): RetrospectivePromptConfig {
  return {
    ...DEFAULT_RETROSPECTIVE_CONFIG,
    ...overrides,
  };
}

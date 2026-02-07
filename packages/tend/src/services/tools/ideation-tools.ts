/**
 * Tool definitions for ideation operations
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const ideationTools: ToolDefinition[] = [
  {
    name: 'create_block',
    description: 'Create a new idea block (nugget) in the ideation space. Use this when the user expresses a new idea, requirement, or concept that should be captured.',
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The main content/idea for this block',
        },
        type: {
          type: 'string',
          enum: ['requirement', 'idea', 'question', 'constraint'],
          description: 'The type of block being created',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for categorization',
        },
      },
      required: ['content', 'type'],
    },
  },
  {
    name: 'update_block',
    description: 'Update an existing idea block. Use when refining or clarifying an existing concept.',
    input_schema: {
      type: 'object',
      properties: {
        blockId: {
          type: 'string',
          description: 'The ID of the block to update',
        },
        content: {
          type: 'string',
          description: 'Updated content for the block',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated tags',
        },
      },
      required: ['blockId'],
    },
  },
  {
    name: 'curate_block',
    description: 'Mark a block as curated/important. Use when an idea has been validated or deemed essential for the project.',
    input_schema: {
      type: 'object',
      properties: {
        blockId: {
          type: 'string',
          description: 'The ID of the block to curate',
        },
        rationale: {
          type: 'string',
          description: 'Why this block is being curated',
        },
      },
      required: ['blockId'],
    },
  },
  {
    name: 'start_session',
    description: 'Start a new ideation session for focused brainstorming on a specific topic or area.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title for the ideation session',
        },
        focus: {
          type: 'string',
          description: 'What this session should focus on',
        },
      },
      required: ['title'],
    },
  },
];

import { z } from 'zod';

/**
 * Context captures formalized decisions by role at the plan level.
 *
 * The schema is intentionally freeform: any role key, any fields within.
 * This allows different roles to think differently and orgs to have different needs.
 * The Orchestrator (an LLM) can understand any JSON structure.
 *
 * Intelligence lives in agent prompts, not Zod schemas. SUGGESTED_ROLES below
 * provides hints for UI and agent prompts but is NOT enforced by validation.
 *
 * Flow: understanding (observations) -> context (decisions) -> specification (implementation)
 */

/**
 * RoleContext stores any fields for a given role.
 * The structure is completely freeform - any key-value pairs allowed.
 */
export const RoleContextSchema = z.record(z.string(), z.unknown());
export type RoleContext = z.infer<typeof RoleContextSchema>;

/**
 * Context is a record keyed by role name.
 * Any role key is allowed (designer, architect, custom_role, etc.)
 */
export const ContextSchema = z.record(z.string(), RoleContextSchema);
export type Context = z.infer<typeof ContextSchema>;

/**
 * Suggested roles and their field hints.
 * These are documentation for agent prompts and UI hints - NOT enforced by schema.
 * Users and agents can add any role or field they want.
 */
export const SUGGESTED_ROLES = {
  designer: {
    description: 'Design system decisions that guide UI implementation',
    suggested_fields: ['library', 'theme', 'typography', 'patterns', 'icons'],
    field_hints: {
      library: 'Component library (e.g., shadcn/ui)',
      theme: 'Theme decisions - feel, colors, etc.',
      typography: 'Font family decisions - display, body, mono',
      patterns: 'Pattern decisions - cards, buttons, forms',
      icons: 'Icon approach - inline SVG, icon library, etc.',
    },
  },
  architect: {
    description: 'Technical architecture decisions that guide implementation',
    suggested_fields: ['tech_stack', 'api_style', 'storage', 'boundaries'],
    field_hints: {
      tech_stack: 'Core technologies (e.g., TypeScript, Express, SQLite)',
      api_style: 'API design approach (e.g., REST with Zod validation)',
      storage: 'Storage technology and approach',
      boundaries: 'Component/service boundaries with ownership',
    },
  },
  modeler: {
    description: 'Data model decisions that guide schema and storage design',
    suggested_fields: ['approach', 'entities', 'relationships', 'conventions', 'migrations'],
    field_hints: {
      approach: 'Overall modeling approach (e.g., JSONB for nested data, relational for queried fields)',
      entities: 'Core domain entities',
      relationships: 'Key entity relationships (e.g., Plan 1:N PlanVersion)',
      conventions: 'Naming conventions, ID formats, timestamp handling',
      migrations: 'Migration strategy (e.g., idempotent, additive only)',
    },
  },
  tester: {
    description: 'Testing strategy decisions that guide test implementation',
    suggested_fields: ['framework', 'coverage_target', 'strategy', 'test_data'],
    field_hints: {
      framework: 'Testing framework (e.g., Vitest)',
      coverage_target: 'Coverage goal (e.g., 80%)',
      strategy: 'Test type strategy (e.g., unit + integration + e2e)',
      test_data: 'Required test data/fixtures',
    },
  },
  security: {
    description: 'Security decisions that guide implementation constraints',
    suggested_fields: ['auth', 'compliance', 'data_handling'],
    field_hints: {
      auth: 'Authentication approach (e.g., JWT)',
      compliance: 'Compliance requirements (e.g., OWASP Top 10)',
      data_handling: 'Data handling policy (e.g., No PII stored)',
    },
  },
} as const;

export type SuggestedRole = keyof typeof SUGGESTED_ROLES;

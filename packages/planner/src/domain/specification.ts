import { z } from 'zod';

/**
 * Specification captures step-level implementation details by domain.
 *
 * The schema is intentionally freeform: any domain key, any fields within.
 * This allows different steps to have different domains based on what they need.
 * The Orchestrator (an LLM) can understand any JSON structure.
 *
 * Intelligence lives in agent prompts, not Zod schemas. SUGGESTED_DOMAINS below
 * provides hints for UI and agent prompts but is NOT enforced by validation.
 *
 * Flow: understanding (observations) -> context (decisions) -> specification (implementation)
 */

/**
 * DomainSpec stores any fields for a given domain.
 * The structure is completely freeform - any key-value pairs allowed.
 */
export const DomainSpecSchema = z.record(z.string(), z.unknown());
export type DomainSpec = z.infer<typeof DomainSpecSchema>;

/**
 * StepSpecification is a record keyed by domain name.
 * Any domain key is allowed (architecture, model, design, custom_domain, etc.)
 */
export const StepSpecificationSchema = z.record(z.string(), DomainSpecSchema);
export type StepSpecification = z.infer<typeof StepSpecificationSchema>;

/**
 * Suggested domains and their field hints.
 * These are documentation for agent prompts and UI hints - NOT enforced by schema.
 * Users and agents can add any domain or field they want.
 */
export const SUGGESTED_DOMAINS = {
  architecture: {
    description: 'Step-scoped architecture decisions and API contracts',
    suggested_fields: ['decisions', 'api_contracts', 'boundaries'],
    field_hints: {
      decisions: 'Array of {decision_id, decision, rationale, alternatives?}',
      api_contracts: 'Array of {endpoint, method, request_schema?, response_schema?}',
      boundaries: 'Array of {component_id, name, technology?, owns?}',
    },
  },
  model: {
    description: 'Step-scoped data model specifications',
    suggested_fields: ['entities', 'relationships', 'schemas', 'migrations'],
    field_hints: {
      entities: 'Array of {entity_id, name, attributes?, type?}',
      relationships: 'Array of {from, to, cardinality, description?}',
      schemas: 'Array of {schema_id, format, content}',
      migrations: 'Array of {migration_id, description, sql?}',
    },
  },
  design: {
    description: 'Step-scoped UI/UX specifications',
    suggested_fields: ['components', 'views', 'interactions'],
    field_hints: {
      components: 'Array of {component_id, name, props?, variants?, states?}',
      views: 'Array of {view_id, name, route?, components?}',
      interactions: 'Array of {trigger, action, feedback?}',
    },
  },
  testing: {
    description: 'Step-scoped test specifications',
    suggested_fields: ['test_cases', 'coverage_notes'],
    field_hints: {
      test_cases: 'Array of {case_id, type, priority, description, steps?, expected_result?}',
      coverage_notes: 'String with coverage strategy notes',
    },
  },
  security: {
    description: 'Step-scoped security specifications',
    suggested_fields: ['requirements', 'threats'],
    field_hints: {
      requirements: 'Array of {requirement_id, category, description, priority}',
      threats: 'Array of {threat, likelihood, impact, mitigations?}',
    },
  },
} as const;

export type SuggestedDomain = keyof typeof SUGGESTED_DOMAINS;

import { describe, it, expect } from 'vitest';
import {
  DomainSpecSchema,
  StepSpecificationSchema,
  SUGGESTED_DOMAINS,
} from './specification.js';

describe('DomainSpecSchema', () => {
  it('should accept any field names and values', () => {
    const result = DomainSpecSchema.parse({
      decision: 'Use PostgreSQL',
      rationale: 'Better for relational data',
      custom_field: 'any value',
    });
    expect(result.decision).toBe('Use PostgreSQL');
    expect(result.custom_field).toBe('any value');
  });

  it('should accept empty object', () => {
    const result = DomainSpecSchema.parse({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should accept nested objects as field values', () => {
    const result = DomainSpecSchema.parse({
      api_contract: {
        endpoint: '/api/plans',
        method: 'GET',
        errors: [{ code: 404, message: 'Not found' }],
      },
    });
    expect(result.api_contract).toEqual({
      endpoint: '/api/plans',
      method: 'GET',
      errors: [{ code: 404, message: 'Not found' }],
    });
  });

  it('should accept arrays as field values', () => {
    const result = DomainSpecSchema.parse({
      decisions: [
        { id: 'd1', decision: 'Use REST' },
        { id: 'd2', decision: 'Use Zod' },
      ],
      tags: ['backend', 'api'],
    });
    expect(result.decisions).toHaveLength(2);
    expect(result.tags).toContain('backend');
  });

  it('should accept primitive values', () => {
    const result = DomainSpecSchema.parse({
      coverage_target: 80,
      is_critical: true,
      notes: 'Some notes here',
    });
    expect(result.coverage_target).toBe(80);
    expect(result.is_critical).toBe(true);
  });
});

describe('StepSpecificationSchema', () => {
  it('should accept any domain key', () => {
    const result = StepSpecificationSchema.parse({
      architecture: { decision: 'Use microservices' },
      model: { entities: ['User', 'Plan'] },
      custom_domain: { anything: 'goes here' },
    });
    expect(result.architecture).toBeDefined();
    expect(result.model).toBeDefined();
    expect(result.custom_domain).toBeDefined();
  });

  it('should accept empty object', () => {
    const result = StepSpecificationSchema.parse({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should accept suggested domains', () => {
    const result = StepSpecificationSchema.parse({
      architecture: { decisions: [] },
      model: { entities: [] },
      design: { components: [] },
      testing: { test_cases: [] },
      security: { requirements: [] },
    });
    expect(Object.keys(result)).toHaveLength(5);
  });

  it('should accept custom domains alongside suggested domains', () => {
    const result = StepSpecificationSchema.parse({
      architecture: { tech_stack: 'Node.js + TypeScript' },
      deployment: { provider: 'AWS', region: 'us-east-1' },
      performance: { targets: { p99: '100ms', throughput: '1000rps' } },
    });
    expect(result.architecture).toBeDefined();
    expect(result.deployment).toBeDefined();
    expect(result.performance).toBeDefined();
  });

  it('should accept deeply nested structures', () => {
    const result = StepSpecificationSchema.parse({
      architecture: {
        decisions: [
          {
            decision_id: 'd001',
            decision: 'Use PostgreSQL',
            rationale: 'Better for relational data',
            alternatives: [
              { option: 'MongoDB', pros: ['Flexible'], cons: ['Joins'] },
              { option: 'SQLite', pros: ['Simple'], cons: ['Scale'] },
            ],
          },
        ],
        api_contracts: [
          {
            endpoint: '/api/plans/:id',
            method: 'GET',
            response: { plan_id: 'string', status: 'enum' },
          },
        ],
      },
    });
    expect(result.architecture?.decisions).toHaveLength(1);
    expect(result.architecture?.api_contracts).toHaveLength(1);
  });
});

describe('SUGGESTED_DOMAINS', () => {
  it('should contain architecture domain', () => {
    expect(SUGGESTED_DOMAINS.architecture).toBeDefined();
    expect(SUGGESTED_DOMAINS.architecture.description).toContain('architecture');
    expect(SUGGESTED_DOMAINS.architecture.suggested_fields).toContain('decisions');
    expect(SUGGESTED_DOMAINS.architecture.field_hints.decisions).toBeDefined();
  });

  it('should contain model domain', () => {
    expect(SUGGESTED_DOMAINS.model).toBeDefined();
    expect(SUGGESTED_DOMAINS.model.description).toContain('data model');
    expect(SUGGESTED_DOMAINS.model.suggested_fields).toContain('entities');
    expect(SUGGESTED_DOMAINS.model.field_hints.entities).toBeDefined();
  });

  it('should contain design domain', () => {
    expect(SUGGESTED_DOMAINS.design).toBeDefined();
    expect(SUGGESTED_DOMAINS.design.description).toContain('UI/UX');
    expect(SUGGESTED_DOMAINS.design.suggested_fields).toContain('components');
    expect(SUGGESTED_DOMAINS.design.field_hints.components).toBeDefined();
  });

  it('should contain testing domain', () => {
    expect(SUGGESTED_DOMAINS.testing).toBeDefined();
    expect(SUGGESTED_DOMAINS.testing.description).toContain('test');
    expect(SUGGESTED_DOMAINS.testing.suggested_fields).toContain('test_cases');
    expect(SUGGESTED_DOMAINS.testing.field_hints.test_cases).toBeDefined();
  });

  it('should contain security domain', () => {
    expect(SUGGESTED_DOMAINS.security).toBeDefined();
    expect(SUGGESTED_DOMAINS.security.description).toContain('security');
    expect(SUGGESTED_DOMAINS.security.suggested_fields).toContain('requirements');
    expect(SUGGESTED_DOMAINS.security.field_hints.requirements).toBeDefined();
  });

  it('should have exactly 5 suggested domains', () => {
    const domains = Object.keys(SUGGESTED_DOMAINS);
    expect(domains).toHaveLength(5);
    expect(domains).toEqual(['architecture', 'model', 'design', 'testing', 'security']);
  });

  it('should have field_hints for all suggested_fields in each domain', () => {
    for (const [domainName, domain] of Object.entries(SUGGESTED_DOMAINS)) {
      for (const field of domain.suggested_fields) {
        expect(
          domain.field_hints[field as keyof typeof domain.field_hints],
          `${domainName}.field_hints should have hint for ${field}`
        ).toBeDefined();
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  RoleContextSchema,
  ContextSchema,
  SUGGESTED_ROLES,
} from './context.js';

describe('RoleContextSchema', () => {
  it('should accept any field names and values', () => {
    const result = RoleContextSchema.parse({
      library: 'shadcn/ui',
      theme: 'dark mode',
      custom_field: 'custom value',
      nested: { key: 'value' },
    });
    expect(result.library).toBe('shadcn/ui');
    expect(result.theme).toBe('dark mode');
    expect(result.custom_field).toBe('custom value');
    expect(result.nested).toEqual({ key: 'value' });
  });

  it('should accept empty object', () => {
    const result = RoleContextSchema.parse({});
    expect(result).toEqual({});
  });

  it('should accept nested objects as field values', () => {
    const result = RoleContextSchema.parse({
      tech_stack: { frontend: 'React', backend: 'Node.js' },
      boundaries: {
        api: { owner: 'backend-team' },
        ui: { owner: 'frontend-team' },
      },
    });
    expect(result.tech_stack).toEqual({ frontend: 'React', backend: 'Node.js' });
    expect(result.boundaries).toEqual({
      api: { owner: 'backend-team' },
      ui: { owner: 'frontend-team' },
    });
  });

  it('should accept arrays as field values', () => {
    const result = RoleContextSchema.parse({
      patterns: ['cards', 'buttons', 'forms'],
      entities: ['Plan', 'PlanVersion', 'Step'],
    });
    expect(result.patterns).toEqual(['cards', 'buttons', 'forms']);
    expect(result.entities).toEqual(['Plan', 'PlanVersion', 'Step']);
  });
});

describe('ContextSchema', () => {
  it('should accept any role key', () => {
    const result = ContextSchema.parse({
      designer: { library: 'shadcn/ui', theme: 'dark' },
      architect: { tech_stack: 'TypeScript + Express' },
      custom_role: { some_field: 'some value' },
    });
    expect(result.designer?.library).toBe('shadcn/ui');
    expect(result.architect?.tech_stack).toBe('TypeScript + Express');
    expect(result.custom_role?.some_field).toBe('some value');
  });

  it('should accept empty object', () => {
    const result = ContextSchema.parse({});
    expect(result).toEqual({});
  });

  it('should accept nested objects and arrays as field values', () => {
    const result = ContextSchema.parse({
      designer: {
        patterns: ['cards', 'buttons'],
        library: { name: 'shadcn/ui', version: 'latest' },
      },
      modeler: {
        entities: ['Plan', 'PlanVersion'],
        relationships: { plan_to_version: '1:N' },
      },
    });
    expect(result.designer?.patterns).toEqual(['cards', 'buttons']);
    expect(result.designer?.library).toEqual({ name: 'shadcn/ui', version: 'latest' });
    expect(result.modeler?.entities).toEqual(['Plan', 'PlanVersion']);
    expect(result.modeler?.relationships).toEqual({ plan_to_version: '1:N' });
  });

  it('should accept multiple roles with different structures', () => {
    const result = ContextSchema.parse({
      designer: { library: 'shadcn/ui' },
      architect: { tech_stack: 'TypeScript' },
      tester: { framework: 'Vitest', coverage_target: '80%' },
      security: { auth: 'JWT' },
      modeler: { approach: 'JSONB for nested' },
    });
    expect(result.designer?.library).toBe('shadcn/ui');
    expect(result.architect?.tech_stack).toBe('TypeScript');
    expect(result.tester?.framework).toBe('Vitest');
    expect(result.security?.auth).toBe('JWT');
    expect(result.modeler?.approach).toBe('JSONB for nested');
  });
});

describe('SUGGESTED_ROLES', () => {
  it('should contain designer role with expected fields', () => {
    expect(SUGGESTED_ROLES.designer).toBeDefined();
    expect(SUGGESTED_ROLES.designer.description).toContain('Design system');
    expect(SUGGESTED_ROLES.designer.suggested_fields).toContain('library');
    expect(SUGGESTED_ROLES.designer.suggested_fields).toContain('theme');
    expect(SUGGESTED_ROLES.designer.suggested_fields).toContain('typography');
    expect(SUGGESTED_ROLES.designer.suggested_fields).toContain('patterns');
    expect(SUGGESTED_ROLES.designer.suggested_fields).toContain('icons');
    expect(SUGGESTED_ROLES.designer.field_hints.library).toBeDefined();
  });

  it('should contain architect role with expected fields', () => {
    expect(SUGGESTED_ROLES.architect).toBeDefined();
    expect(SUGGESTED_ROLES.architect.description).toContain('Technical architecture');
    expect(SUGGESTED_ROLES.architect.suggested_fields).toContain('tech_stack');
    expect(SUGGESTED_ROLES.architect.suggested_fields).toContain('api_style');
    expect(SUGGESTED_ROLES.architect.suggested_fields).toContain('storage');
    expect(SUGGESTED_ROLES.architect.suggested_fields).toContain('boundaries');
    expect(SUGGESTED_ROLES.architect.field_hints.tech_stack).toBeDefined();
  });

  it('should contain modeler role with expected fields', () => {
    expect(SUGGESTED_ROLES.modeler).toBeDefined();
    expect(SUGGESTED_ROLES.modeler.description).toContain('Data model');
    expect(SUGGESTED_ROLES.modeler.suggested_fields).toContain('approach');
    expect(SUGGESTED_ROLES.modeler.suggested_fields).toContain('entities');
    expect(SUGGESTED_ROLES.modeler.suggested_fields).toContain('relationships');
    expect(SUGGESTED_ROLES.modeler.suggested_fields).toContain('conventions');
    expect(SUGGESTED_ROLES.modeler.suggested_fields).toContain('migrations');
    expect(SUGGESTED_ROLES.modeler.field_hints.approach).toBeDefined();
  });

  it('should contain tester role with expected fields', () => {
    expect(SUGGESTED_ROLES.tester).toBeDefined();
    expect(SUGGESTED_ROLES.tester.description).toContain('Testing strategy');
    expect(SUGGESTED_ROLES.tester.suggested_fields).toContain('framework');
    expect(SUGGESTED_ROLES.tester.suggested_fields).toContain('coverage_target');
    expect(SUGGESTED_ROLES.tester.suggested_fields).toContain('strategy');
    expect(SUGGESTED_ROLES.tester.suggested_fields).toContain('test_data');
    expect(SUGGESTED_ROLES.tester.field_hints.framework).toBeDefined();
  });

  it('should contain security role with expected fields', () => {
    expect(SUGGESTED_ROLES.security).toBeDefined();
    expect(SUGGESTED_ROLES.security.description).toContain('Security decisions');
    expect(SUGGESTED_ROLES.security.suggested_fields).toContain('auth');
    expect(SUGGESTED_ROLES.security.suggested_fields).toContain('compliance');
    expect(SUGGESTED_ROLES.security.suggested_fields).toContain('data_handling');
    expect(SUGGESTED_ROLES.security.field_hints.auth).toBeDefined();
  });
});

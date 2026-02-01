import { describe, it, expect } from 'vitest';
import {
  ConfidenceSchema,
  AgentObservationsSchema,
  UnderstandingSchema,
} from './understanding.js';

describe('ConfidenceSchema', () => {
  it('should validate exploring level', () => {
    expect(ConfidenceSchema.parse('exploring')).toBe('exploring');
  });

  it('should validate forming level', () => {
    expect(ConfidenceSchema.parse('forming')).toBe('forming');
  });

  it('should validate confident level', () => {
    expect(ConfidenceSchema.parse('confident')).toBe('confident');
  });

  it('should reject invalid confidence value', () => {
    expect(() => ConfidenceSchema.parse('unknown')).toThrow();
  });
});

describe('AgentObservationsSchema', () => {
  it('should validate with all fields', () => {
    const result = AgentObservationsSchema.parse({
      observations: ['Found a pattern', 'Noticed complexity'],
      keywords: ['auth', 'security'],
      questions: ['How to handle edge case?'],
      concerns: ['Performance impact'],
      references: ['https://example.com/docs'],
      confidence: 'forming',
      updated_at: '2026-01-31T12:00:00.000Z',
      updated_by: 'architect-agent',
    });
    expect(result.observations).toHaveLength(2);
    expect(result.keywords).toEqual(['auth', 'security']);
    expect(result.confidence).toBe('forming');
  });

  it('should validate with no fields (all optional)', () => {
    const result = AgentObservationsSchema.parse({});
    expect(result.observations).toBeUndefined();
    expect(result.keywords).toBeUndefined();
    expect(result.confidence).toBeUndefined();
  });

  it('should validate with partial fields', () => {
    const result = AgentObservationsSchema.parse({
      observations: ['Just one observation'],
      confidence: 'exploring',
    });
    expect(result.observations).toEqual(['Just one observation']);
    expect(result.confidence).toBe('exploring');
    expect(result.keywords).toBeUndefined();
  });

  it('should reject invalid confidence value', () => {
    expect(() =>
      AgentObservationsSchema.parse({
        observations: ['Valid'],
        confidence: 'invalid-level',
      })
    ).toThrow();
  });

  it('should reject invalid updated_at format', () => {
    expect(() =>
      AgentObservationsSchema.parse({
        updated_at: 'not-a-datetime',
      })
    ).toThrow();
  });
});

describe('UnderstandingSchema', () => {
  it('should validate empty understanding', () => {
    const result = UnderstandingSchema.parse({});
    expect(result).toEqual({});
  });

  it('should accept any string role key', () => {
    const result = UnderstandingSchema.parse({
      architect: { observations: ['Structure looks good'] },
      designer: { keywords: ['minimalist', 'dark-mode'] },
      'custom-role': { concerns: ['Custom concern'] },
    });
    expect(result.architect?.observations).toEqual(['Structure looks good']);
    expect(result.designer?.keywords).toEqual(['minimalist', 'dark-mode']);
    expect(result['custom-role']?.concerns).toEqual(['Custom concern']);
  });

  it('should validate multiple roles with different confidence levels', () => {
    const result = UnderstandingSchema.parse({
      architect: { confidence: 'confident' },
      designer: { confidence: 'forming' },
      tester: { confidence: 'exploring' },
    });
    expect(result.architect?.confidence).toBe('confident');
    expect(result.designer?.confidence).toBe('forming');
    expect(result.tester?.confidence).toBe('exploring');
  });

  it('should reject invalid observations for a role', () => {
    expect(() =>
      UnderstandingSchema.parse({
        architect: { confidence: 'not-valid' },
      })
    ).toThrow();
  });
});

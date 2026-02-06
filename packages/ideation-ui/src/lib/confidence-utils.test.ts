import { describe, it, expect } from 'vitest';
import {
  parseConfidenceValue,
  extractSpecialistConfidence,
  aggregateSessionConfidence,
} from './confidence-utils';
import {
  extractCategoryNames,
  extractCategoryDetails,
  extractRecommendations,
  identifyLowConfidenceCategories,
  formatCategoryName,
  LOW_CONFIDENCE_THRESHOLD,
} from './category-utils';

describe('parseConfidenceValue', () => {
  it('parses percentage strings', () => {
    expect(parseConfidenceValue('75%')).toBe(75);
    expect(parseConfidenceValue('0%')).toBe(0);
    expect(parseConfidenceValue('100%')).toBe(100);
    expect(parseConfidenceValue('  88%  ')).toBe(88);
  });

  it('parses verbal confidence levels', () => {
    expect(parseConfidenceValue('confident')).toBe(80);
    expect(parseConfidenceValue('forming')).toBe(50);
    expect(parseConfidenceValue('exploring')).toBe(20);
    expect(parseConfidenceValue('uncertain')).toBe(10);
    expect(parseConfidenceValue('unknown')).toBe(0);
    expect(parseConfidenceValue('Confident')).toBe(80); // case insensitive
  });

  it('parses numeric values', () => {
    expect(parseConfidenceValue(75)).toBe(75);
    expect(parseConfidenceValue(0)).toBe(0);
    expect(parseConfidenceValue(100)).toBe(100);
  });

  it('clamps numeric values to 0-100 range', () => {
    expect(parseConfidenceValue(150)).toBe(100);
    expect(parseConfidenceValue(-10)).toBe(0);
  });

  it('handles undefined and null', () => {
    expect(parseConfidenceValue(undefined)).toBe(0);
    expect(parseConfidenceValue(null)).toBe(0);
  });

  it('handles invalid values', () => {
    expect(parseConfidenceValue('invalid')).toBe(0);
    expect(parseConfidenceValue({})).toBe(0);
    expect(parseConfidenceValue([])).toBe(0);
  });
});

describe('extractSpecialistConfidence', () => {
  it('extracts root-level confidence_level', () => {
    const observations = {
      confidence_level: '75%',
      system_design: { mcp_tool_integration: 'details...' },
    };

    const result = extractSpecialistConfidence(observations);
    expect(result.overall).toBe(75);
    expect(result.byCategory).toEqual({});
  });

  it('falls back to per-category confidence averaging', () => {
    const observations = {
      system_design: { mcp_tool_integration: 'details...', confidence: '88%' },
      scalability: { specialist_spawning: 'details...', confidence: '79%' },
    };

    const result = extractSpecialistConfidence(observations);
    expect(result.overall).toBe((88 + 79) / 2);
    expect(result.byCategory).toEqual({
      system_design: 88,
      scalability: 79,
    });
  });

  it('defaults categories without explicit confidence to 50%', () => {
    const observations = {
      system_design: { mcp_tool_integration: 'details...', confidence: '88%' },
      scalability: { specialist_spawning: 'details...' }, // no confidence
    };

    const result = extractSpecialistConfidence(observations);
    expect(result.overall).toBe((88 + 50) / 2);
    expect(result.byCategory).toEqual({
      system_design: 88,
      scalability: 50,
    });
  });

  it('returns 0 if no confidence data found', () => {
    const observations = {};
    const result = extractSpecialistConfidence(observations);
    expect(result.overall).toBe(0);
    expect(result.byCategory).toEqual({});
  });

  it('skips meta fields like role and roleHint', () => {
    const observations = {
      role: 'Architect',
      roleHint: 'System design expert',
      system_design: { confidence: '90%' },
    };

    const result = extractSpecialistConfidence(observations);
    expect(result.overall).toBe(90);
    expect(result.byCategory).toEqual({ system_design: 90 });
  });
});

describe('aggregateSessionConfidence', () => {
  it('calculates weighted average across specialists', () => {
    const understanding = {
      Architect: {
        confidence_level: '80%',
      },
      Backend: {
        api_design: { confidence: '90%' },
        security: { confidence: '70%' },
      },
    };

    const result = aggregateSessionConfidence(understanding);

    // Architect: weight = 1 (has overall, no categories), score = 80
    // Backend: weight = 2 (2 categories), score = (90+70)/2 = 80
    // Overall: (80*1 + 80*2) / (1+2) = 240/3 = 80
    expect(result.score).toBe(80);
    expect(result.bySpecialist).toEqual({
      Architect: 80,
      Backend: 80,
    });
  });

  it('excludes empty specialists (weight = 0)', () => {
    const understanding = {
      Active: {
        confidence_level: '75%',
      },
      Empty: {},
    };

    const result = aggregateSessionConfidence(understanding);
    expect(result.score).toBe(75);
    expect(result.bySpecialist).toEqual({ Active: 75 });
  });

  it('returns 0 for completely empty understanding', () => {
    const result = aggregateSessionConfidence({});
    expect(result.score).toBe(0);
    expect(result.bySpecialist).toEqual({});
  });

  it('weights by number of categories', () => {
    const understanding = {
      SpecialistA: {
        cat1: { confidence: '100%' },
        cat2: { confidence: '100%' },
        cat3: { confidence: '100%' },
      },
      SpecialistB: {
        cat1: { confidence: '0%' },
      },
    };

    const result = aggregateSessionConfidence(understanding);

    // SpecialistA: weight = 3, score = 100
    // SpecialistB: weight = 1, score = 0
    // Overall: (100*3 + 0*1) / 4 = 75
    expect(result.score).toBe(75);
  });

  it('handles real specialist output format', () => {
    const understanding = {
      Architect: {
        confidence_level: '75%',
        system_design: {
          mcp_tool_integration: 'Details about MCP tool integration...',
          confidence: '88%',
        },
        scalability: {
          specialist_spawning: 'Details about specialist spawning...',
          confidence: '79%',
        },
      },
      Security: {
        confidence_level: '55%',
        recommendations: ['item1', 'item2'],
      },
    };

    const result = aggregateSessionConfidence(understanding);

    // Architect: has confidence_level (75%), weight = 1
    // Security: has confidence_level (55%), weight = 1
    // Overall: (75*1 + 55*1) / (1+1) = 130/2 = 65
    expect(result.score).toBe(65);
    expect(result.bySpecialist).toEqual({
      Architect: 75,
      Security: 55,
    });
  });
});

describe('extractCategoryNames', () => {
  it('extracts category names from specialist observations', () => {
    const observations = {
      confidence_level: '75%',
      system_design: { mcp_tool_integration: 'details...' },
      scalability: { specialist_spawning: 'details...' },
    };

    const categories = extractCategoryNames(observations);
    expect(categories).toEqual(['system_design', 'scalability']);
  });

  it('filters out reserved metadata keys', () => {
    const observations = {
      confidence: 75,
      confidence_level: '75%',
      keywords: ['keyword1', 'keyword2'],
      concerns: ['concern1'],
      questions: ['question1'],
      observations: 'some observation',
      recommendations: ['rec1', 'rec2'],
      confidence_reasoning: 'reasoning text',
      system_design: { details: 'actual category' },
    };

    const categories = extractCategoryNames(observations);
    expect(categories).toEqual(['system_design']);
  });

  it('only includes object values (not arrays or primitives)', () => {
    const observations = {
      valid_category: { confidence: '88%' },
      array_field: ['item1', 'item2'],
      string_field: 'some string',
      number_field: 42,
      null_field: null,
    };

    const categories = extractCategoryNames(observations);
    expect(categories).toEqual(['valid_category']);
  });

  it('returns empty array for empty observations', () => {
    const categories = extractCategoryNames({});
    expect(categories).toEqual([]);
  });

  it('returns empty array when only reserved keys present', () => {
    const observations = {
      confidence_level: '75%',
      recommendations: ['item1', 'item2'],
    };

    const categories = extractCategoryNames(observations);
    expect(categories).toEqual([]);
  });
});

describe('extractCategoryDetails', () => {
  it('extracts category details with confidence and item counts', () => {
    const observations = {
      system_design: {
        mcp_tool_integration: 'Details about MCP...',
        component_architecture: 'Details about architecture...',
        confidence: '88%',
      },
      scalability: {
        specialist_spawning: 'Details about spawning...',
        confidence: '79%',
      },
    };

    const details = extractCategoryDetails(observations);
    expect(details).toEqual([
      {
        name: 'system_design',
        confidence: 88,
        itemCount: 2, // mcp_tool_integration, component_architecture (confidence not counted)
        hasRecommendations: false,
        items: expect.any(Array),
      },
      {
        name: 'scalability',
        confidence: 79,
        itemCount: 1, // specialist_spawning (confidence not counted)
        hasRecommendations: false,
        items: expect.any(Array),
      },
    ]);
  });

  it('detects categories with recommendations', () => {
    const observations = {
      security: {
        threat_modeling: 'Details...',
        confidence: '55%',
        recommendations: ['Use encryption', 'Add authentication'],
      },
      system_design: {
        confidence: '90%',
      },
    };

    const details = extractCategoryDetails(observations);
    expect(details[0]!.hasRecommendations).toBe(true);
    expect(details[1]!.hasRecommendations).toBe(false);
  });

  it('handles missing confidence gracefully', () => {
    const observations = {
      category_without_confidence: {
        item1: 'detail1',
        item2: 'detail2',
      },
    };

    const details = extractCategoryDetails(observations);
    expect(details[0]!.confidence).toBe(0);
  });

  it('parses confidence from percentage strings', () => {
    const observations = {
      cat1: { confidence: '75%' },
      cat2: { confidence: '88%' },
    };

    const details = extractCategoryDetails(observations);
    expect(details[0]!.confidence).toBe(75);
    expect(details[1]!.confidence).toBe(88);
  });

  it('parses confidence from numeric values', () => {
    const observations = {
      cat1: { confidence: 75 },
      cat2: { confidence: 88 },
    };

    const details = extractCategoryDetails(observations);
    expect(details[0]!.confidence).toBe(75);
    expect(details[1]!.confidence).toBe(88);
  });

  it('returns empty array for observations with no categories', () => {
    const observations = {
      confidence_level: '75%',
      recommendations: ['item1'],
    };

    const details = extractCategoryDetails(observations);
    expect(details).toEqual([]);
  });
});

describe('extractRecommendations', () => {
  it('extracts top-level recommendations', () => {
    const observations = {
      recommendations: ['item1', 'item2', 'item3'],
      system_design: { confidence: '88%' },
    };

    const recommendations = extractRecommendations(observations);
    expect(recommendations).toEqual(['item1', 'item2', 'item3']);
  });

  it('extracts category-level recommendations', () => {
    const observations = {
      security: {
        confidence: '55%',
        recommendations: ['Use encryption', 'Add authentication'],
      },
      scalability: {
        confidence: '79%',
        recommendations: ['Consider caching'],
      },
    };

    const recommendations = extractRecommendations(observations);
    expect(recommendations).toEqual([
      'Use encryption',
      'Add authentication',
      'Consider caching',
    ]);
  });

  it('combines top-level and category-level recommendations', () => {
    const observations = {
      recommendations: ['global-rec1', 'global-rec2'],
      security: {
        confidence: '55%',
        recommendations: ['security-rec1'],
      },
      system_design: {
        confidence: '88%',
        recommendations: ['design-rec1'],
      },
    };

    const recommendations = extractRecommendations(observations);
    expect(recommendations).toEqual([
      'global-rec1',
      'global-rec2',
      'security-rec1',
      'design-rec1',
    ]);
  });

  it('filters out non-string recommendation items', () => {
    const observations = {
      recommendations: ['item1', 42, null, 'item2', undefined, { nested: 'obj' }],
    };

    const recommendations = extractRecommendations(observations);
    expect(recommendations).toEqual(['item1', 'item2']);
  });

  it('returns empty array when no recommendations present', () => {
    const observations = {
      system_design: { confidence: '88%' },
      scalability: { confidence: '79%' },
    };

    const recommendations = extractRecommendations(observations);
    expect(recommendations).toEqual([]);
  });

  it('handles empty recommendations array', () => {
    const observations = {
      recommendations: [],
      security: {
        recommendations: [],
      },
    };

    const recommendations = extractRecommendations(observations);
    expect(recommendations).toEqual([]);
  });
});

describe('identifyLowConfidenceCategories', () => {
  it('identifies categories below threshold', () => {
    const observations = {
      system_design: { confidence: '88%' },
      scalability: { confidence: '79%' },
      threat_modeling: { confidence: '40%' },
      security_audit: { confidence: '30%' },
    };

    const lowConfidence = identifyLowConfidenceCategories(observations);
    expect(lowConfidence).toEqual(['threat_modeling', 'security_audit']);
  });

  it('returns empty array when all categories have high confidence', () => {
    const observations = {
      system_design: { confidence: '88%' },
      scalability: { confidence: '79%' },
      security: { confidence: '90%' },
    };

    const lowConfidence = identifyLowConfidenceCategories(observations);
    expect(lowConfidence).toEqual([]);
  });

  it('uses LOW_CONFIDENCE_THRESHOLD constant', () => {
    const observations = {
      exactly_at_threshold: { confidence: `${LOW_CONFIDENCE_THRESHOLD}%` },
      just_below_threshold: { confidence: `${LOW_CONFIDENCE_THRESHOLD - 1}%` },
      just_above_threshold: { confidence: `${LOW_CONFIDENCE_THRESHOLD + 1}%` },
    };

    const lowConfidence = identifyLowConfidenceCategories(observations);
    // Categories < threshold should be flagged
    expect(lowConfidence).toContain('just_below_threshold');
    expect(lowConfidence).not.toContain('exactly_at_threshold');
    expect(lowConfidence).not.toContain('just_above_threshold');
  });

  it('handles categories without explicit confidence', () => {
    const observations = {
      no_confidence_field: {
        item1: 'detail1',
      },
      with_confidence: { confidence: '80%' },
    };

    const lowConfidence = identifyLowConfidenceCategories(observations);
    // Category without confidence defaults to 0, which is < threshold
    expect(lowConfidence).toContain('no_confidence_field');
    expect(lowConfidence).not.toContain('with_confidence');
  });

  it('returns empty array for empty observations', () => {
    const lowConfidence = identifyLowConfidenceCategories({});
    expect(lowConfidence).toEqual([]);
  });
});

describe('formatCategoryName', () => {
  it('formats snake_case to Title Case', () => {
    expect(formatCategoryName('system_design')).toBe('System Design');
    expect(formatCategoryName('threat_modeling')).toBe('Threat Modeling');
    expect(formatCategoryName('api_architecture')).toBe('Api Architecture');
  });

  it('handles single word categories', () => {
    expect(formatCategoryName('security')).toBe('Security');
    expect(formatCategoryName('scalability')).toBe('Scalability');
  });

  it('handles multi-word categories', () => {
    expect(formatCategoryName('system_design_patterns')).toBe(
      'System Design Patterns'
    );
    expect(formatCategoryName('real_time_data_processing')).toBe(
      'Real Time Data Processing'
    );
  });

  it('handles undefined and null', () => {
    expect(formatCategoryName(undefined)).toBe('');
    expect(formatCategoryName(null)).toBe('');
  });

  it('handles empty string', () => {
    expect(formatCategoryName('')).toBe('');
  });

  it('preserves already capitalized words', () => {
    expect(formatCategoryName('HTTP_API')).toBe('HTTP API');
  });
});

describe('Integration: real specialist output format', () => {
  it('processes complete Architect specialist output', () => {
    const architectObservations = {
      confidence_level: '75%',
      system_design: {
        mcp_tool_integration: 'MCP tools provide structured agent communication...',
        component_architecture: 'React + TypeScript frontend, Node.js backend...',
        confidence: '88%',
      },
      scalability: {
        specialist_spawning: 'Dynamic specialist spawning via relay...',
        session_management: 'SQLite-based session persistence...',
        confidence: '79%',
      },
    };

    // Extract confidence
    const confidence = extractSpecialistConfidence(architectObservations);
    expect(confidence.overall).toBe(75);
    expect(confidence.byCategory).toEqual({});

    // Extract categories
    const categories = extractCategoryNames(architectObservations);
    expect(categories).toEqual(['system_design', 'scalability']);

    // Extract details
    const details = extractCategoryDetails(architectObservations);
    expect(details).toHaveLength(2);
    expect(details[0]).toMatchObject({
      name: 'system_design',
      confidence: 88,
      hasRecommendations: false,
    });

    // Check for low confidence
    const lowConfidence = identifyLowConfidenceCategories(architectObservations);
    expect(lowConfidence).toEqual([]);
  });

  it('processes Security specialist with recommendations', () => {
    const securityObservations = {
      confidence_level: '55%',
      threat_modeling: {
        identified_threats: 'Unauthorized agent spawning, data injection...',
        confidence: '40%',
        recommendations: [
          'Implement agent authentication',
          'Add input validation for all relay messages',
        ],
      },
      recommendations: [
        'Review authentication flow',
        'Add rate limiting',
      ],
    };

    // Extract confidence
    const confidence = extractSpecialistConfidence(securityObservations);
    expect(confidence.overall).toBe(55);

    // Extract all recommendations
    const recommendations = extractRecommendations(securityObservations);
    expect(recommendations).toEqual([
      'Review authentication flow',
      'Add rate limiting',
      'Implement agent authentication',
      'Add input validation for all relay messages',
    ]);

    // Identify low confidence categories
    const lowConfidence = identifyLowConfidenceCategories(securityObservations);
    expect(lowConfidence).toEqual(['threat_modeling']);

    // Extract category details
    const details = extractCategoryDetails(securityObservations);
    expect(details[0]).toMatchObject({
      name: 'threat_modeling',
      confidence: 40,
      hasRecommendations: true,
    });
  });

  it('aggregates session with multiple specialists', () => {
    const understanding = {
      Architect: {
        confidence_level: '75%',
        system_design: { confidence: '88%' },
        scalability: { confidence: '79%' },
      },
      Security: {
        confidence_level: '55%',
        threat_modeling: { confidence: '40%' },
      },
      Backend: {
        api_design: { confidence: '90%' },
        database_schema: { confidence: '85%' },
      },
    };

    const sessionConfidence = aggregateSessionConfidence(understanding);

    // Verify per-specialist scores
    expect(sessionConfidence.bySpecialist).toEqual({
      Architect: 75,
      Security: 55,
      Backend: (90 + 85) / 2, // 87.5
    });

    // Verify overall score is weighted average
    // Architect: weight=1, score=75
    // Security: weight=1, score=55
    // Backend: weight=2, score=87.5
    const expectedScore = (75 * 1 + 55 * 1 + 87.5 * 2) / 4; // 76.25
    expect(sessionConfidence.score).toBe(expectedScore);
  });
});

/**
 * Test file for ExtractionResult examples
 * Validates that all examples conform to the schema and scoring guidelines
 */

import { describe, it, expect } from 'vitest';
import { ExtractionResultSchema } from '../domain/types.js';
import * as examples from './extraction-results.examples.js';

describe('ExtractionResult Examples', () => {
  describe('Schema Validation', () => {
    it('should validate all examples against ExtractionResultSchema', () => {
      Object.entries(examples.allExamples).forEach(([name, example]) => {
        const result = ExtractionResultSchema.safeParse(example);
        expect(result.success).toBe(true);
        if (!result.success) {
          console.error(`Example "${name}" failed validation:`, result.error.errors);
        }
      });
    });

    it('criticalIncidentReport should be valid', () => {
      const result = ExtractionResultSchema.safeParse(examples.criticalIncidentReport);
      expect(result.success).toBe(true);
    });

    it('vagueCustomerFeedback should be valid', () => {
      const result = ExtractionResultSchema.safeParse(examples.vagueCustomerFeedback);
      expect(result.success).toBe(true);
    });

    it('securityVulnerabilityAlert should be valid', () => {
      const result = ExtractionResultSchema.safeParse(examples.securityVulnerabilityAlert);
      expect(result.success).toBe(true);
    });

    it('strategicMarketInsight should be valid', () => {
      const result = ExtractionResultSchema.safeParse(examples.strategicMarketInsight);
      expect(result.success).toBe(true);
    });

    it('developerExperienceIssue should be valid', () => {
      const result = ExtractionResultSchema.safeParse(examples.developerExperienceIssue);
      expect(result.success).toBe(true);
    });

    it('featureRequest should be valid', () => {
      const result = ExtractionResultSchema.safeParse(examples.featureRequest);
      expect(result.success).toBe(true);
    });

    it('ambiguousPerformanceStatement should be valid', () => {
      const result = ExtractionResultSchema.safeParse(examples.ambiguousPerformanceStatement);
      expect(result.success).toBe(true);
    });

    it('operationalRunbook should be valid', () => {
      const result = ExtractionResultSchema.safeParse(examples.operationalRunbook);
      expect(result.success).toBe(true);
    });
  });

  describe('Scoring Ranges', () => {
    it('all scores should be between 0 and 1', () => {
      Object.entries(examples.allExamples).forEach(([name, example]) => {
        expect(example.specificity).toBeGreaterThanOrEqual(0);
        expect(example.specificity).toBeLessThanOrEqual(1);
        expect(example.emotional_intensity).toBeGreaterThanOrEqual(0);
        expect(example.emotional_intensity).toBeLessThanOrEqual(1);
        expect(example.actionability).toBeGreaterThanOrEqual(0);
        expect(example.actionability).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Score Interpretation', () => {
    it('criticalIncidentReport should have high specificity', () => {
      expect(examples.criticalIncidentReport.specificity).toBeGreaterThan(0.8);
    });

    it('criticalIncidentReport should have moderate emotional intensity', () => {
      expect(examples.criticalIncidentReport.emotional_intensity).toBeGreaterThan(0.4);
      expect(examples.criticalIncidentReport.emotional_intensity).toBeLessThan(0.6);
    });

    it('criticalIncidentReport should have high actionability', () => {
      expect(examples.criticalIncidentReport.actionability).toBeGreaterThan(0.8);
    });

    it('vagueCustomerFeedback should have low specificity', () => {
      expect(examples.vagueCustomerFeedback.specificity).toBeLessThan(0.3);
    });

    it('vagueCustomerFeedback should have low actionability', () => {
      expect(examples.vagueCustomerFeedback.actionability).toBeLessThan(0.3);
    });

    it('securityVulnerabilityAlert should have very high emotional intensity', () => {
      expect(examples.securityVulnerabilityAlert.emotional_intensity).toBeGreaterThan(0.9);
    });

    it('securityVulnerabilityAlert should have high actionability', () => {
      expect(examples.securityVulnerabilityAlert.actionability).toBeGreaterThan(0.7);
    });

    it('strategicMarketInsight should have low emotional intensity', () => {
      expect(examples.strategicMarketInsight.emotional_intensity).toBeLessThan(0.3);
    });

    it('strategicMarketInsight should have high actionability', () => {
      expect(examples.strategicMarketInsight.actionability).toBeGreaterThan(0.7);
    });

    it('operationalRunbook should have very high specificity', () => {
      expect(examples.operationalRunbook.specificity).toBeGreaterThan(0.9);
    });

    it('operationalRunbook should have very high actionability', () => {
      expect(examples.operationalRunbook.actionability).toBeGreaterThanOrEqual(0.9);
    });

    it('operationalRunbook should have low emotional intensity', () => {
      expect(examples.operationalRunbook.emotional_intensity).toBeLessThan(0.2);
    });
  });

  describe('Required Fields', () => {
    it('should have all required fields populated', () => {
      Object.entries(examples.allExamples).forEach(([name, example]) => {
        expect(example.summary).toBeDefined();
        expect(example.summary).not.toBe('');
        expect(example.keywords).toBeDefined();
        expect(Array.isArray(example.keywords)).toBe(true);
        expect(example.keywords.length).toBeGreaterThan(0);
        expect(example.entities).toBeDefined();
        expect(Array.isArray(example.entities)).toBe(true);
        expect(example.aspects).toBeDefined();
        expect(Array.isArray(example.aspects)).toBe(true);
        expect(example.aspects.length).toBeGreaterThan(0);
        expect(example.quotes).toBeDefined();
        expect(Array.isArray(example.quotes)).toBe(true);
        expect(example.reasoning).toBeDefined();
        expect(example.reasoning).not.toBe('');
        expect(example.specificity).toBeDefined();
        expect(example.emotional_intensity).toBeDefined();
        expect(example.actionability).toBeDefined();
      });
    });
  });

  describe('Reasoning Quality', () => {
    it('reasoning should explain score choices', () => {
      Object.entries(examples.allExamples).forEach(([name, example]) => {
        // Reasoning should mention at least one of the scoring dimensions
        const hasScoreMention =
          example.reasoning.toLowerCase().includes('specificity') ||
          example.reasoning.toLowerCase().includes('emotional') ||
          example.reasoning.toLowerCase().includes('actionability') ||
          example.reasoning.toLowerCase().includes('high') ||
          example.reasoning.toLowerCase().includes('low') ||
          example.reasoning.toLowerCase().includes('moderate');

        expect(hasScoreMention).toBe(true);
      });
    });
  });

  describe('Entity Structure', () => {
    it('all entities should have name and type', () => {
      Object.entries(examples.allExamples).forEach(([name, example]) => {
        example.entities.forEach((entity) => {
          expect(entity).toHaveProperty('name');
          expect(entity).toHaveProperty('type');
          expect(typeof entity.name).toBe('string');
          expect(entity.name).not.toBe('');
          expect(typeof entity.type).toBe('string');
          expect(entity.type).not.toBe('');
        });
      });
    });
  });

  describe('Score Distribution', () => {
    it('should have a variety of scores across examples', () => {
      const specificities = Object.values(examples.allExamples).map((e) => e.specificity);
      const intensities = Object.values(examples.allExamples).map((e) => e.emotional_intensity);
      const actionabilities = Object.values(examples.allExamples).map((e) => e.actionability);

      // Check that we have variation in scores (not all the same)
      const uniqueSpecificities = new Set(specificities);
      const uniqueIntensities = new Set(intensities);
      const uniqueActionabilities = new Set(actionabilities);

      expect(uniqueSpecificities.size).toBeGreaterThan(1);
      expect(uniqueIntensities.size).toBeGreaterThan(1);
      expect(uniqueActionabilities.size).toBeGreaterThan(1);
    });
  });
});

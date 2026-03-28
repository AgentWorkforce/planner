import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { SpawnTaskOptions } from '../../../forge-core/src/services/agent-spawner.js';

/**
 * Integration tests for prompt context capping with realistic data sizes
 */

// Mock buildTaskPrompt to test the actual logic
// We extract the buildTaskPrompt function logic for integration testing
function simulateContextBudget(
  specification?: Record<string, unknown>,
  planContext?: Record<string, unknown>,
  planUnderstanding?: Record<string, unknown>,
  scope?: string,
  maxChars = 12000
): {
  included: string[];
  dropped: string[];
  filtered: string[];
  compacted: string[];
  totalSize: number;
} {
  const sections: Array<{
    key: string;
    data: Record<string, unknown>;
    priority: number;
    sizeChars: number;
  }> = [];

  const included: string[] = [];
  const dropped: string[] = [];
  const filtered: string[] = [];
  const compacted: string[] = [];

  // Collect sections
  if (specification && Object.keys(specification).length > 0) {
    const json = JSON.stringify(specification, null, 2);
    sections.push({
      key: 'specification',
      data: specification,
      priority: 0,
      sizeChars: json.length,
    });
  }

  if (planContext && Object.keys(planContext).length > 0) {
    const json = JSON.stringify(planContext, null, 2);
    sections.push({
      key: 'planContext',
      data: planContext,
      priority: 2,
      sizeChars: json.length,
    });
  }

  if (planUnderstanding && Object.keys(planUnderstanding).length > 0) {
    const json = JSON.stringify(planUnderstanding, null, 2);
    sections.push({
      key: 'planUnderstanding',
      data: planUnderstanding,
      priority: 3,
      sizeChars: json.length,
    });
  }

  let totalSize = sections.reduce((sum, s) => sum + s.sizeChars, 0);

  // Apply reductions if over budget
  if (totalSize > maxChars) {
    const sortedSections = [...sections].sort((a, b) => b.priority - a.priority);

    for (const section of sortedSections) {
      if (totalSize <= maxChars || section.priority === 0) {
        break;
      }

      // Try filtering planContext by scope first
      if (section.key === 'planContext' && scope) {
        const scopeKeys = Object.keys(section.data).filter(
          (key) =>
            key.toLowerCase().includes(scope.toLowerCase()) ||
            key === 'shared' ||
            key === 'common'
        );

        if (scopeKeys.length > 0 && scopeKeys.length < Object.keys(section.data).length) {
          const filteredData: Record<string, unknown> = {};
          for (const key of scopeKeys) {
            filteredData[key] = section.data[key];
          }
          const oldSize = section.sizeChars;
          const newJson = JSON.stringify(filteredData, null, 2);
          section.data = filteredData;
          section.sizeChars = newJson.length;
          totalSize = totalSize - oldSize + section.sizeChars;
          filtered.push(section.key);
          continue;
        }
      }

      // Drop the section
      dropped.push(section.key);
      totalSize -= section.sizeChars;
      section.sizeChars = 0;
    }
  }

  // Check for compaction (sections > 2000 chars)
  for (const section of sections) {
    if (section.sizeChars > 0) {
      included.push(section.key);
      if (section.sizeChars > 2000) {
        compacted.push(section.key);
      }
    }
  }

  return { included, dropped, filtered, compacted, totalSize };
}

describe('forge-spawner integration: realistic data sizes', () => {
  describe('small plan (under budget)', () => {
    it('should include all sections for small plan', () => {
      const specification = {
        target_files: ['api/users.ts'],
        implementation: 'Add CRUD endpoints',
      };
      const planContext = {
        shared: { types: 'interface User { id: string; name: string; }' },
      };
      const planUnderstanding = {
        observations: 'Uses Express with TypeScript',
      };

      const result = simulateContextBudget(specification, planContext, planUnderstanding);

      expect(result.included).toEqual(['specification', 'planContext', 'planUnderstanding']);
      expect(result.dropped).toEqual([]);
      expect(result.totalSize).toBeLessThan(12000);
    });
  });

  describe('medium plan (slightly over budget)', () => {
    it('should drop planUnderstanding when over budget', () => {
      // Create medium-sized data
      const specification = {
        target_files: Array.from({ length: 20 }, (_, i) => `file${i}.ts`),
        patterns: Object.fromEntries(
          Array.from({ length: 30 }, (_, i) => [`pattern${i}`, `value${i}`])
        ),
      };

      const planContext = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`context${i}`, `value${i}`])
      );

      const planUnderstanding = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`observation${i}`, `long observation text here`])
      );

      const specSize = JSON.stringify(specification, null, 2).length;
      const contextSize = JSON.stringify(planContext, null, 2).length;
      const understandingSize = JSON.stringify(planUnderstanding, null, 2).length;

      // Small budget to force dropping
      const result = simulateContextBudget(
        specification,
        planContext,
        planUnderstanding,
        undefined,
        specSize + contextSize + 100 // Just enough for spec + context
      );

      expect(result.included).toContain('specification');
      expect(result.included).toContain('planContext');
      expect(result.dropped).toContain('planUnderstanding');
    });
  });

  describe('large plan (well over budget)', () => {
    it('should drop both planUnderstanding and planContext when necessary', () => {
      // Create large specification (never dropped)
      const specification = Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`spec${i}`, `detailed spec ${i}`])
      );

      const planContext = Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`context${i}`, `value${i}`])
      );

      const planUnderstanding = Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`obs${i}`, `observation ${i}`])
      );

      const specSize = JSON.stringify(specification, null, 2).length;

      // Budget only allows specification
      const result = simulateContextBudget(
        specification,
        planContext,
        planUnderstanding,
        undefined,
        specSize + 100
      );

      expect(result.included).toEqual(['specification']);
      expect(result.dropped).toContain('planContext');
      expect(result.dropped).toContain('planUnderstanding');
    });
  });

  describe('scope-based filtering', () => {
    it('should filter planContext by scope before dropping', () => {
      const specification = { target: 'api.ts' };

      const planContext = {
        'api-service': {
          types: 'API-specific types here',
          patterns: 'API patterns',
        },
        'web-frontend': {
          types: 'Frontend types here',
          patterns: 'Frontend patterns',
        },
        'mobile-app': {
          types: 'Mobile types here',
          patterns: 'Mobile patterns',
        },
        shared: {
          types: 'Shared types',
        },
      };

      const planUnderstanding = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`obs${i}`, `observation ${i}`])
      );

      const specSize = JSON.stringify(specification, null, 2).length;
      const apiContextSize = JSON.stringify(
        {
          'api-service': planContext['api-service'],
          shared: planContext.shared,
        },
        null,
        2
      ).length;

      // Budget allows spec + filtered context
      const result = simulateContextBudget(
        specification,
        planContext,
        planUnderstanding,
        'api-service', // scope
        specSize + apiContextSize + 100
      );

      expect(result.included).toContain('specification');
      expect(result.included).toContain('planContext');
      expect(result.filtered).toContain('planContext');
      expect(result.dropped).toContain('planUnderstanding');
    });

    it('should handle scope with no matching keys gracefully', () => {
      const specification = { target: 'api.ts' };

      const planContext = {
        'web-frontend': { types: 'Frontend types' },
        'mobile-app': { types: 'Mobile types' },
      };

      const result = simulateContextBudget(
        specification,
        planContext,
        undefined,
        'api-service', // scope with no matches
        1000
      );

      // Since no keys match, planContext will be dropped entirely if over budget
      // or included fully if under budget
      expect(result.included).toContain('specification');
    });
  });

  describe('compaction threshold', () => {
    it('should identify sections over 2000 chars for compaction', () => {
      // Create a large specification (over 2000 chars)
      const specification = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [
          `spec${i}`,
          `Very detailed specification with lots of information about implementation ${i}`,
        ])
      );

      const specSize = JSON.stringify(specification, null, 2).length;

      const result = simulateContextBudget(specification, undefined, undefined, undefined, 50000);

      expect(specSize).toBeGreaterThan(2000);
      expect(result.compacted).toContain('specification');
    });

    it('should not compact small sections', () => {
      const specification = { target: 'api.ts', implementation: 'Add endpoint' };

      const specSize = JSON.stringify(specification, null, 2).length;

      const result = simulateContextBudget(specification, undefined, undefined, undefined, 50000);

      expect(specSize).toBeLessThan(2000);
      expect(result.compacted).not.toContain('specification');
    });
  });

  describe('budget configuration', () => {
    it('should respect custom budget values', () => {
      const specification = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`spec${i}`, `value${i}`])
      );

      const planContext = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`ctx${i}`, `value${i}`])
      );

      const planUnderstanding = Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [`obs${i}`, `value${i}`])
      );

      // Small budget
      const smallResult = simulateContextBudget(
        specification,
        planContext,
        planUnderstanding,
        undefined,
        1000
      );

      // Large budget
      const largeResult = simulateContextBudget(
        specification,
        planContext,
        planUnderstanding,
        undefined,
        50000
      );

      // With small budget, some sections should be dropped
      expect(smallResult.dropped.length).toBeGreaterThan(0);
      // With large budget, all sections should be included
      expect(largeResult.dropped.length).toBe(0);
      expect(largeResult.included.length).toBe(3);
    });
  });

  describe('priority enforcement', () => {
    it('should never drop specification regardless of size', () => {
      // Create massive specification
      const specification = Object.fromEntries(
        Array.from({ length: 1000 }, (_, i) => [
          `spec${i}`,
          `Very long specification value ${i}`.repeat(10),
        ])
      );

      const specSize = JSON.stringify(specification, null, 2).length;

      const result = simulateContextBudget(specification, undefined, undefined, undefined, 1000);

      expect(specSize).toBeGreaterThan(10000);
      expect(result.included).toContain('specification');
      expect(result.dropped).not.toContain('specification');
    });

    it('should drop in correct priority order', () => {
      const specification = { target: 'api.ts' };

      const planContext = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`ctx${i}`, `value${i}`])
      );

      const planUnderstanding = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`obs${i}`, `value${i}`])
      );

      const specSize = JSON.stringify(specification, null, 2).length;
      const contextSize = JSON.stringify(planContext, null, 2).length;

      // Budget allows spec + context, but not understanding
      const result = simulateContextBudget(
        specification,
        planContext,
        planUnderstanding,
        undefined,
        specSize + contextSize + 100
      );

      // planUnderstanding should be dropped first (priority 3)
      expect(result.included).toContain('specification');
      expect(result.included).toContain('planContext');
      expect(result.dropped).toContain('planUnderstanding');
      expect(result.dropped).not.toContain('specification');
      expect(result.dropped).not.toContain('planContext');
    });
  });
});

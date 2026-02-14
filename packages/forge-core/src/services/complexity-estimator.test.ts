/**
 * Tests for ComplexityEstimator
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTaskComplexity,
  estimateComplexityLevel,
  estimateComplexityScore,
  type ComplexityLevel,
} from './complexity-estimator.js';
import type { Task } from '../domain/types.js';

describe('ComplexityEstimator', () => {
  const baseTask: Task = {
    task_id: 'task-1',
    run_id: 'run-1',
    step_id: 'step-1',
    step_title: 'Implement feature',
    status: 'pending',
    dependencies: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  describe('estimateTaskComplexity', () => {
    it('should return high complexity for architecture keywords', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Design system architecture',
        step_description: 'Redesign the core platform infrastructure',
        acceptance_criteria: [
          { id: 'ac-1', description: 'Design patterns' },
          { id: 'ac-2', description: 'System diagram' },
        ],
      };

      const estimate = estimateTaskComplexity(task);

      // Architecture keywords push to high complexity
      expect(['complex', 'architecture']).toContain(estimate.level);
      expect(estimate.score).toBeGreaterThan(0.7);
      expect(estimate.factors).toContain('Architecture-related keywords detected');
    });

    it('should return simple level for analysis tasks with few criteria', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Analyze codebase',
        step_description: 'Review the current implementation',
        acceptance_criteria: [{ id: 'ac-1', description: 'Document findings' }],
      };

      const estimate = estimateTaskComplexity(task);

      expect(estimate.level).toBe('simple');
      expect(estimate.score).toBeLessThanOrEqual(0.4);
    });

    it('should return complex level for tasks with many acceptance criteria', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Implement authentication',
        acceptance_criteria: [
          { id: 'ac-1', description: 'OAuth integration' },
          { id: 'ac-2', description: 'Session management' },
          { id: 'ac-3', description: 'Token refresh' },
          { id: 'ac-4', description: 'Logout flow' },
          { id: 'ac-5', description: 'Security tests' },
        ],
        dependencies: ['step-0'],
      };

      const estimate = estimateTaskComplexity(task);

      expect(estimate.level).toBe('complex');
      expect(estimate.score).toBeGreaterThan(0.6);
      expect(estimate.factors.some(f => f.includes('acceptance criteria'))).toBe(true);
    });

    it('should return moderate level for tasks with moderate complexity', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Add user endpoint',
        step_description: 'Create a REST endpoint for user management with validation',
        acceptance_criteria: [
          { id: 'ac-1', description: 'GET /users' },
          { id: 'ac-2', description: 'POST /users' },
          { id: 'ac-3', description: 'Input validation' },
        ],
        dependencies: ['step-0', 'step-1'],
      };

      const estimate = estimateTaskComplexity(task);

      expect(estimate.level).toBe('moderate');
      expect(estimate.score).toBeGreaterThan(0.4);
      expect(estimate.score).toBeLessThanOrEqual(0.6);
    });

    it('should increase complexity for many dependencies', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Integrate all services',
        dependencies: ['step-1', 'step-2', 'step-3', 'step-4'],
        acceptance_criteria: [
          { id: 'ac-1', description: 'Integration complete' },
          { id: 'ac-2', description: 'Tests pass' },
        ],
      };

      const estimate = estimateTaskComplexity(task);

      expect(estimate.score).toBeGreaterThan(0.6);
      expect(estimate.factors.some(f => f.includes('dependencies'))).toBe(true);
    });

    it('should handle tasks with no description or criteria', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Update docs',
      };

      const estimate = estimateTaskComplexity(task);

      expect(estimate.level).toBe('simple');
      expect(estimate.score).toBeLessThanOrEqual(0.4);
    });

    it('should increase complexity for long descriptions', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Implement feature',
        step_description: 'a'.repeat(600), // Very long description
      };

      const estimate = estimateTaskComplexity(task);

      expect(estimate.score).toBeGreaterThan(0.5);
      expect(estimate.factors.some(f => f.includes('Long description'))).toBe(true);
    });

    it('should detect complex integration keywords', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Multi-tier orchestration',
        step_description: 'Coordinate end-to-end workflow',
      };

      const estimate = estimateTaskComplexity(task);

      expect(estimate.score).toBeGreaterThan(0.6);
      expect(estimate.factors.some(f => f.includes('Complex/integration'))).toBe(true);
    });
  });

  describe('estimateComplexityLevel', () => {
    it('should return just the complexity level', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Analyze code',
      };

      const level = estimateComplexityLevel(task);

      expect(['trivial', 'simple', 'moderate', 'complex', 'architecture']).toContain(level);
    });
  });

  describe('estimateComplexityScore', () => {
    it('should return a score between 0 and 1', () => {
      const task: Task = {
        ...baseTask,
        step_title: 'Implement feature',
      };

      const score = estimateComplexityScore(task);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return higher scores for more complex tasks', () => {
      const simpleTask: Task = {
        ...baseTask,
        step_title: 'Review code',
      };

      const complexTask: Task = {
        ...baseTask,
        step_title: 'Architect system',
        step_description: 'Design and implement multi-service architecture',
        acceptance_criteria: [
          { id: 'ac-1', description: 'Service A' },
          { id: 'ac-2', description: 'Service B' },
          { id: 'ac-3', description: 'Integration' },
          { id: 'ac-4', description: 'Testing' },
        ],
        dependencies: ['step-1', 'step-2', 'step-3'],
      };

      const simpleScore = estimateComplexityScore(simpleTask);
      const complexScore = estimateComplexityScore(complexTask);

      expect(complexScore).toBeGreaterThan(simpleScore);
    });
  });
});

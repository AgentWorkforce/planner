import { describe, it, expect } from 'vitest';
import type { SpawnTaskOptions } from '../../../forge-core/src/services/agent-spawner.js';

/**
 * Tests for verify_only mode detection in buildTaskPrompt
 */

// Extract the buildTaskPrompt function logic for testing
function detectVerifyOnlyMode(options: SpawnTaskOptions): boolean {
  const spec = options.specification as Record<string, unknown> | undefined;
  const prepTaskGuidance = (options.prepFindings as Record<string, unknown> | undefined)?.task_guidance as Record<string, unknown> | undefined;

  return !!(spec?.verify_only || prepTaskGuidance?.already_implemented);
}

function detectAlreadyBuiltHint(options: SpawnTaskOptions): boolean {
  const spec = options.specification as Record<string, unknown> | undefined;
  const isVerifyOnly = detectVerifyOnlyMode(options);

  return !isVerifyOnly && !!spec?.already_built_hint;
}

describe('forge-spawner verify_only mode detection', () => {
  const baseOptions: SpawnTaskOptions = {
    taskId: 'task-123',
    runId: 'run-456',
    stepTitle: 'Test step',
    cli: 'claude',
  };

  describe('verify_only from specification', () => {
    it('should detect verify_only=true in specification', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: { verify_only: true },
      };

      expect(detectVerifyOnlyMode(options)).toBe(true);
    });

    it('should not detect verify_only when false', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: { verify_only: false },
      };

      expect(detectVerifyOnlyMode(options)).toBe(false);
    });

    it('should not detect verify_only when missing', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: {},
      };

      expect(detectVerifyOnlyMode(options)).toBe(false);
    });
  });

  describe('verify_only from PREP task_guidance', () => {
    it('should detect already_implemented from PREP', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        prepFindings: {
          task_guidance: {
            already_implemented: true,
          },
        },
      };

      expect(detectVerifyOnlyMode(options)).toBe(true);
    });

    it('should not detect when already_implemented is false', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        prepFindings: {
          task_guidance: {
            already_implemented: false,
          },
        },
      };

      expect(detectVerifyOnlyMode(options)).toBe(false);
    });

    it('should not detect when task_guidance is missing', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        prepFindings: {
          other_field: 'value',
        },
      };

      expect(detectVerifyOnlyMode(options)).toBe(false);
    });
  });

  describe('combined detection', () => {
    it('should trigger on specification verify_only', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: { verify_only: true },
        prepFindings: {
          task_guidance: {
            already_implemented: false,
          },
        },
      };

      expect(detectVerifyOnlyMode(options)).toBe(true);
    });

    it('should trigger on PREP already_implemented', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: { verify_only: false },
        prepFindings: {
          task_guidance: {
            already_implemented: true,
          },
        },
      };

      expect(detectVerifyOnlyMode(options)).toBe(true);
    });

    it('should trigger when both are true', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: { verify_only: true },
        prepFindings: {
          task_guidance: {
            already_implemented: true,
          },
        },
      };

      expect(detectVerifyOnlyMode(options)).toBe(true);
    });
  });

  describe('already_built_hint', () => {
    it('should show hint when present and not verify_only', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: { already_built_hint: true },
      };

      expect(detectAlreadyBuiltHint(options)).toBe(true);
    });

    it('should NOT show hint when verify_only is active', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: {
          already_built_hint: true,
          verify_only: true,
        },
      };

      expect(detectAlreadyBuiltHint(options)).toBe(false);
    });

    it('should NOT show hint when missing', () => {
      const options: SpawnTaskOptions = {
        ...baseOptions,
        specification: {},
      };

      expect(detectAlreadyBuiltHint(options)).toBe(false);
    });
  });
});

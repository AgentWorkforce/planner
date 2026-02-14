/**
 * Tests for Tier 0 greenhouse keyword gate filter
 */

import { describe, it, expect } from 'vitest';
import { applyGreenhouseGate } from './greenhouse-gate.js';
import { SignalFilteredError } from '../errors.js';

describe('applyGreenhouseGate', () => {
  const baseSignal = {
    title: 'Test signal',
    body: 'Test body',
    source_type: 'poll_api',
    external_id: 'test-123',
    greenhouse_id: 'greenhouse-1',
  };

  describe('keyword_require behavior', () => {
    it('should pass when keyword_require is empty', () => {
      const result = applyGreenhouseGate(baseSignal, {
        keyword_require: [],
        keyword_exclude: [],
      });

      expect(result.passed).toBe(true);
    });

    it('should pass when signal contains required keyword (case-insensitive)', () => {
      const signal = {
        ...baseSignal,
        title: 'Authentication flow improvement',
        body: 'We need to improve the login process',
      };

      const result = applyGreenhouseGate(signal, {
        keyword_require: ['auth'],
        keyword_exclude: [],
      });

      expect(result.passed).toBe(true);
    });

    it('should pass when signal contains required keyword in body (case-insensitive)', () => {
      const signal = {
        ...baseSignal,
        title: 'User flow update',
        body: 'Update the authentication system',
      };

      const result = applyGreenhouseGate(signal, {
        keyword_require: ['authentication'],
        keyword_exclude: [],
      });

      expect(result.passed).toBe(true);
    });

    it('should pass when signal contains one of multiple required keywords', () => {
      const signal = {
        ...baseSignal,
        title: 'Security improvement',
        body: 'Enhance the security features',
      };

      const result = applyGreenhouseGate(signal, {
        keyword_require: ['auth', 'security', 'login'],
        keyword_exclude: [],
      });

      expect(result.passed).toBe(true);
    });

    it('should throw SignalFilteredError when missing required keyword', () => {
      const signal = {
        ...baseSignal,
        title: 'UI improvement',
        body: 'Update the button styles',
      };

      expect(() => {
        applyGreenhouseGate(signal, {
          keyword_require: ['auth'],
          keyword_exclude: [],
        });
      }).toThrow(SignalFilteredError);
    });

    it('should include clear reason when missing required keyword', () => {
      const signal = {
        ...baseSignal,
        title: 'UI improvement',
        body: 'Update the button styles',
      };

      try {
        applyGreenhouseGate(signal, {
          keyword_require: ['auth', 'security'],
          keyword_exclude: [],
        });
        expect.fail('Should have thrown SignalFilteredError');
      } catch (error) {
        expect(error).toBeInstanceOf(SignalFilteredError);
        expect((error as SignalFilteredError).reason).toContain('Missing required keyword');
        expect((error as SignalFilteredError).reason).toContain('auth OR security');
        expect((error as SignalFilteredError).filter_tier).toBe(0);
      }
    });
  });

  describe('keyword_exclude behavior', () => {
    it('should pass when keyword_exclude is empty', () => {
      const result = applyGreenhouseGate(baseSignal, {
        keyword_require: [],
        keyword_exclude: [],
      });

      expect(result.passed).toBe(true);
    });

    it('should pass when signal does not contain excluded keyword', () => {
      const signal = {
        ...baseSignal,
        title: 'Production bug fix',
        body: 'Fix the authentication flow',
      };

      const result = applyGreenhouseGate(signal, {
        keyword_require: [],
        keyword_exclude: ['test'],
      });

      expect(result.passed).toBe(true);
    });

    it('should throw SignalFilteredError when signal contains excluded keyword', () => {
      const signal = {
        ...baseSignal,
        title: 'This is a test message',
        body: 'Testing the feature',
      };

      expect(() => {
        applyGreenhouseGate(signal, {
          keyword_require: [],
          keyword_exclude: ['test'],
        });
      }).toThrow(SignalFilteredError);
    });

    it('should include clear reason when contains excluded keyword', () => {
      const signal = {
        ...baseSignal,
        title: 'This is a test message',
        body: 'Just testing',
      };

      try {
        applyGreenhouseGate(signal, {
          keyword_require: [],
          keyword_exclude: ['test'],
        });
        expect.fail('Should have thrown SignalFilteredError');
      } catch (error) {
        expect(error).toBeInstanceOf(SignalFilteredError);
        expect((error as SignalFilteredError).reason).toContain('Contains excluded keyword');
        expect((error as SignalFilteredError).reason).toContain('test');
        expect((error as SignalFilteredError).filter_tier).toBe(0);
      }
    });

    it('should reject on first excluded keyword match', () => {
      const signal = {
        ...baseSignal,
        title: 'Test draft spam',
        body: 'This is a test message',
      };

      try {
        applyGreenhouseGate(signal, {
          keyword_require: [],
          keyword_exclude: ['test', 'draft', 'spam'],
        });
        expect.fail('Should have thrown SignalFilteredError');
      } catch (error) {
        expect(error).toBeInstanceOf(SignalFilteredError);
        expect((error as SignalFilteredError).reason).toContain('test');
      }
    });
  });

  describe('combined behavior', () => {
    it('should pass when both required and excluded keywords are satisfied', () => {
      const signal = {
        ...baseSignal,
        title: 'Authentication improvement',
        body: 'Enhance the login security',
      };

      const result = applyGreenhouseGate(signal, {
        keyword_require: ['auth'],
        keyword_exclude: ['test', 'draft'],
      });

      expect(result.passed).toBe(true);
    });

    it('should reject when required keyword is present but excluded keyword also present', () => {
      const signal = {
        ...baseSignal,
        title: 'Test the authentication flow',
        body: 'Testing auth improvements',
      };

      expect(() => {
        applyGreenhouseGate(signal, {
          keyword_require: ['auth'],
          keyword_exclude: ['test'],
        });
      }).toThrow(SignalFilteredError);
    });

    it('should reject when missing required keyword even if no excluded keywords', () => {
      const signal = {
        ...baseSignal,
        title: 'UI improvement',
        body: 'Update button styles',
      };

      expect(() => {
        applyGreenhouseGate(signal, {
          keyword_require: ['auth'],
          keyword_exclude: ['test'],
        });
      }).toThrow(SignalFilteredError);
    });
  });

  describe('case-insensitive matching', () => {
    it('should match required keywords regardless of case', () => {
      const signal = {
        ...baseSignal,
        title: 'AUTHENTICATION System',
        body: 'Improve AUTH flow',
      };

      const result = applyGreenhouseGate(signal, {
        keyword_require: ['authentication'],
        keyword_exclude: [],
      });

      expect(result.passed).toBe(true);
    });

    it('should match excluded keywords regardless of case', () => {
      const signal = {
        ...baseSignal,
        title: 'TEST Message',
        body: 'This is a TEST',
      };

      expect(() => {
        applyGreenhouseGate(signal, {
          keyword_require: [],
          keyword_exclude: ['test'],
        });
      }).toThrow(SignalFilteredError);
    });
  });

  describe('SignalMetadata in error', () => {
    it('should include correct metadata in SignalFilteredError', () => {
      const signal = {
        title: 'Test message',
        body: 'Testing',
        source_type: 'webhook',
        external_id: 'ext-456',
        greenhouse_id: 'greenhouse-2',
      };

      try {
        applyGreenhouseGate(signal, {
          keyword_require: ['auth'],
          keyword_exclude: [],
        });
        expect.fail('Should have thrown SignalFilteredError');
      } catch (error) {
        expect(error).toBeInstanceOf(SignalFilteredError);
        const filteredError = error as SignalFilteredError;
        expect(filteredError.signal_metadata.source_type).toBe('webhook');
        expect(filteredError.signal_metadata.external_id).toBe('ext-456');
        expect(filteredError.signal_metadata.greenhouse_id).toBe('greenhouse-2');
      }
    });
  });
});

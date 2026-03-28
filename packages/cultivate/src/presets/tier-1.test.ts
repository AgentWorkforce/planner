/**
 * Tests for Tier 1 preset factories
 */

import { describe, it, expect } from 'vitest';
import {
  createSupportTicketPreset,
  createSurveyPreset,
  createInterviewPreset,
} from './tier-1';
import { SourcePresetSchema } from '../schemas';

describe('Tier 1 Preset Factories', () => {
  describe('createSupportTicketPreset', () => {
    it('should create a valid Support Ticket preset', () => {
      const preset = createSupportTicketPreset();
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should have correct channel_authority for Support Tickets', () => {
      const preset = createSupportTicketPreset();
      expect(preset.channel_authority).toBe(0.85);
    });

    it('should have poll_api adapter type', () => {
      const preset = createSupportTicketPreset();
      expect(preset.adapter_type).toBe('poll_api');
    });

    it('should require api_key and instance_url', () => {
      const preset = createSupportTicketPreset();
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('api_key');
      expect(requiredKeys).toContain('instance_url');
    });

    it('should include optional status_filter and lookback_days', () => {
      const preset = createSupportTicketPreset();
      const optionalKeys = preset.optional_inputs.map((i) => i.key);
      expect(optionalKeys).toContain('status_filter');
      expect(optionalKeys).toContain('lookback_days');
    });

    it('should have poll_interval_ms in defaults', () => {
      const preset = createSupportTicketPreset();
      expect(preset.defaults).toHaveProperty('poll_interval_ms');
    });
  });

  describe('createSurveyPreset', () => {
    it('should create a valid Survey preset', () => {
      const preset = createSurveyPreset();
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should have correct channel_authority for Surveys', () => {
      const preset = createSurveyPreset();
      expect(preset.channel_authority).toBe(0.90);
    });

    it('should have structured_pull adapter type', () => {
      const preset = createSurveyPreset();
      expect(preset.adapter_type).toBe('structured_pull');
    });

    it('should require api_key and survey_id', () => {
      const preset = createSurveyPreset();
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('api_key');
      expect(requiredKeys).toContain('survey_id');
    });

    it('should include optional completed_only and lookback_days', () => {
      const preset = createSurveyPreset();
      const optionalKeys = preset.optional_inputs.map((i) => i.key);
      expect(optionalKeys).toContain('completed_only');
      expect(optionalKeys).toContain('lookback_days');
    });

    it('should default completed_only to true', () => {
      const preset = createSurveyPreset();
      const completedOnly = preset.optional_inputs.find((i) => i.key === 'completed_only');
      expect(completedOnly?.default).toBe('true');
    });
  });

  describe('createInterviewPreset', () => {
    it('should create a valid Interview preset', () => {
      const preset = createInterviewPreset();
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should have correct channel_authority for Interviews', () => {
      const preset = createInterviewPreset();
      expect(preset.channel_authority).toBe(0.95);
    });

    it('should have push adapter type', () => {
      const preset = createInterviewPreset();
      expect(preset.adapter_type).toBe('push');
    });

    it('should require webhook_endpoint', () => {
      const preset = createInterviewPreset();
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('webhook_endpoint');
    });

    it('should include transcript format options', () => {
      const preset = createInterviewPreset();
      const optionalKeys = preset.optional_inputs.map((i) => i.key);
      expect(optionalKeys).toContain('transcript_format');
      expect(optionalKeys).toContain('segment_by_topic');
    });

    it('should default transcript_format to speaker-labeled', () => {
      const preset = createInterviewPreset();
      const format = preset.optional_inputs.find((i) => i.key === 'transcript_format');
      expect(format?.default).toBe('speaker-labeled');
    });

    it('should have batch_processing in defaults', () => {
      const preset = createInterviewPreset();
      expect(preset.defaults).toHaveProperty('batch_processing', true);
    });
  });

  describe('Tier 1 Authority Range', () => {
    it('all presets should have channel_authority between 0.8 and 1.0', () => {
      const presets = [
        createSupportTicketPreset(),
        createSurveyPreset(),
        createInterviewPreset(),
      ];

      presets.forEach((preset) => {
        expect(preset.channel_authority).toBeGreaterThanOrEqual(0.8);
        expect(preset.channel_authority).toBeLessThanOrEqual(1.0);
      });
    });

    it('all presets should have distinct authority values', () => {
      const authorities = [
        createSupportTicketPreset().channel_authority,
        createSurveyPreset().channel_authority,
        createInterviewPreset().channel_authority,
      ];
      const uniqueAuthorities = new Set(authorities);
      expect(uniqueAuthorities.size).toBe(authorities.length);
    });
  });

  describe('Preset Schema Validation', () => {
    it('all presets should have valid InputField definitions', () => {
      const presets = [
        createSupportTicketPreset(),
        createSurveyPreset(),
        createInterviewPreset(),
      ];

      presets.forEach((preset) => {
        preset.required_inputs.forEach((input) => {
          expect(input.key).toBeDefined();
          expect(input.label).toBeDefined();
          expect(input.type).toBeDefined();
          expect(input.description).toBeDefined();
        });

        preset.optional_inputs.forEach((input) => {
          expect(input.key).toBeDefined();
          expect(input.label).toBeDefined();
          expect(input.type).toBeDefined();
          expect(input.description).toBeDefined();
        });
      });
    });
  });
});

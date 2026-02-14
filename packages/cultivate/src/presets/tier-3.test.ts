/**
 * Tests for Tier 3 preset factories
 */

import { describe, it, expect } from 'vitest';
import {
  createSlackPreset,
  createDiscordPreset,
  createTeamsPreset,
  createCRMNotesPreset,
  createSalesCallPreset,
} from './tier-3';
import { SourcePresetSchema } from '../schemas';

describe('Tier 3 Preset Factories', () => {
  describe('createSlackPreset', () => {
    it('should create a valid Slack preset', () => {
      const preset = createSlackPreset();
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should have correct channel_authority for Slack', () => {
      const preset = createSlackPreset();
      expect(preset.channel_authority).toBe(0.55);
    });

    it('should have poll_api adapter type', () => {
      const preset = createSlackPreset();
      expect(preset.adapter_type).toBe('poll_api');
    });

    it('should require bot_token and channel_ids', () => {
      const preset = createSlackPreset();
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('bot_token');
      expect(requiredKeys).toContain('channel_ids');
    });

    it('should include optional message_limit', () => {
      const preset = createSlackPreset();
      const optionalKeys = preset.optional_inputs.map((i) => i.key);
      expect(optionalKeys).toContain('message_limit');
    });
  });

  describe('createDiscordPreset', () => {
    it('should create a valid Discord preset', () => {
      const preset = createDiscordPreset();
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should have correct channel_authority for Discord', () => {
      const preset = createDiscordPreset();
      expect(preset.channel_authority).toBe(0.52);
    });

    it('should have poll_api adapter type', () => {
      const preset = createDiscordPreset();
      expect(preset.adapter_type).toBe('poll_api');
    });

    it('should require bot_token, guild_id, and channel_ids', () => {
      const preset = createDiscordPreset();
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('bot_token');
      expect(requiredKeys).toContain('guild_id');
      expect(requiredKeys).toContain('channel_ids');
    });
  });

  describe('createTeamsPreset', () => {
    it('should create a valid Teams preset', () => {
      const preset = createTeamsPreset();
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should have correct channel_authority for Teams', () => {
      const preset = createTeamsPreset();
      expect(preset.channel_authority).toBe(0.60);
    });

    it('should have poll_api adapter type', () => {
      const preset = createTeamsPreset();
      expect(preset.adapter_type).toBe('poll_api');
    });

    it('should require webhook_url and tenant_id', () => {
      const preset = createTeamsPreset();
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('webhook_url');
      expect(requiredKeys).toContain('tenant_id');
    });
  });

  describe('createCRMNotesPreset', () => {
    it('should create a valid Salesforce CRM preset by default', () => {
      const preset = createCRMNotesPreset();
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should create a valid HubSpot CRM preset when specified', () => {
      const preset = createCRMNotesPreset('hubspot');
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should have correct channel_authority for CRM', () => {
      const preset = createCRMNotesPreset();
      expect(preset.channel_authority).toBe(0.62);
    });

    it('should have poll_api adapter type', () => {
      const preset = createCRMNotesPreset();
      expect(preset.adapter_type).toBe('poll_api');
    });

    it('should require api_key', () => {
      const preset = createCRMNotesPreset();
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('api_key');
    });

    it('should include instance_url for Salesforce', () => {
      const preset = createCRMNotesPreset('salesforce');
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('instance_url');
    });

    it('should not include instance_url for HubSpot', () => {
      const preset = createCRMNotesPreset('hubspot');
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).not.toContain('instance_url');
    });

    it('should have different defaults for Salesforce vs HubSpot', () => {
      const salesforcePreset = createCRMNotesPreset('salesforce');
      const hubspotPreset = createCRMNotesPreset('hubspot');

      const sfDefaults = salesforcePreset.optional_inputs.find((i) => i.key === 'object_types')?.default;
      const hsDefaults = hubspotPreset.optional_inputs.find((i) => i.key === 'object_types')?.default;

      expect(sfDefaults).toContain('Account');
      expect(hsDefaults).toContain('companies');
    });
  });

  describe('createSalesCallPreset', () => {
    it('should create a valid Sales Call preset', () => {
      const preset = createSalesCallPreset();
      expect(SourcePresetSchema.parse(preset)).toBeDefined();
    });

    it('should have correct channel_authority for Sales Calls', () => {
      const preset = createSalesCallPreset();
      expect(preset.channel_authority).toBe(0.65);
    });

    it('should have push adapter type', () => {
      const preset = createSalesCallPreset();
      expect(preset.adapter_type).toBe('push');
    });

    it('should require webhook_endpoint and api_key', () => {
      const preset = createSalesCallPreset();
      const requiredKeys = preset.required_inputs.map((i) => i.key);
      expect(requiredKeys).toContain('webhook_endpoint');
      expect(requiredKeys).toContain('api_key');
    });

    it('should include speaker-aware chunking options', () => {
      const preset = createSalesCallPreset();
      const optionalKeys = preset.optional_inputs.map((i) => i.key);
      expect(optionalKeys).toContain('chunk_strategy');
      expect(optionalKeys).toContain('speaker_role_mapping');
    });

    it('should have speaker-aware as default chunk strategy', () => {
      const preset = createSalesCallPreset();
      const chunkStrategy = preset.optional_inputs.find((i) => i.key === 'chunk_strategy');
      expect(chunkStrategy?.default).toBe('speaker-aware');
    });
  });

  describe('Tier 3 Authority Range', () => {
    it('all presets should have channel_authority between 0.5 and 0.65', () => {
      const presets = [
        createSlackPreset(),
        createDiscordPreset(),
        createTeamsPreset(),
        createCRMNotesPreset(),
        createSalesCallPreset(),
      ];

      presets.forEach((preset) => {
        expect(preset.channel_authority).toBeGreaterThanOrEqual(0.5);
        expect(preset.channel_authority).toBeLessThanOrEqual(0.65);
      });
    });
  });

  describe('Preset Schema Validation', () => {
    it('all presets should have valid InputField definitions', () => {
      const presets = [
        createSlackPreset(),
        createDiscordPreset(),
        createTeamsPreset(),
        createCRMNotesPreset(),
        createSalesCallPreset(),
      ];

      presets.forEach((preset) => {
        // All inputs should have required keys
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

/**
 * Zod schemas for Cultivate API request/response validation
 */
import { z } from 'zod';
import { AdapterTypeSchema } from './domain/types';

/**
 * Nugget metadata - Normalized quality metrics (all 0-1 scale)
 */
const NuggetMetadataSchema = z.object({
  abstraction_level: z.number().min(0).max(1).describe('Score 0-1 indicating abstraction level (concrete vs abstract)'),
  specificity: z.number().min(0).max(1).describe('Score 0-1 indicating how specific the nugget is'),
  emotional_intensity: z.number().min(0).max(1).describe('Score 0-1 indicating emotional charge or intensity'),
  actionability: z.number().min(0).max(1).describe('Score 0-1 indicating how actionable the nugget is'),
});

/**
 * Nugget - Refined insight crystallized from ideation sessions
 * Represents a single refined idea or requirement extracted from session discussions
 */
export const NuggetSchema = z.object({
  id: z.string().uuid().describe('Unique identifier for the nugget'),
  session_id: z.string().uuid().describe('Foreign key reference to the ideation session this nugget came from'),
  created_at: z.string().datetime().describe('ISO 8601 timestamp when nugget was created'),
  content: z.string().min(1).describe('The actual nugget content - refined insight or requirement'),
  metadata: NuggetMetadataSchema.describe('Quality metrics for the nugget'),
});

/**
 * TypeScript type inferred from NuggetSchema
 * Use this for type annotations in functions and data structures
 */
export type Nugget = z.infer<typeof NuggetSchema>;

/**
 * Extraction result containing analyzed signal data
 * Produced by extraction jobs and used for clustering and analysis
 */
export const ExtractionResultSchema = z.object({
  summary: z.string().describe('Brief summary of the extracted content'),
  keywords: z.array(z.string()).describe('List of key terms and phrases extracted from content'),
  entities: z.array(
    z.object({
      name: z.string().describe('Entity name or value'),
      type: z.string().describe('Entity type classification (e.g., PERSON, ORGANIZATION, LOCATION)'),
    })
  ).describe('Named entities found in content with their types'),
  aspects: z.array(z.string()).describe('Key aspects, themes, or dimensions discussed'),
  quotes: z.array(z.string()).describe('Notable direct quotes from the source'),
  reasoning: z.string().describe('AI reasoning explaining the extraction choices and key findings'),
  specificity: z.number().min(0).max(1).describe('Score 0-1 indicating how specific/general the content is'),
  emotional_intensity: z.number().min(0).max(1).describe('Score 0-1 indicating emotional charge or intensity'),
  actionability: z.number().min(0).max(1).describe('Score 0-1 indicating how actionable the signal is'),
});

/**
 * TypeScript type inferred from ExtractionResultSchema
 * Use this for type annotations in functions and data structures
 */
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Input field definition for adapter configuration
 * Represents a required or optional input parameter for a source adapter
 */
export const InputFieldSchema = z.object({
  key: z.string().describe('Unique identifier for the input field'),
  label: z.string().describe('Human-readable label for the input field'),
  type: z.string().describe('Data type of the input (e.g., string, number, url, password)'),
  description: z.string().describe('Detailed description of what this input is used for'),
  default: z.unknown().optional().describe('Optional default value for this input'),
});

/**
 * TypeScript type inferred from InputFieldSchema
 * Use this for type annotations in functions and data structures
 */
export type InputField = z.infer<typeof InputFieldSchema>;

/**
 * Source preset configuration template for adapter integration
 * Defines the structure and requirements for a reusable source adapter configuration
 */
export const SourcePresetSchema = z.object({
  name: z.string().describe('Human-readable name of the preset'),
  adapter_type: AdapterTypeSchema.describe('Type of adapter this preset is for'),
  description: z.string().describe('Detailed description of the preset and its purpose'),
  required_inputs: z.array(InputFieldSchema).describe('Array of required input fields for configuring this adapter'),
  optional_inputs: z.array(InputFieldSchema).describe('Array of optional input fields with sensible defaults'),
  defaults: z.record(z.unknown()).describe('Pre-configured default values for adapter settings'),
  channel_authority: z.number().min(0).max(1).describe('Source tier weight (0-1) representing channel authority/credibility'),
});

/**
 * TypeScript type inferred from SourcePresetSchema
 * Use this for type annotations in functions and data structures
 */
export type SourcePreset = z.infer<typeof SourcePresetSchema>;

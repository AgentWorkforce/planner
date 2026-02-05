import { z } from 'zod';

// ============================================
// Contract Input Type
// ============================================

/**
 * Types of inputs a step can consume.
 */
export const ContractInputType = {
  /** Output from another step (file, artifact, etc.) */
  Artifact: 'artifact',
  /** Contextual information from plan or previous steps */
  Context: 'context',
  /** Configuration parameter */
  Parameter: 'parameter',
} as const;

export type ContractInputType = (typeof ContractInputType)[keyof typeof ContractInputType];

export const ContractInputTypeSchema = z.enum(['artifact', 'context', 'parameter']);

// ============================================
// Contract Output Type
// ============================================

/**
 * Types of outputs a step can produce.
 */
export const ContractOutputType = {
  /** Single file output */
  File: 'file',
  /** Directory output */
  Directory: 'directory',
  /** Schema definition (API, database, etc.) */
  Schema: 'schema',
  /** Configuration output */
  Config: 'config',
} as const;

export type ContractOutputType = (typeof ContractOutputType)[keyof typeof ContractOutputType];

export const ContractOutputTypeSchema = z.enum(['file', 'directory', 'schema', 'config']);

// ============================================
// Output Validation Type
// ============================================

/**
 * How to validate a contract output.
 */
export const OutputValidation = {
  /** Check if the output exists */
  Exists: 'exists',
  /** Validate against a JSON schema */
  Schema: 'schema',
  /** Run automated tests */
  Test: 'test',
  /** Requires human review */
  Human: 'human',
} as const;

export type OutputValidation = (typeof OutputValidation)[keyof typeof OutputValidation];

export const OutputValidationSchema = z.enum(['exists', 'schema', 'test', 'human']);

// ============================================
// Contract Input
// ============================================

/**
 * Defines an input requirement for a step.
 */
export const ContractInputSchema = z.object({
  /** Name of the input (for reference) */
  name: z.string().min(1),
  /** Type of input */
  type: ContractInputTypeSchema,
  /** Source: step_id that produces this, or 'plan' for plan-level context */
  source: z.string().min(1),
  /** Whether this input is required */
  required: z.boolean(),
  /** Human-readable description of the input */
  description: z.string().optional(),
});

export type ContractInput = z.infer<typeof ContractInputSchema>;

// ============================================
// Contract Output
// ============================================

/**
 * Defines an output produced by a step.
 */
export const ContractOutputSchema = z.object({
  /** Name of the output (for reference) */
  name: z.string().min(1),
  /** Type of output */
  type: ContractOutputTypeSchema,
  /** Path where output will be created (optional) */
  path: z.string().optional(),
  /** How to validate this output */
  validation: OutputValidationSchema,
  /** Reference to validation schema if validation='schema' */
  schema_ref: z.string().optional(),
});

export type ContractOutput = z.infer<typeof ContractOutputSchema>;

// ============================================
// Done Definition
// ============================================

/**
 * Defines when a step is considered complete.
 */
export const DoneDefinitionSchema = z.object({
  /** All declared outputs must be present */
  all_outputs_present: z.boolean(),
  /** All acceptance criteria must pass */
  acceptance_criteria_pass: z.boolean(),
  /** Custom check command or condition (optional) */
  custom_check: z.string().optional(),
});

export type DoneDefinition = z.infer<typeof DoneDefinitionSchema>;

// ============================================
// Task Contract
// ============================================

/**
 * Full contract for a step defining inputs, outputs, and completion criteria.
 * Enables contract-based dependency resolution in Forge.
 */
export const TaskContractSchema = z.object({
  /** Inputs required by this step */
  inputs: z.array(ContractInputSchema),
  /** Outputs produced by this step */
  outputs: z.array(ContractOutputSchema),
  /** Definition of when the step is done */
  done_definition: DoneDefinitionSchema,
});

export type TaskContract = z.infer<typeof TaskContractSchema>;

// ============================================
// Factory Functions
// ============================================

/**
 * Creates a contract input.
 */
export function createContractInput(options: {
  name: string;
  type: ContractInputType;
  source: string;
  required?: boolean;
  description?: string;
}): ContractInput {
  return ContractInputSchema.parse({
    name: options.name,
    type: options.type,
    source: options.source,
    required: options.required ?? true,
    description: options.description,
  });
}

/**
 * Creates a contract output.
 */
export function createContractOutput(options: {
  name: string;
  type: ContractOutputType;
  path?: string;
  validation: OutputValidation;
  schemaRef?: string;
}): ContractOutput {
  return ContractOutputSchema.parse({
    name: options.name,
    type: options.type,
    path: options.path,
    validation: options.validation,
    schema_ref: options.schemaRef,
  });
}

/**
 * Creates a done definition.
 */
export function createDoneDefinition(options?: {
  allOutputsPresent?: boolean;
  acceptanceCriteriaPass?: boolean;
  customCheck?: string;
}): DoneDefinition {
  return DoneDefinitionSchema.parse({
    all_outputs_present: options?.allOutputsPresent ?? true,
    acceptance_criteria_pass: options?.acceptanceCriteriaPass ?? true,
    custom_check: options?.customCheck,
  });
}

/**
 * Creates a task contract.
 */
export function createTaskContract(options: {
  inputs?: ContractInput[];
  outputs?: ContractOutput[];
  doneDefinition?: DoneDefinition;
}): TaskContract {
  return TaskContractSchema.parse({
    inputs: options.inputs ?? [],
    outputs: options.outputs ?? [],
    done_definition: options.doneDefinition ?? createDoneDefinition(),
  });
}

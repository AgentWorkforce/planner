import { z } from 'zod';
import * as fs from 'node:fs';
import * as yaml from 'js-yaml';

/**
 * Model types for DOT Framework model routing.
 * Research basis: SWE-bench - Opus 80.9%, Sonnet 64.8%, Haiku 60.6%
 */
export const ModelType = {
  Haiku: 'haiku',
  Sonnet: 'sonnet',
  Opus: 'opus',
} as const;

export type ModelType = (typeof ModelType)[keyof typeof ModelType];

export const ModelTypeSchema = z.enum(['haiku', 'sonnet', 'opus']);

/**
 * CLI configuration for a role.
 * Maps an owner_role to the CLI command, optional timeout, and audit flag.
 */
export const CliConfigSchema = z.object({
  /** The CLI command to use (e.g., "claude", "aider") */
  cli: z.string().min(1),
  /** Optional timeout in seconds for task execution */
  timeout: z.number().int().positive().optional(),
  /** Whether to run an audit step after task completion */
  audit: z.boolean().optional(),
  /** Model to use (haiku, sonnet, opus) - DOT Framework */
  model: ModelTypeSchema.optional(),
});

export type CliConfig = z.infer<typeof CliConfigSchema>;

/**
 * Model routing rule for complexity-based model selection.
 * DOT Framework: Maps task conditions to appropriate models.
 */
export const ModelRoutingRuleSchema = z.object({
  /** Condition to match (complexity level or keyword) */
  condition: z.enum(['trivial', 'simple', 'moderate', 'complex', 'architecture', 'default']),
  /** Model to use when condition matches */
  model: ModelTypeSchema,
  /** Optional complexity score threshold (0-1) */
  complexity_threshold: z.number().min(0).max(1).optional(),
});

export type ModelRoutingRule = z.infer<typeof ModelRoutingRuleSchema>;

/**
 * Default model routing rules based on research.
 * Research basis: SWE-bench - Haiku 3.7x cost efficient for simple tasks
 */
export const DEFAULT_MODEL_ROUTING_RULES: ModelRoutingRule[] = [
  { condition: 'trivial', model: 'haiku' },
  { condition: 'simple', model: 'haiku', complexity_threshold: 0.3 },
  { condition: 'moderate', model: 'sonnet', complexity_threshold: 0.5 },
  { condition: 'complex', model: 'sonnet', complexity_threshold: 0.7 },
  { condition: 'architecture', model: 'opus' },
  { condition: 'default', model: 'sonnet' },
];

/**
 * Repository configuration for a scope.
 * Maps a scope name to the repository URL and optional base branch.
 */
export const RepoConfigSchema = z.object({
  /** The repository URL for this scope */
  repo_url: z.string().min(1),
  /** The base branch to use (defaults to main/master) */
  base_branch: z.string().optional(),
});

export type RepoConfig = z.infer<typeof RepoConfigSchema>;

/**
 * Planner API configuration for connecting to the Planner service.
 */
export const PlannerConfigSchema = z.object({
  /** Base URL for the Planner API */
  base_url: z.string().url(),
  /** Optional API key for authentication */
  api_key: z.string().optional(),
  /** Request timeout in milliseconds */
  timeout_ms: z.number().int().positive().optional().default(30000),
});

export type PlannerConfig = z.infer<typeof PlannerConfigSchema>;

/**
 * ForgeConfig is the main configuration schema for Forge.
 * It maps roles to CLI commands and scopes to repositories.
 */
export const ForgeConfigSchema = z.object({
  /**
   * Maps owner_role values from plan steps to CLI configurations.
   * Key: role name (e.g., "backend:Coder", "frontend:Designer")
   * Value: CLI configuration
   */
  role_cli_mapping: z.record(z.string(), CliConfigSchema),

  /**
   * Maps scope values from plan steps to repository configurations.
   * Key: scope name (e.g., "api-service", "web-frontend")
   * Value: Repository configuration
   */
  scope_repo_mapping: z.record(z.string(), RepoConfigSchema),

  /**
   * Default CLI configuration when no role mapping is found.
   */
  default_cli: CliConfigSchema.optional(),

  /**
   * Default repository configuration when no scope mapping is found.
   */
  default_repo: RepoConfigSchema.optional(),

  /**
   * Planner API configuration for fetching plans and reporting status.
   */
  planner: PlannerConfigSchema.optional(),
});

export type ForgeConfig = z.infer<typeof ForgeConfigSchema>;

/**
 * Configuration load error with context about what went wrong.
 */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly cause?: Error
  ) {
    super(`Failed to load config from ${path}: ${message}`);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Loads Forge configuration from a YAML or JSON file.
 *
 * @param configPath - Path to the configuration file (YAML or JSON)
 * @returns Validated ForgeConfig object
 * @throws ConfigLoadError if file cannot be read or parsed
 * @throws z.ZodError if configuration fails validation
 */
export function loadForgeConfig(configPath: string): ForgeConfig {
  // Check if file exists
  if (!fs.existsSync(configPath)) {
    throw new ConfigLoadError('File not found', configPath);
  }

  // Read file contents
  let content: string;
  try {
    content = fs.readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new ConfigLoadError(
      'Failed to read file',
      configPath,
      err instanceof Error ? err : new Error(String(err))
    );
  }

  // Determine file type and parse
  const isYaml = configPath.endsWith('.yaml') || configPath.endsWith('.yml');
  const isJson = configPath.endsWith('.json');

  let parsed: unknown;
  try {
    if (isYaml) {
      parsed = yaml.load(content);
    } else if (isJson) {
      parsed = JSON.parse(content);
    } else {
      // Try YAML first (it's a superset of JSON)
      try {
        parsed = yaml.load(content);
      } catch {
        parsed = JSON.parse(content);
      }
    }
  } catch (err) {
    throw new ConfigLoadError(
      `Failed to parse as ${isYaml ? 'YAML' : isJson ? 'JSON' : 'YAML/JSON'}`,
      configPath,
      err instanceof Error ? err : new Error(String(err))
    );
  }

  // Validate against schema
  return ForgeConfigSchema.parse(parsed);
}

/**
 * Resolves CLI configuration for a given role.
 *
 * @param config - Forge configuration
 * @param role - The owner_role from a plan step (e.g., "backend:Coder")
 * @returns CLI configuration or undefined if not found
 */
export function resolveCliConfig(
  config: ForgeConfig,
  role: string | undefined
): CliConfig | undefined {
  if (role && config.role_cli_mapping[role]) {
    return config.role_cli_mapping[role];
  }
  return config.default_cli;
}

/**
 * Resolves repository configuration for a given scope.
 *
 * @param config - Forge configuration
 * @param scope - The scope from a plan step (e.g., "api-service")
 * @returns Repository configuration or undefined if not found
 */
export function resolveRepoConfig(
  config: ForgeConfig,
  scope: string | undefined
): RepoConfig | undefined {
  if (scope && config.scope_repo_mapping[scope]) {
    return config.scope_repo_mapping[scope];
  }
  return config.default_repo;
}

/**
 * Creates a minimal default configuration for testing or fallback.
 */
export function createDefaultConfig(): ForgeConfig {
  return {
    role_cli_mapping: {},
    scope_repo_mapping: {},
    default_cli: {
      cli: 'claude',
      timeout: 300,
      audit: true,
    },
  };
}

// ============================================
// Guardian Configuration
// ============================================

/**
 * Guardian types that can observe and intervene during task execution.
 */
export const GuardianType = {
  Security: 'Security',
  Architect: 'Architect',
  QA: 'QA',
  Compliance: 'Compliance',
} as const;

export type GuardianType = (typeof GuardianType)[keyof typeof GuardianType];

/**
 * Trigger events that guardians can respond to.
 */
export const SpeakOnTrigger = {
  // Security triggers
  SecurityConcern: 'security_concern',
  CredentialExposure: 'credential_exposure',
  InjectionRisk: 'injection_risk',
  AuthIssue: 'auth_issue',
  SensitiveDataExposure: 'sensitive_data_exposure',

  // Architecture triggers
  BoundaryViolation: 'boundary_violation',
  PatternInconsistency: 'pattern_inconsistency',
  DependencyViolation: 'dependency_violation',
  ApiContractChange: 'api_contract_change',

  // QA triggers
  TestCoverageDrop: 'test_coverage_drop',
  QualityRegression: 'quality_regression',
  MissingTests: 'missing_tests',
  PerformanceRegression: 'performance_regression',

  // Compliance triggers
  LicenseViolation: 'license_violation',
  PolicyViolation: 'policy_violation',
  DataRetentionIssue: 'data_retention_issue',
} as const;

export type SpeakOnTrigger = (typeof SpeakOnTrigger)[keyof typeof SpeakOnTrigger];

/**
 * Schema for guardian configuration.
 */
export const GuardianConfigSchema = z.object({
  /** Type of guardian (Security, Architect, QA, Compliance) */
  type: z.enum(['Security', 'Architect', 'QA', 'Compliance']),

  /** Whether this guardian is enabled */
  enabled: z.boolean().default(true),

  /** List of agent/worker names this guardian should shadow */
  shadow_targets: z.array(z.string()).default([]),

  /** List of triggers this guardian responds to */
  speak_on: z.array(z.string()).default([]),

  /** Optional custom prompt template for the guardian */
  prompt_template: z.string().optional(),

  /** Optional description of this guardian's focus */
  description: z.string().optional(),
});

export type GuardianConfig = z.infer<typeof GuardianConfigSchema>;

/**
 * Extended ForgeConfig schema with guardian support.
 */
export const ForgeConfigWithGuardiansSchema = ForgeConfigSchema.extend({
  /**
   * Guardian configurations for observing worker activity.
   * Key: guardian identifier (e.g., "security-1", "architect-main")
   * Value: Guardian configuration
   */
  guardians: z.record(z.string(), GuardianConfigSchema).optional(),
});

export type ForgeConfigWithGuardians = z.infer<typeof ForgeConfigWithGuardiansSchema>;

/**
 * Loads Forge configuration with guardian support from a YAML or JSON file.
 *
 * @param configPath - Path to the configuration file (YAML or JSON)
 * @returns Validated ForgeConfigWithGuardians object
 * @throws ConfigLoadError if file cannot be read or parsed
 * @throws z.ZodError if configuration fails validation
 */
export function loadForgeConfigWithGuardians(configPath: string): ForgeConfigWithGuardians {
  // Check if file exists
  if (!fs.existsSync(configPath)) {
    throw new ConfigLoadError('File not found', configPath);
  }

  // Read file contents
  let content: string;
  try {
    content = fs.readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new ConfigLoadError(
      'Failed to read file',
      configPath,
      err instanceof Error ? err : new Error(String(err))
    );
  }

  // Determine file type and parse
  const isYaml = configPath.endsWith('.yaml') || configPath.endsWith('.yml');
  const isJson = configPath.endsWith('.json');

  let parsed: unknown;
  try {
    if (isYaml) {
      parsed = yaml.load(content);
    } else if (isJson) {
      parsed = JSON.parse(content);
    } else {
      // Try YAML first (it's a superset of JSON)
      try {
        parsed = yaml.load(content);
      } catch {
        parsed = JSON.parse(content);
      }
    }
  } catch (err) {
    throw new ConfigLoadError(
      `Failed to parse as ${isYaml ? 'YAML' : isJson ? 'JSON' : 'YAML/JSON'}`,
      configPath,
      err instanceof Error ? err : new Error(String(err))
    );
  }

  // Validate against schema
  return ForgeConfigWithGuardiansSchema.parse(parsed);
}

/**
 * Gets guardians of a specific type from the configuration.
 *
 * @param config - Forge configuration with guardians
 * @param type - Guardian type to filter by
 * @returns Array of [guardianId, config] tuples for the specified type
 */
export function getGuardiansByType(
  config: ForgeConfigWithGuardians,
  type: GuardianType
): Array<[string, GuardianConfig]> {
  if (!config.guardians) {
    return [];
  }

  return Object.entries(config.guardians).filter(
    ([, guardianConfig]) => guardianConfig.type === type && guardianConfig.enabled
  );
}

/**
 * Gets all enabled guardians from the configuration.
 *
 * @param config - Forge configuration with guardians
 * @returns Array of [guardianId, config] tuples
 */
export function getEnabledGuardians(
  config: ForgeConfigWithGuardians
): Array<[string, GuardianConfig]> {
  if (!config.guardians) {
    return [];
  }

  return Object.entries(config.guardians).filter(
    ([, guardianConfig]) => guardianConfig.enabled
  );
}

/**
 * Default speak_on triggers for each guardian type.
 */
export const DEFAULT_GUARDIAN_TRIGGERS: Record<GuardianType, SpeakOnTrigger[]> = {
  [GuardianType.Security]: [
    SpeakOnTrigger.SecurityConcern,
    SpeakOnTrigger.CredentialExposure,
    SpeakOnTrigger.InjectionRisk,
    SpeakOnTrigger.AuthIssue,
    SpeakOnTrigger.SensitiveDataExposure,
  ],
  [GuardianType.Architect]: [
    SpeakOnTrigger.BoundaryViolation,
    SpeakOnTrigger.PatternInconsistency,
    SpeakOnTrigger.DependencyViolation,
    SpeakOnTrigger.ApiContractChange,
  ],
  [GuardianType.QA]: [
    SpeakOnTrigger.TestCoverageDrop,
    SpeakOnTrigger.QualityRegression,
    SpeakOnTrigger.MissingTests,
    SpeakOnTrigger.PerformanceRegression,
  ],
  [GuardianType.Compliance]: [
    SpeakOnTrigger.LicenseViolation,
    SpeakOnTrigger.PolicyViolation,
    SpeakOnTrigger.DataRetentionIssue,
  ],
};

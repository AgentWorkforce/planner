/**
 * CultivateStorage interface
 * Defines storage contract for all Cultivate entities
 */

import type {
  Signal,
  SignalStatus,
  Greenhouse,
  Cluster,
  SourceConfig,
  FilterRule,
  IngestionJob,
  CultivateConfig,
  SourceHealth,
  AdapterType,
  ExtractionResult,
} from '../domain/types';

/**
 * Query filters for signal listing with pagination
 */
export interface SignalQueryFilters {
  /** Filter by greenhouse ID */
  greenhouse_id?: string;
  /** Filter by signal status */
  status?: SignalStatus;
  /** Filter by cluster ID */
  cluster_id?: string;
  /** Maximum number of results to return */
  limit: number;
  /** Number of results to skip */
  offset: number;
}

/**
 * Input for creating a new signal
 */
export interface CreateSignalInput {
  greenhouse_id: string;
  source_type: AdapterType;
  external_id: string;
  title: string;
  body: string;
  author: string;
  author_type: 'user' | 'team' | 'bot' | 'system' | 'unknown';
  url?: string;
  score: number;
  scoring_factors: Record<string, number>;
  status: SignalStatus;
  tags?: string[];
}

/**
 * Input for updating a signal
 */
export interface UpdateSignalInput {
  score?: number;
  scoring_factors?: Record<string, number>;
  cluster_id?: string;
  status?: SignalStatus;
  tags?: string[];
  linked_plan_id?: string;
  provenance?: Array<{
    step: string;
    timestamp: string;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Input for creating a greenhouse
 */
export interface CreateGreenhouseInput {
  name: string;
  description?: string;
  mode: 'discovery' | 'refinement' | 'focused';
  keyword_require: string[];
  keyword_exclude: string[];
  source_ids: string[];
}

/**
 * Input for updating a greenhouse
 */
export interface UpdateGreenhouseInput {
  name?: string;
  description?: string;
  mode?: 'discovery' | 'refinement' | 'focused';
  keyword_require?: string[];
  keyword_exclude?: string[];
  source_ids?: string[];
}

/**
 * Input for creating a cluster
 */
export interface CreateClusterInput {
  greenhouse_id: string;
  label: string;
  summary: string;
  signal_count?: number;
  trend: 'rising' | 'stable' | 'declining';
  velocity_weekly?: number;
  velocity_monthly?: number;
}

/**
 * Input for updating a cluster
 */
export interface UpdateClusterInput {
  label?: string;
  summary?: string;
  signal_count?: number;
  trend?: 'rising' | 'stable' | 'declining';
  velocity_weekly?: number;
  velocity_monthly?: number;
}

/**
 * Input for creating a source configuration
 */
export interface CreateSourceConfigInput {
  name: string;
  adapter_type: AdapterType;
  preset?: string;
  endpoint_template?: string;
  auth?: {
    type: 'bearer' | 'api_key' | 'oauth2' | 'basic' | 'hmac';
    encrypted_credentials: string;
  };
  poll_interval_ms: number;
  greenhouse_ids: string[];
  enabled?: boolean;
}

/**
 * Input for updating a source configuration
 */
export interface UpdateSourceConfigInput {
  name?: string;
  adapter_type?: AdapterType;
  preset?: string;
  endpoint_template?: string;
  auth?: {
    type: 'bearer' | 'api_key' | 'oauth2' | 'basic' | 'hmac';
    encrypted_credentials: string;
  };
  poll_interval_ms?: number;
  greenhouse_ids?: string[];
  enabled?: boolean;
}

/**
 * Input for updating source health
 */
export interface UpdateSourceHealthInput {
  health: SourceHealth;
  consecutive_failures?: number;
  last_error?: string;
}

/**
 * Input for creating a filter rule
 */
export interface CreateFilterRuleInput {
  name: string;
  description: string;
  type: 'reject' | 'boost';
  condition: string;
  enabled?: boolean;
}

/**
 * Input for updating a filter rule
 */
export interface UpdateFilterRuleInput {
  name?: string;
  description?: string;
  type?: 'reject' | 'boost';
  condition?: string;
  enabled?: boolean;
}

/**
 * Input for updating filter rule effectiveness
 */
export interface UpdateFilterEffectivenessInput {
  signals_matched: number;
  false_positive_rate: number;
}

/**
 * Input for creating an ingestion job
 */
export interface CreateIngestionJobInput {
  filename: string;
  greenhouse_id: string;
  total_chunks: number;
}

/**
 * Input for updating an ingestion job
 */
export interface UpdateIngestionJobInput {
  status?: 'pending' | 'chunking' | 'processing' | 'complete' | 'failed';
  processed_chunks?: number;
}

/**
 * CultivateStorage interface defining all storage operations
 */
export interface CultivateStorage {
  // ========== Signal Operations ==========

  /**
   * Create a new signal
   */
  createSignal(input: CreateSignalInput): Promise<Signal>;

  /**
   * Get a signal by ID
   */
  getSignalById(id: string): Promise<Signal | null>;

  /**
   * Get a signal by external ID for deduplication
   * @param source_type - The source adapter type
   * @param external_id - The external identifier from the source
   * @returns The signal if found, null otherwise
   */
  getSignalByExternalId(source_type: AdapterType, external_id: string): Promise<Signal | null>;

  /**
   * Check for an exact duplicate signal
   * Used to reject already-processed signals before the pipeline
   * @param source_type - The source adapter type
   * @param external_id - The external identifier from the source
   * @returns The existing signal ID if duplicate found, null otherwise
   */
  checkExactDuplicate(source_type: AdapterType, external_id: string): Promise<string | null>;

  /**
   * Update a signal
   */
  updateSignal(id: string, input: UpdateSignalInput): Promise<Signal>;

  /**
   * List signals with filters and pagination
   */
  listSignals(filters: SignalQueryFilters): Promise<Signal[]>;

  /**
   * Count signals by status
   */
  countSignalsByStatus(status: SignalStatus): Promise<number>;

  // ========== Greenhouse Operations ==========

  /**
   * Create a new greenhouse
   */
  createGreenhouse(input: CreateGreenhouseInput): Promise<Greenhouse>;

  /**
   * Get a greenhouse by ID
   */
  getGreenhouseById(id: string): Promise<Greenhouse | null>;

  /**
   * Update a greenhouse
   */
  updateGreenhouse(id: string, input: UpdateGreenhouseInput): Promise<Greenhouse>;

  /**
   * Delete a greenhouse
   */
  deleteGreenhouse(id: string): Promise<void>;

  /**
   * List all greenhouses
   */
  listGreenhouses(): Promise<Greenhouse[]>;

  // ========== Cluster Operations ==========

  /**
   * Create a new cluster
   */
  createCluster(input: CreateClusterInput): Promise<Cluster>;

  /**
   * Get a cluster by ID
   */
  getClusterById(id: string): Promise<Cluster | null>;

  /**
   * Get a cluster by label within a greenhouse
   */
  getClusterByLabel(greenhouse_id: string, label: string): Promise<Cluster | null>;

  /**
   * Update a cluster
   */
  updateCluster(id: string, input: UpdateClusterInput): Promise<Cluster>;

  /**
   * Delete a cluster
   */
  deleteCluster(id: string): Promise<void>;

  /**
   * List clusters for a greenhouse
   */
  listClustersByGreenhouse(greenhouse_id: string): Promise<Cluster[]>;

  // ========== Source Config Operations ==========

  /**
   * Create a new source configuration
   */
  createSourceConfig(input: CreateSourceConfigInput): Promise<SourceConfig>;

  /**
   * Get a source configuration by ID
   */
  getSourceConfigById(id: string): Promise<SourceConfig | null>;

  /**
   * Update a source configuration
   */
  updateSourceConfig(id: string, input: UpdateSourceConfigInput): Promise<SourceConfig>;

  /**
   * Update source health status
   */
  updateSourceHealth(id: string, input: UpdateSourceHealthInput): Promise<SourceConfig>;

  /**
   * Delete a source configuration
   */
  deleteSourceConfig(id: string): Promise<void>;

  /**
   * List all source configurations
   * @param enabled - Optional filter by enabled status
   */
  listSourceConfigs(enabled?: boolean): Promise<SourceConfig[]>;

  // ========== Filter Rule Operations ==========

  /**
   * Create a new filter rule
   */
  createFilterRule(input: CreateFilterRuleInput): Promise<FilterRule>;

  /**
   * Get a filter rule by ID
   */
  getFilterRuleById(id: string): Promise<FilterRule | null>;

  /**
   * Update a filter rule
   */
  updateFilterRule(id: string, input: UpdateFilterRuleInput): Promise<FilterRule>;

  /**
   * Update filter rule effectiveness metrics
   */
  updateFilterEffectiveness(id: string, input: UpdateFilterEffectivenessInput): Promise<FilterRule>;

  /**
   * Delete a filter rule
   */
  deleteFilterRule(id: string): Promise<void>;

  /**
   * List all filter rules
   * @param enabled - Optional filter by enabled status
   */
  listFilterRules(enabled?: boolean): Promise<FilterRule[]>;

  // ========== Ingestion Job Operations ==========

  /**
   * Create a new ingestion job
   */
  createIngestionJob(input: CreateIngestionJobInput): Promise<IngestionJob>;

  /**
   * Get an ingestion job by ID
   */
  getIngestionJobById(id: string): Promise<IngestionJob | null>;

  /**
   * Update an ingestion job
   */
  updateIngestionJob(id: string, input: UpdateIngestionJobInput): Promise<IngestionJob>;

  /**
   * List ingestion jobs
   * @param status - Optional filter by job status
   */
  listIngestionJobs(status?: 'pending' | 'chunking' | 'processing' | 'complete' | 'failed'): Promise<IngestionJob[]>;

  // ========== Config Operations ==========

  /**
   * Get the Cultivate configuration
   */
  getConfig(): Promise<CultivateConfig | null>;

  /**
   * Set the Cultivate configuration
   */
  setConfig(config: CultivateConfig): Promise<CultivateConfig>;

  // ========== Extraction Operations ==========

  /**
   * Store extraction results for a signal
   * @param signal_id - Signal ID the extraction belongs to
   * @param extraction - Extraction result from AI analysis
   * @returns Stored extraction data
   */
  storeExtraction(signal_id: string, extraction: ExtractionResult): Promise<ExtractionResult>;

  /**
   * Get extraction results for a signal
   * @param signal_id - Signal ID to retrieve extraction for
   * @returns Extraction result if found, null otherwise
   */
  getExtractionBySignalId(signal_id: string): Promise<ExtractionResult | null>;
}

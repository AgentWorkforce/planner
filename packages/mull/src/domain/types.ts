import { z } from 'zod';

// ---------------------------------------------------------------------------
// SessionRef — discriminated union identifying a session source
// ---------------------------------------------------------------------------

export const SessionRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('plan_id'), id: z.string() }),
  z.object({ type: z.literal('run_id'), id: z.string() }),
  z.object({ type: z.literal('channel'), id: z.string() }),
]);

export type SessionRef = z.infer<typeof SessionRefSchema>;

// ---------------------------------------------------------------------------
// Session data loaded from an adapter
// ---------------------------------------------------------------------------

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface SessionData {
  ref: SessionRef;
  messages: SessionMessage[];
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// MullConfig — resolved configuration for the pipeline
// ---------------------------------------------------------------------------

export const AdapterConfigSchema = z.object({
  type: z.string(),
  dir: z.string().optional(),
}).passthrough();

export type AdapterConfig = z.infer<typeof AdapterConfigSchema>;

export const MullConfigSchema = z.object({
  memoryDir: z.string().default('./memory'),
  mullDir: z.string().default('.mull'),
  adapters: z.array(AdapterConfigSchema).default([{ type: 'trajectory', dir: '.trajectories/' }]),
});

export type MullConfig = z.infer<typeof MullConfigSchema>;

// ---------------------------------------------------------------------------
// Progress callback types
// ---------------------------------------------------------------------------

export type ProgressStage =
  | 'loading'
  | 'extracting'
  | 'synthesizing'
  | 'merging'
  | 'done';

export interface ProgressUpdate {
  stage: ProgressStage;
  sessionId: string;
  counts?: {
    messages?: number;
    entities?: number;
    facts?: number;
    nuggets?: number;
    topicsCreated?: number;
    topicsUpdated?: number;
  };
}

export type ProgressCallback = (update: ProgressUpdate) => void;

// ---------------------------------------------------------------------------
// MullOptions — runtime options passed to mull()
// ---------------------------------------------------------------------------

export interface MullOptions {
  /** Partial config overrides merged with resolved config. */
  config?: Partial<MullConfig>;

  /** Pre-built adapter instances. When provided, skip adapter creation from config. */
  adapters?: MullAdapter[];

  /** Run extraction + synthesis but skip writing to disk (merge, TOC, cursor). */
  dryRun?: boolean;

  /** Ignore cursor position, re-process entire session from the start. */
  force?: boolean;

  /** Progress callback for stage-by-stage updates. */
  onProgress?: ProgressCallback;
}

// ---------------------------------------------------------------------------
// Pipeline data structures
// ---------------------------------------------------------------------------

export interface PreExtract {
  sessionRef: SessionRef;
  messages: SessionMessage[];
  existingTopics: string[];
  metadata?: Record<string, unknown>;
}

export interface Nugget {
  id: string;
  content: string;
  topic: string;
  confidence: number;
  source: {
    sessionRef: SessionRef;
    messageIds: string[];
  };
}

export interface SynthesisResult {
  nuggets: Nugget[];
  errors: PipelineError[];
}

export interface TopicMergeResult {
  topicsUpdated: number;
  topicsCreated: number;
  nuggetsWritten: number;
}

// ---------------------------------------------------------------------------
// MergeResult — topic merge counts
// ---------------------------------------------------------------------------

export interface MergeResult {
  topicsUpdated: number;
  topicsCreated: number;
  nuggetsWritten: number;
  errors: PipelineError[];
}

// ---------------------------------------------------------------------------
// Dry-run details — rich pipeline data returned in dry-run mode
// ---------------------------------------------------------------------------

export interface DryRunEntity {
  text: string;
  type: 'person' | 'tool' | 'concept' | 'file' | 'service' | 'other';
  count: number;
}

export interface DryRunFact {
  slug: string;
  text: string;
  source?: string;
  isPreStructured: boolean;
}

export interface DryRunTopicMatch {
  topicSlug: string;
  score: number;
  isNew: boolean;
  matchedEntities: string[];
}

export interface DryRunNugget {
  id: string;
  content: string;
  topic: string;
  confidence: number;
  category?: string;
}

export interface DryRunDetails {
  entities: DryRunEntity[];
  facts: DryRunFact[];
  topicMatches: DryRunTopicMatch[];
  nuggets: DryRunNugget[];
  messagesProcessed: number;
}

// ---------------------------------------------------------------------------
// MullResult — the final output of mull()
// ---------------------------------------------------------------------------

export interface MullResult extends MergeResult {
  /**
   * True when the LLM synthesizer failed and the pipeline fell back to
   * pre-structured trail decision nuggets only.
   *
   * When `llmFailed` is true, the written nuggets are deterministic
   * shortcut extractions from the session messages — not LLM-synthesized.
   * The pipeline still completes: nuggets are merged, TOC is rebuilt,
   * and the cursor is advanced.
   */
  llmFailed: boolean;

  /** Populated only in dry-run mode with detailed extraction/synthesis data. */
  dryRunDetails?: DryRunDetails;
}

// ---------------------------------------------------------------------------
// MullAllResult — the final output of mullAll()
// ---------------------------------------------------------------------------

export interface SessionProcessingResult {
  ref: SessionRef;
  success: boolean;
  result: MergeResult;
}

export interface MullAllResult extends MergeResult {
  sessions: SessionProcessingResult[];
  sessionsProcessed: number;
  sessionsSkipped: number;
  sessionsFailed: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type PipelineStage = 'load' | 'extract' | 'synthesize' | 'merge' | 'toc' | 'cursor';

export interface PipelineError {
  stage: PipelineStage;
  message: string;
  recoverable: boolean;
}

// ---------------------------------------------------------------------------
// MullAdapter — interface for session data sources
// ---------------------------------------------------------------------------

export interface MullAdapter {
  readonly name: string;

  /** Returns true if this adapter can handle the given session ref type. */
  supports(ref: SessionRef): boolean;

  /** List all available session refs from this adapter's data source. */
  listSessions(): Promise<SessionRef[]>;

  /** Load session messages, optionally filtered to messages after a cursor. */
  loadSession(ref: SessionRef, opts?: { after?: string }): Promise<SessionData>;

  /** Get the current processing cursor for a session (null = never processed). */
  getCursor(ref: SessionRef): Promise<string | null>;

  /** Persist the cursor after successful processing. */
  setCursor(ref: SessionRef, cursor: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// NuggetSynthesizer — pluggable synthesis engine
// ---------------------------------------------------------------------------

export interface NuggetSynthesizer {
  /** Synthesize nuggets from a pre-extract, with partial failure tolerance. */
  synthesize(preExtract: PreExtract, config: MullConfig): Promise<SynthesisResult>;
}

// ---------------------------------------------------------------------------
// TopicStore — pluggable topic file management
// ---------------------------------------------------------------------------

export interface TopicStore {
  /** List existing topic slugs in the memory directory. */
  listTopics(memoryDir: string): Promise<string[]>;

  /** Merge nuggets into topic files. Returns per-file stats. */
  merge(nuggets: Nugget[], memoryDir: string): Promise<TopicMergeResult>;

  /** Rebuild the table of contents index file. */
  rebuildToc(memoryDir: string): Promise<void>;
}

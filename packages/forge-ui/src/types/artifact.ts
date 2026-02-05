/**
 * Artifact types for the Forge orchestration UI
 */

export type ArtifactType = 'commit' | 'pr' | 'file' | 'deployment' | 'test_result';

export type PRStatus = 'open' | 'merged' | 'closed';

export interface ArtifactMetadata {
  status?: PRStatus;
  last_checked?: string;
  [key: string]: unknown;
}

export interface Artifact {
  artifact_id: string;
  run_id?: string;
  task_id: string;
  attempt_id?: string;

  type: ArtifactType;
  reference: string;
  label?: string;

  // Content (legacy support)
  name?: string;
  description?: string;
  content_type?: string;
  size_bytes?: number;
  url?: string;
  inline_content?: string;

  // Metadata
  metadata?: ArtifactMetadata;
  created_at: string;

  // Joined data from task
  task_title?: string;
}

export interface ArtifactSummary {
  artifact_id: string;
  type: ArtifactType;
  reference: string;
  label?: string;
  created_at: string;
}

export interface ArtifactsResponse {
  artifacts: Artifact[];
}

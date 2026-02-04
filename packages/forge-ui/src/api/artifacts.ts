/**
 * Artifacts API for Forge UI
 *
 * Provides functions for fetching and managing artifacts produced during run execution.
 */

import { get, post } from './client';
import type { Artifact, ArtifactsResponse } from '@/types';

/**
 * Get all artifacts for a run
 */
export async function getRunArtifacts(runId: string): Promise<ArtifactsResponse> {
  return get<ArtifactsResponse>(`/runs/${runId}/artifacts`);
}

/**
 * Get artifacts for a specific task
 */
export async function getTaskArtifacts(runId: string, taskId: string): Promise<ArtifactsResponse> {
  return get<ArtifactsResponse>(`/runs/${runId}/tasks/${taskId}/artifacts`);
}

/**
 * Refresh PR status for a specific artifact
 * Returns the updated artifact with fresh status from the PR provider
 */
export async function refreshPRStatus(artifactId: string): Promise<Artifact> {
  return post<Artifact>(`/artifacts/${artifactId}/refresh`);
}

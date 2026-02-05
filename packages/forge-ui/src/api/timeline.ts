/**
 * Timeline API module for Forge UI
 *
 * Provides functions for fetching timeline events for a run.
 */

import { get } from './client';
import type { TimelineResponse, TimelineFilter } from '@/types';

/**
 * Get timeline events for a run
 *
 * @param runId - The run ID to fetch timeline for
 * @param filter - Optional filter by event type
 * @returns Promise with timeline events
 */
export async function getRunTimeline(
  runId: string,
  filter?: TimelineFilter
): Promise<TimelineResponse> {
  const params: Record<string, unknown> = {};

  if (filter?.type) {
    params.type = filter.type;
  }

  return get<TimelineResponse>(`/runs/${runId}/timeline`, params);
}

/**
 * Trajectories API client
 *
 * Functions for recording and querying user trajectory events
 * (decisions, preferences, similar questions).
 */

import type { DecisionEvent, DerivedPreference, EventFilter, SimilarQuestion } from '@/types/trajectory';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** Response type for events list */
export interface EventsResponse {
  events: DecisionEvent[];
}

/** Response type for single event operations */
export interface EventResponse {
  event: DecisionEvent;
}

/** Response type for preferences list */
export interface PreferencesResponse {
  preferences: DerivedPreference[];
}

/** Response type for similar questions search */
export interface SimilarQuestionsResponse {
  matches: SimilarQuestion[];
}

/**
 * Get all decision events for a plan.
 *
 * @param planId - Plan ID to get events for
 * @param filters - Optional filters (agent, date range, limit)
 * @returns List of decision events
 */
export async function getEvents(
  planId: string,
  filters?: EventFilter
): Promise<EventsResponse> {
  const params = new URLSearchParams();
  if (filters?.agent) params.append('agent', filters.agent);
  if (filters?.from_date) params.append('from_date', filters.from_date);
  if (filters?.to_date) params.append('to_date', filters.to_date);
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const queryString = params.toString();
  const url = `${API_BASE}/plans/${planId}/trajectory/events${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      return { events: [] };
    }
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  return response.json();
}

/**
 * Record a new decision event to the user's trajectory.
 *
 * @param planId - Plan ID
 * @param event - Decision event data (without event_id and timestamp)
 * @returns The recorded event
 */
export async function recordDecision(
  planId: string,
  event: Omit<DecisionEvent, 'event_id' | 'timestamp'>
): Promise<EventResponse> {
  const response = await fetch(
    `${API_BASE}/plans/${planId}/trajectory/decision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to record decision: ${response.status}`);
  }

  return response.json();
}

/**
 * Get derived preferences for a plan.
 * Preferences are patterns extracted from trajectory events.
 *
 * @param planId - Plan ID
 * @returns List of derived preferences
 */
export async function getPreferences(planId: string): Promise<PreferencesResponse> {
  const response = await fetch(`${API_BASE}/plans/${planId}/trajectory/preferences`);

  if (!response.ok) {
    if (response.status === 404) {
      return { preferences: [] };
    }
    throw new Error(`Failed to fetch preferences: ${response.status}`);
  }

  return response.json();
}

/**
 * Find similar questions from past trajectory events.
 * Uses embedding similarity to match against question text.
 *
 * @param planId - Plan ID
 * @param text - Question text to search for
 * @param threshold - Similarity threshold (0-1, default 0.7)
 * @returns Matching events with similarity scores
 */
export async function findSimilarQuestions(
  planId: string,
  text: string,
  threshold?: number
): Promise<SimilarQuestionsResponse> {
  const params = new URLSearchParams();
  params.append('text', text);
  if (threshold !== undefined) {
    params.append('threshold', threshold.toString());
  }

  const response = await fetch(
    `${API_BASE}/plans/${planId}/trajectory/similar?${params.toString()}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      return { matches: [] };
    }
    throw new Error(`Failed to find similar questions: ${response.status}`);
  }

  return response.json();
}

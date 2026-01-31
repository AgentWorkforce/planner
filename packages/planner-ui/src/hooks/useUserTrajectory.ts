/**
 * useUserTrajectory Hook
 *
 * Manages user trajectory events and preferences for a plan.
 * Tracks decision history, derived preferences, and enables similarity search.
 */

import { useState, useEffect, useCallback } from 'react';
import type { DecisionEvent, DerivedPreference, EventFilter } from '@/types/trajectory';
import {
  getEvents,
  recordDecision as apiRecordDecision,
  getPreferences,
  findSimilarQuestions as apiFindSimilarQuestions,
} from '@/api/trajectories';

interface UseUserTrajectoryOptions {
  /** Optional filter for events */
  filter?: EventFilter;
}

interface UseUserTrajectoryResult {
  /** All decision events for this plan */
  decisions: DecisionEvent[];
  /** Derived preferences for this plan */
  preferences: DerivedPreference[];
  /** Whether loading is in progress */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh the trajectory data */
  refetch: () => Promise<void>;
  /** Record a new decision */
  recordDecision: (event: Omit<DecisionEvent, 'event_id' | 'timestamp'>) => Promise<DecisionEvent | null>;
  /** Check for similar past questions */
  findSimilar: (text: string, threshold?: number) => Promise<DecisionEvent[]>;
}

/**
 * Hook for managing user trajectory for a plan.
 * Fetches decision events and preferences, supports recording new decisions.
 */
export function useUserTrajectory(
  planId: string | null,
  options: UseUserTrajectoryOptions = {}
): UseUserTrajectoryResult {
  const { filter } = options;

  const [decisions, setDecisions] = useState<DecisionEvent[]>([]);
  const [preferences, setPreferences] = useState<DerivedPreference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!planId) {
      setDecisions([]);
      setPreferences([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [eventsResponse, preferencesResponse] = await Promise.all([
        getEvents(planId, filter),
        getPreferences(planId),
      ]);

      setDecisions(eventsResponse.events);
      setPreferences(preferencesResponse.preferences);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trajectory data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [planId, filter]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (!planId) return;

    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const eventSource = new EventSource(`${API_BASE}/plans/${planId}/events`);

    const handleTrajectoryEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { eventType, event: trajectoryEvent } = data;

        switch (eventType) {
          case 'decision_recorded':
            // Add new decision event
            setDecisions((prev) => {
              // Check for duplicates
              if (prev.some((d) => d.event_id === trajectoryEvent.event_id)) {
                return prev;
              }
              // Add new event (most recent first)
              return [trajectoryEvent, ...prev];
            });
            break;

          case 'preferences_updated':
            // Refresh preferences
            getPreferences(planId)
              .then((response) => setPreferences(response.preferences))
              .catch(() => {
                // Silently ignore preference refresh errors
              });
            break;
        }
      } catch {
        // Ignore parse errors from SSE
      }
    };

    eventSource.addEventListener('trajectory_event', handleTrajectoryEvent);

    eventSource.onerror = () => {
      // EventSource will automatically reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [planId]);

  const recordDecision = useCallback(
    async (event: Omit<DecisionEvent, 'event_id' | 'timestamp'>): Promise<DecisionEvent | null> => {
      if (!planId) return null;

      setError(null);

      try {
        const response = await apiRecordDecision(planId, event);
        // Add to local state (will also be added via SSE, but optimistic update is good UX)
        setDecisions((prev) => [response.event, ...prev]);
        return response.event;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to record decision';
        setError(errorMessage);
        return null;
      }
    },
    [planId]
  );

  const findSimilar = useCallback(
    async (text: string, threshold?: number): Promise<DecisionEvent[]> => {
      if (!planId) return [];

      setError(null);

      try {
        const response = await apiFindSimilarQuestions(planId, text, threshold);
        return response.matches.map((match) => match.event);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to find similar questions';
        setError(errorMessage);
        return [];
      }
    },
    [planId]
  );

  return {
    decisions,
    preferences,
    isLoading,
    error,
    refetch: fetchData,
    recordDecision,
    findSimilar,
  };
}

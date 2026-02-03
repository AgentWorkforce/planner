/**
 * useTimeline - Hook for fetching and managing timeline events
 *
 * Features:
 * - Fetches timeline events for a run
 * - For running runs: SSE subscription for new events
 * - Appends new events to existing list (no full refetch)
 * - Client-side filtering when filter changes
 * - Calculates event counts by category
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getRunTimeline } from '@/api/timeline';
import { useRunEvents } from './useRunEvents';
import type {
  TimelineEvent,
  TimelineFilterType,
  TimelineEventCounts,
  ForgeEventUnion,
} from '@/types';
import { calculateEventCounts, filterEventsByCategory } from '@/types';

interface UseTimelineOptions {
  filter?: TimelineFilterType;
  isRunning?: boolean;
}

interface UseTimelineResult {
  events: TimelineEvent[];
  filteredEvents: TimelineEvent[];
  counts: TimelineEventCounts;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Convert SSE event to timeline event format
 */
function sseEventToTimelineEvent(event: ForgeEventUnion): TimelineEvent | null {
  const baseEvent = {
    event_id: `${event.type}-${event.timestamp}-${Math.random().toString(36).slice(2, 9)}`,
    run_id: event.run_id,
    timestamp: event.timestamp,
    data: event.data as Record<string, unknown>,
  };

  switch (event.type) {
    case 'run_updated':
      // Map status changes to timeline events
      const status = (event.data as { status?: string }).status;
      if (status === 'completed') {
        return {
          ...baseEvent,
          event_type: 'run_completed',
        };
      }
      if (status === 'failed') {
        return {
          ...baseEvent,
          event_type: 'run_failed',
        };
      }
      return null;

    case 'task_updated':
      const taskData = event.data as { task_id: string; status: string };
      if (taskData.status === 'running') {
        return {
          ...baseEvent,
          event_type: 'task_started',
          task_id: taskData.task_id,
        };
      }
      if (taskData.status === 'completed') {
        return {
          ...baseEvent,
          event_type: 'task_completed',
          task_id: taskData.task_id,
        };
      }
      if (taskData.status === 'failed') {
        return {
          ...baseEvent,
          event_type: 'task_failed',
          task_id: taskData.task_id,
        };
      }
      return null;

    case 'gate_updated':
      const gateData = event.data as { gate_id: string; status: string };
      if (gateData.status === 'pending') {
        return {
          ...baseEvent,
          event_type: 'gate_reached',
        };
      }
      if (gateData.status === 'approved') {
        return {
          ...baseEvent,
          event_type: 'gate_approved',
        };
      }
      if (gateData.status === 'rejected') {
        return {
          ...baseEvent,
          event_type: 'gate_rejected',
        };
      }
      return null;

    case 'question_asked':
      return {
        ...baseEvent,
        event_type: 'question_asked',
        agent_id: (event.data as { agent_id?: string }).agent_id,
      };

    case 'question_answered':
      return {
        ...baseEvent,
        event_type: 'question_answered',
      };

    case 'agent_updated':
      const agentData = event.data as { agent_id: string; state: string };
      if (agentData.state === 'working') {
        return {
          ...baseEvent,
          event_type: 'agent_spawned',
          agent_id: agentData.agent_id,
        };
      }
      if (agentData.state === 'offline') {
        return {
          ...baseEvent,
          event_type: 'agent_exited',
          agent_id: agentData.agent_id,
        };
      }
      return null;

    default:
      return null;
  }
}

export function useTimeline(
  runId: string | null | undefined,
  options: UseTimelineOptions = {}
): UseTimelineResult {
  const { filter = 'all', isRunning = false } = options;

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track seen event IDs to avoid duplicates
  const seenEventIds = useRef<Set<string>>(new Set());

  // Fetch initial timeline data
  const fetchTimeline = useCallback(async () => {
    if (!runId) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getRunTimeline(runId);
      const fetchedEvents = response.events || [];

      // Update seen event IDs
      seenEventIds.current = new Set(fetchedEvents.map((e) => e.event_id));

      setEvents(fetchedEvents);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch timeline'));
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  // Initial fetch
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Handle SSE events for running runs
  const handleSSEEvent = useCallback((event: ForgeEventUnion) => {
    const timelineEvent = sseEventToTimelineEvent(event);
    if (!timelineEvent) return;

    // Check for duplicates
    if (seenEventIds.current.has(timelineEvent.event_id)) {
      return;
    }

    seenEventIds.current.add(timelineEvent.event_id);

    setEvents((prev) => [...prev, timelineEvent]);
  }, []);

  // Subscribe to SSE events for running runs
  useRunEvents(isRunning ? runId : null, {
    onEvent: handleSSEEvent,
    enabled: isRunning,
  });

  // Calculate filtered events and counts
  const filteredEvents = filterEventsByCategory(events, filter);
  const counts = calculateEventCounts(events);

  return {
    events,
    filteredEvents,
    counts,
    isLoading,
    error,
    refetch: fetchTimeline,
  };
}

/**
 * TimelineList - Virtualized list of timeline events
 *
 * Features:
 * - Renders TimelineEvent for each event
 * - Visual marker for run start (top) and run end (bottom if completed)
 * - Auto-scrolls to latest event for running runs
 * - Virtualized rendering when events.length > 100
 * - Uses @tanstack/react-virtual for virtualization
 * - Smooth scrolling with fixed row heights
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TimelineEvent } from './TimelineEvent';
import { cn } from '@/lib/utils';
import type { TimelineEvent as TimelineEventType } from '@/types';

interface TimelineListProps {
  events: TimelineEventType[];
  runStartTime?: string;
  runEndTime?: string;
  isRunning?: boolean;
  className?: string;
}

// Fixed heights for virtualization
const COLLAPSED_HEIGHT = 56;
const EXPANDED_HEIGHT = 120;
const MARKER_HEIGHT = 40;
const VIRTUALIZATION_THRESHOLD = 100;

/**
 * Run start marker component
 */
function RunStartMarker({ time }: { time?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2" style={{ height: MARKER_HEIGHT }}>
      <span className="text-xs font-mono text-text-muted w-16 flex-shrink-0">
        {time ? new Date(time).toLocaleTimeString() : '--:--:--'}
      </span>
      <div className="flex items-center gap-2 flex-1">
        <div className="h-px bg-gradient-to-r from-accent-cyan to-transparent flex-1" />
        <span className="text-xs font-medium text-accent-cyan uppercase tracking-wide">
          Run Started
        </span>
        <div className="h-px bg-gradient-to-l from-accent-cyan to-transparent flex-1" />
      </div>
    </div>
  );
}

/**
 * Run end marker component
 */
function RunEndMarker({ time, status }: { time?: string; status?: 'completed' | 'failed' }) {
  const isCompleted = status === 'completed';
  const colorClass = isCompleted ? 'text-success' : 'text-error';
  const gradientClass = isCompleted
    ? 'from-success to-transparent'
    : 'from-error to-transparent';

  return (
    <div className="flex items-center gap-3 px-3 py-2" style={{ height: MARKER_HEIGHT }}>
      <span className="text-xs font-mono text-text-muted w-16 flex-shrink-0">
        {time ? new Date(time).toLocaleTimeString() : '--:--:--'}
      </span>
      <div className="flex items-center gap-2 flex-1">
        <div className={cn('h-px bg-gradient-to-r flex-1', gradientClass)} />
        <span className={cn('text-xs font-medium uppercase tracking-wide', colorClass)}>
          {isCompleted ? 'Run Completed' : 'Run Failed'}
        </span>
        <div className={cn('h-px bg-gradient-to-l flex-1', gradientClass)} />
      </div>
    </div>
  );
}

/**
 * Non-virtualized list for small event counts
 */
function SimpleTimelineList({
  events,
  runStartTime,
  runEndTime,
  isRunning,
  className,
}: TimelineListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom for running runs
  useEffect(() => {
    if (isRunning && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [isRunning, events.length]);

  // Determine run end status
  const getRunEndStatus = (): 'completed' | 'failed' | undefined => {
    if (!runEndTime) return undefined;
    const lastEvent = events[events.length - 1];
    if (lastEvent?.event_type === 'run_failed') return 'failed';
    if (lastEvent?.event_type === 'run_completed') return 'completed';
    return 'completed';
  };

  return (
    <div ref={containerRef} className={cn('overflow-auto', className)}>
      {/* Timeline line */}
      <div className="relative">
        <div className="absolute left-[4.5rem] top-0 bottom-0 w-px bg-border-subtle" />

        {/* Run start marker */}
        <RunStartMarker time={runStartTime} />

        {/* Events */}
        {events.map((event) => (
          <TimelineEvent
            key={event.event_id}
            event={event}
            runStartTime={runStartTime}
          />
        ))}

        {/* Run end marker (if completed) */}
        {runEndTime && <RunEndMarker time={runEndTime} status={getRunEndStatus()} />}
      </div>
    </div>
  );
}

/**
 * Virtualized timeline list for large event counts
 */
function VirtualizedTimelineList({
  events,
  runStartTime,
  runEndTime,
  isRunning,
  className,
}: TimelineListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Determine run end status
  const getRunEndStatus = (): 'completed' | 'failed' | undefined => {
    if (!runEndTime) return undefined;
    const lastEvent = events[events.length - 1];
    if (lastEvent?.event_type === 'run_failed') return 'failed';
    if (lastEvent?.event_type === 'run_completed') return 'completed';
    return 'completed';
  };

  // Calculate if we have start/end markers
  const hasStartMarker = true;
  const hasEndMarker = !!runEndTime;
  const totalItems = events.length + (hasStartMarker ? 1 : 0) + (hasEndMarker ? 1 : 0);

  // Estimate size for each row
  const estimateSize = useCallback(
    (index: number) => {
      // Start marker
      if (hasStartMarker && index === 0) {
        return MARKER_HEIGHT;
      }

      // End marker
      if (hasEndMarker && index === totalItems - 1) {
        return MARKER_HEIGHT;
      }

      // Event items
      const eventIndex = hasStartMarker ? index - 1 : index;
      const event = events[eventIndex];
      if (event && expandedItems.has(event.event_id)) {
        return EXPANDED_HEIGHT;
      }
      return COLLAPSED_HEIGHT;
    },
    [events, expandedItems, hasStartMarker, hasEndMarker, totalItems]
  );

  const virtualizer = useVirtualizer({
    count: totalItems,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
  });

  // Auto-scroll to bottom for running runs
  useEffect(() => {
    if (isRunning && events.length > 0) {
      virtualizer.scrollToIndex(totalItems - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [isRunning, events.length, totalItems, virtualizer]);

  // Handle height changes from expanded/collapsed events
  const handleHeightChange = useCallback(
    (eventId: string, expanded: boolean) => {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        if (expanded) {
          next.add(eventId);
        } else {
          next.delete(eventId);
        }
        return next;
      });
      // Force virtualizer to recalculate
      virtualizer.measure();
    },
    [virtualizer]
  );

  return (
    <div ref={parentRef} className={cn('overflow-auto', className)}>
      <div
        className="relative"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {/* Timeline line */}
        <div className="absolute left-[4.5rem] top-0 bottom-0 w-px bg-border-subtle" />

        {virtualizer.getVirtualItems().map((virtualRow) => {
          const index = virtualRow.index;

          // Start marker
          if (hasStartMarker && index === 0) {
            return (
              <div
                key="start-marker"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <RunStartMarker time={runStartTime} />
              </div>
            );
          }

          // End marker
          if (hasEndMarker && index === totalItems - 1) {
            return (
              <div
                key="end-marker"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <RunEndMarker time={runEndTime} status={getRunEndStatus()} />
              </div>
            );
          }

          // Event items
          const eventIndex = hasStartMarker ? index - 1 : index;
          const event = events[eventIndex];

          if (!event) return null;

          return (
            <div
              key={event.event_id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TimelineEvent
                event={event}
                runStartTime={runStartTime}
                onHeightChange={(expanded) => handleHeightChange(event.event_id, expanded)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineList(props: TimelineListProps) {
  const { events, className } = props;

  // Use virtualization for large lists
  if (events.length > VIRTUALIZATION_THRESHOLD) {
    return <VirtualizedTimelineList {...props} />;
  }

  return <SimpleTimelineList {...props} className={className} />;
}

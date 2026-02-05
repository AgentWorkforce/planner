/**
 * TimelineExportButton - Export timeline data as JSON or CSV
 *
 * Features:
 * - Dropdown button: Export JSON, Export CSV
 * - JSON export: full event data
 * - CSV export: timestamp, type, description, task_id, agent_id
 * - Downloads file: forge-run-{runId}-timeline.{ext}
 */

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { TimelineEvent } from '@/types';

interface TimelineExportButtonProps {
  runId: string;
  events: TimelineEvent[];
  className?: string;
}

/**
 * Convert events to CSV format
 */
function eventsToCSV(events: TimelineEvent[]): string {
  const headers = ['timestamp', 'event_type', 'description', 'task_id', 'agent_id', 'task_title', 'agent_name'];
  const rows = events.map((event) => {
    const description = event.description || buildDescription(event);
    return [
      event.timestamp,
      event.event_type,
      `"${description.replace(/"/g, '""')}"`, // Escape quotes in CSV
      event.task_id || '',
      event.agent_id || '',
      event.task_title || '',
      event.agent_name || '',
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Build description from event data (copied from TimelineEvent for export)
 */
function buildDescription(event: TimelineEvent): string {
  if (event.description) {
    return event.description;
  }

  const { event_type, task_title, agent_name, data } = event;

  switch (event_type) {
    case 'run_started':
      return 'Execution started';
    case 'run_completed':
      return 'Execution completed successfully';
    case 'run_failed':
      return data?.error ? `Execution failed: ${data.error}` : 'Execution failed';
    case 'task_started':
      return task_title ? `Started: ${task_title}` : 'Task started';
    case 'task_completed':
      return task_title ? `Completed: ${task_title}` : 'Task completed';
    case 'task_failed':
      return task_title ? `Failed: ${task_title}` : 'Task failed';
    case 'agent_spawned':
      return agent_name ? `Agent spawned: ${agent_name}` : 'Agent spawned';
    case 'agent_exited':
      return agent_name ? `Agent exited: ${agent_name}` : 'Agent exited';
    case 'gate_reached':
      return data?.gate_title ? `Gate reached: ${data.gate_title}` : 'Gate reached, awaiting approval';
    case 'gate_approved':
      return data?.gate_title ? `Gate approved: ${data.gate_title}` : 'Gate approved';
    case 'gate_rejected':
      return data?.gate_title ? `Gate rejected: ${data.gate_title}` : 'Gate rejected';
    case 'question_asked':
      return data?.question_text ? `Question: ${data.question_text}` : 'Question asked';
    case 'question_answered':
      return data?.answer ? `Answer provided` : 'Question answered';
    default:
      return event_type;
  }
}

/**
 * Trigger file download
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TimelineExportButton({
  runId,
  events,
  className,
}: TimelineExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportJSON = () => {
    const content = JSON.stringify(events, null, 2);
    const filename = `forge-run-${runId.slice(0, 8)}-timeline.json`;
    downloadFile(content, filename, 'application/json');
    setIsOpen(false);
  };

  const handleExportCSV = () => {
    const content = eventsToCSV(events);
    const filename = `forge-run-${runId.slice(0, 8)}-timeline.csv`;
    downloadFile(content, filename, 'text/csv');
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={events.length === 0}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
          'border border-border-subtle',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-1',
          events.length === 0
            ? 'text-text-muted bg-bg-tertiary cursor-not-allowed'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Export</span>
        <svg
          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 rounded-md bg-bg-card border border-border-subtle shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleExportJSON}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13h2" />
                <path d="M8 17h2" />
                <path d="M14 13h2" />
                <path d="M14 17h2" />
              </svg>
              <span>Export JSON</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

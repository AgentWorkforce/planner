/**
 * ConnectionIndicator Component
 *
 * Small status indicator showing connection state to the backend/relay.
 * Uses earth-tone palette:
 * - Connected: moss green (successful connection)
 * - Disconnected: brick red (offline)
 * - Reconnecting: clay orange (attempting to reconnect) with pulse animation
 *
 * Designed for StatusBar integration.
 */

interface ConnectionIndicatorProps {
  status: 'connected' | 'disconnected' | 'reconnecting';
  /** Optional className for container */
  className?: string;
}

// Status labels
const STATUS_LABELS: Record<ConnectionIndicatorProps['status'], string> = {
  connected: 'Connected',
  disconnected: 'Offline',
  reconnecting: 'Reconnecting...',
};

// Status colors (earth-tone CSS variables)
const STATUS_COLORS: Record<ConnectionIndicatorProps['status'], string> = {
  connected: 'text-[var(--color-moss)]',
  disconnected: 'text-[var(--color-brick)]',
  reconnecting: 'text-[var(--color-clay)]',
};

/**
 * ConnectionIndicator - Shows connection status with dot and label
 *
 * Minimal UI that fits well in status bars or headers.
 */
export function ConnectionIndicator({ status, className = '' }: ConnectionIndicatorProps) {
  const colorClass = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  const isPulsing = status === 'reconnecting';

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span
        className={`${colorClass} text-sm ${isPulsing ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      >
        ●
      </span>
      <span className="text-[var(--text-muted)] text-xs">
        {label}
      </span>
    </div>
  );
}

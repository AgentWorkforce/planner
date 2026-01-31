/**
 * Format a date as a relative time string (e.g., "2h ago", "14 days ago").
 * Uses Intl.RelativeTimeFormat for localization support.
 *
 * @param date - Date string or Date object to format
 * @returns Human-readable relative time string, or empty string if invalid
 */
export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    // Handle future dates
    if (diffSeconds < 0) {
      return formatFutureTime(-diffSeconds);
    }

    // Just now (< 1 minute)
    if (diffSeconds < 60) {
      return 'just now';
    }

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    // Minutes (< 1 hour)
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return rtf.format(-diffMinutes, 'minute');
    }

    // Hours (< 1 day)
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return rtf.format(-diffHours, 'hour');
    }

    // Days (< 1 week)
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return rtf.format(-diffDays, 'day');
    }

    // Weeks (< 4 weeks)
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) {
      return rtf.format(-diffWeeks, 'week');
    }

    // Months (< 12 months)
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return rtf.format(-diffMonths, 'month');
    }

    // Years
    const diffYears = Math.floor(diffDays / 365);
    return rtf.format(-diffYears, 'year');
  } catch {
    return '';
  }
}

/**
 * Format future time offsets.
 */
function formatFutureTime(diffSeconds: number): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (diffSeconds < 60) {
    return 'in a moment';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.floor(diffHours / 24);
  return rtf.format(diffDays, 'day');
}

/**
 * Generate context-specific time strings for attention items.
 *
 * @param date - The date to format
 * @param attentionType - The type of attention (affects wording)
 * @returns Context-appropriate time string (e.g., "submitted 2h ago", "stale for 14 days")
 */
export function formatAttentionTime(date: string | Date, attentionType: string): string {
  const relative = formatRelativeTime(date);

  if (!relative) return '';

  switch (attentionType) {
    case 'awaiting_approval':
      return `submitted ${relative}`;
    case 'stale_draft': {
      // For stale drafts, show "stale for X days" instead of "X ago"
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const diffMs = new Date().getTime() - dateObj.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return `stale for ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }
    case 'change_request':
      return `requested ${relative}`;
    case 'gate_pending':
      return `blocked ${relative}`;
    case 'execution_failed':
      return `failed ${relative}`;
    case 'unread_comments':
      return `commented ${relative}`;
    case 'active':
      return `last edited ${relative}`;
    default:
      return relative;
  }
}

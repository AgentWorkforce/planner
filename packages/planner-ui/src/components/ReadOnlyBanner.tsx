import { Link } from 'react-router-dom';

interface ReadOnlyBannerProps {
  planId: string;
  message?: string;
  showCreateVersionLink?: boolean;
}

// Eye icon for read-only indicator
function EyeIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Banner indicating the plan is in read-only mode.
 * Used for published plans showing execution status.
 */
export function ReadOnlyBanner({
  planId,
  message = 'This plan is in execution mode. Editing is disabled.',
  showCreateVersionLink = true,
}: ReadOnlyBannerProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg text-accent-cyan"
      role="alert"
    >
      <EyeIcon />
      <span className="flex-1 text-sm">{message}</span>
      {showCreateVersionLink && (
        <Link
          to={`/plans/${planId}/versions/new`}
          className="text-sm font-medium hover:underline"
        >
          Create new version
        </Link>
      )}
    </div>
  );
}

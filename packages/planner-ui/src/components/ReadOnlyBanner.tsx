import { Link } from 'react-router-dom';

interface ReadOnlyBannerProps {
  /** Plan ID for creating new version link */
  planId: string;
  /** Message to display (defaults to execution view message) */
  message?: string;
  /** Whether to show the "create new version" link */
  showCreateVersionLink?: boolean;
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
    <div className="read-only-banner" role="alert">
      <span className="read-only-icon" aria-hidden="true">
        👁
      </span>
      <span className="read-only-message">{message}</span>
      {showCreateVersionLink && (
        <Link to={`/plans/${planId}/versions/new`} className="read-only-link">
          Create new version
        </Link>
      )}
    </div>
  );
}

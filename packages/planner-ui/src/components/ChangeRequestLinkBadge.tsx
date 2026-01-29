interface ChangeRequestLinkBadgeProps {
  /** The change request ID this version was created from */
  changeRequestId: string;
  /** Callback when user clicks to view the change request */
  onClick?: (changeRequestId: string) => void;
}

/**
 * Badge showing that a version was created from a change request.
 * Provides traceability link back to the original request.
 */
export function ChangeRequestLinkBadge({
  changeRequestId,
  onClick,
}: ChangeRequestLinkBadgeProps) {
  const handleClick = () => {
    onClick?.(changeRequestId);
  };

  // Truncate the ID for display
  const displayId = changeRequestId.slice(0, 8);

  return (
    <button
      className="change-request-link-badge"
      onClick={handleClick}
      title={`Created from change request: ${changeRequestId}`}
      aria-label="View originating change request"
    >
      <span className="badge-icon" aria-hidden="true">
        ⚠️
      </span>
      <span className="badge-text">From CR: {displayId}...</span>
    </button>
  );
}

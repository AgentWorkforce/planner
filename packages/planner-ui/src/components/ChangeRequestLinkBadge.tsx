import { AlertIcon } from './icons';

interface ChangeRequestLinkBadgeProps {
  changeRequestId: string;
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
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 transition-colors"
      onClick={handleClick}
      title={`Created from change request: ${changeRequestId}`}
      aria-label="View originating change request"
    >
      <AlertIcon size="sm" />
      <span>From CR: {displayId}...</span>
    </button>
  );
}

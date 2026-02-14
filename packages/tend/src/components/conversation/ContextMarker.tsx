export interface ContextMarkerProps {
  label?: string;
  fromContext?: string;
  toContext?: string;
  timestamp: string;
}

/**
 * ContextMarker
 *
 * Subtle horizontal divider marking context shifts in conversation.
 * Minimal attention level - fades into background.
 *
 * Features:
 * - Thin horizontal line (border-t border-border-subtle)
 * - Optional centered label in text-[11px] text-text-dim
 * - If fromContext/toContext: shows "from → to" format
 * - Minimal spacing (my-2)
 * - Should barely be visible
 */
export function ContextMarker({ label, fromContext, toContext }: ContextMarkerProps) {
  // Construct label if fromContext/toContext are provided
  const displayLabel = fromContext && toContext
    ? `${fromContext} → ${toContext}`
    : label;

  return (
    <div className="my-2 relative">
      <div className="border-t border-border-subtle" />
      {displayLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="px-2 bg-bg-deep text-[11px] text-text-dim">
            {displayLabel}
          </span>
        </div>
      )}
    </div>
  );
}

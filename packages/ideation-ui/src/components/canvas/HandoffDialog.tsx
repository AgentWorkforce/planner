import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Block } from './FormingBlocksColumn';

/**
 * Options for handling un-curated blocks during handoff
 */
export interface HandoffOptions {
  uncuratedAction: 'leave_out' | 'include_as_context' | 'include_above_threshold';
  threshold?: number; // Only if 'include_above_threshold'
}

/**
 * Props for HandoffDialog component
 */
export interface HandoffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: HandoffOptions) => void;
  blocks: Block[];
}

/**
 * HandoffDialog
 *
 * Dialog shown when user clicks "→ Planner" to handle un-curated blocks before handoff.
 *
 * Features:
 * - Shows count of curated vs. un-curated blocks
 * - Options for handling un-curated blocks:
 *   - Leave out (only send curated)
 *   - Include as context (AI considers them)
 *   - Include all above threshold (configurable confidence %)
 * - Confirm button initiates handoff
 * - Cancel button closes dialog
 *
 * Layout:
 * ```
 * ┌─────────────────────────────────────────────┐
 * │  Hand off to Planner                    [X] │
 * ├─────────────────────────────────────────────┤
 * │  Ready to send:                             │
 * │  • 5 curated blocks                         │
 * │  • 3 un-curated blocks remaining            │
 * │                                             │
 * │  How to handle un-curated blocks?           │
 * │  ○ Leave out (only send curated)            │
 * │  ○ Include as context (AI considers them)   │
 * │  ○ Include all above [75]% confidence       │
 * │                                             │
 * ├─────────────────────────────────────────────┤
 * │                    [Cancel] [Send to Plan →]│
 * └─────────────────────────────────────────────┘
 * ```
 *
 * Usage:
 * ```tsx
 * const [isHandoffOpen, setIsHandoffOpen] = useState(false);
 *
 * const handleHandoff = (options: HandoffOptions) => {
 *   // Process handoff with selected options
 *   setIsHandoffOpen(false);
 * };
 *
 * <HandoffDialog
 *   isOpen={isHandoffOpen}
 *   onClose={() => setIsHandoffOpen(false)}
 *   onConfirm={handleHandoff}
 *   blocks={allBlocks}
 * />
 * ```
 */
export function HandoffDialog({
  isOpen,
  onClose,
  onConfirm,
  blocks,
}: HandoffDialogProps) {
  const [uncuratedAction, setUncuratedAction] = useState<HandoffOptions['uncuratedAction']>('leave_out');
  const [threshold, setThreshold] = useState(75);

  const curatedCount = blocks.filter((b) => b.status === 'curated').length;
  const uncuratedCount = blocks.filter((b) => b.status !== 'curated').length;

  const handleConfirm = () => {
    onConfirm({
      uncuratedAction,
      threshold: uncuratedAction === 'include_above_threshold' ? threshold : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--canvas-bg-subtle)] rounded-lg shadow-xl border border-[var(--block-draft-border)] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--block-draft-border)]">
          <h2 className="text-lg font-semibold text-[var(--canvas-text-primary)]">Hand off to Planner</h2>
          <button
            onClick={onClose}
            className="text-[var(--canvas-text-muted)] hover:text-[var(--canvas-text-primary)] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Block counts */}
          <div className="text-sm space-y-1">
            <p className="font-medium text-[var(--canvas-text-primary)]">Ready to send:</p>
            <p className="text-[var(--canvas-accent)]">• {curatedCount} curated blocks</p>
            {uncuratedCount > 0 && (
              <p className="text-[var(--canvas-text-muted)]">• {uncuratedCount} un-curated blocks remaining</p>
            )}
          </div>

          {/* Options (only show if there are uncurated blocks) */}
          {uncuratedCount > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--canvas-text-primary)]">How to handle un-curated blocks?</p>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  checked={uncuratedAction === 'leave_out'}
                  onChange={() => setUncuratedAction('leave_out')}
                  className="cursor-pointer accent-[var(--canvas-accent)]"
                />
                <span className="text-sm text-[var(--canvas-text-primary)]">Leave out (only send curated)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  checked={uncuratedAction === 'include_as_context'}
                  onChange={() => setUncuratedAction('include_as_context')}
                  className="cursor-pointer accent-[var(--canvas-accent)]"
                />
                <span className="text-sm text-[var(--canvas-text-primary)]">Include as context (AI considers them)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  checked={uncuratedAction === 'include_above_threshold'}
                  onChange={() => setUncuratedAction('include_above_threshold')}
                  className="cursor-pointer accent-[var(--canvas-accent)]"
                />
                <span className="text-sm text-[var(--canvas-text-primary)]">
                  Include all above{' '}
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    disabled={uncuratedAction !== 'include_above_threshold'}
                    className={cn(
                      'w-12 px-1 border border-[var(--block-draft-border)] rounded bg-[var(--canvas-bg)] text-[var(--canvas-text-primary)]',
                      uncuratedAction !== 'include_above_threshold' && 'opacity-50 cursor-not-allowed'
                    )}
                    min={0}
                    max={100}
                  />
                  % confidence
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--block-draft-border)]">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-[var(--canvas-text-primary)] hover:bg-[var(--canvas-bg)] rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm bg-[var(--canvas-accent)] text-white font-medium rounded-md hover:brightness-110 transition-all"
          >
            Send to Planner →
          </button>
        </div>
      </div>
    </div>
  );
}

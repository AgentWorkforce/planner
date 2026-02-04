import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X, Check } from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';

/**
 * Extended Block interface with all fields from the domain schema
 * This matches the full Block type from the ideation package
 */
export interface FocusModeBlock {
  id: string;
  emoji: string;
  keyword: string;
  confidence: number;
  status: string;
  type?: string;
  title?: string;
  content?: string;
  specialist?: string;
  sourceContext?: string;
  userEdited?: boolean;
  userEdits?: Array<{
    id: string;
    range: { start: number; end: number };
    content: string;
    timestamp: string;
  }>;
}

/**
 * Props for FocusMode component
 */
export interface FocusModeProps {
  /** The block being focused */
  block: FocusModeBlock;
  /** Callback when user closes focus mode */
  onClose: () => void;
  /** Callback when user curates the block */
  onCurate: () => void;
  /** Callback when block content is edited */
  onContentChange?: (content: string, userEdited: boolean, editedField?: string) => void;
  /** Slot for contextual chat UI */
  children?: ReactNode;
  className?: string;
}

/**
 * FocusMode Component
 *
 * Full-screen layout transition that shows a focused block's details
 * alongside contextual chat. Replaces the normal 3-column layout.
 *
 * Layout Transition:
 * Normal (3-column):
 * ```
 * ┌──────────┬─────────────┬──────────┐
 * │ Forming  │    Chat     │ Curated  │
 * │  (30%)   │   (45%)     │  (25%)   │
 * └──────────┴─────────────┴──────────┘
 * ```
 *
 * Focus Mode (2-column):
 * ```
 * ┌──────────────────┬─────────────────┐
 * │   Block Detail   │  Contextual     │
 * │     Panel        │     Chat        │
 * │    (expanded)    │   (narrower)    │
 * └──────────────────┴─────────────────┘
 * ```
 *
 * Features:
 * - Block metadata display (type, confidence, specialist)
 * - Editable markdown content area
 * - Curate action button
 * - Close button to exit focus mode
 * - Smooth entry/exit animation
 * - Contextual chat slot on the right
 *
 * @example
 * ```tsx
 * <FocusMode
 *   block={selectedBlock}
 *   onClose={() => setFocusedBlockId(null)}
 *   onCurate={() => curateBlock(block.id)}
 *   onContentChange={(content, userEdited) => updateBlock(block.id, { content, userEdited })}
 * >
 *   <SessionChatView sessionId={sessionId} />
 * </FocusMode>
 * ```
 */
export function FocusMode({ block, onClose, onCurate, onContentChange, children, className }: FocusModeProps) {
  return (
    <div className={cn('flex h-full focus-mode-enter', className)}>
      {/* Left: Block Detail Panel (60%) */}
      <div className="flex-[0_0_60%] h-full overflow-y-auto border-r border-border-subtle bg-bg-primary p-6">
        {/* Header with title and actions */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden="true">
              {block.emoji}
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-text-primary">
                {block.keyword}
              </h2>
              {block.title && (
                <p className="text-sm text-text-muted mt-1">{block.title}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCurate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              aria-label="Curate block"
            >
              <Check className="w-4 h-4" />
              <span>Curate</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-bg-secondary transition-colors text-text-muted hover:text-text-primary"
              aria-label="Close focus mode"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata section */}
        <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-border-subtle">
          {block.type && (
            <div className="flex flex-col">
              <span className="text-xs text-text-muted uppercase tracking-wide">Type</span>
              <span className="text-sm text-text-primary mt-1">{block.type}</span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-xs text-text-muted uppercase tracking-wide">Confidence</span>
            <span className="text-sm text-text-primary mt-1">{block.confidence}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-text-muted uppercase tracking-wide">Status</span>
            <span className="text-sm text-text-primary mt-1 capitalize">{block.status}</span>
          </div>
          {block.specialist && (
            <div className="flex flex-col">
              <span className="text-xs text-text-muted uppercase tracking-wide">Created By</span>
              <span className="text-sm text-text-primary mt-1">{block.specialist}</span>
            </div>
          )}
        </div>

        {/* Content section - editable markdown */}
        <div className="mb-6">
          <MarkdownEditor
            value={block.content || ''}
            onChange={(content, userEdited, editedField) => {
              onContentChange?.(content, userEdited, editedField);
            }}
            placeholder="Enter block content (markdown supported)..."
            minHeight="300px"
            fieldName="content"
          />
        </div>

        {/* Source context section */}
        {block.sourceContext && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-primary uppercase tracking-wide mb-3">
              Source Context
            </h3>
            <p className="text-sm text-text-muted bg-bg-secondary p-4 rounded-md border border-border-subtle">
              {block.sourceContext}
            </p>
          </div>
        )}

        {/* User edits indicator */}
        {block.userEdited && block.userEdits && block.userEdits.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-primary uppercase tracking-wide mb-3">
              User Edits
            </h3>
            <div className="space-y-2">
              {block.userEdits.slice(-3).map((edit, idx) => (
                <div key={idx} className="text-xs text-text-muted bg-bg-tertiary rounded px-2 py-1">
                  <span className="text-accent-yellow">{edit.field}</span>
                  <span className="text-text-muted"> edited </span>
                  <span className="text-text-secondary">
                    {new Date(edit.editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {block.userEdits.length > 3 && (
                <p className="text-xs text-text-muted">+{block.userEdits.length - 3} more edits</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Contextual Chat (40%) */}
      <div className="flex-[0_0_40%] h-full flex flex-col bg-bg-primary">
        {children}
      </div>
    </div>
  );
}

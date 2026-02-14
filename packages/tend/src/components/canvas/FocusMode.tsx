import { ReactNode, useEffect } from 'react';
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
    field?: string;
    editedAt?: string;
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div className={cn('flex h-full focus-mode-enter', className)}>
      {/* Left: Contextual Chat (40%) */}
      <div className="flex-[0_0_40%] h-full flex flex-col bg-[var(--canvas-bg)]">
        {children}
      </div>

      {/* Right: Block Detail Panel (60%) */}
      <div className="flex-[0_0_60%] h-full overflow-y-auto border-l border-border-subtle bg-[var(--canvas-bg)]">
        {/* Compact header bar — aligns with chat toolbar height */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle">
          <span className="text-lg" aria-hidden="true">{block.emoji}</span>
          <h2 className="text-sm font-semibold text-text-primary truncate">{block.keyword}</h2>
          {block.title && (
            <span className="text-xs text-text-muted truncate hidden lg:inline">— {block.title}</span>
          )}
          <div className="flex items-center gap-2 text-xs text-text-muted ml-auto shrink-0">
            {block.type && <span>{block.type}</span>}
            <span>{block.confidence}%</span>
            <span className="capitalize">{block.status}</span>
            <button
              onClick={onCurate}
              className="flex items-center gap-1 px-3 py-1 bg-[var(--canvas-accent)] text-white text-xs font-medium rounded-full hover:brightness-110 transition-all"
              aria-label="Curate block"
            >
              <Check className="w-3 h-3" />
              Curate
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-bg-secondary transition-colors text-text-muted hover:text-text-primary"
              aria-label="Close focus mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6">

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

        {/* Source context badges */}
        {block.sourceContext && (
          <div className="mb-6 flex flex-wrap gap-2">
            {block.sourceContext.split(',').map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-[var(--canvas-bg-subtle)] text-[var(--canvas-text-muted)]"
              >
                {item.trim()}
              </span>
            ))}
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
                  <span className="text-accent-yellow">{edit.field || 'content'}</span>
                  <span className="text-text-muted"> edited </span>
                  <span className="text-text-secondary">
                    {new Date(edit.editedAt || edit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      </div>

    </div>
  );
}

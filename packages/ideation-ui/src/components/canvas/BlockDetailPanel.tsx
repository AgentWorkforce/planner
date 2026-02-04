import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Trash2, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { MarkdownEditor } from './MarkdownEditor';
import { PencilIcon } from '../icons/PencilIcon';

/**
 * Block interface matching the domain schema
 */
export interface Block {
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
  userEditedFields?: string[];
}

/**
 * Props for BlockDetailPanel component
 */
export interface BlockDetailPanelProps {
  /** The block to display and edit */
  block: Block;
  /** Callback when content is changed */
  onContentChange?: (content: string, userEdited: boolean, editedField?: string) => void;
  /** Callback when curate button is clicked */
  onCurate?: () => void;
  /** Callback when delete is confirmed */
  onDelete?: () => void;
  /** Callback when panel is closed */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * BlockDetailPanel
 *
 * Detail panel shown when a block is focused. Displays block metadata,
 * editable content, and actions (curate, delete).
 *
 * Layout:
 * ```
 * ┌─────────────────────────────────────┐
 * │  💡 Auth Flow          [Delete] [X] │
 * │  Type: feature                       │
 * ├─────────────────────────────────────┤
 * │  Confidence: ████████░░ 75%         │
 * ├─────────────────────────────────────┤
 * │  Content:                            │
 * │  ┌─────────────────────────────────┐ │
 * │  │ **What**: User authentication   │ │
 * │  │ **Why**: Secure access needed   │ │
 * │  │ **Details**:                    │ │
 * │  │ - OAuth 2.0 support             │ │
 * │  │ - Session management            │ │
 * │  └─────────────────────────────────┘ │
 * ├─────────────────────────────────────┤
 * │  Source: Architect, Turn 3          │
 * ├─────────────────────────────────────┤
 * │                    [Curate ✓]       │
 * └─────────────────────────────────────┘
 * ```
 *
 * Features:
 * - Displays block emoji, keyword, type
 * - Shows confidence as progress bar
 * - Editable markdown content area
 * - Curate action (only shown if not already curated)
 * - Delete action with confirmation dialog
 * - Source context display (specialist + turn info)
 * - Close button to exit
 *
 * @example
 * ```tsx
 * <BlockDetailPanel
 *   block={selectedBlock}
 *   onContentChange={(content, userEdited) => updateBlock(block.id, { content, userEdited })}
 *   onCurate={() => curateBlock(block.id)}
 *   onDelete={() => removeBlock(block.id)}
 *   onClose={() => setSelectedBlock(null)}
 * />
 * ```
 */
export function BlockDetailPanel({
  block,
  onContentChange,
  onCurate,
  onDelete,
  onClose,
  className,
}: BlockDetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  // Format source context
  const sourceText = [block.specialist, block.sourceContext].filter(Boolean).join(', ');

  return (
    <>
      <div className={cn('flex flex-col h-full bg-bg-primary', className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">
              {block.emoji}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{block.keyword}</h2>
              {block.type && (
                <p className="text-sm text-text-muted">Type: {block.type}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-error hover:text-error/80 hover:bg-error-light rounded-md transition-colors"
              aria-label="Delete block"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-primary"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Confidence Display */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted whitespace-nowrap">Confidence:</span>
            <div className="flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-cyan transition-all duration-300"
                style={{ width: `${block.confidence}%` }}
                aria-label={`${block.confidence}% confidence`}
              />
            </div>
            <span className="text-sm font-medium text-text-primary tabular-nums">
              {Math.round(block.confidence)}%
            </span>
          </div>
        </div>

        {/* Content - Editable */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* User Edited Indicator */}
          {block.userEdited && (
            <div className="px-4 pt-3 pb-2 flex items-center gap-2 bg-accent-light border-b border-accent-cyan/20">
              <PencilIcon size="sm" className="text-accent-cyan" />
              <span className="text-xs font-medium text-accent-cyan">You edited this</span>
            </div>
          )}
          <div className="flex-1 p-4 overflow-y-auto">
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
        </div>

        {/* Source Context */}
        {sourceText && (
          <div className="px-4 py-2 border-t border-border-subtle bg-bg-secondary">
            <p className="text-xs text-text-muted">
              <span className="font-medium">Source:</span> {sourceText}
            </p>
          </div>
        )}

        {/* Actions */}
        {block.status !== 'curated' && onCurate && (
          <div className="p-4 border-t border-border-subtle flex justify-end bg-bg-primary">
            <button
              onClick={onCurate}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md',
                'bg-accent-cyan text-text-inverse',
                'hover:bg-accent-hover transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:ring-offset-2 focus:ring-offset-bg-primary'
              )}
              aria-label="Curate block"
            >
              <Check className="w-4 h-4" />
              <span className="font-medium">Curate</span>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Block</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this block? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-sm text-text-primary hover:bg-bg-hover rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 text-sm bg-error text-text-inverse rounded-md hover:bg-error/90 transition-colors"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

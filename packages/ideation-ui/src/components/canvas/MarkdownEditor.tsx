import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { Eye, Edit3 } from 'lucide-react';

/**
 * Props for MarkdownEditor component
 */
export interface MarkdownEditorProps {
  /** Current markdown content */
  value: string;
  /** Callback when content changes (triggers on blur or explicit save) */
  onChange: (content: string, userEdited: boolean, editedField?: string) => void;
  /** Placeholder text for empty editor */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to start in edit mode */
  defaultEditMode?: boolean;
  /** Minimum height for editor */
  minHeight?: string;
  /** Name of the field being edited (for tracking userEditedFields) */
  fieldName?: string;
}

/**
 * MarkdownEditor
 *
 * Inline markdown editor with preview toggle. Supports:
 * - Edit mode: textarea for editing markdown
 * - Preview mode: rendered markdown display
 * - Toggle button to switch between modes
 * - Auto-save on blur
 * - User edit tracking
 *
 * Usage:
 * ```tsx
 * <MarkdownEditor
 *   value={block.content || ''}
 *   onChange={(content, userEdited) => {
 *     updateBlock(block.id, { content, userEdited });
 *   }}
 *   placeholder="Enter block content..."
 * />
 * ```
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Enter content (markdown supported)...',
  className,
  defaultEditMode = false,
  minHeight = '200px',
  fieldName = 'content',
}: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(defaultEditMode);
  const [localContent, setLocalContent] = useState(value);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialContentRef = useRef(value);

  // Update local content when prop changes (e.g., from external updates)
  useEffect(() => {
    if (!isEditing && value !== localContent) {
      setLocalContent(value);
      initialContentRef.current = value;
    }
  }, [value, isEditing, localContent]);

  // Handle content change in textarea
  const handleContentChange = useCallback((newContent: string) => {
    setLocalContent(newContent);
    setHasUnsavedChanges(newContent !== initialContentRef.current);
  }, []);

  // Save changes and exit edit mode
  const handleSave = useCallback(() => {
    if (hasUnsavedChanges && localContent !== initialContentRef.current) {
      const wasEdited = initialContentRef.current !== value || localContent !== value;
      onChange(localContent, wasEdited, fieldName);
      initialContentRef.current = localContent;
      setHasUnsavedChanges(false);
    }
  }, [localContent, hasUnsavedChanges, onChange, value, fieldName]);

  // Handle blur event (auto-save)
  const handleBlur = useCallback(() => {
    if (hasUnsavedChanges) {
      handleSave();
    }
  }, [hasUnsavedChanges, handleSave]);

  // Toggle between edit and preview modes
  const toggleMode = useCallback(() => {
    if (isEditing && hasUnsavedChanges) {
      handleSave();
    }
    setIsEditing((prev) => !prev);
  }, [isEditing, hasUnsavedChanges, handleSave]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  return (
    <div className={cn('relative flex flex-col', className)}>
      {/* Mode toggle button */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-text-primary uppercase tracking-wide">
          Content
        </label>
        <button
          onClick={toggleMode}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors',
            'hover:bg-bg-hover text-text-muted hover:text-text-primary'
          )}
          aria-label={isEditing ? 'Preview markdown' : 'Edit markdown'}
        >
          {isEditing ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </>
          ) : (
            <>
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </>
          )}
        </button>
      </div>

      {/* Editor or Preview */}
      <div
        className={cn(
          'relative rounded-md border transition-colors',
          isEditing
            ? 'border-border-subtle bg-bg-secondary'
            : 'border-border-subtle bg-bg-primary'
        )}
        style={{ minHeight }}
      >
        {isEditing ? (
          // Edit mode: textarea
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={handleBlur}
            className={cn(
              'w-full h-full min-h-[200px] p-4 rounded-md resize-y',
              'bg-transparent border-0',
              'text-text-primary placeholder:text-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-accent-cyan',
              'font-mono text-sm'
            )}
            placeholder={placeholder}
            spellCheck="true"
          />
        ) : (
          // Preview mode: rendered markdown
          <div
            className={cn(
              'p-4 overflow-y-auto',
              'prose prose-sm max-w-none',
              'prose-headings:text-text-primary prose-p:text-text-primary',
              'prose-strong:text-text-primary prose-code:text-text-primary',
              'prose-ul:text-text-primary prose-ol:text-text-primary',
              'prose-li:text-text-primary prose-a:text-accent-cyan',
              'prose-blockquote:text-text-muted prose-blockquote:border-l-accent-cyan'
            )}
            style={{ minHeight }}
          >
            {localContent ? (
              <ReactMarkdown
                components={{
                  // Customize code blocks
                  code: (props) => {
                    const { node, className, children, ...rest } = props;
                    const isInline = !className?.includes('language-');
                    return (
                      <code
                        {...rest}
                        className={cn(
                          className,
                          isInline
                            ? 'px-1.5 py-0.5 rounded bg-bg-secondary text-text-primary font-mono text-xs'
                            : 'block p-3 rounded bg-bg-secondary text-text-primary font-mono text-sm overflow-x-auto'
                        )}
                      >
                        {children}
                      </code>
                    );
                  },
                  // Customize links
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      className="text-accent-cyan hover:text-accent-hover underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                }}
              >
                {localContent}
              </ReactMarkdown>
            ) : (
              <p className="text-text-muted italic">{placeholder}</p>
            )}
          </div>
        )}
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && isEditing && (
        <p className="text-xs text-text-muted mt-1">
          Unsaved changes (will auto-save on blur)
        </p>
      )}
    </div>
  );
}

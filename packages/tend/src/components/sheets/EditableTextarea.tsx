import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableTextareaProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
}

/**
 * EditableTextarea - Inline editable textarea field
 *
 * Copied from planner-ui pattern.
 * Click to edit, Ctrl/Cmd+Enter to save, Escape to cancel.
 */
export function EditableTextarea({
  value,
  onSave,
  placeholder = 'Click to edit',
  className = '',
  disabled = false,
  rows = 3,
}: EditableTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setPreviousValue(value);
    setEditValue(value);
    setIsEditing(true);
  }, [disabled, value]);

  const save = useCallback(async () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue !== value) {
      try {
        await onSave(trimmedValue);
      } catch {
        setEditValue(previousValue);
      }
    }
    setIsEditing(false);
  }, [editValue, value, onSave, previousValue]);

  const cancel = useCallback(() => {
    setEditValue(previousValue);
    setIsEditing(false);
  }, [previousValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel]
  );

  const handleBlur = useCallback(() => {
    save();
  }, [save]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        rows={rows}
        className={`w-full px-3 py-2 bg-bg-secondary border-2 border-accent-primary rounded-md text-text-primary text-sm placeholder:text-text-muted focus:outline-none resize-y ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      className={`w-full px-3 py-2 bg-bg-secondary rounded-md text-text-primary text-sm min-h-[${rows * 1.5}rem] cursor-text border-2 border-transparent hover:border-border-light transition-colors ${
        disabled ? 'cursor-default' : ''
      } ${className}`}
      onClick={startEditing}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEditing();
        }
      }}
    >
      {value ? (
        <span className="whitespace-pre-wrap">{value}</span>
      ) : (
        <span className="text-text-muted italic">{placeholder}</span>
      )}
    </div>
  );
}

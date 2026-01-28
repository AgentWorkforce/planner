import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableTextareaProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
}

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

  // Sync with external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus textarea when entering edit mode
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
        // Revert on error
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
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      }
    },
    [save, cancel]
  );

  const handleBlur = useCallback(() => {
    save();
  }, [save]);

  if (isEditing) {
    return (
      <div className={`editable-textarea-wrapper ${className}`}>
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="editable-textarea-input"
          placeholder={placeholder}
          rows={rows}
        />
        <div className="editable-textarea-hint">Press Cmd/Ctrl+Enter to save, Esc to cancel</div>
      </div>
    );
  }

  return (
    <div
      className={`editable-textarea ${className} ${disabled ? 'disabled' : ''}`}
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
        <span className="editable-content">{value}</span>
      ) : (
        <span className="editable-placeholder">{placeholder}</span>
      )}
    </div>
  );
}

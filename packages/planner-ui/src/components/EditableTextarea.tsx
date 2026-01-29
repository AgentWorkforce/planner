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
      <div className={className}>
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full px-3 py-2 bg-bg-secondary border border-accent-cyan rounded-md text-text-primary text-sm placeholder:text-text-muted focus:ring-1 focus:ring-accent-cyan/50 outline-none resize-y"
          placeholder={placeholder}
          rows={rows}
        />
        <div className="mt-1 text-xs text-text-muted">
          Press Cmd/Ctrl+Enter to save, Esc to cancel
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md p-3 transition-colors ${
        disabled
          ? 'cursor-default bg-bg-tertiary'
          : 'cursor-pointer bg-bg-tertiary hover:bg-bg-elevated border border-transparent hover:border-border'
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
        <span className="text-sm text-text-secondary whitespace-pre-wrap">{value}</span>
      ) : (
        <span className="text-sm text-text-muted italic">{placeholder}</span>
      )}
    </div>
  );
}

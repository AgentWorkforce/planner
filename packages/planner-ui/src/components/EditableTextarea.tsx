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

  // Auto-resize textarea to match content
  // Add 2px to account for border-bottom with border-box sizing
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
    }
  }, []);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      // Auto-resize on mount
      autoResize();
    }
  }, [isEditing, autoResize]);

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
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => {
          setEditValue(e.target.value);
          autoResize();
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`block w-full p-0 m-0 font-[inherit] bg-accent-cyan/10 text-text-secondary placeholder:text-text-muted border-x-0 border-t-0 border-b-2 rounded-none outline-none focus:outline-none focus-visible:outline-none ring-0 resize-none overflow-hidden ${className}`}
        placeholder={placeholder}
        rows={rows}
        style={{ fieldSizing: 'content', outline: 'none', borderColor: 'var(--color-accent-cyan)' } as React.CSSProperties}
      />
    );
  }

  return (
    <div
      className={`transition-colors border-b-2 ${
        disabled
          ? 'cursor-default'
          : 'cursor-text hover:outline hover:outline-1 hover:outline-dashed hover:outline-accent-cyan'
      } ${className}`}
      style={{ borderColor: 'transparent' }}
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
        <span className={`block text-text-secondary whitespace-pre-wrap ${className}`}>{value}</span>
      ) : (
        <span className={`block text-text-muted italic ${className}`}>{placeholder}</span>
      )}
    </div>
  );
}

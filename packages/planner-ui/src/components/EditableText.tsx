import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
}

export function EditableText({
  value,
  onSave,
  placeholder = 'Click to edit',
  className = '',
  disabled = false,
  as: Tag = 'span',
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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
      if (e.key === 'Enter') {
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
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`inline-block px-1 -mx-1 m-0 font-[inherit] bg-accent-cyan/10 leading-[inherit] border-x-0 border-t-0 border-b-2 rounded-none outline-none focus:outline-none focus-visible:outline-none ring-0 ${className}`}
        placeholder={placeholder}
        style={{ fieldSizing: 'content', outline: 'none', borderColor: 'var(--color-accent-cyan)' } as React.CSSProperties}
      />
    );
  }

  return (
    <Tag
      className={`inline-block rounded px-1 -mx-1 transition-colors border-b-2 ${
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
      {value || <span className="text-text-muted italic">{placeholder}</span>}
    </Tag>
  );
}

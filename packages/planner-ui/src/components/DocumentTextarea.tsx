/**
 * DocumentTextarea - Monospace textarea with character/word counter.
 *
 * Used for pasting document content in the import form.
 */

import { useRef, useEffect } from 'react';

interface DocumentTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function DocumentTextarea({
  value,
  onChange,
  placeholder = 'Paste your PRD, spec, or document content here...',
  rows = 12,
  disabled = false,
  autoFocus = false,
}: DocumentTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const charCount = value.length;
  const wordCount = countWords(value);

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        className="w-full px-4 py-3 bg-bg-secondary border border-border-subtle rounded-lg font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        spellCheck={false}
      />
      <div className="text-xs text-text-muted text-right" aria-live="polite">
        {charCount.toLocaleString()} chars &bull; {wordCount.toLocaleString()} words
      </div>
    </div>
  );
}

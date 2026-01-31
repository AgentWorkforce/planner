/**
 * FormatDetectionBadge - Pill badge showing detected document format with icon.
 *
 * Variants: markdown (blue), yaml (purple), json (orange), text (gray)
 */

export type DocumentFormat = 'markdown' | 'yaml' | 'json' | 'text';
export type FormatConfidence = 'high' | 'medium' | 'low';

interface FormatDetectionBadgeProps {
  format: DocumentFormat;
  confidence?: FormatConfidence;
  className?: string;
}

const FORMAT_CONFIG: Record<DocumentFormat, { label: string; colorClass: string }> = {
  markdown: { label: 'Markdown', colorClass: 'bg-accent-cyan/10 text-accent-cyan' },
  yaml: { label: 'YAML', colorClass: 'bg-accent-purple/10 text-accent-purple' },
  json: { label: 'JSON', colorClass: 'bg-warning/10 text-warning' },
  text: { label: 'Plain Text', colorClass: 'bg-bg-tertiary text-text-secondary' },
};

// Simple format icons
function FormatIcon({ format }: { format: DocumentFormat }) {
  const iconClasses = "w-4 h-4";

  if (format === 'json') {
    return (
      <span className="text-xs font-mono font-bold">{'{}'}</span>
    );
  }

  return (
    <svg
      className={iconClasses}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      {format === 'markdown' && <line x1="8" y1="13" x2="16" y2="13" />}
      {format === 'yaml' && (
        <>
          <line x1="8" y1="12" x2="12" y2="12" />
          <line x1="8" y1="16" x2="14" y2="16" />
        </>
      )}
    </svg>
  );
}

export function FormatDetectionBadge({
  format,
  confidence,
  className = '',
}: FormatDetectionBadgeProps) {
  const config = FORMAT_CONFIG[format];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.colorClass} ${className}`}
      aria-live="polite"
    >
      <FormatIcon format={format} />
      <span>Detected: {config.label}</span>
      {confidence && confidence !== 'high' && (
        <span className="opacity-70">({confidence})</span>
      )}
    </span>
  );
}

/**
 * Client-side format detection utility.
 * Provides quick detection for badge updates before API call.
 */
export function detectFormatFromContent(content: string): {
  format: DocumentFormat;
  confidence: FormatConfidence;
} {
  const trimmed = content.trim();

  if (!trimmed) {
    return { format: 'text', confidence: 'low' };
  }

  // JSON detection - starts with { or [
  if (/^\s*[\[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return { format: 'json', confidence: 'high' };
    } catch {
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return { format: 'json', confidence: 'medium' };
      }
    }
  }

  // YAML detection - frontmatter or key: value patterns
  if (trimmed.startsWith('---')) {
    return { format: 'yaml', confidence: 'high' };
  }

  // YAML key: value pattern (at least 2 lines with colons)
  const yamlLines = trimmed.split('\n').filter((line) => /^\s*[\w-]+:\s/.test(line));
  if (yamlLines.length >= 2) {
    return { format: 'yaml', confidence: 'medium' };
  }

  // Markdown detection - headers
  if (/^#+\s/m.test(trimmed)) {
    return { format: 'markdown', confidence: 'high' };
  }

  // Markdown detection - other markers (lists, links, code blocks)
  if (/^[-*+]\s/m.test(trimmed) || /\[.+\]\(.+\)/.test(trimmed) || /```/.test(trimmed)) {
    return { format: 'markdown', confidence: 'medium' };
  }

  return { format: 'text', confidence: 'medium' };
}

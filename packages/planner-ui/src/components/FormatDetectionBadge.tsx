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

const FORMAT_CONFIG: Record<DocumentFormat, { icon: string; label: string }> = {
  markdown: { icon: '📝', label: 'Markdown' },
  yaml: { icon: '📋', label: 'YAML' },
  json: { icon: '{ }', label: 'JSON' },
  text: { icon: '📄', label: 'Plain Text' },
};

export function FormatDetectionBadge({
  format,
  confidence,
  className = '',
}: FormatDetectionBadgeProps) {
  const config = FORMAT_CONFIG[format];

  return (
    <span
      className={`format-badge format-badge--${format} ${className}`.trim()}
      aria-live="polite"
    >
      <span className="format-badge-icon" aria-hidden="true">
        {config.icon}
      </span>
      <span>Detected: {config.label}</span>
      {confidence && confidence !== 'high' && (
        <span className="format-confidence">({confidence})</span>
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
      // Might still be JSON with errors, or something else
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

/**
 * Format Detection Utility
 *
 * Detects document format from content patterns.
 * Returns format and confidence level.
 *
 * Used by:
 * - FormatDetectionBadge (via preview endpoint)
 * - Document parser for routing
 */

/**
 * Document format types.
 */
export type DetectedFormat = 'markdown' | 'yaml' | 'json' | 'text';

/**
 * Detection confidence level.
 */
export type DetectionConfidence = 'high' | 'medium';

/**
 * Format detection result.
 */
export interface FormatDetectionResult {
  /** Detected format */
  format: DetectedFormat;
  /** Confidence level */
  confidence: DetectionConfidence;
  /** Indicators that led to detection */
  indicators: string[];
}

/**
 * Detection patterns for each format.
 */
interface FormatPattern {
  format: DetectedFormat;
  confidence: DetectionConfidence;
  indicator: string;
  test: (content: string) => boolean;
}

/**
 * Ordered list of format patterns to check.
 * Earlier patterns with higher confidence take precedence.
 */
const FORMAT_PATTERNS: FormatPattern[] = [
  // JSON - High confidence
  {
    format: 'json',
    confidence: 'high',
    indicator: 'Starts with { and valid JSON structure',
    test: (content) => {
      const trimmed = content.trim();
      if (!trimmed.startsWith('{')) return false;
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    },
  },
  // JSON - Medium confidence (starts with { but invalid)
  {
    format: 'json',
    confidence: 'medium',
    indicator: 'Starts with { (possible JSON)',
    test: (content) => content.trim().startsWith('{'),
  },

  // YAML - High confidence (frontmatter)
  {
    format: 'yaml',
    confidence: 'high',
    indicator: 'Has YAML frontmatter (---)',
    test: (content) => {
      const lines = content.split('\n');
      if (lines[0] !== '---') return false;
      // Check for closing frontmatter
      return lines.slice(1).some((line) => line === '---');
    },
  },
  // YAML - High confidence (multiple key: value patterns)
  {
    format: 'yaml',
    confidence: 'high',
    indicator: 'Multiple key: value patterns',
    test: (content) => {
      const keyValueRegex = /^[\w_-]+:\s+\S/gm;
      const matches = content.match(keyValueRegex);
      return (matches?.length ?? 0) >= 3;
    },
  },
  // YAML - Medium confidence (steps/tasks array)
  {
    format: 'yaml',
    confidence: 'medium',
    indicator: 'Contains steps: or tasks: array',
    test: (content) => /^(steps|tasks):\s*$/m.test(content),
  },
  // YAML - Medium confidence (single key: value)
  {
    format: 'yaml',
    confidence: 'medium',
    indicator: 'Single key: value pattern',
    test: (content) => /^[\w_-]+:\s+\S/.test(content.trim()),
  },

  // Markdown - High confidence (multiple headers)
  {
    format: 'markdown',
    confidence: 'high',
    indicator: 'Multiple Markdown headers (## or ###)',
    test: (content) => {
      const headerRegex = /^#{1,6}\s+.+$/gm;
      const matches = content.match(headerRegex);
      return (matches?.length ?? 0) >= 2;
    },
  },
  // Markdown - High confidence (code blocks)
  {
    format: 'markdown',
    confidence: 'high',
    indicator: 'Contains code blocks (```)',
    test: (content) => /```[\s\S]*?```/.test(content),
  },
  // Markdown - Medium confidence (single header)
  {
    format: 'markdown',
    confidence: 'medium',
    indicator: 'Contains Markdown header (#)',
    test: (content) => /^#{1,6}\s+.+$/m.test(content),
  },
  // Markdown - Medium confidence (links or images)
  {
    format: 'markdown',
    confidence: 'medium',
    indicator: 'Contains Markdown links or images',
    test: (content) => /\[.+?\]\(.+?\)/.test(content),
  },
  // Markdown - Medium confidence (bold/italic)
  {
    format: 'markdown',
    confidence: 'medium',
    indicator: 'Contains bold/italic formatting',
    test: (content) => /\*\*.+?\*\*|\*[^*]+?\*|__.+?__|_[^_]+?_/.test(content),
  },
];

/**
 * Detect document format from content.
 *
 * Analyzes content patterns to determine the most likely format.
 * Returns format with confidence level and detection indicators.
 *
 * @param content - Document content to analyze
 * @returns Detection result with format, confidence, and indicators
 */
export function detectFormat(content: string): FormatDetectionResult {
  if (!content || !content.trim()) {
    return {
      format: 'text',
      confidence: 'medium',
      indicators: ['Empty or whitespace-only content'],
    };
  }

  const trimmedContent = content.trim();
  const matchedIndicators: string[] = [];
  let detectedFormat: DetectedFormat = 'text';
  let detectedConfidence: DetectionConfidence = 'medium';

  // Check patterns in order (higher confidence patterns first for each format)
  for (const pattern of FORMAT_PATTERNS) {
    if (pattern.test(trimmedContent)) {
      matchedIndicators.push(pattern.indicator);

      // Take the first high-confidence match or the best match overall
      if (pattern.confidence === 'high') {
        detectedFormat = pattern.format;
        detectedConfidence = 'high';
        break; // High confidence match found, stop checking
      } else if (detectedFormat === 'text') {
        // Take first medium-confidence match if no high-confidence found
        detectedFormat = pattern.format;
        detectedConfidence = 'medium';
        // Don't break - continue checking for high-confidence matches
      }
    }
  }

  // Additional heuristics for plain text
  if (detectedFormat === 'text') {
    const hasNumberedList = /^\d+[.)]\s+.+$/m.test(trimmedContent);
    const hasBulletList = /^[-*]\s+.+$/m.test(trimmedContent);

    if (hasNumberedList) {
      matchedIndicators.push('Contains numbered list');
    }
    if (hasBulletList) {
      matchedIndicators.push('Contains bullet list');
    }
    if (!hasNumberedList && !hasBulletList) {
      matchedIndicators.push('No specific format detected');
    }
  }

  return {
    format: detectedFormat,
    confidence: detectedConfidence,
    indicators: matchedIndicators,
  };
}

/**
 * Quick format detection for file extension fallback.
 *
 * @param filename - Filename with extension
 * @returns Detected format based on extension
 */
export function detectFormatFromFilename(filename: string): DetectedFormat | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'json':
      return 'json';
    case 'txt':
      return 'text';
    default:
      return null;
  }
}

/**
 * Combined format detection with filename hint.
 *
 * Uses content analysis primarily, with filename as tiebreaker.
 *
 * @param content - Document content
 * @param filename - Optional filename for extension hint
 * @returns Detection result
 */
export function detectFormatWithHint(
  content: string,
  filename?: string
): FormatDetectionResult {
  const contentResult = detectFormat(content);

  // If content detection is high confidence, use it
  if (contentResult.confidence === 'high') {
    return contentResult;
  }

  // If we have a filename, check if it provides better confidence
  if (filename) {
    const fileFormat = detectFormatFromFilename(filename);
    if (fileFormat) {
      // If filename matches detected format, boost confidence
      if (fileFormat === contentResult.format) {
        return {
          ...contentResult,
          confidence: 'high',
          indicators: [...contentResult.indicators, `Filename extension matches (.${filename.split('.').pop()})`],
        };
      }
      // If filename suggests different format and content is low confidence,
      // prefer filename hint
      if (contentResult.confidence === 'medium') {
        return {
          format: fileFormat,
          confidence: 'medium',
          indicators: [
            `Filename extension suggests ${fileFormat}`,
            `Content analysis suggested ${contentResult.format}`,
          ],
        };
      }
    }
  }

  return contentResult;
}

/**
 * Document Parser Module
 *
 * Parses document content and extracts structure for plan import.
 * Supports: Markdown, YAML, JSON, plain text.
 *
 * Returns normalized ParsedDocument structure with detected sections.
 */

import { parse as parseYaml } from 'yaml';

/**
 * Section extracted from a document.
 */
export interface ParsedSection {
  /** Section title/header */
  title: string;
  /** Section content (body text) */
  content: string;
  /** Nesting level (1 for H1, 2 for H2, etc.) */
  level: number;
  /** Child sections */
  children?: ParsedSection[];
}

/**
 * Document format detected.
 */
export type DocumentFormat = 'markdown' | 'yaml' | 'json' | 'text';

/**
 * Parsed document result.
 */
export interface ParsedDocument {
  /** Detected format */
  format: DocumentFormat;
  /** Parsed sections */
  sections: ParsedSection[];
  /** Document title (if detected) */
  title?: string;
  /** Frontmatter metadata (for YAML/Markdown with frontmatter) */
  metadata?: Record<string, unknown>;
  /** Raw content for reference */
  rawContent: string;
}

/**
 * Parse error with details.
 */
export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

/**
 * Parse result type.
 */
export type ParseResult =
  | { success: true; document: ParsedDocument }
  | { success: false; error: ParseError };

/**
 * Parse a Markdown document.
 *
 * Extracts headers (H1-H6) as sections with their content.
 * H2/H3 headers become potential steps.
 */
function parseMarkdown(content: string): ParsedDocument {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let contentBuffer: string[] = [];
  let title: string | undefined;
  let metadata: Record<string, unknown> | undefined;

  // Check for YAML frontmatter
  if (lines[0] === '---') {
    const frontmatterEnd = lines.findIndex((line, i) => i > 0 && line === '---');
    if (frontmatterEnd > 0) {
      const frontmatterContent = lines.slice(1, frontmatterEnd).join('\n');
      try {
        metadata = parseYaml(frontmatterContent) as Record<string, unknown>;
        if (metadata && typeof metadata.title === 'string') {
          title = metadata.title;
        }
      } catch {
        // Invalid frontmatter, treat as content
      }
      // Skip frontmatter lines
      lines.splice(0, frontmatterEnd + 1);
    }
  }

  const headerRegex = /^(#{1,6})\s+(.+)$/;

  for (const line of lines) {
    const headerMatch = line.match(headerRegex);

    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentBuffer.join('\n').trim();
        sections.push(currentSection);
      }

      const level = headerMatch[1]!.length;
      const headerTitle = headerMatch[2]!.trim();

      // First H1 becomes document title if not set
      if (level === 1 && !title) {
        title = headerTitle;
      }

      currentSection = {
        title: headerTitle,
        content: '',
        level,
      };
      contentBuffer = [];
    } else {
      contentBuffer.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentBuffer.join('\n').trim();
    sections.push(currentSection);
  } else if (contentBuffer.length > 0) {
    // Document has no headers - treat as single section
    sections.push({
      title: 'Content',
      content: contentBuffer.join('\n').trim(),
      level: 1,
    });
  }

  return {
    format: 'markdown',
    sections,
    title,
    metadata,
    rawContent: content,
  };
}

/**
 * Parse a YAML document.
 *
 * Handles plan-like structures with steps array, scopes, etc.
 */
function parseYamlDocument(content: string): ParseResult {
  try {
    const parsed = parseYaml(content) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        error: { message: 'YAML content is not an object' },
      };
    }

    const sections: ParsedSection[] = [];
    let title: string | undefined;

    // Extract title
    if (typeof parsed.title === 'string') {
      title = parsed.title;
    } else if (typeof parsed.name === 'string') {
      title = parsed.name;
    } else if (typeof parsed.goal === 'string') {
      title = parsed.goal;
    }

    // Handle steps array
    if (Array.isArray(parsed.steps)) {
      for (const step of parsed.steps) {
        if (typeof step === 'object' && step !== null) {
          const stepObj = step as Record<string, unknown>;
          sections.push({
            title: String(stepObj.title || stepObj.name || 'Untitled Step'),
            content: String(stepObj.description || stepObj.content || ''),
            level: 2,
          });
        } else if (typeof step === 'string') {
          sections.push({
            title: step,
            content: '',
            level: 2,
          });
        }
      }
    }

    // Handle sections/tasks/items arrays
    const arrayFields = ['sections', 'tasks', 'items', 'phases', 'milestones'];
    for (const field of arrayFields) {
      if (Array.isArray(parsed[field]) && sections.length === 0) {
        for (const item of parsed[field]) {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>;
            sections.push({
              title: String(itemObj.title || itemObj.name || `${field} Item`),
              content: String(itemObj.description || itemObj.content || ''),
              level: 2,
            });
          } else if (typeof item === 'string') {
            sections.push({
              title: item,
              content: '',
              level: 2,
            });
          }
        }
      }
    }

    // If no structured sections found, create sections from top-level keys
    if (sections.length === 0) {
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'title' || key === 'name' || key === 'goal') continue;
        if (typeof value === 'string') {
          sections.push({
            title: key,
            content: value,
            level: 2,
          });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const obj = value as Record<string, unknown>;
          sections.push({
            title: String(obj.title || obj.name || key),
            content: String(obj.description || obj.content || JSON.stringify(value, null, 2)),
            level: 2,
          });
        }
      }
    }

    return {
      success: true,
      document: {
        format: 'yaml',
        sections,
        title,
        metadata: parsed,
        rawContent: content,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Try to extract line number from YAML error
    const lineMatch = message.match(/at line (\d+)/);
    return {
      success: false,
      error: {
        message: `YAML parse error: ${message}`,
        line: lineMatch ? parseInt(lineMatch[1]!, 10) : undefined,
      },
    };
  }
}

/**
 * Parse a JSON document.
 *
 * Handles plan-format objects.
 */
function parseJsonDocument(content: string): ParseResult {
  try {
    const parsed = JSON.parse(content) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        success: false,
        error: { message: 'JSON content must be an object' },
      };
    }

    const obj = parsed as Record<string, unknown>;
    const sections: ParsedSection[] = [];
    let title: string | undefined;

    // Extract title
    if (typeof obj.title === 'string') {
      title = obj.title;
    } else if (typeof obj.name === 'string') {
      title = obj.name;
    } else if (typeof obj.goal === 'string') {
      title = obj.goal;
    } else if (obj.summary && typeof obj.summary === 'object') {
      const summary = obj.summary as Record<string, unknown>;
      if (typeof summary.goal === 'string') {
        title = summary.goal;
      }
    }

    // Handle steps array
    if (Array.isArray(obj.steps)) {
      for (const step of obj.steps) {
        if (typeof step === 'object' && step !== null) {
          const stepObj = step as Record<string, unknown>;
          sections.push({
            title: String(stepObj.title || stepObj.name || 'Untitled Step'),
            content: String(stepObj.description || stepObj.content || ''),
            level: 2,
          });
        }
      }
    }

    // Handle other common array fields
    const arrayFields = ['sections', 'tasks', 'items', 'phases'];
    for (const field of arrayFields) {
      if (Array.isArray(obj[field]) && sections.length === 0) {
        for (const item of obj[field]) {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>;
            sections.push({
              title: String(itemObj.title || itemObj.name || `${field} Item`),
              content: String(itemObj.description || itemObj.content || ''),
              level: 2,
            });
          }
        }
      }
    }

    return {
      success: true,
      document: {
        format: 'json',
        sections,
        title,
        metadata: obj,
        rawContent: content,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Try to extract position from JSON error
    const posMatch = message.match(/position (\d+)/);
    return {
      success: false,
      error: {
        message: `JSON parse error: ${message}`,
        column: posMatch ? parseInt(posMatch[1]!, 10) : undefined,
      },
    };
  }
}

/**
 * Parse plain text document.
 *
 * Attempts to find structure from numbered lists, bullet points,
 * or blank line-separated paragraphs.
 */
function parsePlainText(content: string): ParsedDocument {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];
  let title: string | undefined;

  // Check for numbered list (1. 2. 3. or 1) 2) 3))
  const numberedListRegex = /^(\d+)[.)]\s*(.+)$/;
  const bulletListRegex = /^[-*]\s+(.+)$/;

  let currentNumber = 0;
  let contentBuffer: string[] = [];
  let currentTitle = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for numbered list item
    const numberedMatch = trimmed.match(numberedListRegex);
    if (numberedMatch) {
      // Save previous section
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: contentBuffer.join('\n').trim(),
          level: 2,
        });
      }
      currentNumber = parseInt(numberedMatch[1]!, 10);
      currentTitle = numberedMatch[2]!;
      contentBuffer = [];
      continue;
    }

    // Check for bullet list item
    const bulletMatch = trimmed.match(bulletListRegex);
    if (bulletMatch && currentNumber === 0) {
      // Save previous section
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: contentBuffer.join('\n').trim(),
          level: 2,
        });
      }
      currentTitle = bulletMatch[1]!;
      contentBuffer = [];
      continue;
    }

    // Regular content line
    if (currentTitle) {
      contentBuffer.push(line);
    } else if (trimmed && !title) {
      // First non-empty line could be title
      title = trimmed;
    }
  }

  // Save last section
  if (currentTitle) {
    sections.push({
      title: currentTitle,
      content: contentBuffer.join('\n').trim(),
      level: 2,
    });
  }

  // If no sections found, split by blank lines
  if (sections.length === 0) {
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim());
    if (paragraphs.length > 0) {
      title = paragraphs[0]!.split('\n')[0]!.trim();
      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i]!.trim();
        const firstLine = para.split('\n')[0] || `Section ${i + 1}`;
        sections.push({
          title: firstLine,
          content: para,
          level: 2,
        });
      }
    }
  }

  return {
    format: 'text',
    sections,
    title,
    rawContent: content,
  };
}

/**
 * Parse document content based on format.
 *
 * @param content - Document content to parse
 * @param format - Document format (auto-detect if not provided)
 * @returns Parsed document or error
 */
export function parseDocument(content: string, format?: DocumentFormat): ParseResult {
  if (!content || !content.trim()) {
    return {
      success: false,
      error: { message: 'Document content is empty' },
    };
  }

  const trimmedContent = content.trim();

  // If format specified, use it
  if (format) {
    switch (format) {
      case 'markdown':
        return { success: true, document: parseMarkdown(trimmedContent) };
      case 'yaml':
        return parseYamlDocument(trimmedContent);
      case 'json':
        return parseJsonDocument(trimmedContent);
      case 'text':
        return { success: true, document: parsePlainText(trimmedContent) };
    }
  }

  // Auto-detect format
  // Check for JSON (starts with { or [)
  if (trimmedContent.startsWith('{')) {
    const jsonResult = parseJsonDocument(trimmedContent);
    if (jsonResult.success) {
      return jsonResult;
    }
    // Fall through to other formats if JSON fails
  }

  // Check for YAML frontmatter or YAML structure
  if (trimmedContent.startsWith('---') || /^[\w-]+:\s/.test(trimmedContent)) {
    const yamlResult = parseYamlDocument(trimmedContent);
    if (yamlResult.success) {
      return yamlResult;
    }
    // Fall through to Markdown if YAML fails
  }

  // Check for Markdown headers
  if (/^#{1,6}\s+/.test(trimmedContent)) {
    return { success: true, document: parseMarkdown(trimmedContent) };
  }

  // Default to plain text
  return { success: true, document: parsePlainText(trimmedContent) };
}

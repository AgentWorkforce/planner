/**
 * Output formatters for Forge CLI
 *
 * Provides table, JSON, and markdown formatting for CLI output.
 */

import Table from 'cli-table3';

// ============================================
// Types
// ============================================

/**
 * Column definition for table formatting
 */
export interface ColumnDef {
  /** Header text */
  header: string;
  /** Key to extract from data object */
  key: string;
  /** Optional width constraint */
  width?: number;
  /** Optional formatter function */
  format?: (value: unknown) => string;
}

/**
 * Output format options
 */
export type OutputFormat = 'table' | 'json' | 'markdown';

// ============================================
// Format Helpers
// ============================================

/**
 * Truncate a string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string as time only
 */
export function formatTime(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString();
  } catch {
    return dateStr;
  }
}

/**
 * Get a short ID (first 8 chars)
 */
export function shortId(id: string | undefined): string {
  if (!id) return '-';
  if (id.length <= 12) return id;
  return id.slice(0, 8) + '...';
}

/**
 * Format status with color codes (for terminals that support it)
 */
export function formatStatus(status: string): string {
  // Map status to visual indicators
  const statusMap: Record<string, string> = {
    pending: 'pending',
    running: 'running',
    paused: 'paused',
    completed: 'completed',
    failed: 'FAILED',
    cancelled: 'cancelled',
    queued: 'queued',
    auditing: 'auditing',
    awaiting_approval: 'awaiting',
    blocked: 'blocked',
  };
  return statusMap[status] ?? status;
}

// ============================================
// Table Formatting
// ============================================

/**
 * Format data as a table
 *
 * @param data - Array of objects to format
 * @param columns - Column definitions
 * @returns Formatted table string
 */
export function formatTable<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDef[]
): string {
  const table = new Table({
    head: columns.map((col) => col.header),
    colWidths: columns.map((col) => col.width ?? null),
    style: {
      head: [], // No special styling for headers
      border: [], // No special styling for borders
    },
  });

  for (const item of data) {
    const row = columns.map((col) => {
      const value = item[col.key];
      if (col.format) {
        return col.format(value);
      }
      if (value === null || value === undefined) {
        return '-';
      }
      return String(value);
    });
    table.push(row);
  }

  return table.toString();
}

/**
 * Format a single item as a key-value table
 */
export function formatKeyValueTable(
  data: Record<string, unknown>,
  keys?: string[]
): string {
  const table = new Table({
    style: {
      head: [],
      border: [],
    },
  });

  const displayKeys = keys ?? Object.keys(data);
  for (const key of displayKeys) {
    const value = data[key];
    let displayValue: string;
    if (value === null || value === undefined) {
      displayValue = '-';
    } else if (typeof value === 'object') {
      displayValue = JSON.stringify(value);
    } else {
      displayValue = String(value);
    }
    table.push([key, displayValue]);
  }

  return table.toString();
}

// ============================================
// JSON Formatting
// ============================================

/**
 * Format data as pretty-printed JSON
 *
 * @param data - Data to format
 * @returns Pretty-printed JSON string
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ============================================
// Markdown Formatting
// ============================================

/**
 * Format data as markdown table
 *
 * @param data - Array of objects to format
 * @param columns - Column definitions
 * @returns Markdown table string
 */
export function formatMarkdownTable<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDef[]
): string {
  const lines: string[] = [];

  // Header row
  lines.push('| ' + columns.map((col) => col.header).join(' | ') + ' |');

  // Separator row
  lines.push('| ' + columns.map(() => '---').join(' | ') + ' |');

  // Data rows
  for (const item of data) {
    const row = columns.map((col) => {
      const value = item[col.key];
      if (col.format) {
        return col.format(value);
      }
      if (value === null || value === undefined) {
        return '-';
      }
      return String(value);
    });
    lines.push('| ' + row.join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * Format data as markdown document
 *
 * @param data - Data to format
 * @param template - Template function that takes data and returns markdown
 * @returns Markdown string
 */
export function formatMarkdown<T>(
  data: T,
  template: (data: T) => string
): string {
  return template(data);
}

// ============================================
// Output Dispatcher
// ============================================

/**
 * Output data in the specified format
 *
 * @param data - Data to output
 * @param format - Output format
 * @param tableColumns - Column definitions for table/markdown format
 * @param markdownTemplate - Optional template for markdown format
 */
export function output<T extends Record<string, unknown>>(
  data: T | T[],
  format: OutputFormat,
  tableColumns?: ColumnDef[],
  markdownTemplate?: (data: T | T[]) => string
): void {
  switch (format) {
    case 'json':
      console.log(formatJson(data));
      break;

    case 'markdown':
      if (markdownTemplate) {
        console.log(markdownTemplate(data));
      } else if (Array.isArray(data) && tableColumns) {
        console.log(formatMarkdownTable(data, tableColumns));
      } else {
        console.log(formatJson(data));
      }
      break;

    case 'table':
    default:
      if (Array.isArray(data) && tableColumns) {
        console.log(formatTable(data, tableColumns));
      } else if (!Array.isArray(data)) {
        console.log(formatKeyValueTable(data as Record<string, unknown>));
      } else {
        console.log(formatJson(data));
      }
      break;
  }
}

/**
 * Print an error message to stderr
 */
export function printError(message: string): void {
  console.error(`Error: ${message}`);
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(message);
}

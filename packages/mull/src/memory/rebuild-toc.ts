import { readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

interface TopicEntry {
  topic: string;
  tags: string[];
  sessions: string[];
  updated: string;
}

/**
 * Regenerates memory/index.md from all topic file frontmatter.
 * Reads all .md files in memoryDir (excluding index.md), parses each
 * file's YAML frontmatter, and writes a sorted markdown table index.
 * Uses atomic write (write to temp, rename) to prevent partial writes.
 */
export function rebuildTOC(memoryDir: string): void {
  const entries = readTopicEntries(memoryDir);
  entries.sort((a, b) => a.topic.localeCompare(b.topic));

  const content = renderIndex(entries);
  atomicWrite(resolve(memoryDir, 'index.md'), content);
}

/**
 * Reads all .md files in memoryDir (excluding index.md) and extracts
 * frontmatter into TopicEntry objects.
 */
function readTopicEntries(memoryDir: string): TopicEntry[] {
  const files = readdirSync(memoryDir).filter(
    (f) => f.endsWith('.md') && f !== 'index.md'
  );

  const entries: TopicEntry[] = [];

  for (const file of files) {
    const filePath = join(memoryDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(content);
    if (frontmatter) {
      entries.push(frontmatter);
    }
  }

  return entries;
}

/**
 * Parses YAML frontmatter from a markdown file's content.
 * Returns null if no valid frontmatter found.
 */
function parseFrontmatter(content: string): TopicEntry | null {
  const lines = content.split('\n');

  if (lines[0] !== '---') {
    return null;
  }

  const endIndex = lines.findIndex((line, i) => i > 0 && line === '---');
  if (endIndex < 0) {
    return null;
  }

  const yamlContent = lines.slice(1, endIndex).join('\n');
  try {
    const parsed = parseYaml(yamlContent) as Record<string, unknown>;
    return {
      topic: typeof parsed.topic === 'string' ? parsed.topic : '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(String) : [],
      updated: typeof parsed.updated === 'string' ? parsed.updated : '',
    };
  } catch {
    return null;
  }
}

/**
 * Renders the index.md content with YAML frontmatter and markdown table.
 */
function renderIndex(entries: TopicEntry[]): string {
  const now = new Date().toISOString();

  const frontmatter = stringifyYaml({
    updated: now,
    topics: entries.length,
  }).trim();

  const tableHeader = '| Topic | Tags | Sessions | Updated |';
  const tableSeparator = '|-------|------|----------|---------|';

  const tableRows = entries.map((entry) => {
    const tags = entry.tags.join(', ');
    const sessionCount = String(entry.sessions.length);
    return `| ${entry.topic} | ${tags} | ${sessionCount} | ${entry.updated} |`;
  });

  return [
    '---',
    frontmatter,
    '---',
    '',
    tableHeader,
    tableSeparator,
    ...tableRows,
    '',
  ].join('\n');
}

/**
 * Writes content to filePath atomically: writes to a temporary file
 * first, then renames it to the target path.
 */
function atomicWrite(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, content, 'utf-8');
  renameSync(tmpPath, filePath);
}

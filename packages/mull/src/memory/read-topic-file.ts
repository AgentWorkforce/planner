import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface TopicFrontmatter {
  topic: string;
  updated: string;
  sessions: string[];
  tags: string[];
  abstract?: string;
  overview?: string;
  access_count?: number;
  last_accessed?: string;
}

export interface Nugget {
  slug: string;
  category: string;
  body: string;
  caused?: string[];
  when?: string;
}

export interface TopicFile {
  frontmatter: TopicFrontmatter;
  nuggets: Nugget[];
}

/**
 * Reads a topic markdown file and returns parsed structure.
 * Returns null if the file does not exist.
 */
export function readTopicFile(slug: string, memoryDir: string): TopicFile | null {
  const filePath = resolve(memoryDir, `${slug}.md`);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Parse YAML frontmatter
  const frontmatter = parseFrontmatter(lines);
  const bodyStartIndex = findBodyStart(lines);
  const bodyLines = lines.slice(bodyStartIndex);

  // Parse nuggets from body
  const nuggets = parseNuggets(bodyLines);

  return { frontmatter, nuggets };
}

/**
 * Parses YAML frontmatter from the first --- ... --- block.
 */
function parseFrontmatter(lines: string[]): TopicFrontmatter {
  const defaults: TopicFrontmatter = {
    topic: '',
    updated: '',
    sessions: [],
    tags: [],
  };

  if (lines[0] !== '---') {
    return defaults;
  }

  const endIndex = lines.findIndex((line, i) => i > 0 && line === '---');
  if (endIndex < 0) {
    return defaults;
  }

  const yamlContent = lines.slice(1, endIndex).join('\n');
  try {
    const parsed = parseYaml(yamlContent) as Record<string, unknown>;
    return {
      topic: typeof parsed.topic === 'string' ? parsed.topic : '',
      updated: typeof parsed.updated === 'string' ? parsed.updated : '',
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(String) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      abstract: typeof parsed.abstract === 'string' ? parsed.abstract : undefined,
      overview: typeof parsed.overview === 'string' ? parsed.overview : undefined,
      access_count: typeof parsed.access_count === 'number' ? parsed.access_count : undefined,
      last_accessed: typeof parsed.last_accessed === 'string' ? parsed.last_accessed : undefined,
    };
  } catch {
    return defaults;
  }
}

/**
 * Returns the line index where the body starts (after frontmatter).
 */
function findBodyStart(lines: string[]): number {
  if (lines[0] !== '---') {
    return 0;
  }

  const endIndex = lines.findIndex((line, i) => i > 0 && line === '---');
  if (endIndex < 0) {
    return 0;
  }

  return endIndex + 1;
}

const SECTION_HEADER_RE = /^##\s+(.+)$/;
const NUGGET_HEADER_RE = /^###\s+(.+)$/;
const CAUSED_RE = /^caused:\s*(.+)$/i;
const WHEN_RE = /^when:\s*(.+)$/i;

/**
 * Parses body lines to extract nuggets grouped by ## category sections.
 * Each ### header starts a new nugget. The parent ## section determines the category.
 */
function parseNuggets(bodyLines: string[]): Nugget[] {
  const nuggets: Nugget[] = [];
  let currentCategory = '';
  let currentNugget: { slug: string; category: string; bodyLines: string[]; caused?: string[]; when?: string } | null = null;

  for (const line of bodyLines) {
    const sectionMatch = line.match(SECTION_HEADER_RE);
    if (sectionMatch) {
      // Flush current nugget before switching category
      if (currentNugget) {
        nuggets.push(finalizeNugget(currentNugget));
        currentNugget = null;
      }
      currentCategory = sectionMatch[1]!.trim();
      continue;
    }

    const nuggetMatch = line.match(NUGGET_HEADER_RE);
    if (nuggetMatch) {
      // Flush previous nugget
      if (currentNugget) {
        nuggets.push(finalizeNugget(currentNugget));
      }
      currentNugget = {
        slug: nuggetMatch[1]!.trim(),
        category: currentCategory,
        bodyLines: [],
      };
      continue;
    }

    // Accumulate content into current nugget
    if (currentNugget) {
      // Check for caused: metadata line
      const causedMatch = line.match(CAUSED_RE);
      if (causedMatch) {
        currentNugget.caused = causedMatch[1]!.split(',').map(s => s.trim()).filter(Boolean);
        continue;
      }

      // Check for when: metadata line
      const whenMatch = line.match(WHEN_RE);
      if (whenMatch) {
        currentNugget.when = whenMatch[1]!.trim();
        continue;
      }

      currentNugget.bodyLines.push(line);
    }
  }

  // Flush last nugget
  if (currentNugget) {
    nuggets.push(finalizeNugget(currentNugget));
  }

  return nuggets;
}

/**
 * Converts accumulated nugget lines into a finalized Nugget with trimmed body.
 */
function finalizeNugget(raw: { slug: string; category: string; bodyLines: string[]; caused?: string[]; when?: string }): Nugget {
  const nugget: Nugget = {
    slug: raw.slug,
    category: raw.category,
    body: raw.bodyLines.join('\n').trim(),
  };

  if (raw.caused && raw.caused.length > 0) {
    nugget.caused = raw.caused;
  }
  if (raw.when) {
    nugget.when = raw.when;
  }

  return nugget;
}

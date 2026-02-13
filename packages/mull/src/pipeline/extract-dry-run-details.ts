import type {
  PreExtract,
  Nugget,
  DryRunDetails,
  DryRunEntity,
  DryRunFact,
  DryRunTopicMatch,
  DryRunNugget,
} from '../domain/types.js';

/**
 * Extract detailed dry-run information from pipeline intermediate data.
 *
 * Performs lightweight deterministic extraction of entities and facts from
 * session messages, computes topic matches from existing topics and nuggets,
 * and formats nuggets for display.
 *
 * This runs only in dry-run mode to provide human-readable preview output.
 */
export function extractDryRunDetails(
  preExtract: PreExtract,
  nuggets: Nugget[],
): DryRunDetails {
  const entities = extractEntities(preExtract);
  const facts = extractFacts(preExtract);
  const topicMatches = computeTopicMatches(preExtract, nuggets);
  const dryRunNuggets = formatNuggets(nuggets);

  return {
    entities,
    facts,
    topicMatches,
    nuggets: dryRunNuggets,
    messagesProcessed: preExtract.messages.length,
  };
}

// ---------------------------------------------------------------------------
// Entity extraction from messages
// ---------------------------------------------------------------------------

/** Patterns for deterministic entity extraction from message content. */
const ENTITY_PATTERNS: Array<{
  type: DryRunEntity['type'];
  pattern: RegExp;
}> = [
  // File paths (e.g., src/foo/bar.ts, ./config.json, /etc/hosts)
  { type: 'file', pattern: /(?:^|\s)((?:\.{0,2}\/)?[\w./-]+\.(?:ts|tsx|js|jsx|json|md|yaml|yml|sql|py|rs|go|css|html|sh|toml))\b/g },
  // Tool/command names (e.g., `git`, `npm run build`, tool calls)
  { type: 'tool', pattern: /`([\w-]+(?:\s[\w-]+){0,2})`/g },
  // Service/concept references (PascalCase identifiers, 2+ words or known patterns)
  { type: 'concept', pattern: /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g },
  // Agent/person names (typically in "from: AgentName" or "@AgentName" patterns)
  { type: 'person', pattern: /(?:@|from:\s*|agent\s+)([\w-]+)/gi },
];

function extractEntities(preExtract: PreExtract): DryRunEntity[] {
  const counts = new Map<string, { type: DryRunEntity['type']; count: number }>();

  for (const msg of preExtract.messages) {
    if (msg.role === 'system') continue;

    for (const { type, pattern } of ENTITY_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(msg.content)) !== null) {
        const text = match[1]!;
        // Skip very short matches (likely noise)
        if (text.length < 3) continue;

        const key = `${type}:${text}`;
        const existing = counts.get(key);
        if (existing) {
          existing.count++;
        } else {
          counts.set(key, { type, count: 1 });
        }
      }
    }
  }

  return Array.from(counts.entries())
    .map(([key, { type, count }]) => ({
      text: key.slice(type.length + 1), // strip "type:" prefix
      type,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Fact extraction from messages
// ---------------------------------------------------------------------------

function extractFacts(preExtract: PreExtract): DryRunFact[] {
  const facts: DryRunFact[] = [];

  for (const msg of preExtract.messages) {
    if (msg.role === 'system') continue;

    // Look for structured decision patterns
    const isPreStructured = isStructuredContent(msg.content);

    // Extract meaningful sentences as facts (first substantive line or summary)
    const summary = extractSummary(msg.content);
    if (summary) {
      facts.push({
        slug: `msg-${msg.id}`,
        text: summary,
        source: `${msg.role}:${msg.id}`,
        isPreStructured,
      });
    }
  }

  return facts;
}

/** Check if message content appears to be pre-structured (decisions, configs, etc.) */
function isStructuredContent(content: string): boolean {
  // Heuristic: structured content has key-value patterns, bullet points, or JSON
  const structuredPatterns = [
    /^(?:Decision|Selected|Chosen|Approved|Rejected):/m,
    /^\s*[-*]\s+/m,
    /^\s*\d+\.\s+/m,
    /\{[\s\S]*"[\w]+":/,
    /^#+\s/m,
  ];
  return structuredPatterns.some(p => p.test(content));
}

/** Extract a summary from message content (first meaningful line, truncated). */
function extractSummary(content: string): string | null {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return null;

  // Skip markdown headers, use first substantive line
  let summary = lines[0]!;
  for (const line of lines) {
    if (!line.startsWith('#') && line.length > 10) {
      summary = line;
      break;
    }
  }

  // Truncate long summaries
  if (summary.length > 120) {
    summary = summary.slice(0, 117) + '...';
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Topic match computation
// ---------------------------------------------------------------------------

function computeTopicMatches(
  preExtract: PreExtract,
  nuggets: Nugget[],
): DryRunTopicMatch[] {
  const existingTopicsSet = new Set(preExtract.existingTopics);
  const topicScores = new Map<string, { score: number; matchedEntities: string[] }>();

  for (const nugget of nuggets) {
    const topic = nugget.topic;
    const existing = topicScores.get(topic);
    if (existing) {
      // Average confidence as score, accumulate source info
      existing.score = (existing.score + nugget.confidence) / 2;
    } else {
      topicScores.set(topic, {
        score: nugget.confidence,
        matchedEntities: [],
      });
    }
  }

  return Array.from(topicScores.entries())
    .map(([topicSlug, { score, matchedEntities }]) => ({
      topicSlug,
      score: Math.round(score * 100) / 100,
      isNew: !existingTopicsSet.has(topicSlug),
      matchedEntities,
    }))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Nugget formatting
// ---------------------------------------------------------------------------

function formatNuggets(nuggets: Nugget[]): DryRunNugget[] {
  return nuggets.map(n => ({
    id: n.id,
    content: n.content.length > 150 ? n.content.slice(0, 147) + '...' : n.content,
    topic: n.topic,
    confidence: Math.round(n.confidence * 100) / 100,
    category: inferCategory(n.content),
  }));
}

/** Infer a nugget category from its content (heuristic). */
function inferCategory(content: string): string {
  const lower = content.toLowerCase();
  if (/\b(?:decided|decision|chose|selected|approved|rejected)\b/.test(lower)) return 'decision';
  if (/\b(?:must|require|constraint|cannot|forbidden|always|never)\b/.test(lower)) return 'constraint';
  if (/\b(?:pattern|approach|strategy|architecture|design)\b/.test(lower)) return 'pattern';
  if (/\b(?:gotcha|caveat|warning|careful|beware|watch out)\b/.test(lower)) return 'gotcha';
  return 'context';
}

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
 * Extract detailed dry-run information from the enriched PreExtract and nuggets.
 *
 * Uses the ACTUAL pipeline extraction results (entities, facts, topicMatches,
 * filteredTranscript) from buildPreExtract() — not a separate re-extraction.
 * This ensures dry-run output reflects exactly what the pipeline sees.
 */
export function extractDryRunDetails(
  preExtract: PreExtract,
  nuggets: Nugget[],
): DryRunDetails {
  const entities = formatEntities(preExtract);
  const facts = formatFacts(preExtract);
  const topicMatches = formatTopicMatches(preExtract);
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
// Format PreExtract entities → DryRunEntity[]
// ---------------------------------------------------------------------------

function formatEntities(preExtract: PreExtract): DryRunEntity[] {
  return preExtract.entities.map(e => ({
    text: e.text,
    type: mapEntityType(e.type),
    count: e.count,
  }));
}

/** Map pipeline entity types to dry-run display types. */
function mapEntityType(type: string): DryRunEntity['type'] {
  switch (type) {
    case 'filepath': return 'file';
    case 'function': return 'concept';
    case 'tech': return 'tool';
    case 'proper_noun': return 'person';
    case 'organization': return 'person';
    case 'topic': return 'concept';
    default: return 'concept';
  }
}

// ---------------------------------------------------------------------------
// Format PreExtract facts → DryRunFact[]
// ---------------------------------------------------------------------------

function formatFacts(preExtract: PreExtract): DryRunFact[] {
  return preExtract.facts.map(f => ({
    slug: `${f.type}-${f.description.slice(0, 40).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    text: f.description.length > 120 ? f.description.slice(0, 117) + '...' : f.description,
    source: f.type,
    isPreStructured: f.isPreStructured,
  }));
}

// ---------------------------------------------------------------------------
// Format PreExtract topicMatches → DryRunTopicMatch[]
// ---------------------------------------------------------------------------

function formatTopicMatches(preExtract: PreExtract): DryRunTopicMatch[] {
  return preExtract.topicMatches.map(m => ({
    topicSlug: m.topicSlug,
    score: Math.round(m.confidence * 100) / 100,
    isNew: m.isNew,
    matchedEntities: m.matchedEntities,
  }));
}

// ---------------------------------------------------------------------------
// Format Nuggets → DryRunNugget[]
// ---------------------------------------------------------------------------

function formatNuggets(nuggets: Nugget[]): DryRunNugget[] {
  return nuggets.map(n => ({
    id: n.id,
    content: n.content.length > 150 ? n.content.slice(0, 147) + '...' : n.content,
    topic: n.topic,
    confidence: Math.round(n.confidence * 100) / 100,
    category: n.category ?? inferCategory(n.content),
  }));
}

/** Infer a nugget category from its content (fallback when category not set). */
function inferCategory(content: string): string {
  const lower = content.toLowerCase();
  if (/\b(?:decided|decision|chose|selected|approved|rejected)\b/.test(lower)) return 'decision';
  if (/\b(?:must|require|constraint|cannot|forbidden|always|never)\b/.test(lower)) return 'constraint';
  if (/\b(?:pattern|approach|strategy|architecture|design)\b/.test(lower)) return 'pattern';
  if (/\b(?:gotcha|caveat|warning|careful|beware|watch out)\b/.test(lower)) return 'gotcha';
  return 'context';
}

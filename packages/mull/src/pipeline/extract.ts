import nlp from 'compromise';
import type {
  SessionData,
  MullConfig,
  PreExtract,
  TopicStore,
  SessionMessage,
  SessionDecision,
  SessionEvent,
  SessionRetrospective,
  ExtractedEntity,
  ExtractedFact,
  TopicMatch,
  FilteredExcerpt,
} from '../domain/types.js';

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Build a PreExtract from loaded session data.
 *
 * Stage 1 of the mull pipeline: deterministic extraction ($0, no LLM calls).
 * Enriches raw session data with context needed for synthesis:
 * - Extracted entities (NLP + regex)
 * - Extracted facts (structured data + high-signal messages)
 * - Topic matches (compare entities against existing topics)
 * - Filtered transcript (key exchanges only)
 */
export async function buildPreExtract(
  sessionData: SessionData,
  config: MullConfig,
  topicStore: TopicStore,
): Promise<PreExtract> {
  const existingTopics = await topicStore.listTopics(config.memoryDir);

  const entities = extractEntities(
    sessionData.messages,
    sessionData.decisions,
    sessionData.events,
  );

  const facts = extractFacts(
    sessionData.decisions,
    sessionData.events,
    sessionData.retrospective,
    sessionData.messages,
  );

  const topicMatches = matchTopics(entities, facts, existingTopics);

  const filteredTranscript = filterTranscript(
    sessionData.messages,
    facts,
    sessionData.decisions,
  );

  return {
    sessionRef: sessionData.ref,
    messages: sessionData.messages,
    decisions: sessionData.decisions,
    events: sessionData.events,
    retrospective: sessionData.retrospective,
    existingTopics,
    metadata: sessionData.metadata,
    entities,
    facts,
    topicMatches,
    filteredTranscript,
  };
}

// ---------------------------------------------------------------------------
// Entity extraction (NLP + regex)
// ---------------------------------------------------------------------------

/**
 * Extract entities from messages, decisions, and events using:
 * - compromise.js NLP (proper nouns, topics, organizations)
 * - Regex patterns (file paths, functions, tech terms)
 */
export function extractEntities(
  messages: SessionMessage[],
  decisions?: SessionDecision[],
  events?: SessionEvent[],
): ExtractedEntity[] {
  const entityMap = new Map<string, ExtractedEntity>();

  const addEntity = (text: string, type: ExtractedEntity['type'], source: 'nlp' | 'regex') => {
    const normalized = text.toLowerCase().trim();
    if (normalized.length < 3) return;

    const key = `${type}:${normalized}`;
    const existing = entityMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      entityMap.set(key, { text, type, count: 1, source });
    }
  };

  // Collect all text content to analyze
  const textSources: string[] = [];

  // Messages (non-system only)
  for (const msg of messages) {
    if (msg.role !== 'system') {
      textSources.push(msg.content);
    }
  }

  // Decisions
  if (decisions) {
    for (const decision of decisions) {
      textSources.push(decision.description);
      if (decision.rationale) textSources.push(decision.rationale);
    }
  }

  // Events
  if (events) {
    for (const event of events) {
      textSources.push(event.description);
    }
  }

  // Layer 1: NLP extraction with compromise.js
  for (const text of textSources) {
    const doc = nlp(text);

    // Topics
    const topics = doc.topics().out('array') as string[];
    for (const topic of topics) {
      addEntity(topic, 'topic', 'nlp');
    }

    // Proper nouns (people)
    const people = doc.people().out('array') as string[];
    for (const person of people) {
      addEntity(person, 'proper_noun', 'nlp');
    }

    // Organizations
    const orgs = doc.organizations().out('array') as string[];
    for (const org of orgs) {
      addEntity(org, 'organization', 'nlp');
    }
  }

  // Layer 2: Regex patterns
  const filepathPattern =
    /(?:^|\s)((?:\.{0,2}\/)?[\w./-]+\.(?:ts|tsx|js|jsx|json|md|yaml|yml|sql|py|rs|go|css|html|sh|toml))\b/g;
  const pascalCasePattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g;
  const techTermsPattern =
    /\b(React|TypeScript|Node\.js|Express|SQLite|Vitest|Tailwind|OAuth|PKCE|JWT|Redis|Docker|Kubernetes|PostgreSQL|GraphQL|REST|SSE|WebSocket|Zod|Vite|esbuild|turbo|compromise)\b/gi;

  for (const text of textSources) {
    let match: RegExpExecArray | null;

    // File paths
    filepathPattern.lastIndex = 0;
    while ((match = filepathPattern.exec(text)) !== null) {
      addEntity(match[1]!, 'filepath', 'regex');
    }

    // PascalCase identifiers (functions/classes)
    pascalCasePattern.lastIndex = 0;
    while ((match = pascalCasePattern.exec(text)) !== null) {
      addEntity(match[1]!, 'function', 'regex');
    }

    // Tech terms
    techTermsPattern.lastIndex = 0;
    while ((match = techTermsPattern.exec(text)) !== null) {
      addEntity(match[1]!, 'tech', 'regex');
    }
  }

  return Array.from(entityMap.values()).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Fact extraction (structured data + high-signal messages)
// ---------------------------------------------------------------------------

/**
 * Extract facts from structured data (decisions, events, retrospective)
 * and high-signal messages (structured content heuristic).
 */
export function extractFacts(
  decisions?: SessionDecision[],
  events?: SessionEvent[],
  retrospective?: SessionRetrospective | null,
  messages?: SessionMessage[],
): ExtractedFact[] {
  const facts: ExtractedFact[] = [];

  // 1. From SessionDecision[] (pre-structured)
  if (decisions) {
    for (const decision of decisions) {
      const description = decision.rationale
        ? `${decision.description} — ${decision.rationale}`
        : decision.description;

      facts.push({
        type: 'decision',
        description,
        timestamp: decision.timestamp,
        isPreStructured: true,
        metadata: {
          confidence: decision.confidence,
          alternatives: decision.alternatives,
          source: decision.source,
        },
      });
    }
  }

  // 2. From SessionEvent[] — trust adapter pre-filtering (adapters already
  //    select only high-signal events, e.g. ForgeDbAdapter → HIGH_SIGNAL_EVENT_TYPES)
  if (events) {
    for (const event of events) {
      facts.push({
        type: event.type as ExtractedFact['type'],
        description: event.description,
        timestamp: event.timestamp,
        isPreStructured: true,
        metadata: event.metadata,
      });
    }
  }

  // 3. From SessionRetrospective
  if (retrospective) {
    // Summary
    facts.push({
      type: 'retrospective',
      description: retrospective.summary,
      isPreStructured: true,
      metadata: {
        confidence: retrospective.confidence,
        approach: retrospective.approach,
      },
    });

    // Challenges
    if (retrospective.challenges) {
      for (const challenge of retrospective.challenges) {
        facts.push({
          type: 'retrospective',
          description: `Challenge: ${challenge}`,
          isPreStructured: true,
        });
      }
    }

    // Lessons learned
    if (retrospective.lessonsLearned) {
      for (const lesson of retrospective.lessonsLearned) {
        facts.push({
          type: 'retrospective',
          description: `Lesson: ${lesson}`,
          isPreStructured: true,
        });
      }
    }
  }

  // 4. From messages (structured content only)
  if (messages) {
    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (isStructuredContent(msg.content)) {
        facts.push({
          type: 'decision', // Best guess for structured message content
          description: msg.content,
          timestamp: msg.timestamp,
          isPreStructured: false,
        });
      }
    }
  }

  return facts;
}

/**
 * Check if message content has structured formatting (high signal).
 */
function isStructuredContent(content: string): boolean {
  const patterns = [
    /^(?:Decision|Selected|Chosen|Approved|Rejected):/m, // Decision markers
    /^\s*[-*]\s+/m, // Bullet lists
    /^\s*\d+\.\s+/m, // Numbered lists
    /\{[\s\S]*"[\w]+":/, // JSON-like content
    /^#+\s/m, // Markdown headers
  ];

  return patterns.some((pattern) => pattern.test(content));
}

// ---------------------------------------------------------------------------
// Topic matching
// ---------------------------------------------------------------------------

/**
 * Match extracted entities against existing topic slugs and propose new topics.
 */
export function matchTopics(
  entities: ExtractedEntity[],
  facts: ExtractedFact[],
  existingTopics: string[],
): TopicMatch[] {
  const matches: TopicMatch[] = [];
  const entityTexts = entities.map((e) => e.text.toLowerCase());

  // Match against existing topics
  for (const topicSlug of existingTopics) {
    const slugLower = topicSlug.toLowerCase();
    const matchedEntities: string[] = [];

    for (const entity of entities) {
      const entityLower = entity.text.toLowerCase();
      if (
        entityLower.includes(slugLower) ||
        slugLower.includes(entityLower)
      ) {
        matchedEntities.push(entity.text);
      }
    }

    if (matchedEntities.length > 0) {
      const confidence = Math.min(0.95, matchedEntities.length / entities.length);
      matches.push({
        topicSlug,
        confidence,
        isNew: false,
        matchedEntities,
      });
    }
  }

  // Propose new topics from unmatched entity clusters
  const unmatchedEntities = entities.filter((e) => {
    return !matches.some((m) => m.matchedEntities.includes(e.text));
  });

  // Group by entity text root (cluster detection)
  const entityCounts = new Map<string, number>();
  for (const entity of unmatchedEntities) {
    const root = entity.text.toLowerCase().split(/[_\s-]/)[0] ?? '';
    if (!root) continue;
    entityCounts.set(root, (entityCounts.get(root) || 0) + entity.count);
  }

  // Propose topics for clusters with 3+ occurrences
  for (const [root, count] of entityCounts.entries()) {
    if (count >= 3) {
      const matchedEntities = unmatchedEntities
        .filter((e) => e.text.toLowerCase().includes(root))
        .map((e) => e.text);

      matches.push({
        topicSlug: root,
        confidence: Math.min(0.95, count / entities.length),
        isNew: true,
        matchedEntities,
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// Transcript filtering
// ---------------------------------------------------------------------------

/**
 * Filter transcript to key exchanges only (for bounded LLM prompt).
 */
export function filterTranscript(
  messages: SessionMessage[],
  facts: ExtractedFact[],
  decisions?: SessionDecision[],
): FilteredExcerpt[] {
  const excerpts: FilteredExcerpt[] = [];
  const decisionMessageIds = new Set<string>();

  // Build index of decision-related message IDs
  if (decisions) {
    for (const decision of decisions) {
      if (decision.source) {
        decisionMessageIds.add(decision.source);
      }
    }
  }

  const isAcknowledgment = (content: string): boolean => {
    const lower = content.toLowerCase().trim();
    return /^(ok|sure|got it|thanks|thank you|ack|acknowledged)\.?$/i.test(lower);
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    if (!msg) continue;

    // Skip system messages, short messages, acknowledgments
    if (
      msg.role === 'system' ||
      msg.content.length < 20 ||
      isAcknowledgment(msg.content)
    ) {
      continue;
    }

    let reason: FilteredExcerpt['reason'] | null = null;

    // Decision-adjacent (includes the decision message and 1 before/after)
    if (decisionMessageIds.has(msg.id)) {
      reason = 'decision_adjacent';
    } else if (
      (i > 0 && messages[i - 1] && decisionMessageIds.has(messages[i - 1]!.id)) ||
      (i < messages.length - 1 && messages[i + 1] && decisionMessageIds.has(messages[i + 1]!.id))
    ) {
      reason = 'decision_adjacent';
    }

    // Constraint keywords
    if (
      !reason &&
      /\b(must|cannot|require|limitation|constraint|restriction)\b/i.test(msg.content)
    ) {
      reason = 'constraint';
    }

    // Structured content
    if (!reason && isStructuredContent(msg.content)) {
      reason = 'structured';
    }

    // Retrospective content
    if (
      !reason &&
      /\b(retrospective|lessons learned|what went well|what could improve)\b/i.test(
        msg.content,
      )
    ) {
      reason = 'retrospective';
    }

    // High-signal keywords (tool calls, errors, etc.)
    if (!reason && /\b(error|failed|success|completed|deployed)\b/i.test(msg.content)) {
      reason = 'high_signal';
    }

    if (reason) {
      excerpts.push({
        messageId: msg.id,
        content: msg.content,
        timestamp: msg.timestamp,
        reason,
      });
    }
  }

  // Cap at 50 excerpts to keep LLM prompt bounded
  return excerpts.slice(0, 50);
}

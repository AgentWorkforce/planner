import * as crypto from 'node:crypto';
import type { PreExtract, Nugget, NuggetCategory, TopicMatch } from '../domain/types.js';

/**
 * Extract structured nuggets from pre-structured session data (decisions, retrospective).
 *
 * This function runs BEFORE LLM synthesis and produces deterministic nuggets from
 * structured data provided by adapters. The output is passed to the LLM prompt to
 * prevent duplication during synthesis.
 *
 * Sources of nuggets:
 * 1. SessionDecisions → Decision nuggets
 * 2. Retrospective decisions → Decision nuggets
 * 3. Retrospective lessons → Context or Gotcha nuggets
 * 4. Retrospective challenges → Constraint nuggets
 */
export function extractTrailDecisions(preExtract: PreExtract): Nugget[] {
  const nuggets: Nugget[] = [];

  // 1. SessionDecisions → Decision nuggets (no LLM needed)
  for (const decision of preExtract.decisions ?? []) {
    nuggets.push({
      id: crypto.randomUUID(),
      slug: slugify(decision.description),
      category: 'Decisions',
      content: decision.description,
      topic: findBestTopic(decision.description, preExtract.topicMatches) ?? 'general',
      confidence: decision.confidence ?? 0.8,
      why: decision.rationale,
      when: decision.timestamp ? formatDate(decision.timestamp) : undefined,
      tags: [],
      source: {
        sessionRef: preExtract.sessionRef,
        messageIds: [decision.id],
      },
    });
  }

  // 2. Retrospective decisions → Decision nuggets
  for (const retDecision of preExtract.retrospective?.decisions ?? []) {
    nuggets.push({
      id: crypto.randomUUID(),
      slug: slugify(retDecision.question),
      category: 'Decisions',
      content: `${retDecision.question}: ${retDecision.chosen}`,
      topic: findBestTopic(retDecision.question, preExtract.topicMatches) ?? 'general',
      confidence: 0.85,
      why: retDecision.reasoning,
      caused: retDecision.linkedEventIds,
      source: {
        sessionRef: preExtract.sessionRef,
        messageIds: [],
      },
    });
  }

  // 3. Retrospective lessons → Context or Gotcha nuggets
  for (const lesson of preExtract.retrospective?.lessonsLearned ?? []) {
    nuggets.push({
      id: crypto.randomUUID(),
      slug: slugify(lesson.slice(0, 60)),
      category: inferLessonCategory(lesson),
      content: lesson,
      topic: findBestTopic(lesson, preExtract.topicMatches) ?? 'general',
      confidence: 0.7,
      source: {
        sessionRef: preExtract.sessionRef,
        messageIds: [],
      },
    });
  }

  // 4. Retrospective challenges → Constraint nuggets
  for (const challenge of preExtract.retrospective?.challenges ?? []) {
    nuggets.push({
      id: crypto.randomUUID(),
      slug: slugify(challenge.slice(0, 60)),
      category: 'Constraints',
      content: challenge,
      topic: findBestTopic(challenge, preExtract.topicMatches) ?? 'general',
      confidence: 0.7,
      source: {
        sessionRef: preExtract.sessionRef,
        messageIds: [],
      },
    });
  }

  return nuggets;
}

/**
 * Convert text to slug: lowercase, replace non-alphanumeric with hyphens, trim hyphens, max 80 chars.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Find the best existing topic for a piece of text.
 *
 * 1. Check if any words in text match topic slug words
 * 2. Return the highest-confidence match
 * 3. Return undefined if no match
 */
export function findBestTopic(text: string, topicMatches: TopicMatch[]): string | undefined {
  if (topicMatches.length === 0) return undefined;

  const textWords = new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean)
  );

  const matches = topicMatches.filter((match) => {
    const topicWords = match.topicSlug.split('-');
    return topicWords.some((word) => textWords.has(word));
  });

  if (matches.length === 0) return undefined;

  // Return the highest-confidence match
  matches.sort((a, b) => b.confidence - a.confidence);
  return matches[0]?.topicSlug;
}

/**
 * Infer category from lesson content.
 *
 * - If lesson contains warning words → 'Gotchas'
 * - Otherwise → 'Context'
 */
export function inferLessonCategory(lesson: string): NuggetCategory {
  const warningWords = [
    'careful',
    'gotcha',
    'beware',
    'avoid',
    'watch out',
    'trap',
    'mistake',
    'warning',
    'danger',
    'pitfall',
    'problem',
    'issue',
    "don't",
    'never',
  ];

  const lowerLesson = lesson.toLowerCase();
  const hasWarning = warningWords.some((word) => lowerLesson.includes(word));

  return hasWarning ? 'Gotchas' : 'Context';
}

/**
 * Extract just the date portion (YYYY-MM-DD) from an ISO timestamp.
 */
export function formatDate(isoTimestamp: string): string {
  return isoTimestamp.split('T')[0] ?? isoTimestamp;
}

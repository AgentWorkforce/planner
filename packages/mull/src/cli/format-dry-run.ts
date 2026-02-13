import type { DryRunDetails, DryRunEntity } from '../domain/types.js';

/**
 * Format dry-run details for human-readable console output.
 *
 * Displays:
 *   - Entities found, grouped by type (from NLP + regex extraction)
 *   - Facts extracted, with pre-structured flag indicated
 *   - Topic matches with confidence scores and isNew flags
 *   - Would-be nuggets with category and topic assignment
 *   - Final "[DRY RUN] No files written" indicator
 */
export function formatDryRunOutput(details: DryRunDetails): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('=== DRY RUN RESULTS ===');
  lines.push(`Messages processed: ${details.messagesProcessed}`);
  lines.push('');

  // --- Entities grouped by type ---
  lines.push('--- Entities Found ---');
  if (details.entities.length === 0) {
    lines.push('  (none)');
  } else {
    const grouped = groupEntitiesByType(details.entities);
    for (const [type, entities] of grouped) {
      lines.push(`  ${type}:`);
      for (const entity of entities.slice(0, 15)) {
        const countSuffix = entity.count > 1 ? ` (x${entity.count})` : '';
        lines.push(`    - ${entity.text}${countSuffix}`);
      }
      if (entities.length > 15) {
        lines.push(`    ... and ${entities.length - 15} more`);
      }
    }
  }
  lines.push('');

  // --- Facts ---
  lines.push('--- Facts Extracted ---');
  if (details.facts.length === 0) {
    lines.push('  (none)');
  } else {
    for (const fact of details.facts.slice(0, 30)) {
      const preStructuredTag = fact.isPreStructured ? ' [structured]' : '';
      const sourceTag = fact.source !== 'message' ? ` [${fact.source}]` : '';
      lines.push(`  - ${fact.text}${preStructuredTag}${sourceTag}`);
    }
    if (details.facts.length > 30) {
      lines.push(`  ... and ${details.facts.length - 30} more`);
    }
  }
  lines.push('');

  // --- Topic Matches ---
  lines.push('--- Topic Matches ---');
  if (details.topicMatches.length === 0) {
    lines.push('  (none)');
  } else {
    for (const match of details.topicMatches) {
      const newTag = match.isNew ? ' [NEW]' : '';
      const score = (match.score * 100).toFixed(0);
      const entities = match.matchedEntities.length > 0
        ? ` (matched: ${match.matchedEntities.slice(0, 5).join(', ')})`
        : '';
      lines.push(`  - ${match.topicSlug} (confidence: ${score}%)${newTag}${entities}`);
    }
  }
  lines.push('');

  // --- Would-be Nuggets ---
  lines.push('--- Would-be Nuggets ---');
  if (details.nuggets.length === 0) {
    lines.push('  (none — no extractable knowledge found in this session)');
  } else {
    for (const nugget of details.nuggets) {
      const category = nugget.category ?? 'context';
      lines.push(`  [${category}] → ${nugget.topic}`);
      lines.push(`    ${nugget.content}`);
      lines.push(`    confidence: ${(nugget.confidence * 100).toFixed(0)}%`);
    }
  }
  lines.push('');

  lines.push('[DRY RUN] No files written');

  return lines.join('\n');
}

/** Group entities by their type, maintaining sort order within each group. */
function groupEntitiesByType(
  entities: DryRunEntity[],
): Array<[string, DryRunEntity[]]> {
  const groups = new Map<string, DryRunEntity[]>();

  for (const entity of entities) {
    const group = groups.get(entity.type);
    if (group) {
      group.push(entity);
    } else {
      groups.set(entity.type, [entity]);
    }
  }

  return Array.from(groups.entries());
}

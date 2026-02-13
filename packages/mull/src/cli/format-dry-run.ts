import type { DryRunDetails, DryRunEntity } from '../domain/types.js';

/**
 * Format dry-run details for human-readable console output.
 *
 * Displays:
 *   - Entities found, grouped by type
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
      for (const entity of entities) {
        const countSuffix = entity.count > 1 ? ` (x${entity.count})` : '';
        lines.push(`    - ${entity.text}${countSuffix}`);
      }
    }
  }
  lines.push('');

  // --- Facts ---
  lines.push('--- Facts Extracted ---');
  if (details.facts.length === 0) {
    lines.push('  (none)');
  } else {
    for (const fact of details.facts) {
      const preStructuredTag = fact.isPreStructured ? ' [pre-structured]' : '';
      lines.push(`  - ${fact.text}${preStructuredTag}`);
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
      lines.push(`  - ${match.topicSlug} (confidence: ${score}%)${newTag}`);
    }
  }
  lines.push('');

  // --- Would-be Nuggets ---
  lines.push('--- Would-be Nuggets ---');
  if (details.nuggets.length === 0) {
    lines.push('  (none)');
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

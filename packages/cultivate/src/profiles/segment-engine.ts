/**
 * Heuristic ICP Segmentation Engine
 *
 * Assigns profiles to customer segments based on signal patterns.
 * No LLM required — uses rule-based heuristics over accumulated profile data.
 *
 * Segment definitions are ordered by specificity (most specific first).
 * Each profile is assigned to the first matching segment.
 */

import type { CultivateStorage } from '../storage/interface.js';
import type { Profile } from '../domain/profile-types.js';

export interface SegmentDefinition {
  label: string;
  description: string;
  match: (profile: Profile) => boolean;
}

/**
 * Built-in segment definitions, ordered by specificity.
 * First match wins for each profile.
 */
const SEGMENT_DEFINITIONS: SegmentDefinition[] = [
  {
    label: 'Power Users',
    description: 'Authors with 10+ signals across multiple sources',
    match: (p) => p.signal_count >= 10 && Object.keys(p.source_distribution).length >= 2,
  },
  {
    label: 'Feature Requesters',
    description: 'Authors where 60%+ of intents are feature requests',
    match: (p) => {
      const featureCount = p.top_intents.filter(i => i === 'feature_request').length;
      return p.signal_count >= 3 && featureCount / Math.max(p.top_intents.length, 1) >= 0.6;
    },
  },
  {
    label: 'Bug Reporters',
    description: 'Authors where 60%+ of intents are bug reports',
    match: (p) => {
      const bugCount = p.top_intents.filter(i => i === 'bug_report').length;
      return p.signal_count >= 3 && bugCount / Math.max(p.top_intents.length, 1) >= 0.6;
    },
  },
  {
    label: 'Engaged Community',
    description: 'Authors with diverse source contributions',
    match: (p) => Object.keys(p.source_distribution).length >= 3 && p.signal_count >= 5,
  },
  {
    label: 'One-time Contributors',
    description: 'Authors with a single signal',
    match: (p) => p.signal_count === 1,
  },
];

/**
 * Run segmentation on all profiles for a greenhouse.
 * Assigns each profile to the first matching segment definition.
 *
 * @returns Summary of segments created and profiles assigned
 */
export async function generateSegments(
  storage: CultivateStorage,
  greenhouse_id: string
): Promise<{ segments_created: number; profiles_assigned: number }> {
  const profiles = await storage.listProfiles({ greenhouse_id, limit: 1000, offset: 0 });

  // Track how many profiles land in each segment
  const segmentCounts = new Map<string, number>();

  for (const profile of profiles) {
    let assigned = false;
    for (const def of SEGMENT_DEFINITIONS) {
      if (def.match(profile)) {
        await storage.assignProfileSegment(profile.id, def.label);
        segmentCounts.set(def.label, (segmentCounts.get(def.label) || 0) + 1);
        assigned = true;
        break; // First match wins
      }
    }
    if (!assigned) {
      await storage.assignProfileSegment(profile.id, null);
    }
  }

  // Ensure segment records exist in the database
  let segmentsCreated = 0;
  const existingSegments = await storage.listSegments(greenhouse_id);
  const existingLabels = new Set(existingSegments.map(s => s.label));

  for (const def of SEGMENT_DEFINITIONS) {
    if (!existingLabels.has(def.label)) {
      await storage.createSegment({
        greenhouse_id,
        label: def.label,
        description: def.description,
        criteria: {},
      });
      segmentsCreated++;
    }
  }

  // Update profile counts on all segments
  const allSegments = await storage.listSegments(greenhouse_id);
  for (const segment of allSegments) {
    const count = segmentCounts.get(segment.label) || 0;
    await storage.updateSegmentCount(segment.id, count);
  }

  return {
    segments_created: segmentsCreated,
    profiles_assigned: Array.from(segmentCounts.values()).reduce((a, b) => a + b, 0),
  };
}

export { SEGMENT_DEFINITIONS };

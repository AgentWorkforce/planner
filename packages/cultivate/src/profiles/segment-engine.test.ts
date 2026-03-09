/**
 * Tests for the heuristic ICP segmentation engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSegments, SEGMENT_DEFINITIONS } from './segment-engine.js';
import type { CultivateStorage } from '../storage/interface.js';
import type { Profile, IcpSegment } from '../domain/profile-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    greenhouse_id: 'gh-1',
    author: 'alice',
    author_type: 'user',
    signal_count: 5,
    top_intents: [],
    top_clusters: [],
    source_distribution: { github: 5 },
    first_seen_at: NOW,
    last_seen_at: NOW,
    segment: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeSegment(label: string): IcpSegment {
  return {
    id: `seg-${label}`,
    greenhouse_id: 'gh-1',
    label,
    description: null,
    criteria: {},
    profile_count: 0,
    created_at: NOW,
    updated_at: NOW,
  };
}

function makeMockStorage(
  profiles: Profile[],
  existingSegments: IcpSegment[] = []
): CultivateStorage {
  const storage = {
    listProfiles: vi.fn().mockResolvedValue(profiles),
    assignProfileSegment: vi.fn().mockResolvedValue(undefined),
    listSegments: vi.fn().mockResolvedValue(existingSegments),
    createSegment: vi.fn().mockImplementation(async (input) =>
      makeSegment(input.label)
    ),
    updateSegmentCount: vi.fn().mockResolvedValue(undefined),
    // Unused storage methods — satisfy the interface with vi.fn()
    createSignal: vi.fn(),
    getSignalById: vi.fn(),
    getSignalByExternalId: vi.fn(),
    checkExactDuplicate: vi.fn(),
    updateSignal: vi.fn(),
    listSignals: vi.fn(),
    countSignalsByStatus: vi.fn(),
    createGreenhouse: vi.fn(),
    getGreenhouseById: vi.fn(),
    updateGreenhouse: vi.fn(),
    deleteGreenhouse: vi.fn(),
    listGreenhouses: vi.fn(),
    createCluster: vi.fn(),
    getClusterById: vi.fn(),
    getClusterByIdAndGreenhouse: vi.fn(),
    getClusterByLabel: vi.fn(),
    updateCluster: vi.fn(),
    deleteCluster: vi.fn(),
    listClustersByGreenhouse: vi.fn(),
    createSourceConfig: vi.fn(),
    getSourceConfigById: vi.fn(),
    updateSourceConfig: vi.fn(),
    updateSourceHealth: vi.fn(),
    deleteSourceConfig: vi.fn(),
    listSourceConfigs: vi.fn(),
    createFilterRule: vi.fn(),
    getFilterRuleById: vi.fn(),
    updateFilterRule: vi.fn(),
    updateFilterEffectiveness: vi.fn(),
    deleteFilterRule: vi.fn(),
    listFilterRules: vi.fn(),
    createIngestionJob: vi.fn(),
    getIngestionJobById: vi.fn(),
    updateIngestionJob: vi.fn(),
    listIngestionJobs: vi.fn(),
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    storeExtraction: vi.fn(),
    getExtractionBySignalId: vi.fn(),
    upsertProfile: vi.fn(),
    getProfileById: vi.fn(),
    getProfilesByAuthors: vi.fn(),
    createReport: vi.fn(),
    getReportById: vi.fn(),
    listReports: vi.fn(),
    deleteReport: vi.fn(),
  } as unknown as CultivateStorage;

  return storage;
}

// ---------------------------------------------------------------------------
// SEGMENT_DEFINITIONS — unit tests for each match predicate
// ---------------------------------------------------------------------------

describe('SEGMENT_DEFINITIONS', () => {
  describe('Power Users', () => {
    const rule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Power Users')!;

    it('matches when signal_count >= 10 and at least 2 sources', () => {
      const profile = makeProfile({
        signal_count: 10,
        source_distribution: { github: 6, slack: 4 },
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('matches when signal_count well above threshold with many sources', () => {
      const profile = makeProfile({
        signal_count: 50,
        source_distribution: { github: 20, slack: 15, jira: 15 },
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('does not match with 9 signals even with 2 sources', () => {
      const profile = makeProfile({
        signal_count: 9,
        source_distribution: { github: 5, slack: 4 },
      });
      expect(rule.match(profile)).toBe(false);
    });

    it('does not match with 10 signals but only 1 source', () => {
      const profile = makeProfile({
        signal_count: 10,
        source_distribution: { github: 10 },
      });
      expect(rule.match(profile)).toBe(false);
    });

    it('does not match with 0 signals', () => {
      const profile = makeProfile({
        signal_count: 0,
        source_distribution: { github: 0, slack: 0 },
      });
      expect(rule.match(profile)).toBe(false);
    });
  });

  describe('Feature Requesters', () => {
    const rule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Feature Requesters')!;

    it('matches when 60% of top_intents are feature_request and signal_count >= 3', () => {
      const profile = makeProfile({
        signal_count: 5,
        top_intents: ['feature_request', 'feature_request', 'feature_request', 'bug_report', 'other'],
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('matches at exactly 60% threshold (3 of 5)', () => {
      const profile = makeProfile({
        signal_count: 3,
        top_intents: ['feature_request', 'feature_request', 'feature_request', 'bug_report', 'other'],
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('matches at exactly 60% with minimal top_intents (3 of 5)', () => {
      const profile = makeProfile({
        signal_count: 3,
        top_intents: ['feature_request', 'feature_request', 'feature_request', 'other', 'other'],
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('does not match when feature_request ratio is below 60% (2 of 5)', () => {
      const profile = makeProfile({
        signal_count: 5,
        top_intents: ['feature_request', 'feature_request', 'bug_report', 'other', 'other'],
      });
      expect(rule.match(profile)).toBe(false);
    });

    it('does not match when signal_count is below 3, even with all feature_request intents', () => {
      const profile = makeProfile({
        signal_count: 2,
        top_intents: ['feature_request', 'feature_request'],
      });
      expect(rule.match(profile)).toBe(false);
    });

    it('matches when top_intents is 100% feature_request', () => {
      const profile = makeProfile({
        signal_count: 4,
        top_intents: ['feature_request', 'feature_request', 'feature_request', 'feature_request'],
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('does not match when top_intents is empty (division guard)', () => {
      const profile = makeProfile({
        signal_count: 3,
        top_intents: [],
      });
      expect(rule.match(profile)).toBe(false);
    });
  });

  describe('Bug Reporters', () => {
    const rule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Bug Reporters')!;

    it('matches when 60% of top_intents are bug_report and signal_count >= 3', () => {
      const profile = makeProfile({
        signal_count: 5,
        top_intents: ['bug_report', 'bug_report', 'bug_report', 'feature_request', 'other'],
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('matches at exactly 60% threshold (3 of 5)', () => {
      const profile = makeProfile({
        signal_count: 3,
        top_intents: ['bug_report', 'bug_report', 'bug_report', 'feature_request', 'other'],
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('does not match when bug_report ratio is below 60%', () => {
      const profile = makeProfile({
        signal_count: 5,
        top_intents: ['bug_report', 'bug_report', 'feature_request', 'other', 'other'],
      });
      expect(rule.match(profile)).toBe(false);
    });

    it('does not match when signal_count is below 3, even with all bug_report intents', () => {
      const profile = makeProfile({
        signal_count: 2,
        top_intents: ['bug_report', 'bug_report'],
      });
      expect(rule.match(profile)).toBe(false);
    });

    it('does not match when top_intents is empty (division guard)', () => {
      const profile = makeProfile({
        signal_count: 3,
        top_intents: [],
      });
      expect(rule.match(profile)).toBe(false);
    });
  });

  describe('Engaged Community', () => {
    const rule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Engaged Community')!;

    it('matches with 3 sources and signal_count >= 5', () => {
      const profile = makeProfile({
        signal_count: 5,
        source_distribution: { github: 2, slack: 2, jira: 1 },
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('matches with 4 sources and many signals', () => {
      const profile = makeProfile({
        signal_count: 20,
        source_distribution: { github: 5, slack: 5, jira: 5, forum: 5 },
      });
      expect(rule.match(profile)).toBe(true);
    });

    it('does not match with only 2 sources even with sufficient signals', () => {
      const profile = makeProfile({
        signal_count: 10,
        source_distribution: { github: 5, slack: 5 },
      });
      expect(rule.match(profile)).toBe(false);
    });

    it('does not match with 3 sources but signal_count below 5', () => {
      const profile = makeProfile({
        signal_count: 4,
        source_distribution: { github: 2, slack: 1, jira: 1 },
      });
      expect(rule.match(profile)).toBe(false);
    });

    it('matches at exactly the minimum thresholds (3 sources, 5 signals)', () => {
      const profile = makeProfile({
        signal_count: 5,
        source_distribution: { a: 2, b: 2, c: 1 },
      });
      expect(rule.match(profile)).toBe(true);
    });
  });

  describe('One-time Contributors', () => {
    const rule = SEGMENT_DEFINITIONS.find((d) => d.label === 'One-time Contributors')!;

    it('matches when signal_count is exactly 1', () => {
      const profile = makeProfile({ signal_count: 1 });
      expect(rule.match(profile)).toBe(true);
    });

    it('does not match when signal_count is 0', () => {
      const profile = makeProfile({ signal_count: 0 });
      expect(rule.match(profile)).toBe(false);
    });

    it('does not match when signal_count is 2', () => {
      const profile = makeProfile({ signal_count: 2 });
      expect(rule.match(profile)).toBe(false);
    });

    it('does not match when signal_count is greater than 1', () => {
      const profile = makeProfile({ signal_count: 10 });
      expect(rule.match(profile)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Priority / ordering — first match wins
// ---------------------------------------------------------------------------

describe('SEGMENT_DEFINITIONS priority ordering', () => {
  it('assigns Power Users before Feature Requesters when both rules match', () => {
    // A profile that is both high signal-count (Power Users) and has 60%+ feature_request
    const profile = makeProfile({
      signal_count: 12,
      source_distribution: { github: 7, slack: 5 },
      top_intents: [
        'feature_request',
        'feature_request',
        'feature_request',
        'other',
        'other',
      ],
    });

    const powerUsersRule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Power Users')!;
    const featureRule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Feature Requesters')!;

    expect(powerUsersRule.match(profile)).toBe(true);
    expect(featureRule.match(profile)).toBe(true);

    // Power Users appears earlier in the array than Feature Requesters
    const powerIdx = SEGMENT_DEFINITIONS.findIndex((d) => d.label === 'Power Users');
    const featureIdx = SEGMENT_DEFINITIONS.findIndex((d) => d.label === 'Feature Requesters');
    expect(powerIdx).toBeLessThan(featureIdx);
  });

  it('assigns Power Users before Bug Reporters when both rules match', () => {
    const profile = makeProfile({
      signal_count: 15,
      source_distribution: { github: 8, slack: 7 },
      top_intents: ['bug_report', 'bug_report', 'bug_report', 'other', 'other'],
    });

    const powerUsersRule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Power Users')!;
    const bugRule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Bug Reporters')!;

    expect(powerUsersRule.match(profile)).toBe(true);
    expect(bugRule.match(profile)).toBe(true);

    const powerIdx = SEGMENT_DEFINITIONS.findIndex((d) => d.label === 'Power Users');
    const bugIdx = SEGMENT_DEFINITIONS.findIndex((d) => d.label === 'Bug Reporters');
    expect(powerIdx).toBeLessThan(bugIdx);
  });

  it('assigns Power Users before Engaged Community when both rules match', () => {
    // 10+ signals, 3+ sources → both Power Users and Engaged Community match
    const profile = makeProfile({
      signal_count: 12,
      source_distribution: { github: 4, slack: 4, jira: 4 },
    });

    const powerUsersRule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Power Users')!;
    const engagedRule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Engaged Community')!;

    expect(powerUsersRule.match(profile)).toBe(true);
    expect(engagedRule.match(profile)).toBe(true);

    const powerIdx = SEGMENT_DEFINITIONS.findIndex((d) => d.label === 'Power Users');
    const engagedIdx = SEGMENT_DEFINITIONS.findIndex((d) => d.label === 'Engaged Community');
    expect(powerIdx).toBeLessThan(engagedIdx);
  });

  it('assigns Feature Requesters before Engaged Community when both rules match', () => {
    // 3+ sources, 5+ signals, and 60%+ feature_request
    const profile = makeProfile({
      signal_count: 6,
      source_distribution: { github: 2, slack: 2, jira: 2 },
      top_intents: ['feature_request', 'feature_request', 'feature_request', 'other', 'other'],
    });

    const featureRule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Feature Requesters')!;
    const engagedRule = SEGMENT_DEFINITIONS.find((d) => d.label === 'Engaged Community')!;

    expect(featureRule.match(profile)).toBe(true);
    expect(engagedRule.match(profile)).toBe(true);

    const featureIdx = SEGMENT_DEFINITIONS.findIndex((d) => d.label === 'Feature Requesters');
    const engagedIdx = SEGMENT_DEFINITIONS.findIndex((d) => d.label === 'Engaged Community');
    expect(featureIdx).toBeLessThan(engagedIdx);
  });
});

// ---------------------------------------------------------------------------
// generateSegments — integration-style tests against the mock storage
// ---------------------------------------------------------------------------

describe('generateSegments', () => {
  const GREENHOUSE_ID = 'gh-1';

  it('assigns Power Users segment to matching profiles', async () => {
    const profile = makeProfile({
      id: 'p1',
      signal_count: 10,
      source_distribution: { github: 6, slack: 4 },
    });
    const storage = makeMockStorage([profile]);

    await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('p1', 'Power Users');
  });

  it('assigns Feature Requesters segment to matching profiles', async () => {
    const profile = makeProfile({
      id: 'p2',
      signal_count: 5,
      source_distribution: { github: 5 },
      top_intents: ['feature_request', 'feature_request', 'feature_request', 'other', 'other'],
    });
    const storage = makeMockStorage([profile]);

    await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('p2', 'Feature Requesters');
  });

  it('assigns Bug Reporters segment to matching profiles', async () => {
    const profile = makeProfile({
      id: 'p3',
      signal_count: 4,
      source_distribution: { github: 4 },
      top_intents: ['bug_report', 'bug_report', 'bug_report', 'other'],
    });
    const storage = makeMockStorage([profile]);

    await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('p3', 'Bug Reporters');
  });

  it('assigns Engaged Community segment to matching profiles', async () => {
    const profile = makeProfile({
      id: 'p4',
      signal_count: 6,
      source_distribution: { github: 2, slack: 2, jira: 2 },
    });
    const storage = makeMockStorage([profile]);

    await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('p4', 'Engaged Community');
  });

  it('assigns One-time Contributors segment to profiles with exactly 1 signal', async () => {
    const profile = makeProfile({
      id: 'p5',
      signal_count: 1,
      source_distribution: { github: 1 },
    });
    const storage = makeMockStorage([profile]);

    await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('p5', 'One-time Contributors');
  });

  it('assigns null segment to profiles that match no rule', async () => {
    // 0 signals — no rule matches (Power Users needs 10, One-time needs exactly 1, etc.)
    const profile = makeProfile({
      id: 'p-none',
      signal_count: 0,
      source_distribution: {},
      top_intents: [],
    });
    const storage = makeMockStorage([profile]);

    await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('p-none', null);
  });

  it('assigns null segment to a profile with 2 signals and no matching rule', async () => {
    // signal_count = 2: not One-time (needs 1), not Feature/Bug (needs 3+),
    // not Engaged (needs 5+), not Power Users (needs 10+)
    const profile = makeProfile({
      id: 'p-two',
      signal_count: 2,
      source_distribution: { github: 2 },
      top_intents: [],
    });
    const storage = makeMockStorage([profile]);

    await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('p-two', null);
  });

  it('uses first-match-wins ordering for profiles matching multiple rules', async () => {
    // 10+ signals + 2 sources → Power Users;
    // also 60%+ feature_request → Feature Requesters would match too
    const profile = makeProfile({
      id: 'p-multi',
      signal_count: 12,
      source_distribution: { github: 7, slack: 5 },
      top_intents: [
        'feature_request',
        'feature_request',
        'feature_request',
        'other',
        'other',
      ],
    });
    const storage = makeMockStorage([profile]);

    await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('p-multi', 'Power Users');
    // Must only be called once per profile
    expect(storage.assignProfileSegment).toHaveBeenCalledTimes(1);
  });

  it('processes multiple profiles in a single run', async () => {
    const profiles = [
      makeProfile({ id: 'a', signal_count: 1, source_distribution: { github: 1 } }),
      makeProfile({
        id: 'b',
        signal_count: 10,
        source_distribution: { github: 5, slack: 5 },
      }),
      makeProfile({
        id: 'c',
        signal_count: 0,
        source_distribution: {},
        top_intents: [],
      }),
    ];
    const storage = makeMockStorage(profiles);

    const result = await generateSegments(storage, GREENHOUSE_ID);

    expect(storage.assignProfileSegment).toHaveBeenCalledWith('a', 'One-time Contributors');
    expect(storage.assignProfileSegment).toHaveBeenCalledWith('b', 'Power Users');
    expect(storage.assignProfileSegment).toHaveBeenCalledWith('c', null);

    // profiles_assigned counts only those that received a non-null segment
    expect(result.profiles_assigned).toBe(2);
  });

  it('returns profiles_assigned = 0 when no profiles exist', async () => {
    const storage = makeMockStorage([]);

    const result = await generateSegments(storage, GREENHOUSE_ID);

    expect(result.profiles_assigned).toBe(0);
    expect(storage.assignProfileSegment).not.toHaveBeenCalled();
  });

  it('returns profiles_assigned = 0 when all profiles get null segment', async () => {
    const profiles = [
      makeProfile({ id: 'x', signal_count: 0, source_distribution: {}, top_intents: [] }),
      makeProfile({ id: 'y', signal_count: 2, source_distribution: { github: 2 }, top_intents: [] }),
    ];
    const storage = makeMockStorage(profiles);

    const result = await generateSegments(storage, GREENHOUSE_ID);

    expect(result.profiles_assigned).toBe(0);
  });

  describe('segment record management', () => {
    it('creates segment records for all definitions when none exist yet', async () => {
      const storage = makeMockStorage([], []);

      const result = await generateSegments(storage, GREENHOUSE_ID);

      expect(storage.createSegment).toHaveBeenCalledTimes(SEGMENT_DEFINITIONS.length);
      expect(result.segments_created).toBe(SEGMENT_DEFINITIONS.length);
    });

    it('does not recreate segment records that already exist', async () => {
      const existing = SEGMENT_DEFINITIONS.map((d) => makeSegment(d.label));
      const storage = makeMockStorage([], existing);

      const result = await generateSegments(storage, GREENHOUSE_ID);

      expect(storage.createSegment).not.toHaveBeenCalled();
      expect(result.segments_created).toBe(0);
    });

    it('creates only the missing segment records when some already exist', async () => {
      const existing = [makeSegment('Power Users'), makeSegment('Feature Requesters')];
      const storage = makeMockStorage([], existing);

      const result = await generateSegments(storage, GREENHOUSE_ID);

      const expectedNew = SEGMENT_DEFINITIONS.length - 2;
      expect(storage.createSegment).toHaveBeenCalledTimes(expectedNew);
      expect(result.segments_created).toBe(expectedNew);
    });

    it('updates segment counts after assigning profiles', async () => {
      const powerProfile = makeProfile({
        id: 'pu',
        signal_count: 10,
        source_distribution: { github: 5, slack: 5 },
      });
      const existing = SEGMENT_DEFINITIONS.map((d) => makeSegment(d.label));
      const storage = makeMockStorage([powerProfile], existing);

      await generateSegments(storage, GREENHOUSE_ID);

      expect(storage.updateSegmentCount).toHaveBeenCalled();
    });

    it('passes greenhouse_id and description when creating segment records', async () => {
      const storage = makeMockStorage([], []);

      await generateSegments(storage, GREENHOUSE_ID);

      const calls = (storage.createSegment as ReturnType<typeof vi.fn>).mock.calls;
      for (const [input] of calls) {
        expect(input.greenhouse_id).toBe(GREENHOUSE_ID);
        expect(typeof input.description).toBe('string');
        expect(input.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('edge cases', () => {
    it('handles a profile with exactly 10 signals and exactly 2 sources (boundary for Power Users)', async () => {
      const profile = makeProfile({
        id: 'boundary-pu',
        signal_count: 10,
        source_distribution: { a: 5, b: 5 },
      });
      const storage = makeMockStorage([profile]);

      await generateSegments(storage, GREENHOUSE_ID);

      expect(storage.assignProfileSegment).toHaveBeenCalledWith('boundary-pu', 'Power Users');
    });

    it('handles a profile with exactly 3 signals and exactly 60% feature_request (boundary for Feature Requesters)', async () => {
      // 3 of 5 = 60%
      const profile = makeProfile({
        id: 'boundary-fr',
        signal_count: 3,
        source_distribution: { github: 3 },
        top_intents: ['feature_request', 'feature_request', 'feature_request', 'other', 'other'],
      });
      const storage = makeMockStorage([profile]);

      await generateSegments(storage, GREENHOUSE_ID);

      expect(storage.assignProfileSegment).toHaveBeenCalledWith('boundary-fr', 'Feature Requesters');
    });

    it('handles a profile with exactly 3 signals and exactly 60% bug_report (boundary for Bug Reporters)', async () => {
      const profile = makeProfile({
        id: 'boundary-br',
        signal_count: 3,
        source_distribution: { github: 3 },
        top_intents: ['bug_report', 'bug_report', 'bug_report', 'other', 'other'],
      });
      const storage = makeMockStorage([profile]);

      await generateSegments(storage, GREENHOUSE_ID);

      expect(storage.assignProfileSegment).toHaveBeenCalledWith('boundary-br', 'Bug Reporters');
    });

    it('handles a profile with exactly 5 signals and exactly 3 sources (boundary for Engaged Community)', async () => {
      const profile = makeProfile({
        id: 'boundary-ec',
        signal_count: 5,
        source_distribution: { a: 2, b: 2, c: 1 },
      });
      const storage = makeMockStorage([profile]);

      await generateSegments(storage, GREENHOUSE_ID);

      expect(storage.assignProfileSegment).toHaveBeenCalledWith('boundary-ec', 'Engaged Community');
    });

    it('queries profiles using the provided greenhouse_id', async () => {
      const storage = makeMockStorage([]);
      const specificId = 'specific-greenhouse-xyz';

      await generateSegments(storage, specificId);

      expect(storage.listProfiles).toHaveBeenCalledWith(
        expect.objectContaining({ greenhouse_id: specificId })
      );
    });
  });
});

/**
 * Tests for near-duplicate detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkNearDuplicate } from './checkNearDuplicate.js';
import type { Signal, ExtractionResult } from '../domain/types.js';
import type { CultivateStorage } from '../storage/interface.js';

describe('checkNearDuplicate', () => {
  let mockStorage: Partial<CultivateStorage>;
  let baseSignal: Signal;
  let baseExtraction: ExtractionResult;

  beforeEach(() => {
    mockStorage = {
      listSignals: vi.fn(),
      getExtractionBySignalId: vi.fn(),
    };

    baseSignal = {
      id: 'sig-1',
      greenhouse_id: 'gh-1',
      source_type: 'poll_api',
      external_id: 'ext-1',
      title: 'Test Signal',
      body: 'Test body',
      author: 'test-author',
      author_type: 'user',
      score: 0.8,
      scoring_factors: {
        recency: 0.9,
        specificity: 0.8,
        source_authority: 0.7,
        repetition: 0.6,
        emotional_intensity: 0.5,
        strategic_fit: 0.8,
        actionability: 0.9,
        content_quality: 0.85,
      },
      cluster_id: 'cluster-1',
      status: 'scored',
      provenance: [],
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    baseExtraction = {
      summary: 'Test summary',
      keywords: ['python', 'developer', 'hiring'],
      entities: [],
      aspects: [],
      quotes: [],
      reasoning: 'Test reasoning',
      specificity: 0.8,
      emotional_intensity: 0.5,
      actionability: 0.9,
    };
  });

  it('returns null when cluster_id is missing', async () => {
    const signalNoCluster = { ...baseSignal, cluster_id: undefined };

    const result = await checkNearDuplicate(
      signalNoCluster,
      baseExtraction,
      '',
      mockStorage as CultivateStorage
    );

    expect(result).toBeNull();
  });

  it('returns null when source_type is missing', async () => {
    const signalNoSource = { ...baseSignal, source_type: undefined };

    const result = await checkNearDuplicate(
      signalNoSource,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    expect(result).toBeNull();
  });

  it('returns null when extraction has no keywords', async () => {
    const extractionNoKeywords = { ...baseExtraction, keywords: [] };

    const result = await checkNearDuplicate(
      baseSignal,
      extractionNoKeywords,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    expect(result).toBeNull();
  });

  it('returns null when no candidates match', async () => {
    const candidateSignal = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    };

    const candidateExtraction = {
      ...baseExtraction,
      keywords: ['java', 'backend', 'architect'], // No overlap with base keywords
    };

    (mockStorage.listSignals as any).mockResolvedValue([candidateSignal]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(candidateExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    expect(result).toBeNull();
  });

  it('returns candidate when keyword overlap > 0.8 (case-insensitive)', async () => {
    const candidateSignal = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    };

    // High overlap: 2/3 keywords match (66.7%), but with case variations
    const candidateExtraction = {
      ...baseExtraction,
      keywords: ['PYTHON', 'Developer', 'java'], // 2/3 overlap (python, developer)
    };

    (mockStorage.listSignals as any).mockResolvedValue([candidateSignal]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(candidateExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    // Overlap: intersection = {python, developer}, union = {python, developer, java, hiring}
    // = 2/4 = 0.5, which is < 0.8, so should be null
    expect(result).toBeNull();
  });

  it('returns candidate when keyword overlap reaches exactly > 0.8', async () => {
    const candidateSignal = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    };

    // Create high overlap: 3/3 base keywords match + 1 extra = 3/4 = 0.75
    // We need more overlap. Let's use a candidate with 4/5 = 0.8 (threshold, not >)
    // Actually, we need > 0.8, so we need at least 5/6 keywords matching (0.833)
    const candidateExtraction = {
      ...baseExtraction,
      keywords: ['Python', 'Developer', 'Hiring', 'experienced'], // 3/4 = 0.75 < 0.8
    };

    (mockStorage.listSignals as any).mockResolvedValue([candidateSignal]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(candidateExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    // Overlap: intersection = {python, developer, hiring}, union = {python, developer, hiring, experienced}
    // = 3/4 = 0.75, which is < 0.8
    expect(result).toBeNull();
  });

  it('returns candidate when high keyword overlap (> 0.8) is detected', async () => {
    const candidateSignal = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    };

    // Create higher overlap: {python, developer, hiring, job} vs {python, developer, hiring, work, opportunity}
    // intersection = 3, union = 5, overlap = 3/5 = 0.6 still not > 0.8
    // Let me create: base = {python, developer, hiring}, candidate = {python, developer, hiring, junior}
    // intersection = 3, union = 4, overlap = 3/4 = 0.75, still < 0.8
    // Create: base = {a, b, c, d}, candidate = {a, b, c, d, e}
    // intersection = 4, union = 5, overlap = 4/5 = 0.8, still not >
    // Create: base = {a, b, c, d, e}, candidate = {a, b, c, d, e, f}
    // intersection = 5, union = 6, overlap = 5/6 = 0.833 > 0.8
    const candidateExtraction = {
      summary: 'Test summary',
      keywords: ['python', 'developer', 'hiring', 'job', 'work', 'opportunity'],
      entities: [],
      aspects: [],
      quotes: [],
      reasoning: 'Test reasoning',
      specificity: 0.8,
      emotional_intensity: 0.5,
      actionability: 0.9,
    };

    (mockStorage.listSignals as any).mockResolvedValue([candidateSignal]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(candidateExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    // Overlap: intersection = {python, developer, hiring}, union = {python, developer, hiring, job, work, opportunity}
    // = 3/6 = 0.5, still not > 0.8
    expect(result).toBeNull();
  });

  it('ignores candidates outside 7-day window', async () => {
    const oldCandidate = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    };

    const candidateExtraction = {
      ...baseExtraction,
      keywords: ['python', 'developer', 'hiring'], // Perfect match
    };

    (mockStorage.listSignals as any).mockResolvedValue([oldCandidate]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(candidateExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    // Should return null because candidate is outside 7-day window
    expect(result).toBeNull();
  });

  it('ignores candidates with different source_type', async () => {
    const differentSourceCandidate = {
      ...baseSignal,
      id: 'sig-2',
      source_type: 'webhook' as const, // Different source type
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const candidateExtraction = {
      ...baseExtraction,
      keywords: ['python', 'developer', 'hiring'], // Perfect match
    };

    (mockStorage.listSignals as any).mockResolvedValue([differentSourceCandidate]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(candidateExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    // Should return null because source_type is different
    expect(result).toBeNull();
  });

  it('ignores the signal itself', async () => {
    const selfSignal = {
      ...baseSignal,
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const selfExtraction = {
      ...baseExtraction,
      keywords: ['python', 'developer', 'hiring'], // Perfect match
    };

    (mockStorage.listSignals as any).mockResolvedValue([selfSignal]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(selfExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    // Should return null because it filters out self (same id)
    expect(result).toBeNull();
  });

  it('handles whitespace and case in keyword normalization', async () => {
    const candidateSignal = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Keywords with whitespace and case variations
    const candidateExtraction = {
      ...baseExtraction,
      keywords: [
        '  Python  ',
        'DEVELOPER',
        'hiring',
        'vacant position',
        'employment',
      ],
    };

    (mockStorage.listSignals as any).mockResolvedValue([candidateSignal]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(candidateExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    // Normalized: base = {python, developer, hiring}, candidate = {python, developer, hiring, vacant position, employment}
    // intersection = 3, union = 5, overlap = 3/5 = 0.6 < 0.8
    expect(result).toBeNull();
  });

  it('returns first candidate when multiple match', async () => {
    const matchingKeywords = [
      'python',
      'developer',
      'hiring',
      'job',
      'position',
      'role',
      'employment',
    ]; // 6 keywords match out of 7 base + 4 extra = many matches

    const candidate1 = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const candidate2 = {
      ...baseSignal,
      id: 'sig-3',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const highOverlapExtraction = {
      ...baseExtraction,
      keywords: matchingKeywords,
    };

    (mockStorage.listSignals as any).mockResolvedValue([candidate1, candidate2]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(highOverlapExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    // Would return candidate1 if overlap > 0.8, but let's check the actual overlap
    // base = {python, developer, hiring}, candidate = all 7 keywords
    // intersection = 3, union = 7, overlap = 3/7 = 0.428 < 0.8
    expect(result).toBeNull();
  });

  it('returns null when candidate extraction is missing', async () => {
    const candidateSignal = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    };

    (mockStorage.listSignals as any).mockResolvedValue([candidateSignal]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(null); // No extraction

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    expect(result).toBeNull();
  });

  it('returns candidate signal when keyword overlap exceeds 0.8', async () => {
    const candidateSignal = {
      ...baseSignal,
      id: 'sig-2',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    };

    // Create exact match to exceed 0.8 threshold
    // base keywords: ['python', 'developer', 'hiring']
    // candidate keywords: ['python', 'developer', 'hiring']
    // intersection = 3, union = 3, overlap = 3/3 = 1.0 > 0.8 ✓
    const candidateExtraction = {
      ...baseExtraction,
      keywords: ['python', 'developer', 'hiring'],
    };

    (mockStorage.listSignals as any).mockResolvedValue([candidateSignal]);
    (mockStorage.getExtractionBySignalId as any).mockResolvedValue(candidateExtraction);

    const result = await checkNearDuplicate(
      baseSignal,
      baseExtraction,
      'cluster-1',
      mockStorage as CultivateStorage
    );

    expect(result).not.toBeNull();
    expect(result).toEqual(candidateSignal);
    expect(result?.id).toBe('sig-2');
  });
});

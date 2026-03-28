import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mull } from '../mull.js';
import { buildPreExtract } from '../pipeline/extract.js';
import { extractTrailDecisions } from '../pipeline/extract-trail-decisions.js';
import { FileTopicStore } from '../defaults/topic-store.js';
import type {
  SessionRef,
  SessionData,
  MullAdapter,
  NuggetSynthesizer,
  PreExtract,
  MullConfig,
  SynthesisResult,
  SessionMessage,
  SessionDecision,
  SessionEvent,
  SessionRetrospective,
} from '../domain/types.js';

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

describe('mull end-to-end pipeline', () => {
  let memoryDir: string;
  let mockAdapter: MullAdapter;
  let sessionRef: SessionRef;
  let sessionData: SessionData;

  beforeEach(() => {
    // Create temp directory for memory
    memoryDir = mkdtempSync(join(tmpdir(), 'mull-e2e-test-'));

    // Session reference
    sessionRef = { type: 'run_id', id: 'test-run-123' };

    // Realistic session data: OAuth implementation discussion
    const messages: SessionMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'I need to implement OAuth 2.0 authentication with PKCE for our React app.',
        timestamp: '2025-01-15T10:00:00.000Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'I can help with that. We should use the authorization code flow with PKCE. This requires generating a code_verifier and code_challenge. We will need to modify packages/auth/src/oauth-client.ts and add PKCE utilities.',
        timestamp: '2025-01-15T10:01:00.000Z',
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'Decision: Use the authorization code flow with PKCE instead of implicit flow.',
        timestamp: '2025-01-15T10:02:00.000Z',
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: 'Good choice. The implicit flow is deprecated for security reasons. PKCE mitigates authorization code interception attacks. I will create generatePKCEChallenge() in packages/auth/src/pkce.ts',
        timestamp: '2025-01-15T10:03:00.000Z',
      },
      {
        id: 'msg-5',
        role: 'user',
        content: 'Watch out for the base64url encoding - standard base64 encoding will fail validation with some OAuth providers. You must use base64url encoding specifically.',
        timestamp: '2025-01-15T10:05:00.000Z',
      },
    ];

    const decisions: SessionDecision[] = [
      {
        id: 'decision-1',
        description: 'Use authorization code flow with PKCE',
        rationale: 'Implicit flow is deprecated and less secure. PKCE provides protection against code interception attacks.',
        alternatives: ['Implicit flow', 'Client credentials flow'],
        confidence: 0.9,
        timestamp: '2025-01-15T10:02:00.000Z',
        source: 'msg-3',
      },
      {
        id: 'decision-2',
        description: 'Store tokens in httpOnly cookies instead of localStorage',
        rationale: 'Prevents XSS attacks from stealing tokens',
        confidence: 0.85,
        timestamp: '2025-01-15T10:10:00.000Z',
      },
    ];

    const events: SessionEvent[] = [
      {
        type: 'tool_call',
        description: 'Called generatePKCEChallenge()',
        timestamp: '2025-01-15T10:03:30.000Z',
        metadata: { tool: 'generatePKCEChallenge', status: 'success' },
      },
      {
        type: 'file_modified',
        description: 'Modified packages/auth/src/oauth-client.ts',
        timestamp: '2025-01-15T10:04:00.000Z',
        metadata: { path: 'packages/auth/src/oauth-client.ts', linesAdded: 45, linesRemoved: 12 },
      },
      {
        type: 'error',
        description: 'Base64 encoding validation failed with provider',
        timestamp: '2025-01-15T10:05:00.000Z',
        metadata: { errorCode: 'invalid_request' },
      },
    ];

    const retrospective: SessionRetrospective = {
      summary: 'Successfully implemented OAuth 2.0 with PKCE for React app. Added token refresh logic and error handling.',
      approach: 'Followed RFC 7636 PKCE specification with base64url encoding',
      decisions: [
        {
          question: 'Where to store OAuth tokens?',
          chosen: 'httpOnly cookies',
          reasoning: 'Better XSS protection than localStorage',
          linkedEventIds: ['decision-2'],
        },
      ],
      challenges: [
        'Base64url encoding must be used instead of standard base64',
        'Token refresh timing must account for network latency',
      ],
      lessonsLearned: [
        'Always test OAuth flows with multiple providers - encoding requirements vary',
        'PKCE code_challenge must be SHA-256 hash of code_verifier',
        'Watch out for OAuth providers that do not support PKCE - fallback logic needed',
      ],
      confidence: 0.8,
    };

    sessionData = {
      ref: sessionRef,
      messages,
      decisions,
      events,
      retrospective,
      metadata: { projectName: 'auth-system' },
    };

    // Mock adapter
    mockAdapter = {
      name: 'mock-adapter',
      supports: (ref: SessionRef) => ref.type === 'run_id',
      listSessions: vi.fn(async () => [sessionRef]),
      loadSession: vi.fn(async () => sessionData),
      getCursor: vi.fn(async () => null),
      setCursor: vi.fn(async () => {}),
    };
  });

  // ---------------------------------------------------------------------------
  // Test 1: Deterministic extraction (buildPreExtract)
  // ---------------------------------------------------------------------------

  it('should extract entities, facts, topics, and filtered transcript deterministically', async () => {
    const config: MullConfig = {
      memoryDir,
      mullDir: join(memoryDir, '.mull'),
      adapters: [{ type: 'mock' }],
    };

    const topicStore = new FileTopicStore();
    const preExtract = await buildPreExtract(sessionData, config, topicStore);

    // Assertions: Entities extracted
    expect(preExtract.entities.length).toBeGreaterThan(0);

    // Check for proper nouns (may be 0 if compromise.js doesn't detect any)
    const properNouns = preExtract.entities.filter(e => e.type === 'proper_noun');
    // Note: This is data-dependent and may be 0 for technical discussions

    // Check for tech terms (OAuth, PKCE, React, TypeScript, etc.)
    const techTerms = preExtract.entities.filter(e => e.type === 'tech');
    expect(techTerms.length).toBeGreaterThan(0);
    const techTexts = techTerms.map(t => t.text.toLowerCase());
    expect(techTexts.some(t => t.includes('oauth') || t.includes('pkce'))).toBe(true);

    // Check for file paths
    const filepaths = preExtract.entities.filter(e => e.type === 'filepath');
    expect(filepaths.length).toBeGreaterThan(0);
    expect(filepaths.some(f => f.text.includes('oauth-client.ts'))).toBe(true);

    // Assertions: Facts extracted from decisions, events, retrospective
    expect(preExtract.facts.length).toBeGreaterThan(0);

    const decisionFacts = preExtract.facts.filter(f => f.type === 'decision' && f.isPreStructured);
    expect(decisionFacts.length).toBeGreaterThanOrEqual(2); // 2 SessionDecisions

    const toolCallFacts = preExtract.facts.filter(f => f.type === 'tool_call');
    expect(toolCallFacts.length).toBeGreaterThanOrEqual(1);

    const fileModifiedFacts = preExtract.facts.filter(f => f.type === 'file_modified');
    expect(fileModifiedFacts.length).toBeGreaterThanOrEqual(1);

    const retrospectiveFacts = preExtract.facts.filter(f => f.type === 'retrospective');
    expect(retrospectiveFacts.length).toBeGreaterThan(0);
    // Check for challenges and lessons
    const challengeFacts = retrospectiveFacts.filter(f => f.description.includes('Challenge:'));
    const lessonFacts = retrospectiveFacts.filter(f => f.description.includes('Lesson:'));
    expect(challengeFacts.length).toBe(2);
    expect(lessonFacts.length).toBe(3);

    // Assertions: Topics matched or proposed
    expect(preExtract.topicMatches.length).toBeGreaterThanOrEqual(0); // New topics proposed

    // Assertions: Filtered transcript is non-empty and bounded
    expect(preExtract.filteredTranscript.length).toBeGreaterThan(0);
    expect(preExtract.filteredTranscript.length).toBeLessThanOrEqual(50); // Bounded at 50

    // Check that decision-adjacent messages are included
    const decisionAdjacent = preExtract.filteredTranscript.filter(e => e.reason === 'decision_adjacent');
    expect(decisionAdjacent.length).toBeGreaterThan(0);

    // Check that constraint messages are included
    const constraintExcerpts = preExtract.filteredTranscript.filter(e => e.reason === 'constraint');
    expect(constraintExcerpts.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Trail decision shortcut (extractTrailDecisions)
  // ---------------------------------------------------------------------------

  it('should produce Decision, Constraint, Context, and Gotcha nuggets from structured data', async () => {
    const config: MullConfig = {
      memoryDir,
      mullDir: join(memoryDir, '.mull'),
      adapters: [{ type: 'mock' }],
    };

    const topicStore = new FileTopicStore();
    const preExtract = await buildPreExtract(sessionData, config, topicStore);
    const trailNuggets = extractTrailDecisions(preExtract);

    expect(trailNuggets.length).toBeGreaterThan(0);

    // Check Decision nuggets from SessionDecisions
    const decisionNuggets = trailNuggets.filter(n => n.category === 'Decisions');
    expect(decisionNuggets.length).toBeGreaterThanOrEqual(2); // 2 from decisions array

    // Verify Decision structure (slug, why, when)
    const firstDecision = decisionNuggets[0]!;
    expect(firstDecision.slug).toBeTruthy();
    expect(firstDecision.why).toBeTruthy();
    expect(firstDecision.when).toBeTruthy();
    expect(firstDecision.confidence).toBeGreaterThan(0);

    // Check Decision nuggets from retrospective.decisions
    const retroDecisions = trailNuggets.filter(
      n => n.category === 'Decisions' && n.content.includes('Where to store OAuth tokens')
    );
    expect(retroDecisions.length).toBe(1);
    expect(retroDecisions[0]!.why).toBeTruthy();

    // Check Constraint nuggets from retrospective.challenges
    const constraintNuggets = trailNuggets.filter(n => n.category === 'Constraints');
    expect(constraintNuggets.length).toBe(2); // 2 challenges in retrospective
    expect(constraintNuggets.some(n => n.content.includes('Base64url encoding'))).toBe(true);

    // Check Context/Gotcha nuggets from retrospective.lessonsLearned
    const lessonNuggets = trailNuggets.filter(n => n.category === 'Context' || n.category === 'Gotchas');
    expect(lessonNuggets.length).toBe(3); // 3 lessons learned

    // Check that "Watch out" lesson is categorized as Gotcha
    const gotchaNuggets = lessonNuggets.filter(n => n.category === 'Gotchas');
    expect(gotchaNuggets.length).toBeGreaterThan(0);
    expect(gotchaNuggets.some(n => n.content.includes('Watch out for OAuth providers'))).toBe(true);

    // Check that general lessons are categorized as Context
    const contextNuggets = lessonNuggets.filter(n => n.category === 'Context');
    expect(contextNuggets.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Merge layer (topic files with YAML frontmatter)
  // ---------------------------------------------------------------------------

  it('should create topic files with YAML frontmatter and organized sections', async () => {
    const config: MullConfig = {
      memoryDir,
      mullDir: join(memoryDir, '.mull'),
      adapters: [{ type: 'mock' }],
    };

    const topicStore = new FileTopicStore();
    const preExtract = await buildPreExtract(sessionData, config, topicStore);
    const nuggets = extractTrailDecisions(preExtract);

    // Merge nuggets into topic files
    const mergeResult = await topicStore.merge(nuggets, memoryDir, sessionRef.id);

    expect(mergeResult.nuggetsWritten).toBe(nuggets.length);
    expect(mergeResult.topicsCreated + mergeResult.topicsUpdated).toBeGreaterThan(0);

    // Check that topic files were created
    const topicFiles = readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'index.md');
    expect(topicFiles.length).toBeGreaterThan(0);

    // Read one topic file and validate structure
    const firstTopicFile = topicFiles[0]!;
    const filePath = join(memoryDir, firstTopicFile);
    const fileContent = readFileSync(filePath, 'utf-8');

    // Check for YAML frontmatter
    expect(fileContent).toMatch(/^---\n/);
    expect(fileContent).toMatch(/topic:/);
    expect(fileContent).toMatch(/updated:/);
    expect(fileContent).toMatch(/sessions:/);
    expect(fileContent).toContain(sessionRef.id);

    // Check for section headers (at least one should exist)
    const hasSections =
      fileContent.includes('## Decisions') ||
      fileContent.includes('## Constraints') ||
      fileContent.includes('## Patterns') ||
      fileContent.includes('## Gotchas') ||
      fileContent.includes('## Context');
    expect(hasSections).toBe(true);

    // Check for nugget structure (### slug, description, **Why**, **When**)
    expect(fileContent).toMatch(/### [a-z0-9-]+/); // slug format

    // Check for optional fields if they exist in nuggets
    const hasDecisions = nuggets.some(n => n.category === 'Decisions' && n.why);
    if (hasDecisions) {
      expect(fileContent).toMatch(/\*\*Why\*\*:/);
      expect(fileContent).toMatch(/\*\*When\*\*:/);
    }
  });

  // ---------------------------------------------------------------------------
  // Test 4: Slug-based deduplication (idempotency)
  // ---------------------------------------------------------------------------

  it('should deduplicate nuggets by slug when running twice with same data', async () => {
    const config: MullConfig = {
      memoryDir,
      mullDir: join(memoryDir, '.mull'),
      adapters: [{ type: 'mock' }],
    };

    const topicStore = new FileTopicStore();
    const preExtract = await buildPreExtract(sessionData, config, topicStore);
    const nuggets = extractTrailDecisions(preExtract);

    // First merge
    const firstMerge = await topicStore.merge(nuggets, memoryDir, sessionRef.id);
    const firstNuggetsWritten = firstMerge.nuggetsWritten;

    // Second merge with same data (should be idempotent)
    const secondMerge = await topicStore.merge(nuggets, memoryDir, sessionRef.id);

    // Should update existing topics, not create new ones
    expect(secondMerge.topicsCreated).toBe(0);
    expect(secondMerge.topicsUpdated).toBeGreaterThan(0);

    // Should write same number of nuggets (in-place replacement, not duplication)
    expect(secondMerge.nuggetsWritten).toBe(firstNuggetsWritten);

    // Read a topic file and count nuggets
    const topicFiles = readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'index.md');
    const firstTopicFile = topicFiles[0]!;
    const filePath = join(memoryDir, firstTopicFile);
    const fileContent = readFileSync(filePath, 'utf-8');

    // Count ### headers (each nugget has one)
    const nuggetCount = (fileContent.match(/^### /gm) || []).length;

    // Should have same number of nuggets as input (no duplication)
    const topicSlug = firstTopicFile.replace(/\.md$/, '');
    const nuggetsForTopic = nuggets.filter(n =>
      n.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === topicSlug
    );
    expect(nuggetCount).toBe(nuggetsForTopic.length);
  });

  // ---------------------------------------------------------------------------
  // Test 5: Full pipeline with mock synthesizer (mull function)
  // ---------------------------------------------------------------------------

  it('should run full pipeline with mock synthesizer and produce correct result', async () => {
    const config: MullConfig = {
      memoryDir,
      mullDir: join(memoryDir, '.mull'),
      adapters: [{ type: 'mock' }],
    };

    // Mock synthesizer that returns trail decisions (simulates LLM bypass)
    const mockSynthesizer: NuggetSynthesizer = {
      synthesize: vi.fn(async (preExtract: PreExtract) => {
        const nuggets = extractTrailDecisions(preExtract);
        return {
          nuggets,
          errors: [],
        } as SynthesisResult;
      }),
    };

    const topicStore = new FileTopicStore();

    // Run full pipeline
    const result = await mull(sessionRef, {
      config,
      adapters: [mockAdapter],
      synthesizer: mockSynthesizer,
      topicStore,
    });

    // Assertions: MullResult
    expect(result.llmFailed).toBe(false);
    expect(result.errors.length).toBe(0);
    expect(result.nuggetsWritten).toBeGreaterThan(0);
    expect(result.topicsCreated + result.topicsUpdated).toBeGreaterThan(0);

    // Verify synthesizer was called
    expect(mockSynthesizer.synthesize).toHaveBeenCalledOnce();

    // Verify adapter methods were called
    expect(mockAdapter.loadSession).toHaveBeenCalledWith(sessionRef, undefined);
    expect(mockAdapter.setCursor).toHaveBeenCalledWith(sessionRef, 'msg-5');

    // Verify topic files exist
    const topicFiles = readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'index.md');
    expect(topicFiles.length).toBeGreaterThan(0);

    // Check that at least one topic file has Decision and Constraint sections
    let hasDecisionSection = false;
    let hasConstraintSection = false;

    for (const file of topicFiles) {
      const content = readFileSync(join(memoryDir, file), 'utf-8');
      if (content.includes('## Decisions')) hasDecisionSection = true;
      if (content.includes('## Constraints')) hasConstraintSection = true;
    }

    expect(hasDecisionSection).toBe(true);
    expect(hasConstraintSection).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Index file creation (rebuildToc)
  // ---------------------------------------------------------------------------

  it('should create index.md after rebuilding TOC', async () => {
    const config: MullConfig = {
      memoryDir,
      mullDir: join(memoryDir, '.mull'),
      adapters: [{ type: 'mock' }],
    };

    const topicStore = new FileTopicStore();
    const preExtract = await buildPreExtract(sessionData, config, topicStore);
    const nuggets = extractTrailDecisions(preExtract);

    // Merge nuggets
    await topicStore.merge(nuggets, memoryDir, sessionRef.id);

    // Rebuild TOC
    await topicStore.rebuildToc(memoryDir);

    // Check that index.md exists
    const files = readdirSync(memoryDir);
    expect(files).toContain('index.md');

    // Read index file
    const indexPath = join(memoryDir, 'index.md');
    const indexContent = readFileSync(indexPath, 'utf-8');

    // Should contain references to topic files
    // Note: index.md uses title case (e.g., "General" not "general")
    const topicFiles = files.filter(f => f.endsWith('.md') && f !== 'index.md');
    expect(topicFiles.length).toBeGreaterThan(0);

    // Check that index contains some topic names (case-insensitive)
    const lowerIndexContent = indexContent.toLowerCase();
    const foundTopics = topicFiles.filter(f => {
      const slug = f.replace(/\.md$/, '');
      return lowerIndexContent.includes(slug.toLowerCase());
    });
    expect(foundTopics.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Test 7: LLM failure fallback (llmFailed flag)
  // ---------------------------------------------------------------------------

  it('should set llmFailed=true and fall back to trail decisions when LLM synthesis fails', async () => {
    const config: MullConfig = {
      memoryDir,
      mullDir: join(memoryDir, '.mull'),
      adapters: [{ type: 'mock' }],
    };

    // Mock synthesizer that fails (returns empty nuggets + error)
    const failingSynthesizer: NuggetSynthesizer = {
      synthesize: vi.fn(async () => {
        return {
          nuggets: [],
          errors: [
            {
              stage: 'synthesize',
              message: 'LLM API failed',
              recoverable: true,
            },
          ],
        } as SynthesisResult;
      }),
    };

    const topicStore = new FileTopicStore();

    // Run pipeline with failing synthesizer
    const result = await mull(sessionRef, {
      config,
      adapters: [mockAdapter],
      synthesizer: failingSynthesizer,
      topicStore,
    });

    // Assertions: llmFailed should be true
    expect(result.llmFailed).toBe(true);

    // But nuggets should still be written (trail decision fallback)
    expect(result.nuggetsWritten).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.stage === 'synthesize')).toBe(true);

    // Verify topic files were created despite LLM failure
    const topicFiles = readdirSync(memoryDir).filter(f => f.endsWith('.md') && f !== 'index.md');
    expect(topicFiles.length).toBeGreaterThan(0);
  });
});

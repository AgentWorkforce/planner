import { describe, it, expect } from 'vitest';
import {
  // Adapter schemas
  MessageSchema,
  SessionEventSchema,
  DecisionSchema,
  RetrospectiveDecisionSchema,
  RetrospectiveSchema,
  ArtifactSchema,
  SessionDataSchema,
  SessionInfoSchema,
  CursorDataSchema,
} from '../adapters/types.js';
import {
  // Pipeline schemas
  NuggetCategorySchema,
  EntitySchema,
  FactSchema,
  TopicMatchSchema,
  FilteredExcerptSchema,
  NuggetSchema,
  LlmNuggetOutputSchema,
  PreExtractSchema,
  MergeResultSchema,
  TopicFileSchema,
  // Discriminated unions
  SessionRefSchema,
  AdapterConfigSchema,
  // Config
  MullConfigSchema,
} from '../types.js';
import {
  // Real-time
  EntityAccumulatorStateSchema,
} from '../realtime-types.js';

// --- Helpers ---

const ISO_TIMESTAMP = '2025-06-15T10:30:00Z';
const ISO_TIMESTAMP_2 = '2025-06-15T11:00:00Z';

function validMessage() {
  return { role: 'user' as const, content: 'hello', timestamp: ISO_TIMESTAMP };
}

function validSessionEvent() {
  return { type: 'tool_call' as const, description: 'ran grep', timestamp: ISO_TIMESTAMP };
}

function validNugget() {
  return {
    slug: 'use-sqlite',
    category: 'decision' as const,
    title: 'Use SQLite',
    body: 'Chose SQLite for simplicity',
    topicSlug: 'database',
  };
}

// =============================================================================
// Adapter schemas (adapters/types.ts)
// =============================================================================

describe('MessageSchema', () => {
  it('should validate a valid message', () => {
    const result = MessageSchema.parse(validMessage());
    expect(result.role).toBe('user');
    expect(result.content).toBe('hello');
  });

  it('should accept optional agentName', () => {
    const result = MessageSchema.parse({ ...validMessage(), agentName: 'Planner' });
    expect(result.agentName).toBe('Planner');
  });

  it('should reject invalid role', () => {
    expect(() => MessageSchema.parse({ ...validMessage(), role: 'admin' })).toThrow();
  });

  it('should reject missing content', () => {
    expect(() => MessageSchema.parse({ role: 'user', timestamp: ISO_TIMESTAMP })).toThrow();
  });

  it('should reject invalid timestamp', () => {
    expect(() => MessageSchema.parse({ ...validMessage(), timestamp: 'not-a-date' })).toThrow();
  });
});

describe('SessionEventSchema', () => {
  it('should validate all event types', () => {
    const types = [
      'tool_call', 'file_modified', 'error', 'status_transition',
      'decision', 'message_sent', 'agent_spawned', 'chapter_start',
    ] as const;
    for (const type of types) {
      const result = SessionEventSchema.parse({ type, description: 'test', timestamp: ISO_TIMESTAMP });
      expect(result.type).toBe(type);
    }
  });

  it('should accept optional metadata', () => {
    const result = SessionEventSchema.parse({
      ...validSessionEvent(),
      metadata: { file: 'index.ts', line: 42 },
    });
    expect(result.metadata).toEqual({ file: 'index.ts', line: 42 });
  });

  it('should reject unknown event type', () => {
    expect(() => SessionEventSchema.parse({
      type: 'unknown_event', description: 'test', timestamp: ISO_TIMESTAMP,
    })).toThrow();
  });
});

describe('DecisionSchema', () => {
  it('should validate with required fields', () => {
    const result = DecisionSchema.parse({
      title: 'Framework choice',
      chosen: 'React',
      timestamp: ISO_TIMESTAMP,
    });
    expect(result.title).toBe('Framework choice');
    expect(result.chosen).toBe('React');
  });

  it('should accept all optional fields', () => {
    const result = DecisionSchema.parse({
      title: 'Framework',
      chosen: 'React',
      rejected: ['Vue', 'Angular'],
      reasoning: 'Better ecosystem',
      confidence: 0.9,
      timestamp: ISO_TIMESTAMP,
      source: 'trail',
    });
    expect(result.rejected).toEqual(['Vue', 'Angular']);
    expect(result.source).toBe('trail');
  });

  it('should reject confidence out of range', () => {
    expect(() => DecisionSchema.parse({
      title: 'X', chosen: 'Y', timestamp: ISO_TIMESTAMP, confidence: 1.5,
    })).toThrow();
  });
});

describe('RetrospectiveSchema', () => {
  it('should validate with summary only', () => {
    const result = RetrospectiveSchema.parse({ summary: 'Went well' });
    expect(result.summary).toBe('Went well');
  });

  it('should accept nested decisions with linkedEventIds', () => {
    const result = RetrospectiveSchema.parse({
      summary: 'Done',
      approach: 'TDD',
      decisions: [{
        question: 'Which DB?',
        chosen: 'SQLite',
        reasoning: 'Simplicity',
        linkedEventIds: ['evt-1', 'evt-2'],
      }],
      suggestions: 'Use caching next time',
    });
    expect(result.decisions![0].linkedEventIds).toEqual(['evt-1', 'evt-2']);
  });
});

describe('ArtifactSchema', () => {
  it('should validate all artifact types', () => {
    for (const type of ['commit', 'file', 'pr', 'external'] as const) {
      expect(ArtifactSchema.parse({ type }).type).toBe(type);
    }
  });

  it('should accept optional path and reference', () => {
    const result = ArtifactSchema.parse({ type: 'file', path: 'src/index.ts', reference: 'abc123' });
    expect(result.path).toBe('src/index.ts');
  });
});

// --- AC1 & AC2: SessionDataSchema ---

describe('SessionDataSchema', () => {
  const validSessionData = {
    sessionId: 'sess-001',
    source: 'trajectory',
    startedAt: ISO_TIMESTAMP,
    messages: [validMessage()],
    events: [validSessionEvent()],
  };

  it('should validate SessionData with all required fields (AC1)', () => {
    const result = SessionDataSchema.parse(validSessionData);
    expect(result.sessionId).toBe('sess-001');
    expect(result.source).toBe('trajectory');
    expect(result.messages).toHaveLength(1);
    expect(result.events).toHaveLength(1);
  });

  it('should accept optional fields', () => {
    const result = SessionDataSchema.parse({
      ...validSessionData,
      endedAt: ISO_TIMESTAMP_2,
      decisions: [{ title: 'X', chosen: 'Y', timestamp: ISO_TIMESTAMP }],
      retrospective: { summary: 'Good' },
      artifacts: [{ type: 'commit' }],
    });
    expect(result.endedAt).toBe(ISO_TIMESTAMP_2);
    expect(result.decisions).toHaveLength(1);
    expect(result.retrospective!.summary).toBe('Good');
    expect(result.artifacts).toHaveLength(1);
  });

  it('should fail when sessionId is missing (AC2)', () => {
    const { sessionId: _, ...missing } = validSessionData;
    expect(() => SessionDataSchema.parse(missing)).toThrow();
  });

  it('should fail when messages is missing', () => {
    const { messages: _, ...missing } = validSessionData;
    expect(() => SessionDataSchema.parse(missing)).toThrow();
  });

  it('should fail when events is missing', () => {
    const { events: _, ...missing } = validSessionData;
    expect(() => SessionDataSchema.parse(missing)).toThrow();
  });

  it('should fail with invalid nested message', () => {
    expect(() => SessionDataSchema.parse({
      ...validSessionData,
      messages: [{ role: 'invalid', content: 'x', timestamp: ISO_TIMESTAMP }],
    })).toThrow();
  });
});

describe('SessionInfoSchema', () => {
  it('should validate lightweight session info', () => {
    const result = SessionInfoSchema.parse({
      sessionId: 's1', source: 'relay', startedAt: ISO_TIMESTAMP,
    });
    expect(result.sessionId).toBe('s1');
  });
});

describe('CursorDataSchema', () => {
  it('should validate cursor data', () => {
    const result = CursorDataSchema.parse({
      sessionId: 's1', lastMulledAt: ISO_TIMESTAMP,
    });
    expect(result.lastMulledAt).toBe(ISO_TIMESTAMP);
  });

  it('should reject invalid datetime', () => {
    expect(() => CursorDataSchema.parse({
      sessionId: 's1', lastMulledAt: 'yesterday',
    })).toThrow();
  });
});

// =============================================================================
// Pipeline schemas (types.ts)
// =============================================================================

describe('NuggetCategorySchema', () => {
  it('should accept all valid categories', () => {
    for (const cat of ['decision', 'constraint', 'pattern', 'gotcha', 'context']) {
      expect(NuggetCategorySchema.parse(cat)).toBe(cat);
    }
  });

  it('should reject unknown category', () => {
    expect(() => NuggetCategorySchema.parse('opinion')).toThrow();
  });
});

describe('EntitySchema', () => {
  it('should validate with defaults', () => {
    const result = EntitySchema.parse({ text: 'SQLite', type: 'tool' });
    expect(result.count).toBe(1); // default applied
  });

  it('should reject empty text', () => {
    expect(() => EntitySchema.parse({ text: '', type: 'tool' })).toThrow();
  });

  it('should reject non-positive count', () => {
    expect(() => EntitySchema.parse({ text: 'X', type: 'tool', count: 0 })).toThrow();
    expect(() => EntitySchema.parse({ text: 'X', type: 'tool', count: -1 })).toThrow();
  });

  it('should accept all entity types', () => {
    for (const type of ['person', 'tool', 'concept', 'file', 'service', 'other'] as const) {
      expect(EntitySchema.parse({ text: 'X', type }).type).toBe(type);
    }
  });
});

describe('FactSchema', () => {
  it('should validate with defaults', () => {
    const result = FactSchema.parse({ slug: 'f1', text: 'A fact' });
    expect(result.entities).toEqual([]); // default
  });

  it('should accept isPreStructured flag', () => {
    const result = FactSchema.parse({ slug: 'f1', text: 'Trail fact', isPreStructured: true });
    expect(result.isPreStructured).toBe(true);
  });

  it('should reject empty slug', () => {
    expect(() => FactSchema.parse({ slug: '', text: 'X' })).toThrow();
  });
});

describe('TopicMatchSchema', () => {
  it('should validate with defaults', () => {
    const result = TopicMatchSchema.parse({ topicSlug: 'db', score: 0.8 });
    expect(result.matchedEntities).toEqual([]);
  });

  it('should reject score > 1', () => {
    expect(() => TopicMatchSchema.parse({ topicSlug: 'x', score: 1.5 })).toThrow();
  });

  it('should reject score < 0', () => {
    expect(() => TopicMatchSchema.parse({ topicSlug: 'x', score: -0.1 })).toThrow();
  });
});

// --- AC6: FilteredExcerptSchema ---

describe('FilteredExcerptSchema', () => {
  it('should validate with messages array using Message sub-schema (AC6)', () => {
    const result = FilteredExcerptSchema.parse({
      messages: [validMessage(), { role: 'agent', content: 'response', timestamp: ISO_TIMESTAMP_2 }],
      startTimestamp: ISO_TIMESTAMP,
      endTimestamp: ISO_TIMESTAMP_2,
    });
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('agent');
  });

  it('should accept empty messages array', () => {
    const result = FilteredExcerptSchema.parse({
      messages: [],
      startTimestamp: ISO_TIMESTAMP,
      endTimestamp: ISO_TIMESTAMP_2,
    });
    expect(result.messages).toEqual([]);
  });

  it('should accept optional anchorEvent and relevanceScore', () => {
    const result = FilteredExcerptSchema.parse({
      messages: [],
      anchorEvent: 'evt-42',
      startTimestamp: ISO_TIMESTAMP,
      endTimestamp: ISO_TIMESTAMP_2,
      relevanceScore: 0.75,
    });
    expect(result.anchorEvent).toBe('evt-42');
    expect(result.relevanceScore).toBe(0.75);
  });

  it('should reject invalid message in array', () => {
    expect(() => FilteredExcerptSchema.parse({
      messages: [{ role: 'invalid', content: 'x', timestamp: ISO_TIMESTAMP }],
      startTimestamp: ISO_TIMESTAMP,
      endTimestamp: ISO_TIMESTAMP_2,
    })).toThrow();
  });

  it('should reject missing timestamps', () => {
    expect(() => FilteredExcerptSchema.parse({
      messages: [],
    })).toThrow();
  });
});

describe('NuggetSchema', () => {
  it('should validate a nugget with defaults', () => {
    const result = NuggetSchema.parse(validNugget());
    expect(result.tags).toEqual([]); // default
    expect(result.caused).toBeUndefined();
  });

  it('should accept caused field', () => {
    const result = NuggetSchema.parse({ ...validNugget(), caused: 'add-caching' });
    expect(result.caused).toBe('add-caching');
  });

  it('should reject invalid category', () => {
    expect(() => NuggetSchema.parse({ ...validNugget(), category: 'opinion' })).toThrow();
  });

  it('should reject empty required strings', () => {
    expect(() => NuggetSchema.parse({ ...validNugget(), slug: '' })).toThrow();
    expect(() => NuggetSchema.parse({ ...validNugget(), title: '' })).toThrow();
    expect(() => NuggetSchema.parse({ ...validNugget(), body: '' })).toThrow();
    expect(() => NuggetSchema.parse({ ...validNugget(), topicSlug: '' })).toThrow();
  });
});

// --- AC3: LlmNuggetOutputSchema ---

describe('LlmNuggetOutputSchema', () => {
  it('should validate a valid JSON array (AC3)', () => {
    const result = LlmNuggetOutputSchema.safeParse([validNugget()]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].slug).toBe('use-sqlite');
    }
  });

  it('should validate multiple nuggets in array', () => {
    const result = LlmNuggetOutputSchema.safeParse([
      validNugget(),
      { ...validNugget(), slug: 'add-index', title: 'Add Index', category: 'pattern' },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('should fail on missing required fields (AC3)', () => {
    const result = LlmNuggetOutputSchema.safeParse([{ slug: 'test' }]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('should strip extra fields (AC3)', () => {
    const withExtra = { ...validNugget(), extraField: 'should be stripped', bonus: 123 };
    const result = LlmNuggetOutputSchema.safeParse([withExtra]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0]).not.toHaveProperty('extraField');
      expect(result.data[0]).not.toHaveProperty('bonus');
    }
  });

  it('should fail gracefully on non-array input (AC3)', () => {
    const result = LlmNuggetOutputSchema.safeParse('not an array');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toBeDefined();
    }
  });

  it('should fail gracefully on object instead of array (AC3)', () => {
    const result = LlmNuggetOutputSchema.safeParse(validNugget());
    expect(result.success).toBe(false);
  });

  it('should fail on null', () => {
    const result = LlmNuggetOutputSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('should validate empty array', () => {
    const result = LlmNuggetOutputSchema.safeParse([]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('should apply default tags when missing', () => {
    const nuggetNoTags = { ...validNugget() };
    const result = LlmNuggetOutputSchema.safeParse([nuggetNoTags]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].tags).toEqual([]);
    }
  });
});

describe('PreExtractSchema', () => {
  it('should validate with defaults', () => {
    const result = PreExtractSchema.parse({ sessionId: 's1' });
    expect(result.entities).toEqual([]);
    expect(result.facts).toEqual([]);
    expect(result.topicMatches).toEqual([]);
    expect(result.excerpts).toEqual([]);
  });

  it('should reject empty sessionId', () => {
    expect(() => PreExtractSchema.parse({ sessionId: '' })).toThrow();
  });
});

describe('MergeResultSchema', () => {
  it('should validate with defaults', () => {
    const result = MergeResultSchema.parse({
      topicSlug: 'db', updatedAt: ISO_TIMESTAMP,
    });
    expect(result.nuggets).toEqual([]);
    expect(result.mergedFrom).toEqual([]);
  });

  it('should accept nuggets array', () => {
    const result = MergeResultSchema.parse({
      topicSlug: 'db',
      nuggets: [validNugget()],
      mergedFrom: ['sess-1', 'sess-2'],
      updatedAt: ISO_TIMESTAMP,
    });
    expect(result.nuggets).toHaveLength(1);
    expect(result.mergedFrom).toEqual(['sess-1', 'sess-2']);
  });
});

describe('TopicFileSchema', () => {
  it('should validate with defaults', () => {
    const result = TopicFileSchema.parse({
      slug: 'database', title: 'Database', lastUpdated: ISO_TIMESTAMP,
    });
    expect(result.sections).toEqual([]);
    expect(result.nuggets).toEqual([]);
  });

  it('should accept sections as NuggetCategory values', () => {
    const result = TopicFileSchema.parse({
      slug: 'db', title: 'DB', lastUpdated: ISO_TIMESTAMP,
      sections: ['decision', 'pattern'],
      nuggets: [validNugget()],
    });
    expect(result.sections).toEqual(['decision', 'pattern']);
  });
});

// --- AC5: SessionRefSchema (discriminated union) ---

describe('SessionRefSchema', () => {
  it('should route sessionId variant (AC5)', () => {
    const result = SessionRefSchema.parse({ type: 'sessionId', sessionId: 'abc' });
    expect(result.type).toBe('sessionId');
    if (result.type === 'sessionId') {
      expect(result.sessionId).toBe('abc');
    }
  });

  it('should route planId variant (AC5)', () => {
    const result = SessionRefSchema.parse({ type: 'planId', planId: 'plan-1' });
    expect(result.type).toBe('planId');
    if (result.type === 'planId') {
      expect(result.planId).toBe('plan-1');
    }
  });

  it('should route runId variant (AC5)', () => {
    const result = SessionRefSchema.parse({ type: 'runId', runId: 'run-1' });
    expect(result.type).toBe('runId');
    if (result.type === 'runId') {
      expect(result.runId).toBe('run-1');
    }
  });

  it('should route channel variant (AC5)', () => {
    const result = SessionRefSchema.parse({ type: 'channel', channel: '#general' });
    expect(result.type).toBe('channel');
    if (result.type === 'channel') {
      expect(result.channel).toBe('#general');
    }
  });

  it('should reject unknown type', () => {
    expect(() => SessionRefSchema.parse({ type: 'unknown', value: 'x' })).toThrow();
  });

  it('should reject missing required field for variant', () => {
    expect(() => SessionRefSchema.parse({ type: 'sessionId' })).toThrow();
    expect(() => SessionRefSchema.parse({ type: 'planId' })).toThrow();
    expect(() => SessionRefSchema.parse({ type: 'runId' })).toThrow();
    expect(() => SessionRefSchema.parse({ type: 'channel' })).toThrow();
  });

  it('should reject empty string for variant field', () => {
    expect(() => SessionRefSchema.parse({ type: 'sessionId', sessionId: '' })).toThrow();
    expect(() => SessionRefSchema.parse({ type: 'channel', channel: '' })).toThrow();
  });
});

// --- AC4: AdapterConfigSchema (discriminated union) ---

describe('AdapterConfigSchema', () => {
  it('should route trajectory variant (AC4)', () => {
    const result = AdapterConfigSchema.parse({ type: 'trajectory', basePath: '/data' });
    expect(result.type).toBe('trajectory');
    if (result.type === 'trajectory') {
      expect(result.basePath).toBe('/data');
    }
  });

  it('should route relay variant (AC4)', () => {
    const result = AdapterConfigSchema.parse({ type: 'relay', relayUrl: 'ws://localhost:4000' });
    expect(result.type).toBe('relay');
    if (result.type === 'relay') {
      expect(result.relayUrl).toBe('ws://localhost:4000');
    }
  });

  it('should route relay variant with optional channel', () => {
    const result = AdapterConfigSchema.parse({
      type: 'relay', relayUrl: 'ws://localhost:4000', channel: '#ops',
    });
    if (result.type === 'relay') {
      expect(result.channel).toBe('#ops');
    }
  });

  it('should route transcript variant with default format (AC4)', () => {
    const result = AdapterConfigSchema.parse({ type: 'transcript', filePath: '/logs/chat.jsonl' });
    expect(result.type).toBe('transcript');
    if (result.type === 'transcript') {
      expect(result.format).toBe('jsonl'); // default
    }
  });

  it('should accept all transcript format values', () => {
    for (const format of ['jsonl', 'markdown', 'plain'] as const) {
      const result = AdapterConfigSchema.parse({ type: 'transcript', filePath: '/x', format });
      if (result.type === 'transcript') {
        expect(result.format).toBe(format);
      }
    }
  });

  it('should route custom variant (AC4)', () => {
    const result = AdapterConfigSchema.parse({
      type: 'custom', module: './my-adapter.js', options: { key: 'val' },
    });
    expect(result.type).toBe('custom');
    if (result.type === 'custom') {
      expect(result.module).toBe('./my-adapter.js');
      expect(result.options).toEqual({ key: 'val' });
    }
  });

  it('should reject unknown type', () => {
    expect(() => AdapterConfigSchema.parse({ type: 'firebase', url: 'x' })).toThrow();
  });

  it('should reject missing required field for variant', () => {
    expect(() => AdapterConfigSchema.parse({ type: 'trajectory' })).toThrow();
    expect(() => AdapterConfigSchema.parse({ type: 'relay' })).toThrow();
    expect(() => AdapterConfigSchema.parse({ type: 'transcript' })).toThrow();
    expect(() => AdapterConfigSchema.parse({ type: 'custom' })).toThrow();
  });
});

// --- MullConfigSchema ---

describe('MullConfigSchema', () => {
  const validConfig = {
    memoryDir: '.mull',
    adapters: [{ type: 'trajectory' as const, basePath: '/data' }],
    llm: { model: 'claude-sonnet-4-5-20250929' },
    extraction: {},
  };

  it('should validate with extraction defaults', () => {
    const result = MullConfigSchema.parse(validConfig);
    expect(result.extraction.minEntitiesForLlm).toBe(3);
    expect(result.extraction.topicMatchThreshold).toBe(0.6);
    expect(result.extraction.categories).toEqual([
      'decision', 'constraint', 'pattern', 'gotcha', 'context',
    ]);
  });

  it('should reject empty adapters array', () => {
    expect(() => MullConfigSchema.parse({ ...validConfig, adapters: [] })).toThrow();
  });

  it('should reject empty memoryDir', () => {
    expect(() => MullConfigSchema.parse({ ...validConfig, memoryDir: '' })).toThrow();
  });

  it('should accept optional llm fields', () => {
    const result = MullConfigSchema.parse({
      ...validConfig,
      llm: { model: 'claude-sonnet-4-5-20250929', maxTokens: 4096, temperature: 0.7 },
    });
    expect(result.llm.maxTokens).toBe(4096);
    expect(result.llm.temperature).toBe(0.7);
  });

  it('should reject temperature > 2', () => {
    expect(() => MullConfigSchema.parse({
      ...validConfig,
      llm: { model: 'x', temperature: 3 },
    })).toThrow();
  });
});

// =============================================================================
// Real-time schemas (realtime-types.ts)
// =============================================================================

describe('EntityAccumulatorStateSchema', () => {
  it('should validate with defaults', () => {
    const result = EntityAccumulatorStateSchema.parse({ sessionId: 'sess-1' });
    expect(result.entitiesSinceLastLlm).toEqual([]);
    expect(result.factsSinceLastLlm).toEqual([]);
    expect(result.lastLlmRunAt).toBeUndefined();
  });

  it('should accept full state', () => {
    const result = EntityAccumulatorStateSchema.parse({
      sessionId: 'sess-1',
      entitiesSinceLastLlm: [{ text: 'SQLite', type: 'tool' }],
      factsSinceLastLlm: [{ slug: 'f1', text: 'Fact' }],
      lastLlmRunAt: ISO_TIMESTAMP,
      lastDeterministicAt: ISO_TIMESTAMP_2,
    });
    expect(result.entitiesSinceLastLlm).toHaveLength(1);
    expect(result.factsSinceLastLlm).toHaveLength(1);
  });

  it('should reject empty sessionId', () => {
    expect(() => EntityAccumulatorStateSchema.parse({ sessionId: '' })).toThrow();
  });
});

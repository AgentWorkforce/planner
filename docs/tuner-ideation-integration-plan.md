# Tuner → Ideation Integration Plan

> Extends the Tuner's adaptive learning loop to observe ideation outcomes
> and produce configuration that influences how ideation agents operate.

## Motivation

The Tuner currently produces `ForgeExecutionConfig` and `PlannerConfig` from execution
outcomes. Ideation operates with hardcoded values (model, temperature, confidence thresholds,
specialist selection). There is no feedback loop — ideation quality has no measurable
downstream signal flowing back.

This plan adds:
1. **IdeationConfig** — a new Tuner output consumed by the Ideation package
2. **IdeationOutcome** — emitted by Ideation on handoff to Planner
3. **PlanQualitySignal** — emitted by Planner on approval of ideation-sourced plans
4. **Stability controls** — same burn-in, min samples, hysteresis, rate limiting, and
   credible interval checks that govern Forge/Planner config changes

```
                          ┌──────────────────────────┐
                          │          TUNER            │
                          │                           │
              ┌──────────▶│  IdeationOutcome      IN  │◀──────────────┐
              │           │  PlanQualitySignal    IN  │               │
              │           │  IdeationConfig       OUT │               │
              │           │                           │
              │           │  Stability controls:      │               │
              │           │  burn-in, min samples,    │               │
              │           │  hysteresis, rate limit,  │               │
              │           │  credible intervals       │               │
              │           └────────────┬──────────────┘               │
              │                        │                              │
              │                 reads config                          │
              │                        │                              │
              │                        ▼                              │
   emits outcome on           ┌──────────────┐           emits signal on
   handoff (fire-and-forget)  │   IDEATION   │           plan approval
              │               │              │                        │
              └───────────────│  Interviewer  │                        │
                              │  Specialists  │──handoff──▶ PLANNER ──┘
                              │  Blocks       │
                              └──────────────┘
```

---

## Phase 1: Domain Types & Storage

> Foundation. No behavior changes — just the schemas, tables, and defaults.

### 1.1 New domain type: `IdeationConfig`

**File:** `packages/tuner/src/domain/ideation-config.ts`

Follow the exact pattern of `config.ts` (Zod schema + inferred type + defaults).

```typescript
// --- Zod Schemas ---

const InterviewerConfigSchema = z.object({
  model: z.string().default('claude-sonnet-4-20250514'),
  max_tokens: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
});

const SpawnRuleSchema = z.object({
  topic_signals: z.array(z.string()),       // keywords in initial_intent
  specialists: z.array(z.string()),          // template names to spawn early
  confidence: z.number().min(0).max(1),      // Thompson sampling confidence
});

const SpecialistSpawningSchema = z.object({
  early_spawn_rules: z.array(SpawnRuleSchema).default([]),
  deprioritized: z.array(z.string()).default([]),   // specialists with low contribution rates
});

const ConfidenceCalibrationSchema = z.object({
  exploring_value: z.number().min(0).max(100).default(25),
  forming_value: z.number().min(0).max(100).default(50),
  confident_value: z.number().min(0).max(100).default(90),
});

const ReadinessAdvisorySchema = z.object({
  min_conversation_turns: z.number().int().nonnegative().default(5),
  min_specialist_coverage: z.number().int().nonnegative().default(2),
  min_curated_blocks: z.number().int().nonnegative().default(1),
});

const IdeationConfigSchema = z.object({
  interviewer: InterviewerConfigSchema.default({}),
  specialist_spawning: SpecialistSpawningSchema.default({}),
  confidence_calibration: ConfidenceCalibrationSchema.default({}),
  readiness_advisory: ReadinessAdvisorySchema.default({}),
  version: z.number().int().positive().default(1),
  updated_at: z.string().datetime().default(() => new Date().toISOString()),
});
```

**Default constant:** `DEFAULT_IDEATION_CONFIG` — all fields at their schema defaults.
These defaults match the current hardcoded values in ideation, so day-one behavior
is identical. Learning only changes them after stability controls are satisfied.

### 1.2 New domain type: `IdeationOutcome`

**File:** `packages/tuner/src/domain/ideation-outcome.ts`

Emitted by Ideation on each handoff to Planner. One outcome per `sendToPlanner` call.

```typescript
const SpecialistContributionSchema = z.object({
  observations_count: z.number().int().nonnegative(),
  insights_queued: z.number().int().nonnegative(),
  blocks_created: z.number().int().nonnegative(),
  final_confidence: z.enum(['exploring', 'forming', 'confident']),
});

const IdeationOutcomeSchema = z.object({
  session_id: z.string(),
  plan_id: z.string(),

  // Session shape
  session_duration_seconds: z.number().nonnegative(),
  conversation_turns: z.number().int().nonnegative(),

  // Specialist activity
  specialists_spawned: z.array(z.string()),
  specialist_contributions: z.record(z.string(), SpecialistContributionSchema).default({}),

  // Block metrics
  blocks_total: z.number().int().nonnegative(),
  blocks_curated: z.number().int().nonnegative(),
  blocks_user_edited: z.number().int().nonnegative(),
  avg_block_confidence: z.number().min(0).max(100),

  // Handoff context
  is_first_send: z.boolean(),
  send_number: z.number().int().positive(),
  understanding_field_count: z.number().int().nonnegative(),

  timestamp: z.string().datetime(),
  source: z.enum(['test', 'production']).default('production'),
});
```

### 1.3 New domain type: `PlanQualitySignal`

**File:** `packages/tuner/src/domain/plan-quality-signal.ts`

Emitted by Planner when an ideation-sourced plan reaches approval. This is the key
downstream signal that tells Tuner whether ideation prepared the planner well.

```typescript
const PlanQualitySignalSchema = z.object({
  plan_id: z.string(),
  session_id: z.string(),             // From plan.source.session_id

  // Clarification burden (fewer = better ideation)
  questions_asked: z.number().int().nonnegative(),
  questions_hard_blocking: z.number().int().nonnegative(),

  // Revision burden (fewer versions = cleaner handoff)
  versions_before_approval: z.number().int().positive(),

  // AI suggestions (more = ideation missed things)
  improvements_suggested: z.number().int().nonnegative(),
  improvements_accepted: z.number().int().nonnegative(),

  // Block utilization (higher ratio = blocks were actionable)
  blocks_received: z.number().int().nonnegative(),
  blocks_mapped_to_steps: z.number().int().nonnegative(),

  // Timing
  time_to_approval_seconds: z.number().nonnegative().nullable(),

  timestamp: z.string().datetime(),
  source: z.enum(['test', 'production']).default('production'),
});
```

### 1.4 New domain type: `IdeationBaseline`

**File:** `packages/tuner/src/domain/ideation-baseline.ts`

Baselines for ideation patterns, used by drift detection and config generation.
Follows the same EMA + Welford pattern as `TaskBaseline`.

```typescript
const IdeationBaselineSchema = z.object({
  pattern: z.string(),  // Currently just "session_quality" — one global baseline.
                         // Future: per-topic or per-specialist-combo patterns.

  // Clarification burden baselines
  mean_questions_per_plan: z.number().nonnegative(),
  stddev_questions: z.number().nonnegative(),

  // Revision burden baselines
  mean_versions_before_approval: z.number().nonnegative(),
  stddev_versions: z.number().nonnegative(),

  // Block utilization baselines
  mean_block_utilization: z.number().min(0).max(1),  // blocks_mapped / blocks_received
  stddev_block_utilization: z.number().nonnegative(),

  // Session depth baselines
  mean_conversation_turns: z.number().nonnegative(),
  stddev_conversation_turns: z.number().nonnegative(),

  // Specialist contribution baselines (per specialist template)
  specialist_contribution_rates: z.record(z.string(), z.number().min(0).max(1)).default({}),

  // Welford's state
  m2_questions: z.number().nonnegative().optional(),
  m2_versions: z.number().nonnegative().optional(),
  m2_block_utilization: z.number().nonnegative().optional(),
  m2_conversation_turns: z.number().nonnegative().optional(),

  sample_count: z.number().int().nonnegative(),
  last_updated: z.string().datetime(),
});
```

**Note on `pattern` field:** For v1, use a single pattern `"session_quality"` since
ideation volume is lower than Forge task volume. Per-topic patterns can be added
later when there's enough data to be meaningful.

### 1.5 Stability constants for ideation

**File:** Extend `packages/tuner/src/domain/stability.ts`

Add ideation-specific parameter types to the existing stability config.

```typescript
// Extend parameterType enum to include ideation types:
// Existing: 'model_selection' | 'budget' | 'retry'
// New:      'ideation_model' | 'ideation_confidence' | 'ideation_spawning' | 'ideation_readiness'
```

**Cool-down periods:** New parameter types use the default fallthrough in `getCoolDownPeriod()` which maps to `model_selection_ms` (24h).

**Stability thresholds:** All ideation parameters use the same stability thresholds as Forge/Planner (burn_in=50, min_samples=30, improvement_margin=0.15, max_ci_width=0.10). One set of tuning principles for all packages.

**Note:** If ideation session volume is too low to reach burn-in quickly, use testbench to simulate ideation→planner training cycles.

### 1.6 Storage schema extension

**File:** Extend `packages/tuner/src/storage/schema.ts`

Add three new tables following the existing pattern:

```sql
CREATE TABLE IF NOT EXISTS ideation_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  session_duration_seconds REAL,
  conversation_turns INTEGER,
  specialists_spawned TEXT NOT NULL DEFAULT '[]',
  specialist_contributions TEXT NOT NULL DEFAULT '{}',
  blocks_total INTEGER NOT NULL DEFAULT 0,
  blocks_curated INTEGER NOT NULL DEFAULT 0,
  blocks_user_edited INTEGER NOT NULL DEFAULT 0,
  avg_block_confidence REAL NOT NULL DEFAULT 0,
  is_first_send INTEGER NOT NULL DEFAULT 1,
  send_number INTEGER NOT NULL DEFAULT 1,
  understanding_field_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'production',
  timestamp TEXT NOT NULL,
  UNIQUE(session_id, send_number)
);
CREATE INDEX IF NOT EXISTS idx_ideation_outcomes_session
  ON ideation_outcomes(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_outcomes_timestamp
  ON ideation_outcomes(timestamp);

CREATE TABLE IF NOT EXISTS plan_quality_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  questions_asked INTEGER NOT NULL DEFAULT 0,
  questions_hard_blocking INTEGER NOT NULL DEFAULT 0,
  versions_before_approval INTEGER NOT NULL DEFAULT 1,
  improvements_suggested INTEGER NOT NULL DEFAULT 0,
  improvements_accepted INTEGER NOT NULL DEFAULT 0,
  blocks_received INTEGER NOT NULL DEFAULT 0,
  blocks_mapped_to_steps INTEGER NOT NULL DEFAULT 0,
  time_to_approval_seconds REAL,
  source TEXT NOT NULL DEFAULT 'production',
  timestamp TEXT NOT NULL,
  UNIQUE(plan_id)
);
CREATE INDEX IF NOT EXISTS idx_plan_quality_session
  ON plan_quality_signals(session_id);

CREATE TABLE IF NOT EXISTS ideation_baselines (
  pattern TEXT PRIMARY KEY,
  mean_questions_per_plan REAL NOT NULL DEFAULT 0,
  stddev_questions REAL NOT NULL DEFAULT 0,
  mean_versions_before_approval REAL NOT NULL DEFAULT 1,
  stddev_versions REAL NOT NULL DEFAULT 0,
  mean_block_utilization REAL NOT NULL DEFAULT 0,
  stddev_block_utilization REAL NOT NULL DEFAULT 0,
  mean_conversation_turns REAL NOT NULL DEFAULT 0,
  stddev_conversation_turns REAL NOT NULL DEFAULT 0,
  specialist_contribution_rates TEXT NOT NULL DEFAULT '{}',
  m2_questions REAL DEFAULT 0,
  m2_versions REAL DEFAULT 0,
  m2_block_utilization REAL DEFAULT 0,
  m2_conversation_turns REAL DEFAULT 0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL
);
```

### 1.7 Extend TunerStorage interface

**File:** `packages/tuner/src/storage/interface.ts`

Add methods following the existing pattern (e.g., `insertTaskOutcome`, `getTaskBaseline`):

```typescript
// Ideation outcomes
insertIdeationOutcome(outcome: IdeationOutcome): void;
getIdeationOutcomesBySession(sessionId: string): IdeationOutcome[];
getRecentIdeationOutcomes(limit: number): IdeationOutcome[];

// Plan quality signals
insertPlanQualitySignal(signal: PlanQualitySignal): void;
getPlanQualitySignal(planId: string): PlanQualitySignal | null;
getPlanQualitySignalBySession(sessionId: string): PlanQualitySignal[];

// Ideation baselines
getIdeationBaseline(pattern: string): IdeationBaseline | null;
upsertIdeationBaseline(baseline: IdeationBaseline): void;
listIdeationBaselines(): IdeationBaseline[];

// Specialist contribution tracking (aggregated from outcomes)
getSpecialistContributionRate(specialistName: string): number | null;
```

### 1.8 Implement SQLite storage methods

**File:** `packages/tuner/src/storage/sqlite.ts`

Implement the new interface methods using prepared statements, following the same
pattern as `insertTaskOutcome` / `getTaskBaseline`.

JSON columns (`specialists_spawned`, `specialist_contributions`,
`specialist_contribution_rates`) use `JSON.stringify` on write and `JSON.parse` on read.

### 1.9 Extend `config_versions` table

The existing `config_versions` table stores `forge_config` and `planner_config` as
JSON columns. Add `ideation_config TEXT` as a new nullable column:

```sql
ALTER TABLE config_versions ADD COLUMN ideation_config TEXT;
```

Handle this as a migration in the schema initialization (check if column exists first).

---

### Phase 1 Verification

- [ ] All new Zod schemas parse and validate correctly (unit tests)
- [ ] Default configs match current hardcoded ideation values
- [ ] Storage tables create successfully
- [ ] CRUD operations work for all three new tables
- [ ] Existing tests still pass (no regressions)

---

## Phase 2: API Endpoints & Outcome Ingestion

> Data flows in. Ideation and Planner can emit outcomes. Tuner can serve config.

### 2.1 New config handler: `getIdeationConfig`

**File:** Extend `packages/tuner/src/api/handlers/config.ts`

Follow the exact pattern of `getForgeConfig` / `getPlannerConfig`:

```typescript
getIdeationConfig: (req: Request, res: Response) => {
  try {
    const config = services.config.getCurrentIdeationConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ideation config' });
  }
}
```

Also extend `getConfigVersion` to include `ideation_version`.

### 2.2 New outcome handlers

**File:** Extend `packages/tuner/src/api/handlers/outcomes.ts`

Two new handlers following the existing `recordTaskOutcome` / `recordRunOutcome` pattern:

```typescript
recordIdeationOutcome: (req: Request, res: Response) => {
  const parseResult = IdeationOutcomeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid ideation outcome', details: ... });
  }
  const result = services.collector.recordIdeationOutcome(parseResult.data);
  res.json({ received: true });
}

recordPlanQualitySignal: (req: Request, res: Response) => {
  const parseResult = PlanQualitySignalSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid plan quality signal', details: ... });
  }
  const result = services.collector.recordPlanQualitySignal(parseResult.data);
  res.json({ received: true });
}
```

### 2.3 New insights handler: `getIdeationInsights`

**File:** Extend `packages/tuner/src/api/handlers/insights.ts`

```typescript
getIdeationInsights: (req: Request, res: Response) => {
  const baselines = services.storage.listIdeationBaselines();
  const recentOutcomes = services.storage.getRecentIdeationOutcomes(20);
  const totalSessions = recentOutcomes.length;
  const avgQuestions = baselines[0]?.mean_questions_per_plan ?? null;
  const avgBlockUtil = baselines[0]?.mean_block_utilization ?? null;

  res.json({
    total_sessions_tracked: totalSessions,
    avg_questions_per_plan: avgQuestions,
    avg_block_utilization: avgBlockUtil,
    specialist_contribution_rates: baselines[0]?.specialist_contribution_rates ?? {},
    baselines,
  });
}
```

### 2.4 Mount new routes

**File:** Extend `packages/tuner/src/api/routes.ts`

```typescript
// Config
router.get('/config/ideation', configHandlers.getIdeationConfig);

// Outcomes
router.post('/outcomes/ideation', outcomeHandlers.recordIdeationOutcome);
router.post('/outcomes/plan-quality', outcomeHandlers.recordPlanQualitySignal);

// Insights
router.get('/insights/ideation', insightsHandlers.getIdeationInsights);
```

### 2.5 Extend OutcomeCollector

**File:** `packages/tuner/src/services/outcome-collector.ts`

Add two new methods + events, following the existing pattern:

```typescript
recordIdeationOutcome(outcome: IdeationOutcome): { received: true } {
  this.storage.insertIdeationOutcome(outcome);
  setImmediate(() => this.emit('ideation_outcome_received', outcome));
  return { received: true };
}

recordPlanQualitySignal(signal: PlanQualitySignal): { received: true } {
  this.storage.insertPlanQualitySignal(signal);
  setImmediate(() => this.emit('plan_quality_signal_received', signal));
  return { received: true };
}
```

### 2.6 Extend ConfigWriter

**File:** `packages/tuner/src/services/config-writer.ts`

Add methods to generate and serve ideation config:

```typescript
generateIdeationConfig(): IdeationConfig {
  // Phase 2: return defaults. Phase 3 adds learning.
  return { ...DEFAULT_IDEATION_CONFIG, version: this.nextVersion(), updated_at: now() };
}

getCurrentIdeationConfig(): IdeationConfig {
  const latest = this.getLatestConfig();
  if (latest?.ideation_config) return latest.ideation_config;
  return this.generateIdeationConfig();
}
```

Also extend `saveConfig()` to accept optional `ideationConfig` parameter and persist
it to the new `ideation_config` column.

---

### Phase 2 Verification

- [ ] `GET /api/tuner/config/ideation` returns default config
- [ ] `POST /api/tuner/outcomes/ideation` validates and stores outcome
- [ ] `POST /api/tuner/outcomes/plan-quality` validates and stores signal
- [ ] `GET /api/tuner/insights/ideation` returns empty/default state
- [ ] Zod validation rejects malformed payloads with useful error messages
- [ ] Existing endpoints unaffected

---

## Phase 3: Integration Helpers (Consumer Side)

> Ideation can read config. Planner can emit signals. Both fire-and-forget.

### 3.1 IdeationIntegration class

**File:** `packages/tuner/src/integrations/ideation-integration.ts`

Follow the exact pattern of `ForgeIntegration` and `PlannerIntegration`:

```typescript
export class IdeationIntegration {
  private config: IdeationConfig | null = null;
  private client: TunerClient;
  private refreshInterval: NodeJS.Timeout | null = null;
  private available = false;

  constructor(options?: { tunerUrl?: string; refreshIntervalMs?: number }) { ... }

  async initialize(): Promise<void> {
    // Fetch config from tuner, set available=true
    // Start refresh interval (default: 5 minutes, matching Forge/Planner)
    // Graceful fallback to DEFAULT_IDEATION_CONFIG if tuner unavailable
  }

  getConfig(): IdeationConfig {
    return this.config ?? DEFAULT_IDEATION_CONFIG;
  }

  isAvailable(): boolean { return this.available; }

  async recordIdeationOutcome(outcome: IdeationOutcome): Promise<void> {
    // Fire-and-forget: don't throw on failure, just log
    try { await this.client.submitIdeationOutcome(outcome); }
    catch (e) { console.warn('[ideation-tuner] Failed to submit outcome:', e.message); }
  }

  async refreshConfig(): Promise<void> { ... }
  shutdown(): void { ... }
}
```

**Key behavior:**
- Falls back to defaults if Tuner is unreachable (ideation works standalone)
- Fire-and-forget outcome submission (never blocks ideation flow)
- Auto-refresh every 5 minutes
- Graceful shutdown clears interval

### 3.2 Extend TunerClient

**File:** `packages/tuner/src/client/tuner-client.ts`

Add methods:

```typescript
async getIdeationConfig(): Promise<IdeationConfig> { ... }
async submitIdeationOutcome(outcome: IdeationOutcome): Promise<OutcomeResponse> { ... }
async submitPlanQualitySignal(signal: PlanQualitySignal): Promise<OutcomeResponse> { ... }
```

### 3.3 Wire IdeationIntegration into Ideation package

**File:** `packages/ideation/src/index.ts` (or wherever the service is initialized)

```typescript
import { IdeationIntegration } from '@planner/tuner';

// During ideation service initialization:
const tunerIntegration = new IdeationIntegration({
  tunerUrl: process.env.TUNER_URL ?? 'http://localhost:4002',
});
await tunerIntegration.initialize();

// Pass to Interviewer service so it can read config
const interviewer = new InterviewerService({
  ...,
  tunerConfig: () => tunerIntegration.getConfig(),
});
```

### 3.4 Wire PlanQualitySignal emission into Planner

**File:** `packages/planner/src/api/handlers/workflow.ts` (approve handler)

After successful approval, check if the plan was sourced from ideation and emit:

```typescript
// In approve handler, after version status is set to 'approved':
if (plan.source?.type === 'ideation' && plan.source.session_id) {
  const questions = storage.getQuestionsForPlan(planId);
  const improvements = storage.getImprovementsForVersion(planId, versionNumber);

  // Fire-and-forget to tuner
  tunerClient.submitPlanQualitySignal({
    plan_id: planId,
    session_id: plan.source.session_id,
    questions_asked: questions.length,
    questions_hard_blocking: questions.filter(q => q.blocking_level === 'hard_block').length,
    versions_before_approval: versionNumber,
    improvements_suggested: improvements.length,
    improvements_accepted: improvements.filter(i => i.status === 'accepted').length,
    blocks_received: countBlocksFromUnderstanding(version.understanding),
    blocks_mapped_to_steps: 0,  // Phase 5 adds step-level source tracking
    time_to_approval_seconds: computeTimeToApproval(version),
    timestamp: new Date().toISOString(),
  }).catch(e => console.warn('[planner] Failed to submit plan quality signal:', e.message));
}
```

This is the ONLY change to the Planner package.

---

### Phase 3 Verification

- [ ] IdeationIntegration initializes and falls back gracefully when Tuner is down
- [ ] IdeationIntegration.getConfig() returns defaults when Tuner unavailable
- [ ] IdeationIntegration.recordIdeationOutcome() doesn't throw on network failure
- [ ] Planner emits PlanQualitySignal on approval of ideation-sourced plans
- [ ] Planner does NOT emit signal for manually-created plans
- [ ] Full roundtrip: ideation handoff → outcome stored → planner approval → signal stored

---

## Phase 4: Ideation Config Consumption

> Ideation reads config from Tuner and uses it instead of hardcoded values.

### 4.1 Replace hardcoded LLM config

**File:** `packages/ideation/src/interviewer/config.ts`

```typescript
// Before:
export const LLM_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
} as const;

// After:
export const LLM_DEFAULTS = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
} as const;

export function getInterviewerLLMConfig(tunerConfig?: IdeationConfig) {
  if (!tunerConfig) return LLM_DEFAULTS;
  return {
    model: tunerConfig.interviewer.model,
    maxTokens: tunerConfig.interviewer.max_tokens,
    temperature: tunerConfig.interviewer.temperature,
  };
}
```

**Direction:** The Interviewer service calls `getInterviewerLLMConfig(this.tunerConfig())`
when constructing Anthropic API requests. The `tunerConfig` callback was passed during
initialization (Phase 3.3). If it returns null, defaults apply.

### 4.2 Replace hardcoded confidence mapping

**File:** `packages/ideation/src/domain/confidence.ts`

```typescript
// Before:
const CONFIDENCE_MAP = { exploring: 25, forming: 50, confident: 90 };

// After:
const CONFIDENCE_DEFAULTS = { exploring: 25, forming: 50, confident: 90 };

export function getConfidenceMap(tunerConfig?: IdeationConfig) {
  if (!tunerConfig) return CONFIDENCE_DEFAULTS;
  return {
    exploring: tunerConfig.confidence_calibration.exploring_value,
    forming: tunerConfig.confidence_calibration.forming_value,
    confident: tunerConfig.confidence_calibration.confident_value,
  };
}
```

**Direction:** The confidence computation function receives the tuner config as a
parameter. All callers pass it through. If the Tuner learns that 90% confidence blocks
still correlate with high planner question counts, it will adjust `confident_value`
downward (e.g., to 80%), meaning blocks need more specialist agreement to reach
"ready" status.

### 4.3 Specialist spawning with early_spawn_rules

**File:** `packages/ideation/src/interviewer/service.ts`

When a new session starts, check `specialist_spawning.early_spawn_rules` from config:

```typescript
// After session creation, before first Interviewer response:
const config = this.tunerConfig();
if (config?.specialist_spawning.early_spawn_rules.length) {
  const intent = session.source.initial_intent.toLowerCase();
  for (const rule of config.specialist_spawning.early_spawn_rules) {
    const matches = rule.topic_signals.some(signal => intent.includes(signal.toLowerCase()));
    if (matches) {
      for (const specialistName of rule.specialists) {
        // Check deprioritized list
        if (config.specialist_spawning.deprioritized.includes(specialistName)) continue;
        await this.spawnSpecialist(session.id, specialistName);
      }
    }
  }
}
```

**Direction:** This is additive — it doesn't replace the Interviewer's ability to
spawn specialists on-demand during conversation. It just gives a head start for
patterns the Tuner has learned work well. The Interviewer can still spawn any
specialist it wants regardless of rules.

Also, when the Interviewer considers spawning a specialist, check the deprioritized
list and include a note in the tool response: "Note: {specialist} has had low
contribution rates in recent sessions." The Interviewer can still override this.

### 4.4 Readiness advisory in send_to_planner tool

**File:** `packages/ideation/src/interviewer/tools.ts` (or `tool-executor.ts`)

When the `send_to_planner` tool is invoked, check readiness advisory thresholds:

```typescript
// In send_to_planner tool execution:
const config = this.tunerConfig();
const advisory = config?.readiness_advisory;
const warnings: string[] = [];

if (advisory) {
  if (session.transcript.length < advisory.min_conversation_turns) {
    warnings.push(
      `Session has ${session.transcript.length} turns. ` +
      `Sessions with fewer than ${advisory.min_conversation_turns} turns ` +
      `historically lead to more planner clarification questions.`
    );
  }

  const specialistCount = session.active_specialists.length;
  if (specialistCount < advisory.min_specialist_coverage) {
    warnings.push(
      `${specialistCount} specialist(s) contributed. ` +
      `Sessions with at least ${advisory.min_specialist_coverage} specialists ` +
      `tend to produce more complete plans.`
    );
  }

  const curatedCount = session.blocks.filter(b => b.status === 'curated').length;
  if (curatedCount < advisory.min_curated_blocks) {
    warnings.push(
      `${curatedCount} curated block(s). Consider curating at least ` +
      `${advisory.min_curated_blocks} block(s) before sending.`
    );
  }
}

// Include warnings in tool response (Interviewer sees them, can relay to user)
// The handoff still proceeds — these are ADVISORY, not blocking.
```

**Key:** These warnings are surfaced to the Interviewer agent as part of the tool
response. The Interviewer can choose to mention them to the user or proceed. The
handoff is never blocked. The user always has final say.

### 4.5 Emit IdeationOutcome on handoff

**File:** `packages/ideation/src/api/handlers.ts` (sendToPlanner handler)

After successful handoff to Planner, emit outcome to Tuner:

```typescript
// After successful planner response:
if (tunerIntegration?.isAvailable()) {
  tunerIntegration.recordIdeationOutcome({
    session_id: session.id,
    plan_id: plannerResult.plan_id,
    session_duration_seconds:
      (Date.now() - new Date(session.created_at).getTime()) / 1000,
    conversation_turns: session.transcript.length,
    specialists_spawned: session.active_specialists.map(s => s.template),
    specialist_contributions: buildSpecialistContributions(session),
    blocks_total: session.blocks.length,
    blocks_curated: curatedBlocks.length,
    blocks_user_edited: session.blocks.filter(b => b.userEdited).length,
    avg_block_confidence:
      curatedBlocks.length > 0
        ? curatedBlocks.reduce((sum, b) => sum + b.confidence, 0) / curatedBlocks.length
        : 0,
    is_first_send: session.planner_sends.length === 0,
    send_number: session.planner_sends.length + 1,
    understanding_field_count: Object.keys(session.understanding).length,
    timestamp: new Date().toISOString(),
  }).catch(() => {}); // Fire-and-forget, never fail the handoff
}
```

**Helper function** `buildSpecialistContributions(session)`:
- Iterates `session.active_specialists`
- For each, counts observations in `session.understanding[specialist.name]`
- Counts blocks created by that specialist
- Gets confidence from their observation's `confidence` field
- Returns `Record<string, SpecialistContribution>`

---

### Phase 4 Verification

- [ ] Interviewer uses model from Tuner config (verified by checking Anthropic API calls)
- [ ] Confidence computation uses calibrated values from Tuner config
- [ ] Early spawn rules trigger specialist spawning for matching intents
- [ ] Deprioritized specialists show advisory note but are not hard-blocked
- [ ] Readiness warnings appear in send_to_planner tool response
- [ ] Readiness warnings do NOT block the handoff
- [ ] IdeationOutcome is emitted after every successful handoff
- [ ] Handoff succeeds even when Tuner is unreachable
- [ ] When Tuner is down, all behaviors fall back to current hardcoded defaults

---

## Phase 5: Learning & Config Generation (Closing the Loop)

> The Tuner learns from outcomes and generates non-default IdeationConfig values.
> All changes gated by stability controls.

### 5.1 IdeationBaselineService

**File:** `packages/tuner/src/services/ideation-baseline-service.ts`

New service following the same pattern as `BaselineService`. Uses EMA (alpha=0.1)
and Welford's online algorithm for variance.

**Triggered by:** `plan_quality_signal_received` event (not `ideation_outcome_received`).
The plan quality signal is the authoritative measure because it includes the downstream
result (questions, versions, improvements). The ideation outcome alone only captures
session shape — necessary context but not the quality signal.

**Correlation step:** When a `PlanQualitySignal` arrives, look up the matching
`IdeationOutcome` by `session_id` to get the full picture:

```typescript
onPlanQualitySignal(signal: PlanQualitySignal): void {
  // Get the ideation outcome for this session
  const outcomes = this.storage.getIdeationOutcomesBySession(signal.session_id);
  if (outcomes.length === 0) return; // No ideation data to correlate

  const latestOutcome = outcomes[outcomes.length - 1];

  // Compute block utilization
  const blockUtilization = signal.blocks_received > 0
    ? signal.blocks_mapped_to_steps / signal.blocks_received
    : 0;

  // Update baseline using Welford's algorithm
  const baseline = this.storage.getIdeationBaseline('session_quality')
    ?? createDefaultIdeationBaseline();

  // EMA + Welford update for each metric:
  // - questions_per_plan
  // - versions_before_approval
  // - block_utilization
  // - conversation_turns (from outcome)
  updateBaselineWithWelford(baseline, {
    questions: signal.questions_asked,
    versions: signal.versions_before_approval,
    blockUtilization,
    conversationTurns: latestOutcome.conversation_turns,
  });

  // Update specialist contribution rates
  for (const [name, contrib] of Object.entries(latestOutcome.specialist_contributions)) {
    const contributed = contrib.blocks_created > 0 || contrib.insights_queued > 0;
    updateSpecialistContributionRate(baseline, name, contributed);
  }

  this.storage.upsertIdeationBaseline(baseline);
}
```

### 5.2 Extend ConfigWriter.generateIdeationConfig()

**File:** `packages/tuner/src/services/config-writer.ts`

Replace the Phase 2 stub with learning-based generation. Every change is gated by
stability controls.

```typescript
generateIdeationConfig(): IdeationConfig {
  const baseline = this.storage.getIdeationBaseline('session_quality');
  const config = { ...DEFAULT_IDEATION_CONFIG };

  if (!baseline || baseline.sample_count === 0) {
    // No data yet — return defaults
    return { ...config, version: this.nextVersion(), updated_at: now() };
  }

  // --- Confidence calibration ---
  // If plans from ideation still have high question counts despite high block
  // confidence, the confidence values are too generous.
  //
  // Strategy: If mean_questions_per_plan is above the "good" threshold AND
  // sample_count meets minimum, consider adjusting confident_value downward.

  const stabilityCheck = this.stabilityControls.checkStability({
    totalTrials: baseline.sample_count,
    currentArmSamples: baseline.sample_count,
    parameterType: 'ideation_confidence',
    // No alpha/beta for this — we use baseline stddev instead
  });

  if (stabilityCheck.canChange && baseline.sample_count >= 50) {
    // If avg questions > 3 AND we have statistical confidence, lower the
    // confident_value proportionally. Never go below 70.
    if (baseline.mean_questions_per_plan > 3) {
      const reduction = Math.min(20, Math.round(baseline.mean_questions_per_plan * 2));
      config.confidence_calibration.confident_value =
        Math.max(70, DEFAULT_IDEATION_CONFIG.confidence_calibration.confident_value - reduction);
    }
  }

  // --- Specialist spawn rules ---
  const spawnCheck = this.stabilityControls.checkStability({
    totalTrials: baseline.sample_count,
    currentArmSamples: baseline.sample_count,
    parameterType: 'ideation_spawning',
  });

  if (spawnCheck.canChange) {
    // Build deprioritized list: specialists with < 20% contribution rate
    // and at least min_samples_per_arm (10) sessions observed
    const deprioritized: string[] = [];
    for (const [name, rate] of Object.entries(baseline.specialist_contribution_rates)) {
      if (rate < 0.20) {
        deprioritized.push(name);
      }
    }
    config.specialist_spawning.deprioritized = deprioritized;

    // Early spawn rules: specialists with > 80% contribution rate
    // for sessions containing specific keywords
    // (Phase 5+ — requires keyword correlation tracking, defer to later)
  }

  // --- Readiness advisory ---
  const readinessCheck = this.stabilityControls.checkStability({
    totalTrials: baseline.sample_count,
    currentArmSamples: baseline.sample_count,
    parameterType: 'ideation_readiness',
  });

  if (readinessCheck.canChange) {
    // If sessions with fewer turns correlate with more questions,
    // increase min_conversation_turns.
    // Simple heuristic: set to mean_conversation_turns rounded down,
    // floored at 3 and capped at 15.
    config.readiness_advisory.min_conversation_turns =
      Math.max(3, Math.min(15, Math.floor(baseline.mean_conversation_turns)));

    // Specialist coverage: set to number of specialists with > 50% contribution rate
    const activeSpecialists = Object.values(baseline.specialist_contribution_rates)
      .filter(rate => rate > 0.50).length;
    config.readiness_advisory.min_specialist_coverage =
      Math.max(1, Math.min(4, activeSpecialists));
  }

  config.version = this.nextVersion();
  config.updated_at = new Date().toISOString();
  return config;
}
```

**Direction on model selection learning:**
Interviewer model selection via Thompson sampling is deferred. The interviewer model
is harder to A/B test because "quality of conversation" isn't a binary signal. For now,
model changes are manual (via config override or defaults update). Future: could use
plan quality as a proxy signal if we track which model was used per session.

### 5.3 Wire event handlers in factory

**File:** `packages/tuner/src/services/factory.ts`

Add the new service and wire events:

```typescript
// In createTunerServices():
const ideationBaseline = new IdeationBaselineService(storage);

// In wireEventHandlers():
collector.on('plan_quality_signal_received', (signal: PlanQualitySignal) => {
  if (signal.source === 'test') return;  // Skip test data
  ideationBaseline.onPlanQualitySignal(signal);
});

// Add to TunerServices interface:
ideationBaseline: IdeationBaselineService;
```

### 5.4 Periodic config regeneration

The existing config regeneration pattern (if any) should include ideation config.
If there's no periodic regeneration yet, add a simple interval:

```typescript
// In server.ts or factory.ts:
// Regenerate configs every 6 hours (ideation changes are slow)
const IDEATION_CONFIG_REGEN_INTERVAL = 6 * 60 * 60 * 1000;

setInterval(() => {
  try {
    const ideationConfig = services.config.generateIdeationConfig();
    const forgeConfig = services.config.getCurrentForgeConfig();
    const plannerConfig = services.config.getCurrentPlannerConfig();
    services.config.saveConfig(forgeConfig, plannerConfig, ideationConfig, 'periodic regeneration');
  } catch (e) {
    console.error('[tuner] Failed to regenerate configs:', e.message);
  }
}, IDEATION_CONFIG_REGEN_INTERVAL);
```

---

### Phase 5 Verification

- [ ] IdeationBaselineService updates baselines from PlanQualitySignal + IdeationOutcome correlation
- [ ] Baselines use Welford's algorithm correctly (verify variance computation)
- [ ] ConfigWriter generates non-default IdeationConfig after burn-in threshold (50 samples)
- [ ] Stability controls block changes before burn-in
- [ ] Stability controls enforce cool-down periods between changes
- [ ] Confidence calibration adjusts downward when question counts are high
- [ ] Specialist deprioritization triggers for specialists with < 20% contribution rate
- [ ] Readiness advisory thresholds adjust based on baseline conversation turns
- [ ] Config regeneration runs periodically without errors
- [ ] Full end-to-end: 50+ ideation→approval cycles → config changes → ideation uses new config

---

## Phase 6: PR-Style Review

> Review all changes across tuner, ideation, and planner for consistency,
> correctness, and adherence to patterns.

### Checklist

- [ ] **Type consistency**: All Zod schemas match TypeScript types match SQLite columns
- [ ] **Pattern adherence**: New code follows existing patterns (handler factories,
      fire-and-forget, EventEmitter, Welford's algorithm)
- [ ] **Stability controls**: Every config change path goes through stability check
- [ ] **Graceful degradation**: Ideation works identically when Tuner is unreachable
- [ ] **No blocking**: Outcome emission never blocks ideation handoff or planner approval
- [ ] **Source discrimination**: Test-sourced outcomes don't update learning models
- [ ] **Immutability**: Config versions are append-only, never mutated
- [ ] **Defaults match current**: Day-one IdeationConfig produces identical behavior to
      current hardcoded values
- [ ] **No over-engineering**: No keyword correlation tracking in v1, no model A/B testing
      for interviewer, no per-topic baselines until data volume justifies them
- [ ] Run type checks across all three packages
- [ ] Run existing test suites — no regressions
- [ ] Run new tests for all new code

---

## What This Does NOT Do

- **Does not gate handoff.** The user always decides when to send to Planner.
  Readiness advisory is informational only.
- **Does not assess conversation quality.** "Did the Interviewer ask good questions?"
  is subjective and not measurable by automated signals.
- **Does not assess block correctness.** Whether a block accurately captures user
  intent is the user's job via curation.
- **Does not A/B test the Interviewer model.** Conversation quality is too subjective
  for a binary success/failure signal. Model changes remain manual.
- **Does not track per-topic baselines.** Single `session_quality` pattern for v1.
  Per-topic patterns require keyword extraction and enough volume per topic.
- **Does not require Tuner to be running.** All ideation functionality works with
  hardcoded defaults when Tuner is unavailable.

---

## File Change Summary

### Tuner Package (primary)

| File | Change |
|------|--------|
| `src/domain/ideation-config.ts` | **New** — IdeationConfig schema + defaults |
| `src/domain/ideation-outcome.ts` | **New** — IdeationOutcome schema |
| `src/domain/plan-quality-signal.ts` | **New** — PlanQualitySignal schema |
| `src/domain/ideation-baseline.ts` | **New** — IdeationBaseline schema |
| `src/domain/stability.ts` | **Extend** — Add ideation parameter types + cool-downs |
| `src/domain/index.ts` | **Extend** — Export new types |
| `src/storage/schema.ts` | **Extend** — 3 new tables |
| `src/storage/interface.ts` | **Extend** — New CRUD methods |
| `src/storage/sqlite.ts` | **Extend** — Implement new methods |
| `src/services/outcome-collector.ts` | **Extend** — 2 new record methods + events |
| `src/services/config-writer.ts` | **Extend** — generateIdeationConfig(), saveConfig() |
| `src/services/ideation-baseline-service.ts` | **New** — Baseline tracking for ideation |
| `src/services/stability-controls.ts` | **Extend** — Handle new parameter types |
| `src/services/factory.ts` | **Extend** — Wire new service + events |
| `src/api/handlers/config.ts` | **Extend** — getIdeationConfig handler |
| `src/api/handlers/outcomes.ts` | **Extend** — 2 new outcome handlers |
| `src/api/handlers/insights.ts` | **Extend** — getIdeationInsights handler |
| `src/api/routes.ts` | **Extend** — Mount new endpoints |
| `src/integrations/ideation-integration.ts` | **New** — Consumer helper for ideation |
| `src/client/tuner-client.ts` | **Extend** — 3 new client methods |
| `src/server.ts` | **Extend** — Config regen interval |

### Ideation Package (consumer)

| File | Change |
|------|--------|
| `src/index.ts` | **Extend** — Initialize IdeationIntegration |
| `src/interviewer/config.ts` | **Modify** — Config-driven LLM settings |
| `src/interviewer/service.ts` | **Extend** — Early spawn rules, tuner config callback |
| `src/interviewer/tools.ts` or `tool-executor.ts` | **Extend** — Readiness advisory in send_to_planner |
| `src/domain/confidence.ts` | **Modify** — Config-driven confidence mapping |
| `src/api/handlers.ts` | **Extend** — Emit IdeationOutcome on handoff |

### Planner Package (minimal)

| File | Change |
|------|--------|
| `src/api/handlers/workflow.ts` | **Extend** — Emit PlanQualitySignal on approval |

# Trajectory Injection Implementation Guide for Plannr

**Purpose**: Apply context utilization research to PlannerLead agent and multi-agent coordination

**Status**: Ready for implementation in phase 2 (after core agent skeleton is working)

---

## Overview

This guide provides concrete implementation patterns for:
1. Structuring PlannerLead's context window efficiently
2. Compressing agent trajectories in planning sessions
3. Optimizing relay messages for multi-agent coordination
4. Monitoring context effectiveness

---

## 1. PlannerLead Context Architecture

### 1.1 The Mental Model

Think of PlannerLead's working context like a **news desk at a newspaper**:

```
┌────────────────────────────────────────┐
│  System Instructions (Core Role)       │  Always present
│  "You are the planning coordinator"    │  10-15% budget
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│  Current Request/Goal                  │  What we're working on now
│  "Refine the plan to add caching"      │  15-20% budget
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│  WORKING MEMORY (Most Important)       │
│  ├─ Last 3-5 interactions              │  40-50% budget
│  ├─ Current version under edit         │  (Keep detailed)
│  ├─ Step additions/edits in progress   │
│  └─ Dependency conflicts being resolved│
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│  Supporting Context                    │
│  ├─ Referenced PlanVersions            │  15-25% budget
│  ├─ Tool outputs (observation-masked)  │  (Can be verbose)
│  └─ Approval requirements              │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│  Safety Buffer                         │  5-10% budget
│  (Space for LLM expansion)             │
└────────────────────────────────────────┘
```

### 1.2 Code Structure for Context Builder

```typescript
// src/relay/context-builder.ts

interface ContextBudget {
  total: number;
  system: { tokens: number; percentage: number };
  task: { tokens: number; percentage: number };
  workingMemory: { tokens: number; percentage: number };
  supporting: { tokens: number; percentage: number };
  buffer: { tokens: number; percentage: number };
}

interface TrajectoryFrame {
  turn: number;
  agentMessage: string;
  toolCall?: { name: string; args: unknown };
  toolResult?: string; // observation-masked
  reasoning?: string;
  timestamp: string;
}

interface PlannerContext {
  systemPrompt: string;
  currentGoal: string;
  workingMemory: TrajectoryFrame[];
  supportingContext: {
    referencedPlanVersions: PlanVersion[];
    toolOutputs: Array<{ tool: string; result: string }>;
    approvalRequirements: string;
  };
  metadata: {
    totalTokens: number;
    utilizationRate: number;
    budget: ContextBudget;
  };
}

export class ContextBuilder {
  private budget: ContextBudget;
  private frames: TrajectoryFrame[] = [];

  constructor(windowSize: number = 12000) {
    this.budget = this.allocateBudget(windowSize);
  }

  private allocateBudget(total: number): ContextBudget {
    return {
      total,
      system: { tokens: Math.ceil(total * 0.12), percentage: 12 },
      task: { tokens: Math.ceil(total * 0.18), percentage: 18 },
      workingMemory: { tokens: Math.ceil(total * 0.45), percentage: 45 },
      supporting: { tokens: Math.ceil(total * 0.20), percentage: 20 },
      buffer: { tokens: Math.ceil(total * 0.08), percentage: 8 },
    };
  }

  addFrame(frame: TrajectoryFrame): void {
    this.frames.push(frame);
  }

  /**
   * Select which frames to include in working memory
   * Strategy: Include recent 3-5 turns + compress older iterations
   */
  selectWorkingMemory(): TrajectoryFrame[] {
    const recent = this.frames.slice(-5);

    // If older frames exist, create summary frame
    if (this.frames.length > 5) {
      const older = this.frames.slice(0, -5);
      const summary = this.createSummaryFrame(older);
      return [summary, ...recent];
    }

    return recent;
  }

  /**
   * Observation masking: strip verbose tool output, keep structure
   */
  observationMask(frame: TrajectoryFrame): TrajectoryFrame {
    if (frame.toolResult) {
      // Keep: success/failure status, key metrics
      // Remove: full logs, debug output
      const masked = this.extractKeyMetrics(frame.toolResult);
      return { ...frame, toolResult: masked };
    }
    return frame;
  }

  private extractKeyMetrics(output: string): string {
    // Example: Remove verbose logs, keep "Created 3 steps, 2 dependencies"
    const lines = output.split('\n');
    return lines
      .filter(l =>
        l.includes('Created') ||
        l.includes('Updated') ||
        l.includes('Error') ||
        l.includes('Warning')
      )
      .join('\n');
  }

  private createSummaryFrame(frames: TrajectoryFrame[]): TrajectoryFrame {
    const summary = {
      turn: frames[0].turn,
      agentMessage: `[Summary of turns ${frames[0].turn}-${frames[frames.length - 1].turn}]`,
      reasoning: this.summarizeIterations(frames),
      timestamp: frames[0].timestamp,
    };
    return summary as TrajectoryFrame;
  }

  private summarizeIterations(frames: TrajectoryFrame[]): string {
    // Example output:
    // "Over 8 turns, refined plan from 5 to 12 steps.
    //  Added database scope, resolved 3 dependency conflicts.
    //  Current status: awaiting backend team approval."

    const toolCalls = frames
      .filter(f => f.toolCall)
      .map(f => f.toolCall?.name)
      .reduce((acc, name) => {
        if (name) acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const summary = Object.entries(toolCalls)
      .map(([name, count]) => `${count}x ${name}`)
      .join(', ');

    return `Refined plan through ${frames.length} iterations. Actions: ${summary}.`;
  }

  build(
    systemPrompt: string,
    currentGoal: string,
    referencedPlans: PlanVersion[],
    toolOutputs: Array<{ tool: string; result: string }>,
    approvalRequirements: string
  ): PlannerContext {
    const workingMemory = this.selectWorkingMemory();
    const maskedMemory = workingMemory.map(f => this.observationMask(f));

    return {
      systemPrompt,
      currentGoal,
      workingMemory: maskedMemory,
      supportingContext: {
        referencedPlanVersions: referencedPlans,
        toolOutputs,
        approvalRequirements,
      },
      metadata: {
        totalTokens: this.estimateTokens(maskedMemory, systemPrompt, currentGoal),
        utilizationRate: 0.70, // Target 60-80%
        budget: this.budget,
      },
    };
  }

  private estimateTokens(
    workingMemory: TrajectoryFrame[],
    systemPrompt: string,
    currentGoal: string
  ): number {
    // Rough estimation: 1 token ≈ 4 characters
    const memoryTokens = workingMemory
      .reduce((sum, f) => sum + f.agentMessage.length + (f.toolResult?.length || 0), 0) / 4;
    const systemTokens = systemPrompt.length / 4;
    const goalTokens = currentGoal.length / 4;

    return Math.ceil(systemTokens + goalTokens + memoryTokens);
  }
}
```

### 1.3 Integration with RelayClient

```typescript
// src/relay/relay-client-extended.ts

import { ContextBuilder, PlannerContext } from './context-builder';

export interface RelayMessageWithContext {
  to: string;
  context: PlannerContext;
  message: string;
  metadata: {
    planId: string;
    versionId: string;
    turn: number;
  };
}

/**
 * When sending a relay message with planning context,
 * the context is pre-compressed to fit agent windows.
 */
export async function sendPlannedMessage(
  client: RelayClient,
  recipient: string,
  planId: string,
  context: PlannerContext,
  message: string
): Promise<void> {
  // Validate context doesn't exceed recommended agent window
  if (context.metadata.totalTokens > 12000) {
    console.warn(
      `Context size ${context.metadata.totalTokens} exceeds recommended.`,
      `Consider additional compression.`
    );
  }

  // Format for relay transmission
  const formattedContext = formatContextForRelay(context);

  const relayMessage = `
${formattedContext}

---

${message}
`;

  await client.sendMessage(recipient, relayMessage);
}

function formatContextForRelay(context: PlannerContext): string {
  return `
# Planning Context

## Current Goal
${context.currentGoal}

## Recent Interactions (${context.workingMemory.length} turns)
${context.workingMemory
  .map((f, i) =>
    `**Turn ${f.turn}**
${f.agentMessage}
${f.toolResult ? `Tool: ${f.toolResult}` : ''}
${f.reasoning ? `Reasoning: ${f.reasoning}` : ''}
`
  )
  .join('\n---\n')}

## Approval Status
${context.supportingContext.approvalRequirements}
`;
}
```

---

## 2. Trajectory Compression Strategy

### 2.1 When to Compress

```typescript
// src/agents/compression-trigger.ts

interface CompressionMetrics {
  trajectoryLength: number;
  turns: number;
  wordCount: number;
  estimatedTokens: number;
  lastCompressionAt: number; // timestamp
}

export class CompressionTrigger {
  /**
   * Decide if trajectory should be compressed
   */
  static shouldCompress(metrics: CompressionMetrics): boolean {
    // Compress if:
    // 1. Trajectory exceeds 6K tokens AND
    // 2. It's been >20 turns since last compression AND
    // 3. We've completed 2+ planning cycles

    const tokens6k = metrics.estimatedTokens > 6000;
    const turnThreshold = metrics.turns > 20;
    const enoughIterations = metrics.trajectoryLength > 2;

    return tokens6k && turnThreshold && enoughIterations;
  }

  /**
   * Recommend compression strategy based on metrics
   */
  static recommendStrategy(metrics: CompressionMetrics): 'mask' | 'summarize' | 'archive' {
    // mask: Just remove verbose output (safe, 30-40% savings)
    // summarize: Create summary frames (moderate, 40-50% savings)
    // archive: Move old iterations to persistent store (aggressive, 60%+ savings)

    if (metrics.estimatedTokens < 4000) return 'mask';
    if (metrics.estimatedTokens < 8000) return 'summarize';
    return 'archive';
  }
}
```

### 2.2 Observation Masking (Safest Approach)

```typescript
// src/agents/observation-masking.ts

export class ObservationMasker {
  /**
   * Strip verbose tool output while preserving decision logic
   *
   * BEFORE (verbose):
   * ```
   * [DEBUG] Loading plan...
   * [DEBUG] Parsing schema...
   * [DEBUG] Validating steps...
   * Successfully created step: Database migration (id: step_123)
   * Successfully created step: Backend API (id: step_124)
   * [DEBUG] Serializing output...
   * Total time: 2.3s
   * ```
   *
   * AFTER (masked):
   * ```
   * Created 2 steps: Database migration, Backend API
   * Dependencies: 1 resolved
   * ```
   */
  static maskToolOutput(output: string): string {
    const lines = output.split('\n').filter(l => l.trim());

    // Extract signal lines
    const signals = {
      created: lines.filter(l => l.includes('created') || l.includes('Created')),
      updated: lines.filter(l => l.includes('updated') || l.includes('Updated')),
      deleted: lines.filter(l => l.includes('deleted') || l.includes('Deleted')),
      errors: lines.filter(l => l.includes('error') || l.includes('Error')),
      warnings: lines.filter(l => l.includes('warning') || l.includes('Warning')),
    };

    // Summarize
    const summary = [
      signals.created.length > 0 && `Created: ${signals.created.length} items`,
      signals.updated.length > 0 && `Updated: ${signals.updated.length} items`,
      signals.deleted.length > 0 && `Deleted: ${signals.deleted.length} items`,
      signals.errors.length > 0 && `⚠️ Errors: ${signals.errors.join('; ')}`,
      signals.warnings.length > 0 && `⚠️ Warnings: ${signals.warnings.length}`,
    ]
      .filter(Boolean)
      .join('\n');

    return summary || '[Tool completed]';
  }

  /**
   * Mask entire trajectory frame
   */
  static maskFrame(frame: TrajectoryFrame): TrajectoryFrame {
    return {
      ...frame,
      toolResult: frame.toolResult
        ? this.maskToolOutput(frame.toolResult)
        : undefined,
    };
  }

  /**
   * Apply to entire trajectory
   * Expected savings: 25-35% tokens, <1% accuracy impact
   */
  static maskTrajectory(frames: TrajectoryFrame[]): TrajectoryFrame[] {
    return frames.map(f => this.maskFrame(f));
  }
}
```

### 2.3 Iteration Summarization

```typescript
// src/agents/iteration-summarizer.ts

export interface IterationSummary {
  startTurn: number;
  endTurn: number;
  stepCount: number;
  scopesAffected: string[];
  dependencyResolutions: number;
  approvalsObtained: string[];
  summaryText: string;
}

export class IterationSummarizer {
  /**
   * Summarize a batch of turns (e.g., "turns 1-15") into a single frame
   *
   * Input: 15 detailed turns of planning
   * Output: 1 summary line + recent 5 turns
   */
  static summarizeIterations(
    frames: TrajectoryFrame[],
    recentCount: number = 5
  ): { summary: IterationSummary; recentFrames: TrajectoryFrame[] } {
    const recentFrames = frames.slice(-recentCount);
    const summarized = frames.slice(0, -recentCount);

    if (summarized.length === 0) {
      return { summary: null!, recentFrames };
    }

    const summary = this.computeSummary(summarized);
    return { summary, recentFrames };
  }

  private static computeSummary(frames: TrajectoryFrame[]): IterationSummary {
    const startTurn = frames[0].turn;
    const endTurn = frames[frames.length - 1].turn;

    // Count actions from tool calls
    const toolCallCounts = frames
      .filter(f => f.toolCall)
      .reduce((acc, f) => {
        const tool = f.toolCall!.name;
        acc[tool] = (acc[tool] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const summaryText =
      `Planning iterations ${startTurn}–${endTurn}: ` +
      Object.entries(toolCallCounts)
        .map(([tool, count]) => `${count}× ${tool}`)
        .join(', ') +
      `. Refined plan structure through multiple cycles.`;

    return {
      startTurn,
      endTurn,
      stepCount: toolCallCounts['create_step'] || 0,
      scopesAffected: this.extractScopes(frames),
      dependencyResolutions: toolCallCounts['resolve_dependency'] || 0,
      approvalsObtained: this.extractApprovals(frames),
      summaryText,
    };
  }

  private static extractScopes(frames: TrajectoryFrame[]): string[] {
    // Parse tool outputs for mentioned scopes
    const scopes = new Set<string>();
    frames.forEach(f => {
      if (f.toolResult) {
        const matches = f.toolResult.match(/scope[:\s]+(\w+)/gi);
        matches?.forEach(m => {
          const scope = m.split(/[:\s]+/)[1];
          if (scope) scopes.add(scope);
        });
      }
    });
    return Array.from(scopes);
  }

  private static extractApprovals(frames: TrajectoryFrame[]): string[] {
    const approvals: string[] = [];
    frames.forEach(f => {
      if (f.toolResult?.includes('approved')) {
        approvals.push(`Turn ${f.turn}`);
      }
    });
    return approvals;
  }
}
```

---

## 3. Position Strategy for Plans

### 3.1 Optimal Ordering for Multi-Document Contexts

When PlannerLead includes multiple plan versions or referenced documents:

```typescript
// src/relay/context-ordering.ts

interface RetrievedPlanVersion {
  plan: PlanVersion;
  relevanceScore: number; // 0-1
}

export class ContextOrdering {
  /**
   * Order documents to exploit U-curve (high-value at boundaries)
   *
   * Strategy:
   * - Top 3 most relevant → beginning
   * - Middle ranked → middle (safe position)
   * - Top 1-2 moderately relevant → end (recency bias)
   *
   * Result: ~10-15% improvement over random ordering
   */
  static orderForUCurve(
    plans: RetrievedPlanVersion[]
  ): RetrievedPlanVersion[] {
    // Sort by relevance (descending)
    const sorted = [...plans].sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (sorted.length <= 2) return sorted;

    const topThird = Math.ceil(sorted.length * 0.33);
    const topDocs = sorted.slice(0, topThird);
    const middleDocs = sorted.slice(topThird, -2);
    const endDocs = sorted.slice(-2);

    // Arrange: top → middle → bottom
    return [
      ...topDocs,           // Beginning (high attention)
      ...middleDocs,        // Middle (safe, can be verbose)
      ...endDocs,           // End (recency bias)
    ];
  }

  /**
   * Alternative: Interleave strategy
   * Alternate between high and low relevance to maintain attention
   */
  static orderInterleaved(plans: RetrievedPlanVersion[]): RetrievedPlanVersion[] {
    const sorted = [...plans].sort((a, b) => b.relevanceScore - a.relevanceScore);
    const result: RetrievedPlanVersion[] = [];
    let left = 0;
    let right = sorted.length - 1;
    let fromStart = true;

    while (left <= right) {
      if (fromStart) {
        result.push(sorted[left++]);
      } else {
        result.push(sorted[right--]);
      }
      fromStart = !fromStart;
    }

    return result;
  }
}
```

### 3.2 Instruction Placement in PlannerLead Prompt

```typescript
// src/agents/planner-lead-prompt.ts

export const PLANNER_SYSTEM_PROMPT = `
# Role: Planning Coordinator
You are the lead planning agent in a multi-agent agentic system.

## Core Responsibilities
- Coordinate plan creation and refinement across multiple scopes
- Resolve dependencies and conflicts between steps
- Manage approval workflows
- Ensure plans are versioned immutably

## Key Constraints
- Never mutate approved plans; create new versions instead
- Maintain step dependency DAG integrity
- All steps must have clear acceptance criteria
- Preserve approval status through versions

## Tools Available
- create_plan_version: Start a new plan or version
- add_step: Add step to current version
- resolve_dependency: Establish/fix dependency relationships
- request_approval: Escalate for human review
- publish_version: Release approved plan to orchestrator

## Output Format
Always respond with structured thinking before tool calls:
1. Current state (what version we're editing)
2. User request (what they asked for)
3. Analysis (dependencies, conflicts, scope changes)
4. Plan (steps I will take)
5. Tool calls (execution)
`;

export function buildPlannerContext(
  goal: string,
  currentPlan: PlanVersion,
  recentInteractions: TrajectoryFrame[]
): string {
  // Position 1: Instructions (high priority, placed first)
  const instructionSection = PLANNER_SYSTEM_PROMPT;

  // Position 2: Current goal (immediate context)
  const goalSection = `
## Current Request
${goal}

## Success Criteria
- Plan covers all scopes mentioned by user
- Dependencies are explicitly defined
- All steps have acceptance criteria
- Approval chain is clear
`;

  // Position 3: Working memory (can be verbose, middle is safe)
  const memorySection = formatTrajectory(recentInteractions);

  // Position 4: Current plan state (supporting, with structure)
  const planSection = `
## Current Plan (Version ${currentPlan.version})
${JSON.stringify(currentPlan, null, 2)}
`;

  // Position 5: Constraints (end, for recency bias)
  const constraintSection = `
## Important Constraints
- Do not edit approved versions
- Maintain immutability of published versions
- Flag breaking changes (scope removal, major restructuring)
`;

  return [
    instructionSection,
    goalSection,
    memorySection,
    planSection,
    constraintSection,
  ].join('\n\n');
}

function formatTrajectory(frames: TrajectoryFrame[]): string {
  return `
## Recent Interactions
${frames
  .map(
    f => `
**Turn ${f.turn}**: ${f.agentMessage.slice(0, 200)}...
${f.toolResult ? `→ Result: ${f.toolResult}` : ''}
`
  )
  .join('\n')}
`;
}
```

---

## 4. Monitoring & Metrics

### 4.1 Context Health Dashboard

```typescript
// src/monitoring/context-health.ts

export interface ContextHealthMetrics {
  sessionId: string;
  timestamp: string;
  trajectory: {
    turns: number;
    estimatedTokens: number;
    compressions: number;
  };
  context: {
    utilizationRate: number; // target 60-80%
    averageFrameSize: number;
    maxFrameSize: number;
  };
  performance: {
    hallucinations: number;
    approvalRate: number; // approved / total
    iterationsToApproval: number;
  };
  alerts: string[];
}

export class ContextHealthMonitor {
  static computeMetrics(
    sessionId: string,
    frames: TrajectoryFrame[],
    plans: PlanVersion[],
    contextWindow: number
  ): ContextHealthMetrics {
    const estimatedTokens = this.estimateTokens(frames);
    const utilizationRate = estimatedTokens / contextWindow;

    return {
      sessionId,
      timestamp: new Date().toISOString(),
      trajectory: {
        turns: frames.length,
        estimatedTokens,
        compressions: 0, // tracked separately
      },
      context: {
        utilizationRate,
        averageFrameSize: estimatedTokens / frames.length,
        maxFrameSize: Math.max(
          ...frames.map(f => this.frameTokens(f))
        ),
      },
      performance: {
        hallucinations: 0, // implement error detection
        approvalRate: plans.filter(p => p.status === 'approved').length / plans.length,
        iterationsToApproval: this.averageIterations(plans),
      },
      alerts: this.generateAlerts(
        utilizationRate,
        frames.length,
        estimatedTokens
      ),
    };
  }

  private static estimateTokens(frames: TrajectoryFrame[]): number {
    return frames.reduce((sum, f) => sum + this.frameTokens(f), 0);
  }

  private static frameTokens(frame: TrajectoryFrame): number {
    const content = [
      frame.agentMessage,
      frame.toolResult,
      frame.reasoning,
    ]
      .filter(Boolean)
      .join('');
    return Math.ceil(content.length / 4); // rough estimate
  }

  private static averageIterations(plans: PlanVersion[]): number {
    if (plans.length === 0) return 0;
    const latestPlan = plans[plans.length - 1];
    const maxVersion = plans.reduce((max, p) => Math.max(max, p.version), 0);
    return Math.ceil(maxVersion / Math.max(plans.length, 1));
  }

  private static generateAlerts(
    utilizationRate: number,
    turns: number,
    tokens: number
  ): string[] {
    const alerts: string[] = [];

    if (utilizationRate < 0.6) {
      alerts.push('Context underutilized (< 60%); consider more detailed context');
    }
    if (utilizationRate > 0.85) {
      alerts.push('Context nearly full (> 85%); compression recommended');
    }
    if (turns > 30) {
      alerts.push('Long session (30+ turns); trajectory compression strongly recommended');
    }
    if (tokens > 10000) {
      alerts.push('High token usage; consider aggressive observation masking');
    }

    return alerts;
  }
}
```

### 4.2 Metrics to Track

```typescript
// Key metrics for Plannr effectiveness

interface PlannerMetrics {
  // Trajectory health
  avgTrajectoryLength: number;        // target: growing, but <8K tokens
  compressionRatio: number;           // target: 1.3–1.5x (30-50% savings)
  contextualizationQuality: number;   // 0-1, based on step relevance

  // Plan quality
  approvalRate: number;               // target: >90%
  iterationsToApproval: number;       // target: <5 on average
  stepAccuracyRate: number;           // % of steps matching user intent

  // Performance
  avgResponseTime: number;            // ms; target: <5s with compression
  costPerPlan: number;                // tokens × model pricing

  // Agent behavior
  hallucinations: number;             // count, target: 0
  explanationQuality: number;         // 0-1, human rating
  scopeDetectionAccuracy: number;     // % correct scopes identified
}
```

---

## 5. Implementation Roadmap

### Phase 1: Basic Structure (Weeks 1-2)

- [ ] Implement `ContextBuilder` class
- [ ] Build system prompt with proper positioning
- [ ] Add observation masking for tool outputs
- [ ] Manual testing with sample sessions

### Phase 2: Compression (Weeks 3-4)

- [ ] Implement `CompressionTrigger` and `ObservationMasker`
- [ ] Add iteration summarization
- [ ] Track compression metrics
- [ ] Test on 50+ session samples

### Phase 3: Optimization (Weeks 5-6)

- [ ] Implement U-curve ordering for multi-document contexts
- [ ] Add health monitoring dashboard
- [ ] Tune budget allocations based on real usage
- [ ] A/B test compression strategies

### Phase 4: Multi-Agent Coordination (Weeks 7+)

- [ ] Extend context format for relay messages
- [ ] Test coordination at scale (3+ agents)
- [ ] Measure context propagation overhead
- [ ] Implement feedback loop for context adjustments

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
// tests/context-builder.test.ts

describe('ContextBuilder', () => {
  it('allocates budget correctly (12% system, 18% task, etc)', () => {
    const builder = new ContextBuilder(12000);
    const budget = builder.budget;
    expect(budget.system.percentage).toBe(12);
    expect(budget.task.percentage).toBe(18);
  });

  it('observation masks verbose tool output', () => {
    const masked = ObservationMasker.maskToolOutput(VERBOSE_OUTPUT);
    expect(masked.length).toBeLessThan(VERBOSE_OUTPUT.length * 0.5);
    expect(masked).toContain('Created: 3 items');
  });

  it('U-curve ordering places top docs at boundaries', () => {
    const plans = generateMockPlans(10);
    const ordered = ContextOrdering.orderForUCurve(plans);
    // Assert first 3 and last 2 are highest relevance
  });
});
```

### 6.2 Integration Tests

```typescript
// tests/planner-session.test.ts

describe('Full Planning Session', () => {
  it('completes 10-turn session without compression', async () => {
    const lead = new PlannerLead();
    const session = await lead.startSession('Add authentication to API');

    for (let i = 0; i < 10; i++) {
      await session.refine('Add X');
      expect(session.context.metadata.utilizationRate).toBeLessThan(0.85);
    }
  });

  it('compresses mid-session when tokens exceed threshold', async () => {
    const lead = new PlannerLead();
    const session = await lead.startSession('Complex multi-scope feature');

    // Force many turns
    for (let i = 0; i < 25; i++) {
      await session.refine(`Refine iteration ${i}`);
    }

    expect(session.metrics.compressions).toBeGreaterThan(0);
    expect(session.context.metadata.totalTokens).toBeLessThan(12000);
  });
});
```

### 6.3 Metrics Validation

```typescript
// Monitor these metrics in production

const HEALTH_THRESHOLDS = {
  maxTokens: 12000,
  minUtilization: 0.60,
  maxUtilization: 0.85,
  maxResponseTime: 5000, // ms
  minApprovalRate: 0.85,
  maxHallucinations: 0.05, // 5% max
};

function validateSessionHealth(metrics: ContextHealthMetrics): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (metrics.trajectory.estimatedTokens > HEALTH_THRESHOLDS.maxTokens) {
    errors.push(`Tokens ${metrics.trajectory.estimatedTokens} > ${HEALTH_THRESHOLDS.maxTokens}`);
  }

  if (metrics.context.utilizationRate < HEALTH_THRESHOLDS.minUtilization) {
    warnings.push('Context underutilized');
  }

  // ... more validations

  return { valid: errors.length === 0, errors, warnings };
}
```

---

## 7. Troubleshooting

### Q: My session context keeps exceeding 12K tokens
**A**: Trigger compression earlier. Reduce `recentCount` from 5 to 3 in `IterationSummarizer.summarizeIterations()`.

### Q: Plans aren't getting approved after compression
**A**: Check that approval requirements were preserved (not summarized away). Ensure `extractApprovals()` logic is sound.

### Q: Relay messages to other agents are too large
**A**: Use aggressive observation masking. Strip all tool output except "Created X, Updated Y, Errors: Z".

### Q: Agent seems to forget earlier context
**A**: You're hitting the "Lost in the Middle" effect. Move critical info to system prompt or add summary frames for older turns.

---

## 8. References

- **Main research**: `docs/context-utilization-trajectory-injection-research.md`
- **Related papers**: Lost in the Middle (Liu et al.), MemGPT, MEM1
- **Implementation patterns**: LangChain context engineering docs

---

**Version**: 1.0
**Status**: Ready for phase 2 implementation
**Last Updated**: February 2026

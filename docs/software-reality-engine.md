# Software Reality Engine: Beyond Planning

## The Core Insight

**Traditional planning tools are disconnected from reality.**

Jira, Linear, Asana, Monday — they all share the same fundamental limitation: they track *intent* (what we want to do) and *status* (did someone mark it done?), but they have no idea *what was actually built*.

The "done" checkbox is a human assertion, not a verified fact. The plan and reality drift apart silently.

```
Traditional Planning Tool:

    INTENT              EXECUTION            REALITY
  ┌─────────┐          ┌─────────┐          ┌─────────┐
  │  Plan   │    ?     │  ???    │    ?     │  Code   │
  │  Tasks  │ ──────── │ (black  │ ──────── │ Commits │
  │  Status │          │  box)   │          │ Deploy  │
  └─────────┘          └─────────┘          └─────────┘
       ▲
       │
       │ Human marks "done"
       │ (trust-based, often wrong)
       │ (no verification)
       │ (drift is invisible)
```

**What Planner + Trajectories enables is fundamentally different:**

```
Software Reality Engine:

    INTENT              EXECUTION            REALITY           KNOWLEDGE
  ┌─────────┐          ┌─────────┐          ┌─────────┐       ┌─────────┐
  │  Plan   │ ◄─────── │Trajectory│ ──────── │  Code   │ ───── │  Graph  │
  │  Steps  │          │ Trace   │          │ Commits │       │ Index   │
  │Criteria │ ───────► │Decisions│ ◄─────── │ Artifacts│ ◄──── │ Queries │
  └─────────┘          └─────────┘          └─────────┘       └─────────┘
       │                    │                    │                 │
       │                    │                    │                 │
       └────────────────────┴────────────────────┴─────────────────┘
                                    │
                          CLOSED LOOP VERIFICATION

  • Plan says what should exist
  • Trajectory shows how it was built
  • Reality is the actual artifacts
  • Knowledge graph connects everything
  • Drift is detected, not assumed away
```

---

## What Makes This Different

### The Three Disconnects (That We Solve)

| Disconnect | Classic Tools | Software Reality Engine |
|------------|--------------|------------------------|
| **Intent ↔ Execution** | "Work on task X" → developer does something | Plan step → trajectory captures every decision, tool call, reasoning |
| **Execution ↔ Reality** | "I'm done" → code exists somewhere | Trajectory → linked commits, files, PRs with full provenance |
| **Reality ↔ Intent** | Manual status update, often stale | Automatic verification: does code satisfy acceptance criteria? |

### The Trajectory Difference

A trajectory is not a log. It's a **complete record of how something was built**:

```
Trajectory: t_abc123
Plan: plan_xyz / Step: "Add user authentication"
Agent: claude-coder-01
Duration: 47 minutes
Status: completed

Events:
  1. [prompt] User requested: "Implement OAuth login with Google"
  2. [reasoning] Analyzing existing auth patterns in codebase...
  3. [tool:read] Read src/auth/index.ts
  4. [reasoning] Found existing session middleware, will extend
  5. [tool:write] Created src/auth/oauth.ts
  6. [tool:bash] npm install google-auth-library
  7. [reasoning] Need to add callback route...
  8. [tool:edit] Modified src/routes/auth.ts
  9. [tool:bash] npm test -- --grep "oauth"
  10. [reasoning] Tests passing, committing...
  11. [tool:bash] git commit -m "Add Google OAuth login"
  12. [completion] Step completed with artifacts

Artifacts:
  - commit: a1b2c3d "Add Google OAuth login"
  - files_created: [src/auth/oauth.ts]
  - files_modified: [src/routes/auth.ts, package.json]
  - tests_run: 12 passed, 0 failed

Decisions:
  - "Extended existing session middleware rather than replacing"
  - "Used google-auth-library instead of passport-google"
  - "Stored tokens in existing user session, not separate table"
```

This is **executable knowledge**. We know not just *what* was built, but *why*, *how*, and *what alternatives were considered*.

---

## Capabilities Unlocked

### 1. Reality-Aware Planning

**Classic approach:**
> "Is the auth feature done?"
> → Check if someone ticked a box
> → Hope they were honest
> → No actual verification

**Reality Engine approach:**
> "Is the auth feature done?"
> → Analyze trajectories for this plan step
> → Check: were acceptance criteria addressed?
> → Check: what code was produced?
> → Check: do tests exist and pass?
> → Check: is it deployed?
> → **Verified answer with evidence**

```typescript
interface CompletionVerification {
  step_id: string;

  // Evidence from trajectories
  trajectories: TrajectoryRef[];

  // Acceptance criteria status
  criteria_status: {
    criterion_id: string;
    status: 'verified' | 'partial' | 'unverified' | 'failed';
    evidence?: {
      trajectory_id: string;
      event_index: number;
      description: string;
    };
  }[];

  // Artifacts produced
  artifacts: {
    type: 'commit' | 'file' | 'pr' | 'deployment';
    ref: string;
    trajectory_id: string;
  }[];

  // Overall assessment
  completion: 'complete' | 'partial' | 'blocked' | 'not_started';
  confidence: number; // 0-1
}
```

### 2. Drift Detection

Plans drift from reality. In classic tools, you don't know until someone notices (if ever). The Reality Engine detects drift automatically.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DRIFT DETECTION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Plan Step: "Add OAuth login with Google and GitHub"                        │
│                                                                              │
│  Expected (from acceptance criteria):                                        │
│    ✓ Google OAuth implemented                                                │
│    ✗ GitHub OAuth implemented                                                │
│    ✓ Login page updated                                                      │
│    ? Tests for both providers                                                │
│                                                                              │
│  Actual (from trajectory analysis):                                          │
│    ✓ Google OAuth implemented (trajectory t_abc, commit a1b2c3d)            │
│    ✗ GitHub OAuth NOT found in any trajectory                                │
│    ✓ Login page updated (trajectory t_abc, commit a1b2c3d)                  │
│    △ Tests exist for Google only                                             │
│                                                                              │
│  ⚠️  DRIFT DETECTED                                                          │
│                                                                              │
│  Trajectory t_abc shows agent decision:                                      │
│    "Implementing Google OAuth first, GitHub deferred due to                  │
│     API key not being available in environment"                              │
│                                                                              │
│  Suggested actions:                                                          │
│    [ ] Update plan to reflect partial completion                             │
│    [ ] Create follow-up step for GitHub OAuth                                │
│    [ ] Add GitHub API key to environment and continue                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
interface DriftReport {
  plan_id: string;
  step_id: string;
  detected_at: string;

  drift_type:
    | 'incomplete'      // Not all criteria met
    | 'divergent'       // Built something different
    | 'scope_creep'     // Built more than planned
    | 'abandoned'       // Started but not finished
    | 'superseded';     // Later work changed/removed it

  plan_expected: string;
  reality_actual: string;

  // Where we learned about the drift
  evidence: {
    trajectory_id: string;
    event_type: string;
    description: string;
  }[];

  // What the agent was thinking when drift occurred
  agent_reasoning?: string;

  suggested_actions: {
    action: string;
    impact: string;
  }[];
}
```

### 3. Code Archaeology ("Why Does This Exist?")

Every piece of code can be traced back to its origin:
- Which plan step requested it
- Which trajectory created it
- What decisions were made
- What alternatives were considered
- What context existed at the time

```
User query: "Why do we have exponential backoff in api/client.ts?"

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CODE ARCHAEOLOGY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  File: src/api/client.ts                                                     │
│  Lines: 45-67 (exponential backoff implementation)                           │
│                                                                              │
│  ORIGIN:                                                                     │
│  ────────                                                                    │
│  Plan: "API Resilience Improvements" (plan_xyz)                              │
│  Step: "Add retry logic to API client" (step_003)                            │
│  Trajectory: t_def456                                                        │
│  Created: 2024-01-15                                                         │
│  Agent: claude-coder-02                                                      │
│                                                                              │
│  CONTEXT AT TIME OF CREATION:                                                │
│  ─────────────────────────────                                               │
│  User mentioned: "API calls failing intermittently in production"            │
│  Agent observed: "No retry logic exists, failures are immediate"             │
│  Agent decided: "Implement exponential backoff with jitter"                  │
│                                                                              │
│  ALTERNATIVES CONSIDERED:                                                    │
│  ─────────────────────────                                                   │
│  1. Simple retry with fixed delay - rejected: "Could overwhelm server"       │
│  2. Circuit breaker pattern - deferred: "Good idea but overkill for now"     │
│  3. Exponential backoff - chosen: "Standard practice, handles load spikes"   │
│                                                                              │
│  RELATED CHANGES:                                                            │
│  ────────────────                                                            │
│  - Same trajectory added request timeout (lines 23-30)                       │
│  - Later trajectory t_ghi789 added circuit breaker (lines 70-95)            │
│                                                                              │
│  DEPENDENCIES:                                                               │
│  ─────────────                                                               │
│  - Used by: AuthService, DataFetcher, WebhookClient (12 call sites)         │
│  - Depends on: config.retry settings                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
interface CodeProvenance {
  file_path: string;
  line_range: [number, number];

  // Origin
  origin: {
    plan_id: string;
    step_id: string;
    trajectory_id: string;
    created_at: string;
    agent_id: string;
  };

  // Context when created
  context: {
    user_request?: string;
    agent_observations: string[];
    decision_reasoning: string;
  };

  // Alternatives that were considered
  alternatives_considered: {
    option: string;
    rejected_reason: string;
  }[];

  // Subsequent modifications
  modifications: {
    trajectory_id: string;
    date: string;
    description: string;
    lines_affected: [number, number];
  }[];

  // Current dependency graph
  dependencies: {
    used_by: string[];    // Files/functions that use this
    depends_on: string[]; // What this code needs
  };
}
```

### 4. Intelligent Continuation

Not just "resume where I left off" — resume with **full understanding** of context, partial work, and blockers.

```
User: "Continue working on the dashboard feature"

┌─────────────────────────────────────────────────────────────────────────────┐
│                      INTELLIGENT CONTINUATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Plan: "User Dashboard" (plan_abc)                                           │
│  Progress: 5/8 steps completed                                               │
│                                                                              │
│  CURRENT STATE:                                                              │
│  ──────────────                                                              │
│  ✓ Step 1: Dashboard layout component                                        │
│  ✓ Step 2: User stats API endpoint                                           │
│  ✓ Step 3: Activity feed component                                           │
│  ✓ Step 4: Data fetching hooks                                               │
│  ✓ Step 5: Loading states                                                    │
│  ◐ Step 6: Real-time updates ← PARTIAL                                       │
│  ○ Step 7: Mobile responsive                                                 │
│  ○ Step 8: Performance optimization                                          │
│                                                                              │
│  PARTIAL WORK (Step 6):                                                      │
│  ──────────────────────                                                      │
│  Last trajectory: t_xyz789 (ended 2 days ago)                                │
│  - Created: useRealtimeUpdates hook (complete)                               │
│  - Created: WebSocket connection manager (complete)                          │
│  - Started: Integration with ActivityFeed (incomplete)                       │
│  - Blocker noted: "WebSocket server not deployed to staging"                 │
│                                                                              │
│  Agent's last state:                                                         │
│  - File open: src/components/ActivityFeed.tsx                                │
│  - Uncommitted changes: 23 lines (WebSocket subscription)                    │
│  - Test status: 2 tests skipped (waiting for WS server)                      │
│                                                                              │
│  CONTINUATION OPTIONS:                                                       │
│  ─────────────────────                                                       │
│  [1] Resume Step 6 - integrate WebSocket (needs WS server)                   │
│  [2] Skip to Step 7 - mobile responsive (no blockers)                        │
│  [3] Mock WebSocket and continue Step 6                                      │
│  [4] Review partial work before continuing                                   │
│                                                                              │
│  CONTEXT RESTORATION:                                                        │
│  ────────────────────                                                        │
│  If resuming Step 6, agent will receive:                                     │
│  - Full trajectory history (decisions made)                                  │
│  - Uncommitted changes                                                       │
│  - Test results                                                              │
│  - Blocker context                                                           │
│  - Related file contents                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
interface ContinuationContext {
  plan_id: string;

  // Overall progress
  progress: {
    total_steps: number;
    completed: number;
    in_progress: number;
    blocked: number;
  };

  // Current step state
  current_step: {
    step_id: string;
    status: 'not_started' | 'in_progress' | 'blocked' | 'completed';

    // Last trajectory for this step
    last_trajectory?: {
      trajectory_id: string;
      ended_at: string;
      end_reason: 'completed' | 'blocked' | 'timeout' | 'user_stopped';

      // Work done
      artifacts_created: string[];
      uncommitted_changes?: string[];

      // State when stopped
      last_file_open?: string;
      last_reasoning?: string;
      blocker?: string;
    };
  };

  // What's needed to continue
  continuation_requirements: {
    blockers: { description: string; resolution?: string }[];
    missing_context: string[];
    recommended_action: string;
  };

  // Full context for agent handoff
  agent_context: {
    trajectory_summary: string;
    key_decisions: string[];
    open_questions: string[];
    file_states: { path: string; status: string }[];
  };
}
```

### 5. Knowledge Graph Queries

Ask questions about your codebase in natural language, answered by analyzing plans, trajectories, and code together.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KNOWLEDGE QUERIES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Q: "What authentication methods do we support?"                             │
│                                                                              │
│  A: Based on plan analysis and trajectory evidence:                          │
│                                                                              │
│     ✓ Google OAuth (complete)                                                │
│       - Implemented in plan_abc, step 3                                      │
│       - Trajectory t_123, commit a1b2c3d                                     │
│       - Files: src/auth/google.ts, src/routes/auth/google.ts                │
│       - Tests: 8 passing                                                     │
│                                                                              │
│     ✓ Email/Password (complete)                                              │
│       - Implemented in plan_abc, step 1                                      │
│       - Trajectory t_111, commit x1y2z3                                      │
│       - Files: src/auth/password.ts, src/routes/auth/login.ts               │
│       - Tests: 12 passing                                                    │
│                                                                              │
│     ◐ GitHub OAuth (partial)                                                 │
│       - Planned in plan_abc, step 4                                          │
│       - Trajectory t_456 started but blocked                                 │
│       - Blocker: "Missing GitHub API credentials"                            │
│       - Partial files: src/auth/github.ts (scaffolding only)                │
│                                                                              │
│     ○ SAML SSO (planned, not started)                                        │
│       - In plan_def, step 2                                                  │
│       - Dependencies: Enterprise tier feature flag                           │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Q: "What would break if I remove the User.legacyId field?"                 │
│                                                                              │
│  A: Impact analysis from trajectory and code analysis:                       │
│                                                                              │
│     DIRECT DEPENDENCIES (code references):                                   │
│     - src/migrations/legacy-import.ts (migration script)                     │
│     - src/api/legacy/users.ts (legacy API compatibility)                     │
│     - src/services/billing.ts (Stripe customer lookup)                       │
│                                                                              │
│     TRAJECTORY CONTEXT (why it exists):                                      │
│     - Added in trajectory t_legacy123 during "Legacy Migration" plan         │
│     - Purpose: "Map old system user IDs to new system during migration"      │
│     - Agent note: "Can be removed after migration complete + 6 months"       │
│                                                                              │
│     RISK ASSESSMENT:                                                         │
│     - Migration completed: 2024-06-15 (8 months ago)                        │
│     - Last access to legacy API: 2024-09-01 (5 months ago)                  │
│     - Billing lookup: STILL ACTIVE (23 calls/day)                           │
│                                                                              │
│     RECOMMENDATION:                                                          │
│     ⚠️ Do not remove yet. Billing service still uses legacyId for           │
│        Stripe customer lookup. Need to migrate billing first.                │
│                                                                              │
│     SUGGESTED PLAN:                                                          │
│     1. Migrate Stripe customer lookup to use User.stripeCustomerId           │
│     2. Deprecate legacy API (add sunset header)                              │
│     3. Remove legacyId after 30 days with no legacy API calls               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Auto-Generated Living Documentation

Documentation isn't written manually — it's **derived** from the combination of plans, trajectories, and code.

```markdown
# Authentication System
<!-- Auto-generated from plans and trajectories. Last updated: 2024-02-15 -->

## Overview

The authentication system was implemented across 3 plan versions over 6 weeks,
handling user login, session management, and role-based access control.

## Implementation History

| Version | Date | Changes | Trajectory |
|---------|------|---------|------------|
| v1 | 2024-01-05 | Basic email/password auth | t_auth001 |
| v2 | 2024-01-20 | Added Google OAuth | t_auth002 |
| v3 | 2024-02-10 | Added role-based access | t_auth003 |

## Architecture

```
┌─────────────────────────────────────────────┐
│                  API Layer                   │
│  /auth/login  /auth/google  /auth/logout    │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│              Auth Middleware                 │
│  Session validation, role checking          │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│              Auth Services                   │
│  PasswordAuth, GoogleOAuth, SessionManager  │
└─────────────────────────────────────────────┘
```

## Key Decisions

These decisions were captured from agent reasoning during implementation:

1. **JWT vs Sessions** (trajectory t_auth001)
   - Chose: JWT for statelessness
   - Reasoning: "Easier horizontal scaling, no session store needed"
   - Trade-off: "Revocation is harder, using short expiry + refresh tokens"

2. **Google Auth Library** (trajectory t_auth002)
   - Chose: google-auth-library over passport-google
   - Reasoning: "Direct library has fewer dependencies, better TypeScript support"

3. **Role Storage** (trajectory t_auth003)
   - Chose: Roles in JWT claims
   - Reasoning: "Avoids DB lookup on every request"
   - Trade-off: "Role changes require token refresh"

## Files

| File | Purpose | Added In |
|------|---------|----------|
| src/auth/password.ts | Password hashing, validation | t_auth001 |
| src/auth/google.ts | Google OAuth flow | t_auth002 |
| src/auth/session.ts | JWT creation, validation | t_auth001 |
| src/auth/roles.ts | Role definitions, checking | t_auth003 |
| src/middleware/auth.ts | Express middleware | t_auth001 |

## Related Plans

- [Authentication System v1](plan:auth-v1) - Initial implementation
- [OAuth Integration](plan:oauth) - Google OAuth addition
- [RBAC Implementation](plan:rbac) - Role-based access

## Test Coverage

- Unit tests: 34 passing
- Integration tests: 12 passing
- Coverage: 89%

## Known Limitations

From trajectory analysis, these were noted but not addressed:

1. "GitHub OAuth planned but blocked on API credentials" (t_auth002)
2. "Rate limiting on auth endpoints deferred to security hardening phase" (t_auth001)
3. "SAML SSO is enterprise feature, not in current scope" (t_auth003)
```

### 7. Impact Preview

Before making changes, understand what will be affected — based on actual execution history, not just static analysis.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IMPACT PREVIEW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Proposed change: "Refactor User model to remove email from base class"     │
│                                                                              │
│  STATIC ANALYSIS (traditional):                                              │
│  ─────────────────────────────                                               │
│  - 47 files reference User.email                                             │
│  - 23 TypeScript errors would occur                                          │
│                                                                              │
│  TRAJECTORY-ENHANCED ANALYSIS:                                               │
│  ─────────────────────────────                                               │
│                                                                              │
│  HIGH RISK (based on execution patterns):                                    │
│  ▸ src/services/notifications.ts                                             │
│    - Accessed User.email in 156 trajectories                                 │
│    - Critical path: password reset, order confirmation                       │
│    - Last execution: 2 minutes ago                                           │
│                                                                              │
│  ▸ src/api/users.ts                                                          │
│    - 89 trajectories modified this file                                      │
│    - External API contract: email in response                                │
│    - Breaking change for API consumers                                       │
│                                                                              │
│  MEDIUM RISK:                                                                │
│  ▸ src/auth/password.ts                                                      │
│    - Email used for login identifier                                         │
│    - 34 trajectories, stable for 3 months                                    │
│                                                                              │
│  LOW RISK (rarely executed):                                                 │
│  ▸ src/admin/user-export.ts                                                  │
│    - Only 3 trajectories ever touched this                                   │
│    - Last execution: 4 months ago                                            │
│    - Likely safe to update                                                   │
│                                                                              │
│  TRAJECTORY WARNINGS:                                                        │
│  ────────────────────                                                        │
│  ⚠️ Trajectory t_notif034 added email validation that assumes                │
│     User.email is always present. Agent reasoning: "Email required          │
│     for user creation, so it's safe to assume non-null"                      │
│                                                                              │
│  ⚠️ Trajectory t_api089 added email to public API response.                  │
│     Agent note: "Mobile app depends on this field"                           │
│                                                                              │
│  SUGGESTED APPROACH:                                                         │
│  ──────────────────                                                          │
│  Based on trajectory analysis, recommended migration path:                   │
│  1. Add User.contactEmail as new optional field                              │
│  2. Migrate notification service (high risk, active)                         │
│  3. Add API versioning for email field deprecation                           │
│  4. Update auth after API migration complete                                 │
│  5. Clean up admin export last (low risk)                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Data Model Extensions

```typescript
// Artifact links on steps - what was produced
interface StepArtifact {
  artifact_id: string;
  step_id: string;
  plan_id: string;

  // What kind of artifact
  type: 'commit' | 'file' | 'pr' | 'deployment' | 'test_run';

  // Reference to the actual artifact
  ref: string;  // commit SHA, file path, PR number, etc.

  // Which trajectory created this
  trajectory_id: string;
  trajectory_event_index: number;

  created_at: string;
}

// Evidence linking criteria to trajectory moments
interface CriterionEvidence {
  evidence_id: string;
  criterion_id: string;
  step_id: string;
  plan_id: string;

  // Status of this criterion
  status: 'verified' | 'partial' | 'failed' | 'unverified';

  // Where the evidence came from
  trajectory_id: string;
  trajectory_event_index: number;

  // What we observed
  observation: string;

  // Confidence in this assessment
  confidence: number;  // 0-1

  assessed_at: string;
}

// Reality snapshots - periodic "what exists" captures
interface RealitySnapshot {
  snapshot_id: string;
  org_id: string;

  captured_at: string;

  // What exists
  capabilities: {
    capability_id: string;
    status: 'complete' | 'partial' | 'planned';
    evidence: {
      plans: string[];
      trajectories: string[];
      files: string[];
    };
  }[];

  // Detected drift
  drift_items: DriftReport[];

  // Knowledge graph state
  graph_stats: {
    total_nodes: number;
    total_edges: number;
    orphaned_code: number;  // Code with no plan origin
  };
}

// Knowledge graph node
interface KnowledgeNode {
  node_id: string;

  // What this node represents
  type: 'plan' | 'step' | 'trajectory' | 'file' | 'function' | 'concept';
  ref: string;

  // Attributes
  attributes: Record<string, unknown>;

  // When this was last updated
  updated_at: string;
  updated_by_trajectory?: string;
}

// Knowledge graph edge
interface KnowledgeEdge {
  edge_id: string;

  from_node: string;
  to_node: string;

  // Relationship type
  relationship:
    | 'created_by'      // file created by trajectory
    | 'implements'      // code implements plan step
    | 'depends_on'      // dependency relationship
    | 'modified_by'     // later trajectory modified this
    | 'related_to'      // semantic relationship
    | 'supersedes';     // newer version replaces older

  // Confidence and provenance
  confidence: number;
  source_trajectory?: string;

  created_at: string;
}
```

### Query Interface

```typescript
interface RealityQuery {
  // Natural language query
  question: string;

  // Optional filters
  scope?: {
    plans?: string[];
    date_range?: { from: string; to: string };
    file_patterns?: string[];
  };

  // What kind of answer expected
  response_type?: 'summary' | 'detailed' | 'evidence';
}

interface RealityQueryResult {
  question: string;

  // The answer
  answer: string;

  // Evidence supporting the answer
  evidence: {
    type: 'plan' | 'trajectory' | 'code' | 'test';
    ref: string;
    relevance: string;
  }[];

  // Confidence in this answer
  confidence: number;

  // Related queries that might help
  related_queries?: string[];
}

// Example queries the system can answer:
const exampleQueries = [
  "What authentication methods do we support?",
  "Why does this code exist?",
  "What would break if I change X?",
  "Is feature Y complete?",
  "What was decided about Z and why?",
  "What's the history of this file?",
  "What's not tested?",
  "What's planned but not built?",
  "What's built but not planned?",  // Orphan detection
  "What decisions were made this week?",
];
```

---

## Integration with Existing Architecture

### Fits Within Current Domain Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTENDED DOMAIN MODEL                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EXISTING (unchanged):                                                       │
│  ────────────────────                                                        │
│  Organization ──┬── Initiative ──┬── Plan ──┬── PlanVersion ── Step         │
│                 │                │          │                    │           │
│                 │                │          │                    ├── Criteria│
│                 │                │          │                    └── Gate    │
│                 │                │          │                                │
│                 │                │          └── ChangeRequest               │
│                 │                │                                           │
│                 │                └── (future: Portfolio, Triage)            │
│                 │                                                            │
│                 └── OrgMember                                                │
│                                                                              │
│  NEW (Reality Engine):                                                       │
│  ─────────────────────                                                       │
│                                                                              │
│  Step ────────────┬── StepArtifact ── (commit, file, PR)                    │
│                   │                                                          │
│                   └── CriterionEvidence ── Trajectory                        │
│                                                                              │
│  Trajectory ──────┬── TrajectoryEvent                                        │
│                   │      │                                                   │
│                   │      ├── reasoning                                       │
│                   │      ├── tool_call                                       │
│                   │      ├── decision                                        │
│                   │      └── artifact                                        │
│                   │                                                          │
│                   └── (links to Step it was executing)                       │
│                                                                              │
│  KnowledgeGraph ──┬── KnowledgeNode ── (plan, step, file, concept)          │
│                   │                                                          │
│                   └── KnowledgeEdge ── (created_by, implements, depends_on) │
│                                                                              │
│  RealitySnapshot ─── (periodic state capture for drift detection)            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relationship to Future Subdomains

From `future-management-intelligence.md`:

| Future Subdomain | Reality Engine Role |
|------------------|---------------------|
| **Insights** | Reality Engine IS the foundation for Insights - queryable understanding of what exists |
| **Platform** | Trajectories feed Platform with execution telemetry |
| **Capabilities** | Reality snapshots assess capability maturity based on actual execution |
| **Alignment** | Drift detection IS alignment measurement for strategy-to-execution |

---

## Phased Implementation

### Phase 1: Artifact Linking (Foundation)
- Add `step_artifacts` table
- Link commits/files to steps via trajectory
- Basic "what was produced" queries

### Phase 2: Evidence Collection
- Add `criterion_evidence` table
- Trajectory analysis for acceptance criteria
- Completion verification

### Phase 3: Drift Detection
- Reality snapshots
- Plan vs execution comparison
- Drift alerts and suggestions

### Phase 4: Knowledge Graph
- Node and edge tables
- Relationship extraction from trajectories
- Basic graph queries

### Phase 5: Natural Language Queries
- Query interface
- LLM-powered answer generation
- Evidence retrieval

### Phase 6: Auto Documentation
- Documentation generation from graph
- Decision extraction
- Living docs update on trajectory completion

---

## The Vision

This transforms Planner from a **planning tool** into a **building tool** — or more precisely, a **Software Reality Engine** that:

1. **Knows what you want** (plans with structured acceptance criteria)
2. **Knows how you got there** (trajectories with full execution history)
3. **Knows what you have** (artifacts, code, with verified provenance)
4. **Can explain anything** (traceability from any code back to intent)
5. **Detects when reality drifts** (plan vs execution vs code)
6. **Can continue building** (intelligent context restoration)
7. **Generates documentation** (derived, not written)
8. **Answers questions** (natural language queries over the whole system)

This is not possible with traditional planning tools because they lack the execution trace. It's not possible with just code analysis because that lacks intent. It's the **combination** of structured plans, execution trajectories, and code reality that creates something new.

---

## See Also

- [Domain Model](./domain-model.md) — Current entity definitions
- [Architecture Synthesis](./architecture-synthesis.md) — How Planner fits in the larger system
- [Future Management Intelligence](./future-management-intelligence.md) — Distant future vision for management OS
- [Research: Relay Ecosystem](./research-relay-ecosystem.md) — Trajectory layer from agent-relay

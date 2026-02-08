# Step Decomposition Guidelines for Planner

Practical guide to designing high-reliability plans using error propagation research.

---

## Quick Decision Tree

```
Does your plan have 20+ steps?
  ├─ YES
  │  ├─ Is reliability requirement > 99%?
  │  │  ├─ YES → Use ATOMIC decomposition + consensus voting
  │  │  └─ NO  → COARSE-GRAINED is acceptable
  │  │
  │  └─ NO  → Use COARSE-GRAINED (lower overhead)
  │
  └─ NO (≤5 steps)
     └─ SEQUENTIAL (no decomposition needed)
```

---

## Step Sizing Rules

### What is an "Atomic" Step?

A step is atomic if:

1. **Single clear action**: The step has one well-defined goal
   - GOOD: "Add database migration for user_id field"
   - BAD: "Database work including migrations, indexes, and schema updates"

2. **Verifiable output**: Multiple agents/reviewers can confirm success
   - GOOD: "Create POST /api/users endpoint returning user JSON"
   - BAD: "Implement entire user API"

3. **Low context burden**: Can be understood and executed with minimal surrounding context
   - GOOD: "Fix lint error in src/components/Button.tsx"
   - BAD: "Fix all lint errors across the codebase"

4. **Independent execution**: Doesn't require detailed knowledge of parallel steps
   - GOOD: "Write unit tests for login function"
   - BAD: "Write all integration tests (depends on knowing all implementations)"

### Step Count Guidelines

| Plan Scope | Recommended Steps | Decomposition Strategy |
|---|---|---|
| 1-5 steps | 1-5 | Sequential (no decomposition) |
| 6-15 steps | 6-15 | Coarse-grained (if reliability < 99%) |
| 15-30 steps | 15-30 | ATOMIC decomposition required |
| 30+ steps | Break into sub-plans | Hierarchical (plan version references) |

**Reasoning**:
- 1-5 steps: Error compounding is manageable even at 95% per-step reliability (95% total reliability achievable)
- 6-15 steps: Exponential decay kicks in; consider decomposition if SLA matters
- 15-30 steps: Fine-grained decomposition + voting is most cost-effective
- 30+: Use PlanVersion sub-plans (hierarchical) to keep parent plan cognitive load manageable

---

## Decomposition Strategies

### Strategy 1: Sequential (1-5 steps)

**When to use**: Small, well-scoped plans with clear dependencies.

**Structure**:
```
Step 1: Prerequisite setup
  ├─ depends_on: []
Step 2: Main work A
  ├─ depends_on: [Step 1]
Step 3: Main work B
  ├─ depends_on: [Step 2]
Step 4: Integration
  ├─ depends_on: [Step 2, Step 3]
Step 5: Validation
  ├─ depends_on: [Step 4]
```

**Reliability calculation** (independent per-step at 95%):
- 1 step: 95%
- 2 steps: 90.25%
- 3 steps: 85.74%
- 4 steps: 81.45%
- 5 steps: 77.38%

**Action**: If total reliability drops below acceptable threshold, move to atomic decomposition.

### Strategy 2: Coarse-Grained (6-15 steps, low-reliability requirement)

**When to use**:
- Reliability requirement < 99%
- Steps have complex interdependencies
- Cost minimization is priority over reliability

**Structure**:
```
Step 1: Frontend Implementation (contains several tasks)
  ├─ depends_on: []
  ├─ acceptance_criteria:
  │  ├─ Login form renders
  │  ├─ Form validation works
  │  └─ Session storage implemented
  │
Step 2: Backend API (contains several tasks)
  ├─ depends_on: [Step 1]  # Interdependent
  ├─ acceptance_criteria:
  │  ├─ POST /login endpoint
  │  ├─ Session verification
  │  └─ Error handling
  │
Step 3: Integration Testing
  ├─ depends_on: [Step 1, Step 2]
  ├─ acceptance_criteria:
  │  ├─ End-to-end login flow
  │  ├─ Session persistence
  │  └─ Logout clears session
```

**Tradeoff**: Lower management overhead, but lower reliability. Consensus voting is less effective because agents produce divergent outputs on complex subtasks.

**Recommendation**: Use acceptance criteria heavily to constrain subtask scope.

### Strategy 3: Atomic Decomposition (15-30 steps, high-reliability requirement)

**When to use**:
- Reliability requirement > 99%
- Task can be broken into independent, verifiable actions
- Can tolerate higher coordination overhead

**Structure**:
```
Step 1: Create user_id column
  ├─ depends_on: []
  ├─ title: "Add user_id field to accounts table"
  ├─ description: "PostgreSQL migration adding user_id UUID, default uuid_generate_v4(), NOT NULL"
  ├─ acceptance_criteria:
  │  ├─ Migration file created (src/migrations/202X-XX-XX-add-user-id.sql)
  │  ├─ Schema includes user_id UNIQUE constraint
  │  └─ Migration is idempotent (can re-run safely)
  │
Step 2: Create user_id index
  ├─ depends_on: [Step 1]
  ├─ title: "Add index on user_id for query performance"
  ├─ description: "Create B-tree index on accounts.user_id for O(log n) lookups"
  ├─ acceptance_criteria:
  │  ├─ Index exists in database
  │  ├─ EXPLAIN shows index usage
  │  └─ No performance regression on other indexes
  │
Step 3: Write login endpoint
  ├─ depends_on: [Step 1]
  ├─ title: "Implement POST /api/login endpoint"
  ├─ description: "Express endpoint: accept (username, password), return JWT token"
  ├─ acceptance_criteria:
  │  ├─ Endpoint exists at POST /api/login
  │  ├─ Returns 200 + JWT on valid credentials
  │  ├─ Returns 401 on invalid credentials
  │  └─ Request body validation (required fields)
  │
Step 4: Write login tests
  ├─ depends_on: [Step 3]
  ├─ title: "Unit tests for login endpoint"
  ├─ description: "Jest tests: valid creds, invalid creds, missing fields, SQL injection attempts"
  ├─ acceptance_criteria:
  │  ├─ 100% code coverage on login handler
  │  ├─ All edge cases tested
  │  └─ Tests pass on CI/CD
```

**Benefits**:
1. Each step is independently verifiable (consensus voting is effective)
2. Error in one step doesn't cascade (isolated impact)
3. With 5 parallel agents: 43× reliability improvement
4. With 13 parallel agents: 14,700× reliability improvement

**Cost**:
- Higher absolute cost (multiple agents, voting overhead)
- But achieves impossible reliability levels for complex plans

---

## Multi-Scope Planning

When plans cross repos/teams/domains:

### Scope Grouping

```
Plan: "Add User Authentication"

Scope: backend
├─ Step: Add OAuth endpoints
├─ Step: Add session middleware
├─ Step: Add JWT validation
│
Scope: frontend
├─ Step: Create login page component
├─ Step: Add protected route wrapper
├─ Step: Add logout button
│
Scope: infrastructure
├─ Step: Configure OAuth secrets in CI/CD
├─ Step: Update environment variables docs
```

**Guideline**: 15-20 steps per scope (cognitive manageability). If scope has 30+, consider sub-plan.

### Dependencies Across Scopes

**Keep explicit**: Don't assume reviewers know cross-scope dependencies.

```
Step: Add OAuth endpoints (backend scope)
├─ depends_on: []
├─ note: "Must complete before frontend OAuth flow implementation"

Step: Create login page (frontend scope)
├─ depends_on: ["Add OAuth endpoints"]
├─ note: "Depends on backend POST /oauth/token endpoint"
```

**Rationale**: Planner infers dependencies from step descriptions. Make them explicit for clarity.

---

## Reliability Calculation

### Single-Agent Reliability

**Formula**: P(total) = Π(per-step success rates)

**Example** (6 coarse-grained steps at 95% each):
```
P(total) = 0.95^6 = 0.735 = 73.5%
```

This is unacceptable for production. Options:

1. **Increase per-step success** (use better agent/model): Expensive
2. **Reduce step count** (coarser decomposition): Reduces reliability further (bad)
3. **Use decomposition + voting**: Multiply steps while maintaining/improving reliability

### Multi-Agent Reliability (Consensus Voting)

**Formula**: P(system) = P(majority agents correct)

**With n agents at error rate p**:
```
P(system) ≈ p^⌈n/2⌉  [for independent errors]

Examples:
  n=3, p=0.05 (95% individual): P(system) = 0.05^2 = 0.0025 (99.75%)
  n=5, p=0.05:                  P(system) = 0.05^3 ≈ 0.0001 (99.99%)
  n=7, p=0.05:                  P(system) = 0.05^4 ≈ 0.000006 (99.9994%)
```

**Practical implication**: Doubling agent count exponentially improves reliability (assuming independent errors).

### Reliability Target vs. Agent Count

Given target system reliability R and individual per-step error p, find agent count n:

```
Required n: p^⌈n/2⌉ ≤ (1 - R)

Examples (solving for n, p=0.05):

Target: 99%
  (1 - 0.99) = 0.01
  0.05^⌈n/2⌉ ≤ 0.01
  ⌈n/2⌉ ≥ 2.3
  n ≥ 5 agents

Target: 99.9%
  (1 - 0.999) = 0.001
  0.05^⌈n/2⌉ ≤ 0.001
  ⌈n/2⌉ ≥ 3.4
  n ≥ 7 agents

Target: 99.99%
  (1 - 0.9999) = 0.0001
  0.05^⌈n/2⌉ ≤ 0.0001
  ⌈n/2⌉ ≥ 4.5
  n ≥ 9 agents
```

---

## Step Interdependencies

### How to Identify Dependencies

**Explicit dependencies**: Step B requires output from Step A
```
Step A: Create database migration
Step B: Verify migration succeeds
  └─ depends_on: [Step A]
```

**Soft dependencies**: Steps should be done in order but don't strictly require previous output
```
Step A: Design schema
Step B: Implement in code
  └─ depends_on: [Step A]  # B reviews A design, but could theoretically happen in parallel
```

**No dependency**: Steps are independent
```
Step A: Update frontend documentation
Step B: Update backend documentation
  └─ depends_on: []  # Fully parallel
```

### Dependency Complexity

**GOOD** (low complexity):
- Linear DAG: A → B → C → D (easy to understand, hard to parallelize)
- Fan-in: A, B, C → D (multiple producers, single consumer)

**ACCEPTABLE** (moderate complexity):
- Fan-out: A → B, C, D (single producer, multiple consumers)
- Diamond: A → B,C → D (requires both B and C before D)

**PROBLEMATIC** (high complexity):
- Cycles: A → B → C → A (indicates poor decomposition)
- Complex interdependencies: Every step depends on multiple others (not a DAG)

**Action**: If dependency graph is complex, reconsider scope. Break into sub-plans.

---

## Acceptance Criteria

### Structure

Each acceptance criterion should be:

1. **Specific**: Not vague
   - GOOD: "Test coverage ≥ 95% for new functions"
   - BAD: "Thorough testing"

2. **Measurable**: Can be objectively verified
   - GOOD: "Code lints without warnings (eslint)"
   - BAD: "Code is clean"

3. **Linked to verification**:
   - GOOD: "All unit tests pass in CI (npm run test)"
   - BAD: "Tests pass"

### Examples

**Database step**:
```
Step: Create user_id column
acceptance_criteria:
  - Migration file is idempotent (can re-run safely)
  - user_id UNIQUE constraint enforced
  - Migration tested on staging database
  - Rollback migration also tested
```

**Code step**:
```
Step: Write login endpoint
acceptance_criteria:
  - Code lints without warnings (npm run lint)
  - All unit tests pass (npm run test src/login.test.ts)
  - Coverage ≥ 95% on src/login.ts
  - API response matches OpenAPI spec
  - Handles 401/403 error cases
```

**Review step**:
```
Step: Security review of OAuth implementation
acceptance_criteria:
  - OWASP Top 10 checklist completed
  - No hardcoded secrets in code
  - Secrets stored in CI/CD environment variables
  - Security lead approves via GitHub review
```

---

## Execution and Validation

### How Planner Integrates Decomposition

**Planner responsibilities**:
1. **Plan structure**: Define steps, dependencies, scopes, acceptance criteria
2. **Immutability**: Lock plan once approved (prevent mid-execution changes)
3. **Versioning**: Track changes, enable rollback

**Orchestrator responsibilities** (not Planner):
1. **Execution**: Spawn agents, assign roles, dispatch steps
2. **Retry/failure handling**: Retry failed steps, escalate on repeated failures
3. **Progress tracking**: Mark steps as running/completed
4. **Run overlay**: Show execution status (optional for v1)

### What Gets Locked When Plan is Approved

- Step structure (IDs, titles, descriptions)
- Dependencies (edges in DAG)
- Acceptance criteria
- Scope assignments
- Owner roles

**What can still change during execution**:
- Status (draft → running → completed)
- Execution notes (Orchestrator adds)
- Run-time configuration (environment variables, API keys)

### Feedback Loop: ChangeRequests

If Orchestrator discovers plan is inadequate during execution:

```
Orchestrator → Planner: ChangeRequest
  ├─ plan_id: "..."
  ├─ reason: "Missing step: database rollback not documented"
  ├─ suggested_change: "Add step: 'Create rollback procedure'"
  │
Planner → Create new draft PlanVersion
  ├─ Copy previous version
  ├─ Apply suggested changes
  ├─ Increment version number
  │
Planner → Human review + approve
  │
Planner → Publish new version + notify Orchestrator
```

**Key point**: Approved versions are immutable. ChangeRequests create new versions, not mutations.

---

## Checklist: Planning a High-Reliability Multi-Step Plan

- [ ] Step count > 20? If yes:
  - [ ] Reliability requirement > 99%? → ATOMIC decomposition
  - [ ] Reliability requirement < 99%? → COARSE-GRAINED is OK

- [ ] For each step:
  - [ ] Single clear action (no compound verbs like "and")
  - [ ] Verifiable output (multiple agents could confirm)
  - [ ] Acceptance criteria are specific, measurable, linked to verification
  - [ ] No unexplained dependencies on other steps
  - [ ] No cycles in dependency graph

- [ ] Scope breakdown:
  - [ ] Each scope has ≤ 20 steps
  - [ ] Cross-scope dependencies are explicit
  - [ ] No scope is empty or trivial

- [ ] For atomic steps specifically:
  - [ ] Each step fits in ~1-2 hour human time budget
  - [ ] Output is independently verifiable
  - [ ] Step doesn't require knowledge of other step internals
  - [ ] Multiple agents could produce consensus answer

- [ ] Review preparation:
  - [ ] Plan summary clearly states goal
  - [ ] Context section explains scope and constraints
  - [ ] Acceptance criteria make success objective, not subjective

- [ ] Approval:
  - [ ] Lock plan (approved status)
  - [ ] Generate plan_ref for Orchestrator
  - [ ] Notify Orchestrator plan is ready

---

## References

See main research document for citations: `/docs/error-propagation-decomposition-research.md`

Key papers:
- Six Sigma Agent (consensus voting reliability improvements)
- MAKER framework (atomic decomposition for 1M+ step tasks)
- Hot Mess of AI (incoherence on hard tasks)
- METR (exponential decay with task duration)

# Planner: Multi-Scope Plans

Real work crosses boundaries. A feature typically touches multiple repos, teams, or domains. **Multi-scope plans are the norm, not the exception.**

---

## The Reality

A plan to "add user authentication" doesn't just live in one place:

```
"Add user authentication"
├── api-service          ← backend changes
├── web-frontend         ← login UI
├── mobile-app           ← maybe
└── infrastructure       ← secrets, config
```

This is typical. The "single flat plan in one context" is actually rare.

---

## Scopes: The Primary Structure

**Scopes** group steps by context: repository, team, or domain.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Add user authentication                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  api-service                                                            │
│  ├── Add OAuth endpoints                                                │
│  ├── Add user model                                                     │
│  └── Add session middleware                                             │
│                                                                         │
│  web-frontend                                                           │
│  ├── Add login page                                                     │
│  ├── Add auth state management                                          │
│  └── Add protected routes                                               │
│                                                                         │
│  infrastructure                                                         │
│  └── Add OAuth secrets to config                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**The AI's job:**
1. Identify which scopes are affected by the goal
2. Generate steps per scope
3. Infer dependencies across scopes

**Dependencies are AI-inferred**, not manually wired. If "web-frontend login" needs "api-service OAuth endpoints", the AI figures that out.

---

## Data Model

```typescript
interface Step {
  step_id: string;
  title: string;

  // AI-inferred (displayed but rarely edited)
  dependencies: string[];

  // Scope context
  scope?: string;  // "api-service", "web-frontend", etc.

  // What humans care about
  description?: string;
  owner_role?: string;
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: { type: 'human_approval'; approver_role?: string; };

  // For nested complexity (sub-plan reference)
  sub_plan_id?: string;
}
```

---

## Nested Complexity: Sub-Plans

For very large initiatives, steps can reference **sub-plans** (another PlanVersion):

```
"Build e-commerce application"
├── User Authentication    → [sub-plan: auth-v2]
├── Product Catalog        → [sub-plan: catalog-v1]
├── Shopping Cart          → [sub-plan: cart-v1]
└── Checkout & Payments    → [sub-plan: checkout-v1]
```

Each sub-plan is a full plan with its own scopes, steps, and approval flow.

1. A step with `sub_plan_id` references another PlanVersion
2. Sub-plans are full plans with their own scopes and steps
3. Sub-plans can reference their own sub-plans (recursion)
4. **Depth limit**: Recommend max 3 levels

```
Level 0: Initiative Plan (e.g., "Build e-commerce")
         ├── Level 1: Feature Plans (auth, catalog, cart)
         │            ├── Level 2: Component Plans (if needed)
         │            │            └── Level 3: Task-level steps
```

---

## Approval Flow at Scale

### Option A: Bottom-Up Approval

Sub-plans approved first, then parent:

```
1. "User Auth" sub-plan approved
2. "Product Catalog" sub-plan approved
3. "Cart" sub-plan approved
4. ...
5. "Build E-commerce" parent plan approved (references approved sub-plans)
```

**Pros**: Each piece reviewed in detail
**Cons**: Slow, sequential

### Option B: Top-Down with Delegation

Parent plan approved at high level, sub-plans approved by delegated owners:

```
1. "Build E-commerce" approved (high-level structure)
2. Sub-plan owners refine and approve their pieces
3. Each sub-plan can be published independently when ready
```

**Pros**: Parallel work, faster
**Cons**: Less central oversight

### Option C: Phased Approval (Recommended)

Approve phases, not everything at once:

```
Phase 1: Foundation
  - User Auth: approved ✓
  - Product Catalog: approved ✓
  → Phase 1 published, execution begins

Phase 2: Transactions (still in draft)
  - Cart: drafting...
  - Checkout: drafting...
```

**Pros**: Start executing while still planning later phases
**Cons**: Need to manage phase dependencies

---

## UX for Large Plans

### 1. Zoom Levels

```
┌─────────────────────────────────────────────────────────────────────────┐
│  View: [Overview ▼]  [Expanded]  [Full Detail]                          │
├─────────────────────────────────────────────────────────────────────────┤

Overview (default for large plans):
│  ┌─ 1. User Auth ────────────────────────────── ✅ 8/8 complete ────┐ │
│  ┌─ 2. Product Catalog ──────────────────────── 🔄 7/12 complete ───┐ │
│  ┌─ 3. Cart ─────────────────────────────────── ⏸️ 0/6 waiting ─────┐ │

Expanded (one level):
│  ┌─ 2. Product Catalog ──────────────────────────────────────────────┐ │
│  │  ├─ 2.1 Database schema         ✅ complete                       │ │
│  │  ├─ 2.2 API endpoints           ✅ complete                       │ │
│  │  ├─ 2.3 Search indexing         🔄 running                        │ │
│  │  ├─ 2.4 Admin interface         ⏸️ waiting                        │ │
│  │  └─ ...                                                           │ │

Full Detail (all levels visible):
│  ... everything expanded ...                                            │
```

### 2. Breadcrumb Navigation

```
┌─────────────────────────────────────────────────────────────────────────┐
│  E-commerce App > Product Catalog > Search Indexing                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Back to Product Catalog]                                              │
│                                                                         │
│  Search Indexing                                          ✏️ Draft     │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  ┌─ 1. Choose search provider ────────────────────────────────────┐    │
│  ┌─ 2. Set up Elasticsearch cluster ──────────────────────────────┐    │
│  ┌─ 3. Create indexing pipeline ──────────────────────────────────┐    │
│  ┌─ 4. Build search API ──────────────────────────────────────────┐    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Progress Rollup

Parent plans show aggregated progress from children:

```
┌─ Build E-commerce Application ──────────────────────────────────────────┐
│                                                                         │
│  Progress: 15/51 steps (29%)                                           │
│  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                                                         │
│  By area:                                                               │
│    User Auth:       ████████████████████████████████████ 8/8 (100%)   │
│    Product Catalog: ████████████████░░░░░░░░░░░░░░░░░░░░ 7/12 (58%)   │
│    Cart:            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0/6 (0%)     │
│    Checkout:        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0/15 (0%)    │
│    Deployment:      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0/10 (0%)    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4. Search & Filter

For large plans, find what you need:

```
⌘K: "search api"

Results in "Build E-commerce":
  • Product Catalog > Build search API
  • Product Catalog > Search indexing
  • Checkout > Payment search

Filter by:
  [Status: All ▼]  [Owner: All ▼]  [Phase: All ▼]
```

### 5. Focus Mode

Work on one sub-plan without distraction:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎯 Focus: Product Catalog                           [Exit Focus]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Part of: Build E-commerce Application                                  │
│  Dependencies: User Auth (complete ✓)                                   │
│  Blocking: Cart, Checkout                                               │
│                                                                         │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                         │
│  [Full sub-plan content...]                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Orchestrator Handling

When orchestrator executes a compound step:

```
1. Orchestrator reaches compound step "User Auth"
2. Fetches referenced sub-plan (plan_id: "user-auth-v3")
3. Recursively executes sub-plan
4. When sub-plan completes, compound step is "done"
5. Continues with parent plan
```

### Parallel Execution

Independent compound steps can run in parallel:

```
"Build E-commerce" execution:

Timeline:
─────────────────────────────────────────────────────────────────────────►

User Auth:      [████████████]
                     ↓ completes
Product Catalog:     [████████████████████]
                          ↓ Cart can start (depends on Auth only)
Cart:                     [████████]
                               ↓
Checkout:                      [████████████████]
                                    ↓
Deployment:                              [██████████]
```

---

## Creation Patterns

### Pattern 1: Top-Down (Recommended for large projects)

1. Create high-level plan with compound steps
2. AI suggests sub-plan structure for each
3. Refine sub-plans as needed
4. Approve top-level, then sub-plans

```
User: "Build an e-commerce application with auth, products, cart, checkout"

AI creates:
├── 📦 User Authentication (compound, details TBD)
├── 📦 Product Catalog (compound, details TBD)
├── 📦 Shopping Cart (compound, details TBD)
├── 📦 Checkout & Payments (compound, details TBD)
└── 📦 Deployment (compound, details TBD)

User clicks "Expand" on User Auth:
AI drafts sub-plan with 8 specific steps
```

### Pattern 2: Bottom-Up (For known components)

1. Create detailed sub-plans first
2. Combine into parent plan
3. Add cross-plan dependencies

```
Team A creates "User Auth" plan (complete, detailed)
Team B creates "Product Catalog" plan (complete, detailed)
PM creates parent "E-commerce" plan referencing both
```

### Pattern 3: Progressive Refinement

1. Start with rough plan (all compound)
2. Refine compound steps into sub-plans as execution approaches
3. Just-in-time detailed planning

```
Week 1: Approve high-level plan
Week 2: Detail "User Auth" sub-plan, start execution
Week 4: Detail "Product Catalog" sub-plan (while Auth executes)
...
```

---

## Limits & Guidelines

### Recommended Limits

| Dimension | Soft Limit | Rationale |
|-----------|------------|-----------|
| Steps per plan | 15-20 | Cognitive manageability |
| Hierarchy depth | 3 levels | Practical navigation |
| Total steps (all levels) | 200-300 | System performance |

### When to Split

If a plan has > 20 steps at one level, consider:
- Making some steps compound
- Breaking into multiple related plans
- Using phases within the plan

### Anti-Patterns

❌ **100 steps flat** - Use scopes and sub-plans
❌ **5 levels deep** - Flatten or restructure
❌ **Circular references** - Plan A references B which references A
❌ **Orphan sub-plans** - Sub-plans not referenced by any parent
❌ **Manual dependency wiring** - Let AI infer from context

---

## Summary

| Situation | Structure |
|-----------|-----------|
| Single context | One scope, flat steps |
| Cross-repo feature | Multiple scopes (api, frontend, infra) |
| Large initiative | Scopes + sub-plans for major features |
| Enterprise project | Multi-level hierarchy, phased approval |

**Core principles:**
- Multi-scope is the default (real work crosses boundaries)
- Dependencies are AI-inferred (humans express intent)
- Keep any single view manageable (15-20 items per scope)
- Use sub-plans for nested complexity

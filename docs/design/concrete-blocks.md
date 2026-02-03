# Concrete Blocks: User-Validatable Concepts

> Transform ideation from "trust the observations" to "validate before planning"

## The Problem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT FLOW                                        │
│                                                                             │
│   User describes idea                                                       │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────────┐                                                       │
│   │   Specialists   │──────▶ Observations (patterns, concerns, entities)    │
│   │    analyze      │        "System needs authentication"                  │
│   └─────────────────┘        "Consider rate limiting"                       │
│          │                   "User entity identified"                       │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────────┐                                                       │
│   │   Handoff to    │        Understanding = freeform observations          │
│   │    Planner      │                                                       │
│   └─────────────────┘                                                       │
│          │                                                                  │
│          │    ╔═══════════════════════════════════════════════════════╗     │
│          │    ║  USER VALIDATION GAP                                  ║     │
│          │    ║  "Did you understand me correctly?"                   ║     │
│          │    ║  User must trust or read all observations             ║     │
│          │    ╚═══════════════════════════════════════════════════════╝     │
│          ▼                                                                  │
│   ┌─────────────────┐                                                       │
│   │  Planner makes  │        Steps created from observations                │
│   │     Steps       │        May not match user's mental model              │
│   └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The gap**: Specialists produce domain-descriptive observations, but users have no checkpoint to validate "yes, that's what I meant" before planning begins.

---

## The Solution: Concrete Blocks

Specialists produce **two types of output**:

| Output | Purpose | Example |
|--------|---------|---------|
| **Understanding** | Domain color - informs HOW to plan | "Rate limiting concern", "RESTful pattern" |
| **Blocks** | Crystallized concepts - informs WHAT to plan | "Login Feature", "User Entity", "Checkout Flow" |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROPOSED FLOW                                       │
│                                                                             │
│   User describes idea                                                       │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────────┐     ┌──────────────────────────────────────────────┐  │
│   │   Specialists   │────▶│  Understanding        │  Concrete Blocks     │  │
│   │    analyze      │     │  (observations)       │  (mini-specs)        │  │
│   └─────────────────┘     │                       │                      │  │
│                           │  • Patterns           │  • Login Feature     │  │
│                           │  • Concerns           │  • User Entity       │  │
│                           │  • Technical notes    │  • Dashboard UI      │  │
│                           └───────────────────────┴──────────────────────┘  │
│                                                              │              │
│                                                              ▼              │
│                                    ┌─────────────────────────────────────┐  │
│                                    │      USER VALIDATION LOOP           │  │
│                                    │                                     │  │
│                                    │   ┌─────────┐    Click    ┌──────┐  │  │
│                                    │   │  Block  │ ──────────▶ │ Mini │  │  │
│                                    │   │  Card   │             │ Spec │  │  │
│                                    │   └─────────┘             └──────┘  │  │
│                                    │        │                      │     │  │
│                                    │        │              ┌───────┴───┐ │  │
│                                    │        │              ▼           ▼ │  │
│                                    │        │         [Approve]  [Refine]│  │
│                                    │        │              │           │ │  │
│                                    │        │              ▼           │ │  │
│                                    │        │          Block ✓    Back │ │  │
│                                    │        │          approved   to   │ │  │
│                                    │        │                    chat  │ │  │
│                                    │        └──────────────────────────┘ │  │
│                                    └─────────────────────────────────────┘  │
│                                                              │              │
│                                                              ▼              │
│                           ┌──────────────────────────────────────────────┐  │
│                           │            PLANNER HANDOFF                   │  │
│                           │                                              │  │
│                           │   Understanding ────▶ informs acceptance     │  │
│                           │   (how to plan)       criteria, constraints  │  │
│                           │                                              │  │
│                           │   Approved Blocks ──▶ become Steps           │  │
│                           │   (what to plan)      (1 block → 1+ steps)   │  │
│                           │                                              │  │
│                           └──────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Block Types

**Block types are freeform** - agents choose whatever taxonomy fits the concept. The types below are common suggestions with default icons, but agents can create blocks of any type.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUGGESTED BLOCK TYPES (not exhaustive)                 │
│                                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│   │   feature    │   │  component   │   │    entity    │                    │
│   │      ★       │   │      ◻       │   │      ◈       │                    │
│   │              │   │              │   │              │                    │
│   │ A capability │   │ A UI element │   │ A data model │                    │
│   │ the system   │   │ or system    │   │ or domain    │                    │
│   │ provides     │   │ component    │   │ object       │                    │
│   │              │   │              │   │              │                    │
│   │ "Login"      │   │ "Dashboard"  │   │ "User"       │                    │
│   │ "Checkout"   │   │ "SearchBar"  │   │ "Product"    │                    │
│   └──────────────┘   └──────────────┘   └──────────────┘                    │
│                                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│   │     flow     │   │  constraint  │   │ integration  │                    │
│   │      ➔       │   │      ⊘       │   │      ⌁       │                    │
│   │              │   │              │   │              │                    │
│   │ A user       │   │ A technical  │   │ An external  │                    │
│   │ journey or   │   │ or business  │   │ system       │                    │
│   │ process      │   │ requirement  │   │ connection   │                    │
│   │              │   │              │   │              │                    │
│   │ "Onboarding" │   │ "GDPR"       │   │ "Stripe"     │                    │
│   │ "Purchase"   │   │ "< 100ms"    │   │ "OAuth"      │                    │
│   └──────────────┘   └──────────────┘   └──────────────┘                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AGENTS CAN USE ANY TYPE THAT FITS:                                        │
│                                                                             │
│   • api_endpoint    • business_rule    • user_persona    • edge_case        │
│   • data_source     • validation       • notification    • permission       │
│   • workflow        • metric           • configuration   • migration        │
│   • ... anything that crystallizes a concrete concept                       │
│                                                                             │
│   ╔═══════════════════════════════════════════════════════════════════════╗ │
│   ║  PRINCIPLE: Intelligence lives in agent judgment, not enum constraints ║ │
│   ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Block Lifecycle

```
                    ┌─────────────────────────────────────────┐
                    │              BLOCK STATES               │
                    └─────────────────────────────────────────┘

    Agent identifies          User clicks           User validates
    concrete concept          to review             mini-spec
           │                      │                      │
           ▼                      ▼                      ▼
    ┌───────────┐          ┌───────────┐          ┌───────────┐
    │   DRAFT   │─────────▶│ REVIEWING │─────────▶│ APPROVED  │
    │   (gray)  │  click   │  (blue)   │  approve │  (green)  │
    └───────────┘          └───────────┘          └───────────┘
                                 │                      │
                                 │ "needs work"         │ user wants
                                 ▼                      │ to refine
                           Back to chat                 ▼
                           for refinement         ┌───────────┐
                                                  │  REVISED  │
                                                  │ (updated) │
                                                  └───────────┘
                                                        │
                                                        ▼
                                                  Re-approval
                                                     needed


    ╔═══════════════════════════════════════════════════════════════════════╗
    ║  KEY RULE: Only APPROVED blocks go to planner                         ║
    ║  User explicitly validates "yes, this is what I meant"                ║
    ╚═══════════════════════════════════════════════════════════════════════╝
```

---

## Mini-Spec Format

Each block contains a focused, user-readable specification. The format adapts based on block type - agents have flexibility to structure content appropriately for the concept:

```markdown
┌─────────────────────────────────────────────────────────────────────────────┐
│  # Login Feature                                                 [APPROVE]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ## Summary                                                                 │
│  User authentication via email/password and OAuth providers.                │
│                                                                             │
│  ## User Stories                                                            │
│  - As a user, I can log in with email/password                              │
│  - As a user, I can log in with Google                                      │
│  - As a user, I can reset my forgotten password                             │
│                                                                             │
│  ## Key Decisions                                                           │
│  - Sessions expire after 24 hours                                           │
│  - Support Google and GitHub OAuth initially                                │
│  - Remember-me option extends session to 30 days                            │
│                                                                             │
│  ## Open Questions                                                          │
│  - Should we support 2FA in v1?                                             │
│  - Email verification required before first login?                          │
│                                                                             │
│  ## Diagram                                                                 │
│  ┌─────────────────────┐                                                    │
│  │     Login Form      │                                                    │
│  ├─────────────────────┤                                                    │
│  │  Email: [________]  │                                                    │
│  │  Pass:  [________]  │                                                    │
│  │                     │                                                    │
│  │  [Login]  [Forgot?] │                                                    │
│  │  ─────────────────  │                                                    │
│  │  Or continue with:  │                                                    │
│  │  [Google] [GitHub]  │                                                    │
│  └─────────────────────┘                                                    │
│                                                                             │
│  ## Source                                                                  │
│  Extracted from conversation turns 12-18                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bento-Box UI

The sidebar displays blocks as a **treemap** where size reflects concept maturity:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BLOCKS PANEL (Right Sidebar)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Session Readiness  ████████████░░░░░░░░ 62%                                │
│  Concepts (5)                                              [collapse ▶]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────┐ ┌───────────────────────────┐  │
│  │                                         │ │                           │  │
│  │            ★ Login Feature              │ │     ◈ User Entity         │  │
│  │                                         │ │                           │  │
│  │              ✓ approved                 │ │       ● draft             │  │
│  │                                         │ │                           │  │
│  │  ████████████████████░░░░  85%          │ │  ████████░░░░░░░  45%     │  │
│  └─────────────────────────────────────────┘ └───────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────┐ ┌──────────────┐ ┌──────────────────────┐   │
│  │                           │ │              │ │                      │   │
│  │    ◻ Dashboard Header     │ │  ⊘ GDPR      │ │   ⌁ Stripe           │   │
│  │                           │ │              │ │                      │   │
│  │       ● draft             │ │   ● draft    │ │     ● draft          │   │
│  │                           │ │              │ │                      │   │
│  │  ██████░░░░░░░░░  35%     │ │  ████  25%   │ │  ██████░░░  40%      │   │
│  └───────────────────────────┘ └──────────────┘ └──────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         1 of 5 approved                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Legend (suggested types with icons):
  ★ feature    ◻ component    ◈ entity    ➔ flow    ⊘ constraint    ⌁ integration

  Unknown types get a generic ◆ icon (agents can use any type)

  Block size = maturity score (0-100%)
  Larger blocks = more developed concepts
  Smaller blocks = early/vague concepts
```

---

## UI Layout Evolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BEFORE                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌──────────┐ ┌────────────────────────────────┐ ┌─────────────────────────┐ │
│ │          │ │                                │ │    SPECIALISTS PANEL    │ │
│ │ Sessions │ │           Chat Area            │ │                         │ │
│ │          │ │                                │ │  ┌───────────────────┐  │ │
│ │ • Sess 1 │ │  User: I want to build...      │ │  │ Architect         │  │ │
│ │ • Sess 2 │ │                                │ │  │ • patterns...     │  │ │
│ │          │ │  Agent: Let me understand...   │ │  │ • concerns...     │  │ │
│ │          │ │                                │ │  └───────────────────┘  │ │
│ │          │ │                                │ │  ┌───────────────────┐  │ │
│ │          │ ├────────────────────────────────┤ │  │ Designer          │  │ │
│ │          │ │ Chat  │ Understanding │ Docs   │ │  │ • observations... │  │ │
│ │          │ │                                │ │  └───────────────────┘  │ │
│ │          │ │ (tab content)                  │ │                         │ │
│ └──────────┘ └────────────────────────────────┘ └─────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                              AFTER                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌──────────┐ ┌────────────────────────────────┐ ┌─────────────────────────┐ │
│ │          │ │                                │ │     BLOCKS PANEL        │ │
│ │ Sessions │ │           Chat Area            │ │     (Bento Box)         │ │
│ │          │ │                                │ │                         │ │
│ │ • Sess 1 │ │  User: I want to build...      │ │ ┌─────────────┬───────┐ │ │
│ │ • Sess 2 │ │                                │ │ │   Login ✓   │ User  │ │ │
│ │          │ │  Agent: Let me understand...   │ │ │             │       │ │ │
│ │          │ │                                │ │ ├───────┬─────┴───────┤ │ │
│ │          │ │                                │ │ │Header │ GDPR│Stripe │ │ │
│ │          │ ├────────────────────────────────┤ │ └───────┴─────┴───────┘ │ │
│ │          │ │ Chat  │ Understanding │ Docs   │ │                         │ │
│ │          │ │       ▲                        │ │  1 of 5 approved        │ │
│ │          │ │       │                        │ │                         │ │
│ │          │ │  Specialists observations      │ │  Click block to review  │ │
│ │          │ │  moved here (from sidebar)     │ │  and approve            │ │
│ └──────────┘ └────────────────────────────────┘ └─────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How Planner Uses Blocks

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PLANNER HANDOFF WITH BLOCKS                              │
└─────────────────────────────────────────────────────────────────────────────┘

                     IDEATION OUTPUT
                           │
          ┌────────────────┴────────────────┐
          │                                 │
          ▼                                 ▼
   ┌──────────────┐                ┌──────────────────┐
   │Understanding │                │  Approved Blocks │
   │              │                │                  │
   │ • Patterns   │                │ • Login Feature  │
   │ • Concerns   │                │ • User Entity    │
   │ • Tech notes │                │ • Checkout Flow  │
   └──────────────┘                └──────────────────┘
          │                                 │
          │    "HOW to plan"                │    "WHAT to plan"
          │                                 │
          └────────────────┬────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  PLANNER LEAD  │
                  └────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │   Step 1   │   │   Step 2   │   │   Step 3   │
   │            │   │            │   │            │
   │ Implement  │   │ Create     │   │ Build      │
   │ email/pass │   │ User model │   │ cart UI    │
   │ auth       │   │ with       │   │            │
   │            │   │ fields     │   │ AC from    │
   │ AC from    │   │            │   │ Checkout   │
   │ Login      │   │ AC from    │   │ Flow block │
   │ Feature    │   │ User       │   │            │
   │ block      │   │ Entity     │   └────────────┘
   │            │   │ block      │
   │ + concerns │   │            │
   │ from       │   │ + patterns │
   │ understand │   │ from       │
   │            │   │ understand │
   └────────────┘   └────────────┘

   ════════════════════════════════════════════════════════════

   Blocks → become Steps (1 block → 1+ steps)
   Understanding → informs acceptance criteria, constraints

   ════════════════════════════════════════════════════════════
```

---

## Implementation Phases

```
Phase 1: Backend Schema & Storage
├── Define Block Zod types (id, type, title, status, maturity, content)
├── Add blocks[] to Session entity
└── Create CRUD endpoints for blocks

Phase 2: Specialist Block Extraction
├── Add create_block MCP tool for specialists
├── Update specialist prompts with block guidance
└── Define maturity scoring heuristics

Phase 3: Frontend Blocks Panel
├── Create useBlocks hook (fetch + SSE subscription)
├── Create BlockCard component
├── Implement BentoBoxLayout (treemap algorithm)
└── Replace SpecialistsPanel with BlocksPanel

Phase 4: Block Detail & Approval
├── Create BlockDetailDrawer component
├── Implement mini-spec markdown rendering
├── Add approve/revise actions
└── Relocate specialist observations to Understanding tab

Phase 5: Planner Integration
├── Update handoff to include approved blocks
├── Extend planner-core to receive blocks
└── Update PlannerLead prompt for block→step conversion
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Same agents do both** | Specialists produce observations AND identify blocks. Not two systems. |
| **Bento-box treemap** | Visual hierarchy shows maturity at a glance. Large = ready. Small = early. |
| **Mini-specs not PRDs** | Small, focused docs. User validates incrementally, not one massive spec. |
| **Approval required** | Only approved blocks go to planner. Explicit user validation. |
| **Understanding remains** | Observations still exist as "color". Blocks add prescriptive layer. |
| **Freeform block types** | Suggested types for common cases, but agents can use any type. Same philosophy as freeform observations. |

---

## Success Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUCCESS CRITERIA                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✓ User can see concrete concepts emerge as they describe their idea        │
│                                                                             │
│  ✓ User can click any block to see a focused mini-spec                      │
│                                                                             │
│  ✓ User can approve blocks they agree with                                  │
│                                                                             │
│  ✓ User can refine blocks via continued conversation                        │
│                                                                             │
│  ✓ Only approved blocks go to planner                                       │
│                                                                             │
│  ✓ Planner creates steps from blocks, not from freeform observations        │
│                                                                             │
│  ✓ Bento-box visualization shows which concepts need more development       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Related Files

- Feature spec: `docs/flow/features/ideation-concrete-blocks.json`
- Current specialists panel: `docs/flow/features/ideation-ui-specialists-panel.json`
- Planner handoff: `docs/flow/features/ideation-planner-handoff.json`
- Specialist templates: `packages/ideation/src/specialists/templates.ts`

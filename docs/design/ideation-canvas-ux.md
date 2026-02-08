# Ideation Canvas UX Design

> Comprehensive UX specification for the new ideation canvas view, replacing the mockup with a fully integrated experience.

**TL;DR:** Physics-based blocks (matter.js) visualize concepts as they form through conversation. Blocks grow with confidence, users curate them, then hand off to Planner. Dashboard uses same physics pattern for sessions, with gravity wells for Initiatives.

---

## Overview

The canvas view is the primary "work" view for ideation. It uses physics-based blocks (matter.js) to visualize concepts as they form and mature through conversation.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back   "Building a SaaS platform" ▼   [AI Understanding]  [→ Planner] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌────────────────────────┐  ┌────────────────────┐    │
│  │             │  │                        │  │                    │    │
│  │   FORMING   │  │        CHAT            │  │     CURATED        │    │
│  │   BLOCKS    │  │                        │  │     BLOCKS         │    │
│  │  (physics)  │  │                        │  │    (stacked)       │    │
│  │    ~30%     │  │        ~45%            │  │      ~25%          │    │
│  └─────────────┘  └────────────────────────┘  └────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Dual Output Model

Ideation produces two types of output:

| Output | Purpose | Visibility |
|--------|---------|------------|
| **Understanding** | Domain observations that inform HOW to plan | Inspector panel |
| **Blocks** | User-validated concepts that define WHAT to plan | Canvas view |

### Block Lifecycle

```
Specialist creates block (internal)
         ↓
    ┌─────────────────────────────────────────────────────────────┐
    │  FORMING (0-30%)                                            │
    │  • Tiny translucent dot in physics area                     │
    │  • Hints "something is coalescing"                          │
    │  • Not clickable                                            │
    └─────────────────────────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────────────────────────┐
    │  EMERGING (30-60%)                                          │
    │  • Small block, emoji visible, slightly faded               │
    │  • Clickable - shows sparse mini-spec                       │
    │  • User can start refining                                  │
    └─────────────────────────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────────────────────────┐
    │  DEVELOPING (60-90%)                                        │
    │  • Full size, solid, shows emoji + keyword                  │
    │  • Rich mini-spec content                                   │
    │  • Primary refinement phase                                 │
    └─────────────────────────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────────────────────────┐
    │  READY (90%+)                                               │
    │  • Glows/pulses to indicate readiness                       │
    │  • Auto-curated if user setting enabled                     │
    │  • Otherwise awaits user curation                           │
    └─────────────────────────────────────────────────────────────┘
         ↓
    ┌─────────────────────────────────────────────────────────────┐
    │  CURATED                                                    │
    │  • Moves to right column with animation                     │
    │  • Green accent border                                      │
    │  • Included in planner handoff                              │
    └─────────────────────────────────────────────────────────────┘
```

### Block Visibility Thresholds

| Confidence | Visual State | Size | Interactivity |
|------------|--------------|------|---------------|
| 0-30% | Tiny translucent dot | ~20px | None |
| 30-60% | Small, faded, emoji visible | 40-60px | Clickable |
| 60-90% | Full size, solid | 60-100px | Full interaction |
| 90%+ | Full size + glow effect | 60-100px | Ready indicator |

### Dynamic Block Sizing & Attention

**Primary drivers (always active):**

| Property | Driven By | Effect |
|----------|-----------|--------|
| **Size** | Content amount (mini-spec detail) | More content = larger block |
| **Attention** | Confidence (0-100%) | Higher confidence = more attention-seeking (glow, pulse) |

**Attention-seeking behaviors by confidence:**
- **Low (0-30%)**: Tiny, translucent, no effects
- **Medium (30-60%)**: Small, faded, minimal effects
- **High (60-90%)**: Full size, solid, subtle glow
- **Ready (90%+)**: Full size, pronounced glow/pulse indicating "ready for curation"

**Secondary feature (future - navigation aid):**
- When user mentions keywords in chat, relevant blocks could briefly flash
- Helps user navigate to related concepts
- This is a UX enhancement, NOT the primary sizing mechanism

**Physics behavior (same as mockup):**
- Central attraction pulls blocks toward middle
- Larger blocks have more mass, more stable
- Smaller blocks bounce around more
- Drag releases trigger shake effect on neighbors

---

## Layout Specification

### Header Bar

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back   "Building a SaaS platform" ▼   [AI Understanding]  [→ Planner] │
└──────────────────────────────────────────────────────────────────────────┘
     │              │                            │                │
     │              │                            │                │
     │              └─ Session title dropdown    │                │
     │                 (switch sessions)         │                │
     │                                           │                │
     └─ Returns to session dashboard             │                │
                                                 │                │
                              Opens inspector ───┘                │
                              panel/modal                         │
                                                                  │
                                        Primary action: handoff ──┘
```

**Elements:**
- **← Back**: Navigate to session dashboard
- **Session title**: Editable, with dropdown to switch sessions (or Cmd+K)
- **AI Understanding**: Opens inspector showing overall confidence + per-specialist observations
- **→ Planner**: Primary action - sends curated blocks to planner

### Three-Column Layout

| Column | Width | Purpose |
|--------|-------|---------|
| **Left: Forming Blocks** | ~30% | Physics simulation with draft blocks |
| **Center: Chat** | ~45% | Conversation with interviewer agent |
| **Right: Curated Blocks** | ~25% | Approved blocks ready for handoff |

---

## Focus Mode

When user clicks a block (draft or curated), the view transitions to focus mode:

### Normal State → Focus State (Draft Block)

```
NORMAL:
┌─────────────┐  ┌────────────────────────┐  ┌────────────────────┐
│   FORMING   │  │        CHAT            │  │     CURATED        │
│   BLOCKS    │  │                        │  │     BLOCKS         │
└─────────────┘  └────────────────────────┘  └────────────────────┘

FOCUSED ON DRAFT BLOCK:
┌────────────────────────────────────┐  ┌────────────────────────┐
│   BLOCK DETAIL (mini-spec)         │  │   CHAT (contextual)    │
│                                    │  │                        │
│   # User Authentication            │  │   [discussing this     │
│                                    │  │    block specifically] │
│   ## Summary                       │  │                        │
│   Allow users to sign in...        │  │                        │
│                                    │  │                        │
│   ## Key Decisions                 │  │                        │
│   - JWT tokens                     │  │                        │
│   ░░░ Apple Sign-In ░░░ ← user     │  │                        │
│                                    │  │                        │
│   [Close]              [Curate ✓]  │  │                        │
└────────────────────────────────────┘  └────────────────────────┘
```

### Focus Mode Behaviors

1. **Physics area fades/blurs** - Other blocks become background
2. **Chat becomes contextual** - AI knows user is "zoomed in" on this block
3. **Detail panel shows mini-spec** - Rendered markdown with diagrams
4. **User can edit directly** - Authoritative edits, highlighted visually
5. **User can chat about block** - Refinements via conversation
6. **Curate action available** - Move block to curated column

### User Edits

When user directly edits markdown in the detail panel:

```markdown
## Key Decisions
- Use JWT tokens for session management
- Support Google and GitHub OAuth initially
- ░░░ Also support Apple Sign-In for iOS users ░░░  ← highlighted as user-added
```

**Rules:**
- User edits are **authoritative** (not auto-changed by AI)
- Highlighted with subtle color tint so user can see their contributions
- AI can **request** changes later: "I see you added Apple Sign-In. Should I also add a 'Mobile OAuth flow' block?"
- Edits are versioned (history preserved)

---

## Curation & Handoff

### Auto-Curation Setting

For users who trust the system:

```
Settings:
┌─────────────────────────────────────────────────────┐
│  Auto-curate blocks when confidence exceeds: [90%]  │
│  ☑ Enabled                                          │
└─────────────────────────────────────────────────────┘
```

When enabled, blocks at 90%+ automatically move to curated column.

### Handoff Flow

**"→ Planner" button** in header triggers handoff.

**If un-curated blocks exist:**

```
┌─────────────────────────────────────────────────────────┐
│  3 concepts still developing:                           │
│                                                         │
│  • Payment Processing (45%)                             │
│  • Team Permissions (72%)                               │
│  • Audit Logging (38%)                                  │
│                                                         │
│  What would you like to do?                             │
│                                                         │
│  ○ Leave out (only send curated)                        │
│  ○ Include as context (note as unfinished)              │
│  ○ Include all above [60]% confidence                   │
│                                                         │
│  [Cancel]                              [Send to Planner] │
└─────────────────────────────────────────────────────────┘
```

**Handoff creates:**
- Plan with `blocks[]` (curated + selected un-curated)
- Plan with `understanding` (specialist observations)
- Session remains accessible (can revisit, add more blocks later)

---

## Specialist Presence Indicators

Subtle corner indicators show which specialists are active:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back   "SaaS Platform" ▼   [AI Understanding]  [→ Planner]           │
│                                                                          │
│                                    👤 👤 👤 ○  ← Specialist avatars      │
│                                    A  D  S  T     (corner, subtle)       │
├──────────────────────────────────────────────────────────────────────────┤
```

**Behavior:**
- Filled avatar = specialist is actively processing/observing
- Empty circle = specialist is idle
- Hover shows specialist name + current status
- Click opens AI Understanding panel focused on that specialist

### Standardized Status Bar Component

**Create a shared package** (`@plannr/ui-agent-status-bar`) reusable across apps:

```typescript
interface StatusBarProps {
  agents: AgentStatus[];       // Active agents with status
  overallConfidence?: number;  // Aggregate confidence (if applicable)
  actions?: StatusAction[];    // Quick actions (QA, refresh, etc.)
}

interface AgentStatus {
  id: string;
  name: string;
  avatar: string;              // Emoji or icon
  status: 'idle' | 'thinking' | 'observing' | 'contributing';
  confidence?: number;
}

interface StatusAction {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
}
```

**Shared across apps:**

| App | Use Case |
|-----|----------|
| **Ideation** | Specialist presence, session confidence, QA validation |
| **Planner** | Planning agent status, plan confidence, QA checks |
| **Forge** | Worker/Auditor status, run progress |

**QA functionality from Planner** (also useful in Ideation):
- Validate block completeness
- Check for missing specialist perspectives
- Flag inconsistencies between blocks
- "Ready for handoff?" pre-flight check

**Why shared:**
- Consistent UX across the pipeline
- Agent visibility is a cross-cutting concern
- QA patterns apply at multiple stages
- Reduces duplication, easier to maintain

---

## AI Understanding Panel

Accessed via "AI Understanding" button in header. A **dashboard** showing the AI's holistic understanding of the idea.

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Understanding                                      [Close]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  IDEA SUMMARY                                             │  │
│  │                                                           │  │
│  │  "A multi-tenant SaaS platform for project management    │  │
│  │   with team collaboration, OAuth authentication, and     │  │
│  │   real-time updates. Target: small-medium businesses."   │  │
│  │                                                           │  │
│  │  (AI-generated synopsis of the overall idea)              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  OVERALL CONFIDENCE                                             │
│  ████████████████░░░░░░░░ 68%                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  SPECIALIST PERSPECTIVES                                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🏗️ Architect (forming)                          ●●○ 72%  │  │
│  │                                                           │  │
│  │  "Multi-tenant architecture with team workspaces.        │  │
│  │   API-first design recommended. Still need clarity       │  │
│  │   on data isolation model - shared vs siloed."           │  │
│  │                                                           │  │
│  │  Key concerns: Data isolation, scalability                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔒 Security (exploring)                         ●○○ 45%  │  │
│  │                                                           │  │
│  │  "OAuth mentioned but scope unclear. Need to discuss     │  │
│  │   compliance requirements - SOC2? GDPR? This affects     │  │
│  │   data handling architecture significantly."             │  │
│  │                                                           │  │
│  │  Open questions: Compliance scope, data residency         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🎨 Designer (idle)                              ○○○ --   │  │
│  │                                                           │  │
│  │  "Waiting for UI/UX discussion. No design requirements   │  │
│  │   mentioned yet."                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  BLOCKS STATUS (future)                                         │
│                                                                 │
│  Forming: 2    Developing: 3    Ready: 1    Curated: 2          │
│  ░░           ███            ██           ████                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Panel Sections

| Section | Content | Purpose |
|---------|---------|---------|
| **Idea Summary** | AI-generated synopsis of the overall idea | Quick understanding at a glance |
| **Overall Confidence** | Aggregate confidence across specialists | Readiness indicator for handoff |
| **Specialist Perspectives** | Each AI's "take" - their viewpoint, not just observations | See different angles, concerns, questions |
| **Blocks Status** | Breakdown by lifecycle stage | Track crystallization progress (future) |

### Specialist "Take" vs Raw Observations

Each specialist card shows a **synthesized perspective**, not just bullet points:

- **Their viewpoint** - Natural language summary of how they see the idea
- **Confidence level** - How formed their understanding is
- **Key concerns/questions** - What they still need clarity on

This is the AI's understanding of the idea from multiple domain perspectives - architects see architecture, security sees risks, designers see UX gaps.

**Deep Insight mode (future):**
- Expand a specialist card to see raw understanding data
- Shows `<object>:<keys>:<fields>` structure stored in specialist's memory
- Useful for debugging, power users, or understanding why AI concluded something
- Toggle: "Show raw data" or similar

---

## Session Dashboard

When user clicks "← Back", they see the session dashboard:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Ideation                                                 [+ New Session] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌────────────────────────┐  ┌────────────────────┐    │
│  │             │  │  INTAKE / STRATEGY     │  │                    │    │
│  │  IN PROGRESS │  │                        │  │   SENT TO PLANNER  │    │
│  │  (physics)  │  │  ┌──────────────────┐  │  │                    │    │
│  │             │  │  │ Incoming signals │  │  │  ┌─────────────┐  │    │
│  │  ┌───────┐  │  │  │ (future: Intake) │  │  │  │ Mobile App  │  │    │
│  │  │ SaaS  │  │  │  └──────────────────┘  │  │  │ ✓ Jan 15    │  │    │
│  │  │ ████  │  │  │                        │  │  └─────────────┘  │    │
│  │  └───────┘  │  │  ┌──────────────────┐  │  │  ┌─────────────┐  │    │
│  │    ┌────┐   │  │  │ Portfolio priors │  │  │  │ Dashboard   │  │    │
│  │    │API │   │  │  │ (future)         │  │  │  │ ✓ Jan 12    │  │    │
│  │    └────┘   │  │  └──────────────────┘  │  │  └─────────────┘  │    │
│  │             │  ├────────────────────────┤  │                    │    │
│  │             │  │  META-CHAT             │  │                    │    │
│  │             │  │                        │  │                    │    │
│  │             │  │  "What should I work   │  │                    │    │
│  │             │  │   on next?"            │  │                    │    │
│  │             │  │                        │  │                    │    │
│  └─────────────┘  └────────────────────────┘  └────────────────────┘    │
│       ~30%               ~45%                        ~25%               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Dashboard Layout

**Same three-column pattern with physics:**

| Column | Content | Behavior |
|--------|---------|----------|
| **Left: In Progress** | Active sessions as blocks | Physics: size = content, attention = confidence |
| **Center Top** | Intake inbox + Portfolio priorities (future) | Static cards initially |
| **Center Bottom** | Meta-chat with Navigator agent | Chat interface |
| **Right: Sent to Planner** | Sessions handed off | Static list, sorted by date, status badge shows planner progress |

**Right column status badges:**
- ✓ "Planning" - Planner is working on it
- ✓ "Plan Ready" - Plan created, awaiting approval
- ✓ "Approved" - Plan approved, ready for Forge
- Click to open plan in Planner view

### Block Semantics: Session vs Dashboard

**Important distinction:**

| Context | What is a "Block"? | Relationships |
|---------|-------------------|---------------|
| **Session canvas** | A concept within ONE idea (e.g., "User Auth" is part of "SaaS Platform") | Blocks relate within same plan |
| **Dashboard** | Each block is a SEPARATE idea/session | Sessions can connect via **Initiatives** |

**Initiative connections (future):**
- Sessions belonging to same Initiative show visual grouping via **gravity wells + color coding**
- **Gravity wells**: Initiative creates attraction - sessions orbit toward their Initiative's center
- **Color coding**: Same Initiative = same color tint on blocks (e.g., blue for "Product Launch", green for "Infrastructure")
- Unassigned sessions float freely, no color tint
- E.g., "Mobile App" and "API Backend" both blue-tinted, orbiting within "Product Launch" gravity well

```
┌─────────────────────────────────────────────────────┐
│  IN PROGRESS                                        │
│                                                     │
│     ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐                   │
│       Product Launch (blue)     │    ┌────┐        │
│     │  ┌─────┐   ┌─────┐       │    │Solo│ ← gray  │
│        │SaaS │   │ API │              │Proj│  (no   │
│     │  │ ██  │   │ █   │       │    └────┘  init.) │
│        └─────┘   └─────┘                           │
│     └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘                   │
│         (gravity well)                              │
└─────────────────────────────────────────────────────┘
```

**Cross-session concept deduplication:**
- If "User Auth" exists in two sessions under same Initiative, **Planner handles this**
- When sessions hand off to Planner, it notices duplicate concepts and consolidates
- This is a Planner concern, not Ideation - keeps separation clean

**Abandoned sessions (dashboard only):**
- Sessions not touched for a long time shrink to mini ~10x10px blocks
- Over time, they become less affected by gravity (or gain inverse gravity)
- Drift toward edges/corners - a visual "parking lot"
- Still clickable - user can revive by opening
- Prevents accidental loss of half-formed ideas

### Navigator Agent (Meta-Chat)

The dashboard meta-chat uses a **Navigator** agent - same underlying agent as Interviewer but with broader context:

```
┌─────────────────────────────────────────────────────────────────┐
│  META-CHAT                                                      │
│                                                                 │
│  Navigator: "You have 3 sessions in progress. The SaaS         │
│  Platform is furthest along at 78% overall confidence.         │
│  Would you like to continue there, or start something new?"    │
│                                                                 │
│  User: "What about the API project? Is it related?"            │
│                                                                 │
│  Navigator: "The API Backend session (42%) has some overlap    │
│  with SaaS Platform - both mention authentication. You could   │
│  link them under an Initiative, or merge the auth concepts."   │
│                                                                 │
│  [Type here...]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Navigator capabilities:**
- See all sessions, their confidence levels, and content summaries
- Suggest what to work on next based on progress/priorities
- Identify connections between sessions
- Open specific sessions on request
- (Future) Consider Intake signals and Portfolio priorities

**Role analogy:** Like an "Innovation Guide" or "Creative Director" - someone who helps you see the bigger picture across all your ideas, without the enterprise-y title.

---

## Navigation & Persistence

### Auto-Save

- Sessions auto-save continuously
- No explicit "Save" button needed
- "← Back" just navigates away (state preserved)

### Session Switching

- **Header dropdown**: Quick switch between sessions
- **Cmd+K**: Power user command palette
- **Dashboard**: Visual overview of all sessions

### URL Structure

```
/ideation                    → Session dashboard
/ideation/session/:id        → Canvas view (primary work view)
/ideation/session/:id?block=:blockId  → Canvas view with block focused
```

---

## Settings

User-configurable preferences:

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-curate threshold | 90% | Blocks above this % auto-curate |
| Auto-curate enabled | false | Whether auto-curation is active |
| Block visibility threshold | 30% | Minimum confidence to show block |
| Theme | System | Light/dark mode |

---

## Theme Support

**Both light and dark mode from the start.**

### Light Mode (Sandy/Warm)

```css
:root {
  --canvas-bg: #f5f0e8;           /* Sandy gray background */
  --canvas-bg-subtle: #ebe6de;    /* Depth variation */
  --text-primary: #2d2d2d;
  --text-muted: #7a7a7a;
  --block-draft: #e8e4dc;
  --block-draft-border: #d4cfc5;
  --block-curated: #ffffff;
  --block-curated-border: #4a7c59;
  --accent: #4a7c59;              /* Green accent */
  --accent-light: #e8f0eb;
}
```

### Dark Mode (Mission Control)

```css
:root.dark {
  --canvas-bg: #1a1a1a;
  --canvas-bg-subtle: #242424;
  --text-primary: #e5e5e5;
  --text-muted: #888888;
  --block-draft: #2a2a2a;
  --block-draft-border: #3a3a3a;
  --block-curated: #1e2a1e;
  --block-curated-border: #4a7c59;
  --accent: #5a9c6a;
  --accent-light: #1e2a1e;
}
```

Match existing planner/relay-dashboard aesthetic for dark mode consistency.

---

## Technical Notes

### Physics Engine (matter.js)

- Zero gravity with central attraction force
- Blocks collide and don't overlap
- Drag to move, release snaps back with shake effect
- Block size scales with maturity (40-100px)
- Render with positioned HTML divs (not canvas) for rich content

### Real-Time Updates

- SSE for block changes from specialists
- WebSocket for chat messages
- Optimistic UI for user actions (curate, edit)

### Block Schema

```typescript
interface Block {
  id: string;
  type: string;           // freeform (feature, entity, flow, etc.)
  title: string;
  keyword: string;        // short label for physics block
  emoji: string;          // visual identifier
  status: 'forming' | 'emerging' | 'developing' | 'ready' | 'curated';
  confidence: number;     // 0-100, drives visibility/size
  content: string;        // markdown mini-spec
  userEdits: UserEdit[];  // tracked user modifications
  specialist: string;     // which specialist created it
  sourceContext: string;  // conversation turn references
  createdAt: string;
  curatedAt: string | null;
}

interface UserEdit {
  id: string;
  range: { start: number; end: number };
  content: string;
  timestamp: string;
}
```

---

## Implementation Phases

> Detailed implementation steps are in `docs/flow/features/ideation-concrete-blocks.json`. These phases are a high-level roadmap.

### Phase 1: Canvas Foundation
- Header with navigation
- Three-column layout
- Physics simulation with mock blocks
- Basic chat integration (existing API)

### Phase 2: Block Integration
- Block schema and storage
- Specialist block creation (MCP tool)
- SSE for real-time block updates
- Progressive revelation visualization

### Phase 3: Focus Mode & Editing
- Block detail drawer/panel
- Direct markdown editing
- User edit tracking/highlighting
- Contextual chat mode

### Phase 4: Curation & Handoff
- Curate action with animation
- Auto-curation setting
- Handoff flow with un-curated options
- Planner integration

### Phase 5: Dashboard
- Session dashboard view
- Session cards with progress
- Meta-chat for navigation
- (Future: Intake/Portfolio columns)

---

## Open Questions

### Decided

1. ~~**Session cards on dashboard**~~ → Physics blocks, same behavior as session canvas
2. ~~**Initiative visualization**~~ → Gravity wells + color coding (same color = same initiative)
3. ~~**Navigator agent identity**~~ → Same agent as Interviewer, broader context
4. ~~**Cross-session concepts**~~ → Planner handles deduplication when sessions under same Initiative
5. ~~**Handoff animation**~~ → No animation needed; right column is static list with status badges
6. ~~**Parking lot for abandoned**~~ → Yes, for dashboard: mini 10x10px blocks drift to edges over time
7. ~~**StatusBar component**~~ → Shared package: `@plannr/ui-agent-status-bar`

8. ~~**Inspector panel**~~ → Slide-in drawer
9. ~~**Mobile support**~~ → Basic responsive layout; plan ahead for mobile (see notes below)
10. ~~**Block merging UX**~~ → Planner handles cross-session deduplication, not Ideation
11. ~~**Block deletion**~~ → Yes, user can explicitly delete (AI misunderstood, changed perspective)

### Mobile Considerations (future)

Not fully designed yet, but directional thinking:
- **Canvas view**: Show chat primarily; most confident unapproved blocks at top in sequence or dropdowns
- **Curated blocks**: Collapsed/dropdown, not always visible
- **Navigation**: ← Back and → Planner buttons prominent
- **Dashboard**: TBD - complex physics may not translate well to mobile

---

*Related docs:*
- `concrete-blocks.md` - Original concept design
- `mockup-session-view-spec.md` - Physics mockup implementation
- `architecture-executive-brief.md` - System architecture

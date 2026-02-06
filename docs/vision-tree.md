# Vision: tend

## The Model

A project is a conversation that builds a tree.

The user talks to an AI collaborator. As they talk, structured output materializes: insights crystallize, tasks take shape, work gets done, artifacts appear. This structured output is **the tree** — a living document that grows from conversation into structure (work, execution, artifacts) over the life of the project.

There are no phases. No mode switches. No "handoff from ideation to planner." The conversation is continuous. The tree grows organically. Some branches might be fully executed while others are still being understood. That's fine. That's how real projects work.

```
The user talks.                      The tree grows.

"We need better auth" ──────────────▶ Left: context blocks forming
"Users keep getting locked out" ────▶ Left: more blocks forming
"Yeah, let's break this down" ──────▶ Left: 7 draft steps forming
"The API steps look right" ─────────▶ Tree: api-service steps graduate
"Start the API work" ──────────────▶ Work: 3 agents spawned
"JWT, not session cookies" ─────────▶ AI context updated, agent unblocked
"Frontend still needs design input" ▶ Left: new blocks forming
"Looks good, merge it" ────────────▶ Artifacts: PR #42 merged
```

---

## The Layout

Three columns. Always.

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│     THE NOW      │     CONVERSATION         │     THE TREE         │
│                  │                          │                      │
│  What's alive    │  The ongoing dialogue    │  What's accumulated  │
│  right now.      │  with the AI.            │  and structured.     │
│                  │                          │                      │
│  Ephemeral.      │  Always the primary      │  Persistent.         │
│  Things appear   │  interaction. Never      │  Grows over the      │
│  and disappear.  │  goes away. Adapts       │  project lifetime.   │
│                  │  to context.             │  The source of       │
│                  │                          │  truth.              │
│                  │                          │                      │
└──────────────────┴──────────────────────────┴──────────────────────┘
```

This layout never changes. What changes is the content within each column — and that happens naturally based on where the project is and what the user is doing.

### The Now (Left Column)

The creative space. Things here are transient — they either graduate to the tree or fade away.

**Contains one section:**

- **Forming blocks** — proto-work-items materializing from conversation. They represent future steps and structure that are still taking shape. Shows confidence %, type indicator. Click to inspect. High-confidence blocks auto-graduate to the tree's Work section when approved through conversation. Physics-driven: floating, drifting, confidence-based sizing. Capped at 3-5 visible (highest confidence shown first). A subtle "+N more" indicator collapses the rest.

Note: items needing the user's attention (pending questions, reply-needed items) live in the **reply bar** above the chat input, not in the left column. Active agents live in the **status bar**. The left column is purely the forming space — ephemeral, creative, physics-driven.

The left column is alive but focused. **Inside a project:** when nothing is forming, the column gracefully collapses to give more room to the conversation and tree. A subtle indicator at the edge shows it can re-expand. **At dashboard level:** the column shows project drafts in progress and cultivate signals (when cultivate is available). Without cultivate, it shows project drafts or collapses if there are none.

### The Conversation (Center)

Always present. Always the primary way the user interacts with everything.

The conversation is not a simple chat log. It's **contextual** — its character shifts based on what the user is focused on in the tree. But it's one continuous thread. You can scroll back and see the full history of the project's evolution.

**Message types:**
- **User messages** — what the human says
- **AI messages** — responses, proposals, questions, analysis
- **System events** — "Step completed," "Agent spawned," "PR merged" — these appear as compact inline events in the conversation flow, not just in the tree. The conversation IS the timeline.
- **Agent questions** — surfaced directly in conversation when they need answers
- **Context markers** — subtle indicators showing when the conversation focus shifted ("Now discussing: OAuth endpoints step")

The conversation input is always at the bottom. Above it, the reply bar shows pending items that need a response. Multiple-choice options appear in the input area when the AI asks a direct question.

### The Tree (Right Column)

The accumulated structure of the project. This is the persistent, authoritative representation of everything that's been understood, planned, and built.

The tree has two natural sections that fill in over time:

```
PROJECT NAME
│
├─ WORK
│  What needs to be done and what's been done.
│  Steps organized by scope.
│  Each step has a state: approved → running → done.
│
└─ ARTIFACTS
   What's been produced.
   PRs, commits, deployments, test results.
```

**Key principle: steps and tasks are the same thing.** A "step" in the plan doesn't become a "task" when execution starts. It's always a step. Its state changes: planned → running → completed. There's no plan/execution boundary in the tree — just a step that progresses.

The tree is interactive. Clicking any node focuses the conversation on it. The tree is also the primary navigation — you browse your project by browsing its tree.

### The Tree Breathes

A real project might have 30+ steps across 5 scopes and growing artifacts. Showing all of that at full detail would be overwhelming. The tree solves this by **breathing** — expanding and contracting based on focus, like a map that zooms.

**Three zoom levels:**

```
OVERVIEW (zoomed out — everything at a glance)
────────────────────────────────
AUTH SYSTEM

api-service       ████████░░ 2/3
web-frontend      ░░░░░░░░░░ pending
infrastructure    ████████░░ 0/1

Artifacts (2)                ← just a count
```

```
SCOPE (zoomed to a scope — steps visible)
────────────────────────────────
AUTH SYSTEM > api-service

▾ api-service
  ✓ Add OAuth endpoints
  ⟳ Session middleware · 75%
  ○ Rate limiting

▸ web-frontend (3 pending)   ← collapsed to one line
▸ infrastructure (1 pending) ← collapsed to one line

Artifacts (2)                ← collapsed
```

```
STEP (zoomed to a step — full detail)
────────────────────────────────
AUTH SYSTEM > api-service > Session middleware

▾ api-service
  ✓ Add OAuth endpoints
  ▾ ⟳ Session middleware
    ┌──────────────────────┐
    │ Progress: 75%        │
    │ Agent: Coder (Haiku) │
    │                      │
    │ Acceptance Criteria:  │
    │ ○ Unified session    │
    │   store              │
    │ ○ Redis compatible   │
    │ ○ Tests passing      │
    │                      │
    │ Depends: OAuth ✓     │
    │ Blocks: Rate limit   │
    │                      │
    │ ← Context: Session   │
    │   fragmentation      │
    └──────────────────────┘
  ○ Rate limiting

▸ web-frontend               ← collapsed
▸ infrastructure              ← collapsed
```

**How zoom works: the user drives, the conversation follows.**

The user clicks in the tree. The tree zooms to that level. The conversation adapts to that context.

```
User clicks "api-service" scope
  → Tree zooms to SCOPE level for api-service
  → Other scopes collapse to one-line summaries
  → Conversation: "The api-service scope has 3 steps..."

User clicks "Session middleware" step
  → Tree zooms to STEP level, showing full detail
  → Conversation: "This step is at 75%, the agent found a Redis issue..."

User clicks the project name (breadcrumb or top of tree)
  → Tree zooms back to OVERVIEW
  → Conversation: "Overall, you're 3/7 steps complete..."
```

The AI does NOT auto-scroll or auto-zoom the tree. The user controls the tree, the conversation follows. This keeps the tree predictable — you never glance at it and find it showing something unexpected.

**The one exception:** when an urgent question arrives from the status bar, the relevant step in the tree gets a brief pulse/glow to draw attention. But the tree doesn't scroll or collapse. Just a "look here" signal.

**Breadcrumb navigation:** When zoomed in, a breadcrumb at the top of the tree column orients the user:

```
AUTH SYSTEM > api-service > Session middleware
```

Click any part to zoom out to that level.

**Smart auto-collapse defaults:**

| Section | Auto-collapses when... |
|---------|------------------------|
| Completed scopes | All steps in the scope are ✓ (show as one-line with progress bar) |
| Artifacts | More than 3 items (show count, click to expand) |
| Step detail | User clicks a different step or scope |

The user can always override — expand anything they want. Auto-collapse is a sensible default, not a rule.

### The Status Bar (Agent Dock)

Fixed at the bottom of the screen. Always visible. This is where agents live and surface things in real-time.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   [◉ Coder]  [◉ Tester]  [○ Architect]                  💬 1       │
│    ████░░      ██░░░░      idle                                      │
│       💬                                                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Agent avatars with progress rings:** Each active agent has an avatar in the status bar. A ring around the avatar fills as the agent progresses. Colors indicate state:
- Green ring filling = working normally
- Yellow ring = needs input (preference/FYI)
- Red ring = blocked (needs answer to continue)
- Full green ring → brief glow → avatar fades = completed

**Chat bubbles pop up from avatars:** When an agent has a question or the AI has a draft proposal, a chat bubble appears above the relevant avatar. It stays for 10-15 seconds.

```
         ┌─────────────────────────────┐
         │ 🔴 Blocking                 │
         │ "JWT or session cookies?"   │
         │                             │
         │ [A: JWT] [B: Sessions]      │
         └─────────────┬───────────────┘
                       │
┌──────────[◉ Coder]──┴──[◉ Tester]──[○ idle]────────💬 1────────┐
│            🔴████░░       ██░░░░                                │
└─────────────────────────────────────────────────────────────────┘
```

**The tiered attention model:**

```
1. Agent hits a problem or AI has a proposal
   → Chat bubble pops UP from the avatar in the status bar
   → Bubble stays for ~10-15 seconds

2a. User clicks the bubble within that window
    → Modal opens with full context (question details, draft step preview, etc.)
    → User answers or accepts/rejects
    → Bubble disappears, agent resumes or tree updates
    → Decision recorded in conversation as a system event

2b. User doesn't click (busy typing, reading, didn't notice)
    → Bubble shrinks to a small badge on the avatar (🔴 or 📋)
    → Item appears in the reply bar above chat input
    → Status bar "💬" counter increments
    → The item waits in the reply bar until addressed
```

| Attention layer | Purpose | Lifespan |
|-----------------|---------|----------|
| **Status bar bubble** | "Right now, this second" — immediate notification | 10-15s, then minimizes to badge |
| **Reply bar** | "You should deal with this soon" — compact lines above chat input | Persistent until addressed |
| **Tree** | "The accumulated state of everything" — permanent record | Lifetime of the project |

**Other status bar sections:**
- **💬 count** — total pending items across all projects. Click to see reply bar.
- **Connection** — relay status. Only shows if disconnected.

When the user is on the dashboard (not in a specific project), the status bar shows global agent activity across all projects.

---

## Crucial Moments

These are the points where the user spends the most time. Each one described in detail.

### Moment 1: Starting a New Project

The user clicks "New project" or types in the dashboard conversation. The screen is almost empty. This should feel inviting, not overwhelming.

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│                  │                          │                      │
│                  │  What are you thinking   │  ‹untitled›          │
│                  │  about building?         │                      │
│                  │                          │                      │
│   Nothing here   │  I'm ready to help you   │                      │
│   yet.           │  explore, brainstorm,    │                      │
│                  │  or jump straight into   │                      │
│   Things will    │  planning if you already │                      │
│   appear as we   │  know what you want.     │                      │
│   talk.          │                          │                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ Type here...        │ │                      │
│                  │  └─────────────────────┘ │                      │
│                  │                          │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  (no active agents)                                                │
└───────────────────────────────────────────────────────────────────┘
```

**What the user feels:** A blank canvas with an intelligent partner ready to go. No forms to fill. No "step 1 of 5" wizard. Just start talking.

**What happens next:** The user types something. Could be vague ("improve our auth") or specific ("I need OAuth2 with PKCE on the api-service repo, login page on the frontend, and secrets in Vault"). The AI adapts.

If vague: AI asks clarifying questions. Blocks start forming in the left column. Slow, exploratory.

If specific: AI immediately starts proposing structure. Draft steps form in the left column. Understanding forms behind the scenes as context for the AI. Fast, direct.

Both paths are valid. The user decides the pace.

### Moment 2: Deep in Ideation

The user and AI have been talking for a while. The left column is alive with forming blocks — proto-steps taking shape. Some have graduated to the tree.

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│  FORMING         │  🔒 Security:            │  AUTH SYSTEM         │
│                  │  "Have you considered    │  │                   │
│  ◐ Token         │  token rotation? If a    │  ├─ Work             │
│    rotation      │  refresh token is        │  │  (nothing yet)    │
│    38%           │  compromised, you need   │  │                   │
│                  │  a way to invalidate     │  └─ Artifacts        │
│  ○ API           │  the chain."             │     (nothing yet)    │
│    versioning    │                          │                      │
│    12%           │  You:                    │                      │
│                  │  "Good point. Our        │                      │
│                  │  tokens currently live    │                      │
│                  │  forever once issued."   │                      │
│                  │                          │                      │
│                  │  🤖 That's a security    │                      │
│                  │  risk. I'm adding a      │                      │
│                  │  block about token       │                      │
│                  │  lifecycle management.   │                      │
│                  │  I'm also starting to    │                      │
│                  │  see the shape of the    │                      │
│                  │  implementation. Want me  │                      │
│                  │  to sketch out some      │                      │
│                  │  steps?                  │                      │
│                  │                          │                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ Type here...        │ │                      │
│                  │  └─────────────────────┘ │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  (no active agents)                                                │
└───────────────────────────────────────────────────────────────────┘
```

**What the user feels:** A productive brainstorming session with an expert. Insights are materializing in real-time. The conversation is building context while proto-steps take shape in the left column. The AI is actively connecting dots.

**Key interactions:**
- A forming block in the left column catches the user's eye. They click it → focus mode opens (block detail + scoped conversation). The user explores it, asks the AI questions about it.
- A forming block seems irrelevant. They ignore it. After a while, if the conversation moves on and nobody curated it, it fades out of the left column. Not deleted — just de-emphasized. The AI might reference it later if it becomes relevant.
- The AI asks "Want me to sketch out some steps?" — this is the organic moment where planning starts. Not a transition. Just the conversation evolving.

**The curate interaction:** Forming blocks graduate to the tree through conversation. The AI proposes: "I think X, Y, and Z are ready — should we start?" The user responds naturally. Approved blocks graduate to the tree's Work section. No UI buttons, no checkmarks — approval is dialogue, not controls.

### Moment 3: The Plan Takes Shape

The user said "yeah, sketch out some steps." The AI starts proposing plan structure. This is the most important transition moment — and it should feel like nothing special happened.

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│  FORMING         │  🤖 Here's how I'd       │  AUTH SYSTEM         │
│                  │  break this down:        │                      │
│  ◐ Token         │                          │                      │
│    rotation      │  api-service scope:      │                      │
│    38%           │  1. Add OAuth endpoints  │                      │
│                  │     ← from your PKCE     │                      │
│  ◎ OAuth         │     requirement          │                      │
│    endpoints     │  2. Session middleware    │                      │
│    (proto-step)  │     ← addresses the      │                      │
│                  │     fragmentation issue   │                      │
│  ◎ Session       │  3. Rate limiting        │                      │
│    middleware    │     ← you mentioned this │                      │
│    (proto-step)  │     as absent            │                      │
│                  │                          │                      │
│  ◎ Rate          │  web-frontend scope:     │                      │
│    limiting      │  4. Login page           │                      │
│    (proto-step)  │  5. Protected routes     │                      │
│                  │  6. Token storage        │                      │
│  +4 more         │                          │                      │
│                  │  infrastructure scope:   │                      │
│                  │  7. OAuth secrets in     │                      │
│                  │     Vault                │                      │
│                  │                          │                      │
│                  │  What do you think?       │                      │
│                  │  Anything missing?        │                      │
│                  │                          │                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ Type here...        │ │                      │
│                  │  └─────────────────────┘ │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  (no active agents)                                                │
└───────────────────────────────────────────────────────────────────┘
```

**What the user feels:** The AI understood the problem and proposed a structured breakdown. Steps are appearing both in the conversation (explained) and in the tree (structured). This feels like a natural continuation of the conversation, not a mode switch.

**What just happened technically:**
- The AI generated step proposals from the conversation
- They appear in the left column as forming blocks (proto-steps)
- They do NOT appear in the tree yet — only approved steps appear in the tree
- The AI explains each step in the conversation, linking back to context
- The user approves conversationally; approved steps graduate from the left column to the tree's Work section

**Key interactions:**
- The AI proposes conversationally: "I think the API steps look solid — should we start those?"
- User responds naturally: "yeah, start the API work" → API steps graduate from left column to tree's Work section
- "Actually, we also need X" — user adds context in conversation. AI adds a forming block in the left column.
- "Move rate limiting before session middleware" — user reorders via conversation. AI adjusts dependencies.
- "The frontend scope looks premature, let's just do API first" — frontend blocks stay in left column or fade if the conversation moves on.

**The tree during this moment:** The Work section appears when the first steps are approved and graduate from the left column. This keeps the tree clean: only confirmed, structured items.

### Moment 4: Partial Execution, Mixed States

This is where the tree model really shines. Some parts of the project are done. Some are running. Some are still being planned. Some are still being understood. Everything coexists.

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│  FORMING         │  🤖 The OAuth endpoints   │  AUTH SYSTEM         │
│                  │  are done. PR #42 has    │  │                   │
│  ◐ Token         │  been merged.            │  ├─ Work             │
│    rotation      │                          │  │                   │
│    51%           │  Session middleware is    │  │  api-service      │
│                  │  75% complete. The agent  │  │  ✓ OAuth endpts   │
│  ◎ Login page    │  found an issue with     │  │    PR #42 merged  │
│    (proto-step)  │  Redis session store     │  │  ⟳ Session mw     │
│                  │  compatibility.          │  │    75% · Coder    │
│  ◎ Protected rts │                          │  │  ○ Rate limiting   │
│    (proto-step)  │  Meanwhile, I still have │  │                   │
│                  │  some questions about    │  │  infrastructure   │
│  ◎ Token storage │  the frontend scope.     │  │  ○ OAuth secrets   │
│    (proto-step)  │  Should the login page   │  │                   │
│                  │  support social login    │  └─ Artifacts        │
│                  │  (Google, GitHub), or    │     ✓ PR #42 OAuth  │
│                  │  just email/password?    │     endpoints        │
│                  │                          │                      │
│                  │                          │                      │
│                  │  ┌──────────────────────┐│                      │
│                  │  │Social login too? Or  ││                      │
│                  │  │just email/password?  ││                      │
│                  │  └──────────────────────┘│                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ Type here...        │ │                      │
│                  │  └─────────────────────┘ │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  [◉ Coder ████████░░]  [○ idle]                          💬 0     │
└───────────────────────────────────────────────────────────────────┘
```

**What the user sees at a glance:**
- Left column: Token rotation block still forming (51% confidence), 3 frontend proto-steps waiting for answers
- api-service: 1 done (green check + PR link), 1 running (spinner + progress), 1 pending
- web-frontend: 3 proto-steps forming in the left column — the AI is asking questions before they can be approved and graduate to the tree
- infrastructure: 1 pending (waiting on api-service)
- Artifacts: 1 PR merged

**This is the mixed state that the tree model handles naturally.** In the old three-app model, you'd need to be in Forge to see execution, switch to Planner to refine frontend steps, and switch to Ideation to explore the new token rotation insight. Here, it's all one view.

**Key interactions:**
- Click "Session mw" in the tree → conversation shows the agent's progress, what it found about Redis
- Click "Login page" (draft) → conversation shifts to the frontend scope discussion, AI asks about social login
- Click "Token rotation" (forming) → conversation shows this insight emerged from the agent's work, AI explains the security implications
- Answer "Just email/password for now" → AI finalizes the Login page step, it solidifies in the tree

### Moment 5: An Agent Needs Help

An agent hits something it can't resolve. This should feel urgent but not disruptive. The question flows through the tiered attention model: status bar bubble first, then reply bar if ignored.

**If the user is actively in the project — the bubble catches them:**

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│  FORMING         │  🤖 Session middleware    │  AUTH SYSTEM         │
│  (none)          │  agent has a question:   │  │                   │
│                  │                          │  ├─ Work             │
│                  │  ┌────────────────────┐  │  │                   │
│                  │  │ 🔴 BLOCKING        │  │  │  api-service      │
│                  │  │                    │  │  │  ✓ OAuth endpts   │
│                  │  │ The existing       │  │  │  🔴 Session mw    │
│                  │  │ session store uses │  │  │    BLOCKED        │
│                  │  │ Redis with a       │  │  │  ○ Rate limiting   │
│                  │  │ custom serializer. │  │  │                   │
│                  │  │                    │  │  │  (rest of tree)   │
│                  │  │ Should I:          │  │  │                   │
│                  │  │ A) Migrate to      │  │  └─ Artifacts        │
│                  │  │    standard JSON   │  │     ✓ PR #42        │
│                  │  │    serialization?  │  │                      │
│                  │  │ B) Keep the custom │  │                      │
│                  │  │    serializer and  │  │                      │
│                  │  │    add OAuth       │  │                      │
│                  │  │    fields to it?   │  │                      │
│                  │  │                    │  │                      │
│                  │  │ Option A is cleaner │  │                      │
│                  │  │ but requires data  │  │                      │
│                  │  │ migration. Option B │  │                      │
│                  │  │ is faster but adds │  │                      │
│                  │  │ tech debt.         │  │                      │
│                  │  └────────────────────┘  │                      │
│                  │                          │                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ A ⎸ B ⎸ Or type... │ │                      │
│                  │  └─────────────────────┘ │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  [◉ Coder 🔴███░░]  [○ idle]                             💬 1     │
│       💬 ← bubble popped up here first                             │
└───────────────────────────────────────────────────────────────────┘
```

**The sequence of events:**

1. Agent hits the Redis serializer problem
2. Coder avatar in status bar turns red ring, progress pauses
3. Chat bubble pops UP from the Coder avatar: "🔴 JWT or session cookies?"
4. User notices and clicks the bubble (or it surfaces in conversation)
5. Full question context appears in conversation with quick-answer buttons
6. Tree: Session mw step shows 🔴 BLOCKED (the step pulses briefly to draw attention)

**If the user doesn't click the bubble within ~15 seconds:**

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│  FORMING         │                          │                      │
│  (none)          │  (user is mid-           │  (tree unchanged,    │
│                  │   conversation about     │   Session mw shows   │
│                  │   something else)        │   🔴 BLOCKED)        │
│                  │                          │                      │
│                  │  ─────────────────────── │                      │
│                  │  ↩ Redis serializer      │                      │
│                  │    strategy? · Session   │                      │
│                  │    mw · 2m ago           │                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ Type here...        │ │                      │
│                  │  └─────────────────────┘ │                      │
│                  │                          │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  [◉ Coder 🔴███░░]  [○ idle]                             💬 1     │
│          🔴 ← badge remains on avatar                              │
└───────────────────────────────────────────────────────────────────┘
```

The bubble shrank to a badge on the avatar. The question appeared in the reply bar above the chat input. It waits patiently. The user can click it in the reply bar or click the badge on the avatar — either opens the agent's tab with the question context.

**After answering:** The user clicks "A" or types a response. The answer flows to the agent. The agent's avatar returns to green progress ring. The question disappears from the reply bar. The conversation records the decision. The tree step goes back to ⟳.

If the user is in a **different project** when the question arrives, the status bar shows the Coder avatar with a red badge (agents are global in the status bar). The 💬 counter increments. Clicking it navigates to the Auth System project with the question focused.

### Moment 6: Coming Back to a Project

The user closed the browser yesterday. Agents kept working. When they return:

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│                  │  🤖 Welcome back.         │  AUTH SYSTEM         │
│                  │  Here's what happened    │  │                   │
│                  │  since you left:         │  ├─ Work             │
│   Nothing        │                          │  │                   │
│   happening      │  ✓ Session middleware    │  │  api-service      │
│   right now.     │    completed (PR #43)    │  │  ✓ OAuth endpts   │
│                  │  ✓ Rate limiting         │  │  ✓ Session mw     │
│   All agents     │    completed (PR #44)    │  │  ✓ Rate limiting   │
│   finished.      │  ✓ OAuth secrets         │  │                   │
│                  │    deployed to Vault     │  │  web-frontend     │
│                  │                          │  │  ○ Login page      │
│                  │  The api-service and     │  │  ○ Protected rts   │
│                  │  infrastructure scopes   │  │  ○ Token storage   │
│                  │  are fully complete.     │  │                   │
│                  │                          │  │  infrastructure   │
│                  │  web-frontend has 3      │  │  ✓ OAuth secrets   │
│                  │  approved steps ready    │  │                   │
│                  │  to go. Want me to       │  └─ Artifacts        │
│                  │  start those?            │     ✓ PR #42 OAuth   │
│                  │                          │     ✓ PR #43 Session │
│                  │                          │     ✓ PR #44 Ratelim│
│                  │  ┌─────────────────────┐ │     ✓ Vault deploy  │
│                  │  │ Start frontend ⎸    │ │                      │
│                  │  │ Review first   ⎸    │ │                      │
│                  │  └─────────────────────┘ │                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ Type here...        │ │                      │
│                  │  └─────────────────────┘ │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  (all agents finished)                                             │
└───────────────────────────────────────────────────────────────────┘
```

**What the user feels:** Caught up in 5 seconds. The conversation shows compact system event lines for everything that happened while the user was away — each clickable for detail. The tree reflects the current state. A quick-action bar suggests the obvious next step.

**How it works:** The conversation doesn't show an AI monologue. It shows the actual system events that occurred (step completed, PR merged, agent finished) as compact inline markers — the same format used during live execution. The user scrolls through them like a changelog. The tree already shows the result. Together, the user gets instant comprehension without the AI needing to "speak."

This is essential for the model to work. Projects are async. Agents work while you sleep. The "coming back" experience must be instant comprehension of current state.

### Moment 7: The Dashboard (Multiple Projects)

When the user isn't in a specific project, they see the dashboard. This replaces the current home screens of all three apps.

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│                  │  🤖 Good morning.         │  Auth System         │
│                  │                          │  └ 7/7 · complete    │
│                  │  Auth System is almost   │                      │
│                  │  done — just frontend    │  API Redesign        │
│                  │  left. API Redesign has  │  └ 3/10 · blocked    │
│                  │  a blocking question     │    └ ⟳ endpoint      │
│                  │  from 2 hours ago.       │      naming · needs  │
│                  │                          │      input           │
│                  │  Mobile App is still in  │                      │
│                  │  early ideation.         │  Mobile App          │
│                  │                          │  └ ideating · 3      │
│                  │  What would you like to  │    blocks            │
│                  │  focus on?               │                      │
│                  │                          │  ─────────────────── │
│                  │                          │  [+ new]             │
│                  │                          │                      │
│                  │  ─────────────────────── │                      │
│                  │  ↩ endpoint naming? ·    │                      │
│                  │    API Redesign · 2h ago │                      │
│                  │  ┌─────────────────────┐ │                      │
│                  │  │ Type here...        │ │                      │
│                  │  └─────────────────────┘ │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  [◉ Coder ██░░]  [◉ Tester ████]  [◉ Scout ██░░]        💬 1     │
└───────────────────────────────────────────────────────────────────┘
```

**What the user feels:** A zen garden overview. Projects are text-based list items in the tree column — pulsing or showing indicators only where attention is needed. The AI greets contextually and suggests next actions. The same three-column layout as always.

The conversation at the dashboard level is the same unified AI — it discusses priorities, suggests what to work on, summarizes across projects. No different persona, just adapted context.

---

## The Tree In Detail

### Structure

```
PROJECT
│
├─ WORK
│  │
│  ├─ api-service/
│  │  │
│  │  ├─ ✓ Add OAuth endpoints
│  │  │    Acceptance: ✓ PKCE flow works  ✓ Tests passing
│  │  │    Artifact: PR #42 (merged)
│  │  │    Cost: $0.43  Duration: 4m
│  │  │
│  │  ├─ ⟳ Session middleware
│  │  │    Progress: 75%  Agent: Coder
│  │  │    Depends on: OAuth endpoints ✓
│  │  │
│  │  └─ ○ Rate limiting
│  │       Depends on: OAuth endpoints ✓
│  │       Status: Ready to start
│  │
│  └─ infrastructure/
│     │
│     └─ ○ OAuth secrets in Vault
│          Depends on: OAuth endpoints ✓
│          Status: Ready to start
│
└─ ARTIFACTS
   │
   ├─ ✓ PR #42: OAuth endpoints (merged)
   │    repo: api-service
   │    +342 -12 lines
   │
   └─ (more as they appear)
```

### Step States

Each step in the Work section has a clear visual state:

| State | Icon | Meaning | Visual |
|-------|------|---------|--------|
| Approved | ○ | User confirmed, ready to execute | Solid border, normal text |
| Queued | ◌ | Waiting for agent availability | Subtle pulse |
| Running | ⟳ | Agent actively working | Spinner + progress bar |
| Blocked | 🔴 | Agent needs input | Red indicator, surfaces question |
| Done | ✓ | Completed successfully | Green check, shows artifact link |
| Failed | ✗ | Failed after retries | Red X, shows error summary |

Note: Draft/proposed steps do not appear in the tree. They live as forming blocks in the left column until approved through conversation, at which point they graduate to the tree in the Approved state.

### Step Detail (Expanded View)

When you click a step in the tree, a **sheet** slides in from the side showing full detail:

```
┌────────────────────────────────────────┐
│ Add OAuth endpoints                     │
│ Scope: api-service                      │
│ Status: ✓ Completed                     │
│                                         │
│ ACCEPTANCE CRITERIA                     │
│ ✓ PKCE authorization code flow works    │
│ ✓ Token endpoint returns JWT            │
│ ✓ Refresh token endpoint works          │
│ ✓ All tests passing                     │
│                                         │
│ DEPENDS ON                              │
│ (none — first step)                     │
│                                         │
│ BLOCKS                                  │
│ → Session middleware                    │
│ → Rate limiting                         │
│ → OAuth secrets (different scope)       │
│                                         │
│ TRACEABILITY                            │
│ ← Decision: "OAuth2 with PKCE"         │
│   (conversation turn #3)               │
│ ← Decision: "Use standard JWTs"        │
│   (user preference, 95% confidence)    │
│                                         │
│ EXECUTION                               │
│ Agent: Coder (Haiku)                    │
│ Duration: 4m 12s                        │
│ Tokens: 15,204                          │
│ Cost: $0.43                             │
│ Artifact: PR #42                        │
│                                         │
│ [View PR] [View conversation]           │
└────────────────────────────────────────┘
```

**Traceability** is important: every step can trace back to the decisions and conversation that motivated it. This is provided by the trajectory system — decisions recorded with reasoning, alternatives considered, and provenance from conversation context.

### Step Traceability (Trajectories)

Every step in the tree can trace back to the decisions and conversation that motivated it. The trajectory system captures:

- **Decisions recorded with reasoning:** What was decided and why
- **Alternatives considered:** What other options were discussed
- **Provenance:** Which conversation turns, questions, and context led to this step
- **User preferences:** Explicit choices made during planning

Clicking a step's sheet shows its trajectory: what questions were asked, what was decided, why. This is richer than simple block linkage — it captures the full decision chain, not just topic association.

```
Step: "Add OAuth endpoints"
  ← Decision: OAuth2 with PKCE approach
     Reasoning: PKCE prevents authorization code interception
     Alternative considered: Implicit flow (rejected: less secure)
     Source: conversation turn #3, user preference

Step: "Session middleware"
  ← Decision: Unified session store
     Reasoning: Current fragmentation across Redis + cookies
     Alternative considered: Keep fragmented (rejected: maintenance burden)
     Source: conversation turn #5, agent observation
```

When reviewing a plan, the user can see WHY each step exists through its trajectory. The tree isn't just a list — it's a connected graph with full decision traceability from conversation to artifacts.

---

## The Conversation In Detail

### Conversation Modes

The conversation adapts based on what the user is doing, but there's always only ONE conversation per project.

**Project-level (nothing selected in tree):**
- AI adapts to project-level context
- Summarizes state, suggests next actions
- Answers high-level questions about the project
- "We're 70% through the API scope. Frontend is still in draft."

**Step-focused (user clicked a step):**
- If approved/pending: AI explains what will happen when it runs
- If running: AI shows agent progress, relays messages from agent
- If done: AI summarizes results, shows artifact
- If failed: AI explains what went wrong, suggests recovery

**Agent-focused (user clicked an agent in the status bar or opened an agent tab):**
- AI relays the agent's stream of consciousness
- Shows what the agent is doing, what it's tried, where it's stuck
- User can message the agent directly through the conversation

### Conversation History and Context

The conversation is one long thread per project. But it needs structure to be navigable.

**Context markers:** When the conversation focus changes, a subtle divider appears:

```
──── Step: Add OAuth endpoints ────

🤖 This requirement came from your mention of...

──── Step: Session middleware ────

🤖 The agent is working on this. Current progress...

──── Project overview ────

🤖 Coming back to the big picture...
```

The conversation is a continuous thread — scroll back to see the full project evolution. No auto-collapsing or summarizing. Agent work lives in tabs (see "Conversation Tabs" below), keeping the main thread focused on the user's dialogue with the AI.

### System Events in Conversation

Execution events appear as compact inline markers in the conversation flow:

```
🤖 Starting OAuth endpoints step. Spawning Coder agent...

   ┊ Agent spawned · Coder (Haiku) · 10:42am

🤖 The agent has started working on the PKCE flow.

   ┊ Progress: 25% · Implementing /auth/login endpoint

   ┊ Progress: 60% · Adding PKCE challenge verification

   ┊ Progress: 90% · Writing tests

   ┊ Step completed · 4m 12s · PR #42 created

🤖 OAuth endpoints are done. PR #42 is ready for review.
   All 4 acceptance criteria passed. Should I start the
   next step (session middleware)?
```

These system events are compact — they don't overwhelm the conversation. But they keep the user informed of progress without needing to stare at a dashboard.

---

## The Now Column In Detail

### Layout Sections

The left column has one section that appears only when it has content.

```
FORMING
  Blocks materializing from conversation.
  Proto-work-items representing future steps,
  scope groupings, or structure still taking shape.
  Shows confidence %. Click to inspect.
  Blocks graduate to the tree's Work section when
  approved through conversation.
  Capped at 3-5 visible. "+N more" for overflow.
```

### Empty States

When nothing is forming, the left column collapses to give more room to the conversation and tree. A subtle indicator at the edge shows the column is available — clicking it re-expands. When the user is deep in conversation and the creative/attention items are few, the workspace becomes effectively two columns: conversation + tree.

### Forming Block Lifecycle

```
1. AI mentions something in conversation
   → Block appears in FORMING at 10-20% confidence
   → Small dot, just a keyword

2. Conversation reinforces the concept
   → Confidence grows: 30%, 50%
   → Block expands: shows keyword + one-line summary

3. Confidence crosses threshold (e.g., 70%)
   → AI proposes the block for approval through conversation
   → User confirms → Block graduates to tree's Work section
   → Subtle animation: slides from left column to right column
   → Left column slot freed for new forming blocks

4. OR: Conversation moves on, block is never reinforced
   → Confidence decays slowly over time
   → Block fades from FORMING
   → Not deleted — the AI still remembers it and may reference later
```

### Reply Bar (Pending Items)

Items that need the user's response accumulate as compact lines above the chat input:

```
1. Agent hits a blocking problem
   → Chat bubble pops from agent avatar in STATUS BAR
   → Stays for ~10-15 seconds

2a. User clicks bubble immediately
    → Context opens in conversation
    → Item never reaches the reply bar

2b. User doesn't click within ~15 seconds
    → Bubble shrinks to badge on avatar
    → Item appears in reply bar above chat input
    → Stays until user addresses it

3. User clicks item in reply bar
   → Opens agent tab, scrolls to question context
   → After answering, item removed from reply bar
```

---

## What This Means for the Frontend

### Single App Structure

```
packages/tend/
└── src/
    ├── App.tsx
    ├── layouts/
    │   └── WorkspaceLayout.tsx      ← the three-column shell + status bar
    │
    ├── components/
    │   ├── now/                     ← left column (forming blocks)
    │   │   ├── NowColumn.tsx        ← container, auto-collapses when empty
    │   │   ├── FormingBlocks.tsx    ← blocks materializing from conversation
    │   │   └── ReplyBar.tsx         ← pending items above chat input
    │   │
    │   ├── conversation/            ← center column
    │   │   ├── ConversationPane.tsx ← main conversation container
    │   │   ├── MessageBubble.tsx    ← user + AI messages
    │   │   ├── SystemEvent.tsx      ← compact inline events (step completed, etc.)
    │   │   ├── QuestionCard.tsx     ← inline question with quick-answer buttons
    │   │   ├── ContextMarker.tsx    ← dividers when conversation focus shifts
    │   │   ├── AgentTab.tsx         ← tab view for agent trace/detail
    │   │   └── ConversationInput.tsx ← input + contextual quick actions
    │   │
    │   ├── tree/                    ← right column (the project tree)
    │   │   ├── ProjectTree.tsx      ← tree container with zoom level management
    │   │   ├── TreeBreadcrumb.tsx   ← "Auth > api-service > Session mw"
    │   │   ├── WorkSection.tsx      ← scopes + steps, collapsible per scope
    │   │   ├── ArtifactsSection.tsx ← PRs, commits, deploys
    │   │   ├── StepNode.tsx         ← single step (approved/running/done)
    │   │   └── StepDetail.tsx       ← expanded step view (AC, deps, execution)
    │   │
    │   ├── status-bar/              ← fixed bottom bar (agent dock)
    │   │   ├── StatusBar.tsx        ← container
    │   │   ├── AgentAvatar.tsx      ← avatar with progress ring + state colors
    │   │   ├── AgentBubble.tsx      ← chat bubble that pops up from avatar
    │   │   └── GlobalCounters.tsx   ← 💬 count, $ cost, connection status
    │   │
    │   ├── dashboard/               ← home/multi-project view
    │   │   ├── DashboardPage.tsx
    │   │   ├── ProjectCard.tsx
    │   │   └── AttentionItems.tsx
    │   │
    │   └── sidebar/                 ← global left nav (project list)
    │       ├── AppSidebar.tsx
    │       └── ProjectList.tsx
    │
    ├── hooks/
    │   ├── useProject.ts            ← coordinates session + plan + run
    │   ├── useConversation.ts       ← conversation state + context focus
    │   ├── useTreeFocus.ts          ← which tree node is selected + zoom level
    │   ├── useFormingBlocks.ts      ← forming block lifecycle + auto-graduate
    │   ├── useReplyBar.ts           ← pending items above chat input
    │   ├── useAgentDock.ts          ← agent avatars, progress, bubble lifecycle
    │   └── useTreeZoom.ts           ← auto-collapse rules, breadcrumb state
    │
    └── contexts/
        ├── ProjectContext.tsx        ← current project + tree state
        ├── AgentContext.tsx          ← global agent state across projects
        └── RelayContext.tsx          ← shared WebSocket connection
```

### Routes

```
/                           → Dashboard (multi-project)
/projects                   → Project list
/projects/new               → New project (opens empty workspace)
/projects/:id               → Project workspace (the three-column view)
/settings                   → App settings
```

Only 4-5 routes. The workspace view (three-column layout) handles all the complexity through tree navigation, not URL routing.

### What Carries Over From Existing Packages

| From | What | Adapted How |
|------|------|-------------|
| ideation-ui | SessionChatView | → ConversationPane (universal conversation) |
| ideation-ui | Block rendering | → FormingBlocks in left column |
| ideation-ui | Specialist indicators | → Part of forming block metadata in left column |
| ideation-ui | Understanding data | → invisible context for AI (not rendered in tree) |
| ideation-ui | Block confidence/states | → Forming block lifecycle in left column |
| planner-ui | Step editor | → StepDetail (sheet view when step clicked in tree) |
| planner-ui | Swimlane/scope grouping | → WorkSection scope grouping in tree |
| planner-ui | Agent avatars | → AgentAvatar in status bar (progress ring, state colors) |
| planner-ui | Command palette | → Cmd+K (global, searches tree nodes) |
| planner-ui | Relay messaging | → Part of ConversationPane + AgentContext |
| planner-ui | Question queue | → ReplyBar above chat input (fed by status bar timeout) |
| planner-ui | Status bar | → StatusBar (reimagined as agent dock with avatars + bubbles) |
| forge-ui | Run progress | → StepNode states in tree (running ⟳, progress %, done ✓) |
| forge-ui | Timeline events | → SystemEvent in conversation (compact inline markers) |
| forge-ui | Artifact display | → ArtifactsSection in tree |
| forge-ui | Gate approval | → QuestionCard variant (surfaces via status bar bubble → conversation) |
| forge-ui | Preflight validation | → Inline in conversation when user says "start this scope" |
| shared-ui | Theme, tokens, fonts | → Direct import, unchanged |
| shared-ui | Avatar, StatusIndicator | → Direct import, used in AgentAvatar and tree nodes |

---

## What This Means for the Backend

### Existing APIs

The existing APIs work as-is:

```
POST /api/ideation/sessions           → create session (= start ideation on project)
POST /api/ideation/sessions/:id/chat  → send message
GET  /api/ideation/sessions/:id/blocks → get blocks

POST /api/plans                        → create plan
PUT  /api/plans/:id/versions/:v        → update steps
POST /api/plans/:id/versions/:v/approve → approve

POST /api/forge/runs                   → start execution
GET  /api/forge/runs/:id/events        → SSE stream
```

The "Project" entity is initially a client-side concept that links `session_id + plan_id + run_id`. Stored in localStorage.

### Project Entity

Add a thin `projects` table in planner.db that formalizes the linkage:

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,         -- → user who created it (team-ready from day one)
  initiative_id TEXT,
  session_id TEXT,       -- → ideation session
  plan_id TEXT,          -- → planner plan
  run_id TEXT,           -- → forge run
  created_at TEXT,
  updated_at TEXT
);
```

And a single API endpoint:

```
GET  /api/projects/:id          → returns project with linked entities
POST /api/projects               → creates project
PUT  /api/projects/:id          → updates links
```

This is the only backend addition needed. Everything else uses existing APIs.

### Code & Repo Connection

Projects connect to code repos. Each scope maps to a local directory (Conductor-style):

```
Auth System project
├─ api-service   → ~/code/backend/
├─ web-frontend  → ~/code/web-app/
└─ infrastructure → ~/code/infra/
```

**How repos get connected:** The user points tend to a local folder or remote git repo during conversation. This can happen at project creation ("the API lives in ~/code/backend") or later when scopes solidify. The AI asks when it needs to know — "which repo does api-service map to?"

**Branch management:** tend creates `tend/{step-slug}` branches automatically when execution starts. One branch per step. The agent works on the branch, commits, pushes, and creates PRs. The `tend/*` prefix signals tend-managed branches.

**The workspace_path:** Forge already supports `workspace_path` — it's passed when creating a run and embedded in each agent's task prompt. tend populates this from the scope → repo mapping stored on the project entity.

### Execution: Forge as Orchestrator

Forge is the execution engine — a DAG scheduler that compiles approved plans into runs, spawns agents via relay, and tracks completion. It is **not** a conversation; it's a state machine.

When the user says "start the API work":

1. tend creates a Forge Run (`POST /api/forge/runs`) with the approved plan steps, workspace paths per scope, and execution policy (budgets, parallelism, retries)
2. Forge creates Tasks from Steps, checks the dependency DAG, spawns agents for ready tasks
3. Agents work in their `workspace_path`, report progress and artifacts via MCP tools
4. Forge captures artifacts (PR URLs, commit SHAs, test results, deployments) and emits trajectory events
5. tend receives SSE events and updates the tree + trickles key events to conversation

**What the Interviewer does during execution:** The Interviewer watches forge events and selectively surfaces what matters. Not every event becomes a conversation message — the AI drops info when it thinks it's valuable. A PR completion gets a trickle. An intermediate commit probably doesn't. Agent questions get routed through the attention system (status bar → reply bar).

**Multi-repo coordination:** Agents auto-join the project's relay channel (`#plan-{planId}`). When Agent A (api-service) finishes the OAuth endpoints, it posts the API shape to the channel. Agent B (web-frontend) reads channel history and sees the endpoint spec before starting work. No synchronous blocking — Forge's dependency DAG ensures ordering.

**Artifacts in the tree:**

| Type | Rendering |
|---|---|
| PR | `PR #43 — Session middleware (+120 -30)` — click opens GitHub |
| Deployment | `Deployed to staging — staging.example.com` |
| Test results | `Tests: 42 passed, 0 failed` — click opens sheet |

---

## Detail Views

The tree and conversation columns handle navigation and context. Sheets handle rich detail.

**The principle:** the tree column shows **compact status** (titles, state indicators, progress). The conversation column shows **narrative context** (reasoning, history, explanations). When you need **rich detail** (acceptance criteria, dependencies, execution info, editing), a **sheet** slides in — user-initiated, never AI-triggered. Modals are reserved for destructive confirmations only.

### What Happens When You Click

| Click target | Tree column | Conversation column | Left column |
|---|---|---|---|
| **Step in tree** | Zooms to STEP level — click again opens sheet (AC, deps, agent, progress) | Adapts context — recent activity for this step | Unchanged |
| **Scope heading** | Zooms to SCOPE level — all steps in scope visible | Summarizes scope progress, suggests next actions | Unchanged |
| **Reply bar item** | Relevant step pulses/highlights | Opens agent tab with question context | N/A |
| **Agent avatar (status bar)** | Zooms to the step the agent is working on | Opens agent tab showing activity stream | Unchanged |
| **Artifact in tree** | N/A | N/A | N/A |
| **Breadcrumb segment** | Zooms to that level (OVERVIEW, SCOPE, or STEP) | Adapts to that level's context | Unchanged |

**Artifacts:** External artifacts (PRs, deploys) open in a new browser tab with short inline stats (+150 | -150). Internal artifacts (test results, generated files) open in a sheet.

**Modals** are reserved for exactly one case: confirming destructive actions (delete project, cancel run, remove steps).

**Sheets may include chat:** For complex detail views where the user needs to interact with the AI (editing acceptance criteria, discussing a step's approach), the sheet includes a focused chat input. This keeps the interaction scoped to the detail being viewed.

### Agent Work in Conversation

Agent work (tool calls, code reads, reasoning traces) lives in **agent tabs**, not inline in the main conversation. The main thread shows only key events as compact system markers:

````
🤖 Starting session middleware. Spawning Coder agent...

   ┊ Agent spawned · Coder (Haiku) · 10:42am
                     ↑ click to open agent tab

   ┊ Progress: 60% · Refactoring serializer

   ┊ Progress: 90% · Writing tests

   ┊ Step completed · 4m 12s · PR #43 created

🤖 Session middleware is done. The agent migrated the Redis
   serializer to standard JSON. All tests passing.
   [View PR #43]
````

The main thread stays clean — key events only. Click any agent event to open that agent's tab for full detail (traces, code reads, reasoning). See "Conversation Tabs" for how tabs work.

---

## Tree Ordering

Steps within a scope follow **dependency order** (topological sort) as the primary axis, with a status overlay:

- **Running and blocked steps float to the top** within their dependency group — the user sees "what's happening now" first
- **Completed steps sink to the bottom** — finished work collapses downward
- **Pending steps** (approved but not yet started) appear in dependency order

The user can reorder via conversation ("move rate limiting before session middleware") and the AI adjusts dependencies accordingly.

Between scopes, the order is:
1. Scopes with active/blocked work (most urgent)
2. Scopes with pending work (ready to start)
3. Completed scopes (collapsed to one-line summary)

Auto-collapse and filters ("show only unfinished") keep the tree manageable as projects grow.

---

## Team Awareness

### Single User First

Build for one person + AI. The conversation is between you and the AI. The tree is your project. Agents work for you.

### Team-Ready Data Model

Design decisions that make team features additive, not a rewrite:

| Decision | Rationale |
|----------|-----------|
| `owner_id` on projects from day one | Even with one user, the data model is right for teams later |
| `owner_role` on steps (already exists) | Maps to team members naturally |
| Conversation is per-user-per-project, not per-project | Each person gets their own AI conversation about the shared tree |
| Tree is always project-level (shared) | The tree is the shared source of truth, like code in git |

### Team Mode (Natural Extension)

Multiple people see the same tree. Each person has their own conversation with the AI. The AI knows who's responsible for what via `owner_role` on steps.

```
The tree = shared canvas (like a Figma file)
Your conversation = your personal AI assistant (like your Cursor session)
```

**What changes in team mode:**
- Steps get an avatar badge showing who owns them
- A "team activity" view shows what everyone did (like git log for the tree)
- Team members appear in the status bar alongside agents — avatars, what they're working on
- Steps can require approval from a specific role; the right person gets it in their queue

**What does NOT change:**
- The three-column layout
- The tree model
- The conversation-driven interaction
- The forming → tree lifecycle

---

## Forming Block Physics

Yes — use subtle physics (floating, drifting, growing) for the forming blocks in the left column. Scoped to just the forming section, not the whole app.

**The "messiness" IS the signal.** A neat ordered list says "this is decided." Floating, slightly chaotic blocks say "this is still cooking." When a block graduates to the tree, it goes from messy/floating to structured/fixed. That visual transition itself communicates the state change without any label needed.

Implementation: scoped Matter.js instance in the left column (the existing `usePhysicsEngine` hook from ideation-ui adapts directly). Blocks have confidence-based sizing — higher confidence = larger, more prominent. Low confidence blocks are small, drifting at the edges.

---

## Auto-Curation

Forming blocks become candidates for graduation when aggregate confidence crosses a threshold. Confidence is not a single number from one AI — it's the averaged score across multiple specialist perspectives (see "Technical: Forming → Tree Flow" below).

**Default threshold:** 65% aggregate confidence. Below that, blocks stay in the forming section until the conversation reinforces them or the user confirms through dialogue.

**Tuner integration:** The threshold adapts over time based on user behavior:
- User keeps approving low-confidence blocks → threshold lowers
- User keeps dismissing auto-proposed blocks → threshold raises
- Per-user preference, not global — different users have different curation styles

This is an ideal tuner use case: a single parameter that meaningfully affects UX, with clear signal from user behavior.

---

## Technical: Forming → Tree Flow

How forming blocks are created, mature, and graduate to the tree. This builds directly on patterns already proven in the ideation and planner packages.

### Principle: Ensemble, Not Single Point of Failure

The user talks to **one AI** (the Interviewer — unified voice, no persona distinction). Behind the scenes, **invisible specialist agents** analyze the conversation from different angles:

```
User ←→ Interviewer (visible, unified voice)
              │
              ├── spawns Architect specialist (invisible)
              ├── spawns Security specialist (invisible)
              ├── spawns Designer specialist (invisible)
              └── ... as needed, based on conversation
```

Each specialist has domain expertise and can independently create forming blocks, update confidence, and queue insights for the Interviewer to weave into conversation. The user never sees the specialists — they see a smarter conversation and better-formed blocks.

**Why ensemble:** A single AI pass might miss what a Security specialist catches, or flatten an Architect's structural concern into a generic observation. Multiple perspectives give depth and coverage that one pass can't. This is proven in the existing ideation system.

**Specialist spawning is lazy and AI-driven.** The Interviewer LLM decides when to spawn based on conversation context — no keyword matching, no rules engine. When the user starts talking about auth, the Interviewer recognizes the need and calls `spawn_specialist("Security", focus: "auth patterns")`. Spawning details:

- **6 built-in templates**: Architect, DataModeller, Designer, QA, Security, APIDesigner — each with a tuned system prompt and domain focus
- **Custom specialists**: The Interviewer can spawn any name (e.g., "DevOps", "ProductManager") and the system builds a prompt from the name + focus area
- **One per name per session**: Duplicate check prevents spawning the same specialist twice. If already active, the existing one continues
- **Session-scoped lifecycle**: Specialists persist for the entire session. They're not per-message — once spawned, they observe the full conversation and keep refining their blocks
- **No explicit limit**: The system doesn't cap specialist count. The Interviewer's judgment (and cost awareness from its prompt) is the throttle
- **Communication**: Specialists call tools (`create_block`, `queue_insight`) — they never speak to the user directly. The Interviewer weaves their insights into natural conversation

### The Tool-Call Pattern

Both ideation and planner already use the same pattern: **AI agent → tool call → storage mutation → SSE event → frontend update.** Tend continues this.

**Interviewer tools** (user-facing agent):
- `spawn_specialist` — create background specialist when conversation reveals domain need
- `graduate_blocks` — bridge operation: convert forming blocks to plan steps (new for tend)
- Standard conversation tools (message storage, session management)

**Specialist tools** (invisible background agents):
- `create_block` — create a forming block with title, confidence, scope
- `update_block` — refine confidence, content, scope as understanding develops
- `list_blocks` — check existing blocks before creating (avoid duplication)
- `queue_insight` — feed observations to Interviewer for natural conversation weaving

**Planner tools** (step management, post-graduation):
- `add_step`, `edit_step` — create/modify steps in PlanVersion
- `ask_user_question` — surface blocking questions through attention system

### Block Creation Flow

```
1. User says "we need better auth"
   → Interviewer processes, responds naturally
   → Interviewer calls spawn_specialist("Security", focus: "auth patterns")

2. Security specialist analyzes conversation
   → Calls create_block({
       title: "Token rotation needed",
       confidence: 25,
       scope: "api-service"
     })
   → SSE event: block_created → frontend renders in left column
   → Calls queue_insight({ type: "concern", content: "refresh tokens have no expiry" })

3. Next user message triggers Interviewer response
   → Interviewer sees queued insight in system prompt
   → Weaves it into conversation: "By the way, your refresh tokens never expire..."
   → User: "Good point, we need to fix that"

4. Security specialist hears reinforcement
   → Calls update_block({ id, confidence: 55 })
   → Block grows in left column (physics: larger, more prominent)

5. Architect specialist independently creates related block
   → Calls create_block({ title: "API gateway for auth", confidence: 40 })
   → Another block appears in left column
```

### Confidence: Aggregate, Not Arbitrary

Confidence is not one AI bumping a number. It's **aggregate confidence from specialist consensus**, using the same `computeAggregateConfidence()` pattern already in the codebase:

- Each specialist sets confidence independently (0-100)
- Aggregate = average across specialists who have weighed in on a block
- Status derived from aggregate: `<30 forming`, `<60 emerging`, `<90 developing`, `90+ ready`
- Multiple specialists reinforcing = faster confidence growth
- Single specialist uncertain = confidence stays low even if others are confident

### Graduation Mechanism

When aggregate confidence crosses the threshold (default 65%), the Interviewer proposes graduation through conversation:

```
1. Block reaches threshold
   → Interviewer: "The auth steps look solid — should we start the API work?"

2. User confirms: "yeah, start API"
   → Interviewer calls graduate_blocks({
       block_ids: ["block-abc", "block-def", "block-ghi"],
       plan_id: "...",
       scope: "api-service"
     })

3. graduate_blocks (bridge operation):
   → For each block: create Step in PlanVersion (with title, scope, description from block)
   → Remove blocks from forming state
   → Create new PlanVersion (version N+1, immutable pattern)
   → Emit dual events: block_graduated + step_added

4. Frontend receives events:
   → Left column: blocks shrink and animate right
   → Tree: Work section grows with new steps
   → Coordinated animation (same block IDs map to new step IDs)
```

The AI fills in planner-level details during graduation (dependencies, acceptance criteria) — the forming block is lightweight, the Step is full-fidelity.

### Forming Block Data Model

Lighter than both ideation Blocks and planner Steps — just enough to represent work taking shape:

```typescript
FormingBlock {
  id: string              // UUID
  title: string           // "Fix Redis connection pooling"
  confidence: number      // 0-100 (aggregate from specialists)
  scope?: string          // "api-service" (optional until graduation)
  description?: string    // one-line summary, grows over time
  specialist_scores: Record<string, number>  // per-specialist confidence
  source_turn: number     // which conversation turn spawned this
  created_at: string
  updated_at: string
}
```

On graduation, becomes a full `Step` with dependencies, acceptance criteria, owner role, etc.

### Real-Time Updates

Same SSE pattern used by both ideation and planner today:

| Event | Source | Frontend Effect |
|-------|--------|-----------------|
| `block_created` | Specialist tool call | New block appears in left column (physics pop-in) |
| `block_updated` | Specialist tool call | Block resizes (confidence change), content updates |
| `block_graduated` | Interviewer graduation | Block animates from left to right column |
| `step_added` | Graduation / direct | New step appears in tree Work section |
| `plan_changed` | Step modification | Tree updates (progress, status, etc.) |

### What Carries Over

| From | Pattern | In tend |
|------|---------|---------|
| Ideation Interviewer | Unified voice + specialist spawning | Same — one visible AI, invisible specialists |
| Ideation specialists | `create_block`, `update_block`, `queue_insight` tools | Same tools, creating proto-steps instead of concept blocks |
| Ideation confidence | `computeAggregateConfidence()` | Same — average across specialist scores |
| Ideation SSE | `session:block_created` events | Same event pattern for forming blocks |
| Planner PlannerLead | `add_step`, `edit_step` tools + version-per-change | Same — steps created via tool calls, immutable versions |
| Planner SSE | `plan_changed` events | Same event pattern for tree updates |
| New for tend | `graduate_blocks` bridge operation | Connects forming → tree in one atomic operation |
| Forge orchestrator | DAG scheduler, agent spawning, artifact capture | Same — tend triggers runs, forge executes |
| Forge MCP tools | `report_complete`, `report_progress`, `report_blocked` | Same — agents report back via MCP |
| Forge SSE | `run_started`, `task_completed`, etc. (43 event types) | Interviewer watches and trickles to conversation |
| Relay channels | `#plan-{planId}` for multi-agent coordination | Same — agents share progress across scopes |

### Execution Events in Conversation

Forge events flow through the Interviewer, not directly to the UI. The Interviewer selectively surfaces what matters:

```
Events the Interviewer DOES trickle:
  ┊ Agent spawned · Coder (Haiku) · 10:42am     ← agent started
  ┊ Step completed · 4m 12s · PR #43 created     ← milestone
  ┊ 🔴 Agent blocked — needs input                ← requires attention
  🤖 "OAuth endpoints are done. All 4 AC passed." ← AI summary

Events the Interviewer does NOT trickle:
  - Individual report_progress (25%, 50%, 75%) → shown in tree only
  - Agent tool calls → visible in agent tab only
  - Intermediate commits → inside PR, not separate events
  - Trajectory events → stored for traceability, not shown live
```

The tree always shows real-time status (from SSE). The conversation shows the Interviewer's editorial judgment of what's worth mentioning.

---

## Name: tend

**tend** — lowercase, always. A verb, not a noun. You tend to your projects the way you tend a garden.

**Aesthetic direction:** Minimalistic, warm, inviting. Like tending a zen garden — deliberate placement, negative space, quiet confidence. The UI should feel calm even when agents are running and trees are growing. No visual noise. Every element earns its place.

This means:
- **Muted, warm color palette.** Earth tones, not neon. Sand, stone, moss, clay.
- **Generous whitespace.** The three columns breathe. Nothing is cramped.
- **Subtle animations.** Forming blocks drift gently, not bounce. Progress rings fill smoothly. Transitions are slow enough to notice, fast enough to not wait for.
- **Typography does the work.** Clear hierarchy through weight and size, not color or decoration.
- **The empty state is beautiful.** A new project with an empty tree should feel like a raked sand garden — peaceful, ready, full of potential.

Package name: `packages/tend/`.

---

## Platform

**Desktop app (Tauri), not a browser tab.**

tend is local-first. Agents work on local code repos. Databases are SQLite files on disk. The Relay daemon runs as a local process. A browser tab with an address bar and bookmarks toolbar breaks the zen garden. The app deserves its own window.

**Tauri** (not Electron): Rust backend, native webview, significantly lighter. The React frontend is unchanged — Tauri wraps it. The Express server runs as a Tauri sidecar process.

**System tray:** When you close the window, agents keep running. A tray icon shows status at a glance — agent count, pending questions, active projects. Click to reopen. This is how tend becomes ambient: always there, never demanding attention unless something needs you.

```
Development:   Browser tab → localhost:3004 (standard Vite dev)
Distribution:  Tauri app → single installer (macOS, Windows, Linux)
Background:    System tray → agents run, tray shows status
```

**Build phasing:**
1. Build as web app first (`packages/tend/`, Vite, React, connects to localhost:3001)
2. Add Tauri wrapper (`packages/tend/src-tauri/`) — bundles Express server as sidecar
3. System tray integration — agent status, notification badges, background operation

---

## UX Refinements

### The Dashboard & First Experience

**Project creation:** `[+ new]` button at bottom-right of the project tree at dashboard level. Clicking puts options in the chat input area. The user replies in text — the AI initiates via MCP tools. No forms, no wizards, just talking. (See "New Project Creation (Corrected)" below for details.)

**Project naming:** The AI determines structure and names the project. Temporary names use angle-quote markers to signal AI-generated: `‹api ideation 1›`. The user can rename at any time via conversation or inline edit.

**Transition to workspace:** Elements slide in gracefully from edges — "side dishes arriving at the table." The three columns animate in from top/bottom/sides with subtle, deliberate motion. Tree content has a crystallizing animation: characters resolve from noise to text, like watching something solidify.

**Project list style:** Text-based lists, not cards. ASCII-inspired symbols for structure (`└`, `·`, `○`). Minimal, scannable. Example:
```
Auth System
└ 7/10 · 3 running

Mobile App
└ ideating · 3 blocks
```

**Cards vs text:** Reserve styled blocks (raised cards with drop shadow, badges, icons) for elements that demand attention or open detail views in sheets. Everything else is text on the background layer. This creates a clear two-tier visual system:
- **Subtle (background layer):** Text-based with elegant animation. Progress uses ASCII characters. On the surface of the zen garden.
- **Obvious (raised layer):** Cards/elements with drop shadow, badges, icons, colored indicators. Above the surface. Used sparingly — only for things the user needs to notice or interact with.

### AI Voice & Personality

The AI is intelligent and wise — it **distills**, never adding or subtracting unnecessarily. It captures essential points and asks essential questions. Highly directional without being pushy.

Key traits:
- **Focused and sharp** — constructive, engaged, efficient
- **Some warmth, not artificial** — not endearing, not apologetic, not overly friendly
- **Distilling, not summarizing** — finds the essence, doesn't just restate
- **The AI's personality doesn't fight the underlying model** — it builds on what the LLM naturally does well, not against it

The voice should feel like a sharp, thoughtful colleague who's fully invested in your project's success — not a customer service agent, not an enthusiastic intern.

### Conversation ↔ Sidebar Connection

As the AI mentions concepts in conversation, corresponding forming blocks appear in the left column with purposeful, coordinated animation. The connection is felt, not drawn — no literal lines between chat text and blocks, but the timing and motion create an unmistakable link.

**Implementation approach (needs further design):** AI messages carry structured metadata (in the message JSON) indicating which blocks they reference. The frontend uses this to coordinate animations — when a paragraph mentioning "OAuth2" streams in, the corresponding forming block drifts into the left column in sync. The exact mechanism needs prototyping to get the timing right.

**Reasoning display:** Not fully resolved, but the principle is: reasoning that adds value to the user's understanding flows naturally in the conversation. Internal AI reasoning (tool calls, code analysis) lives in agent tabs. The conversation never feels like watching a machine think — it feels like talking to someone who has already thought.

### Multiple Choice & Quick Actions

For direct questions with discrete options, choices appear as selectable options in the input area (max ~4 options, last is freeform "other"). Styled as text options, not chunky buttons — consistent with the text-first aesthetic.

This complements the existing QA function (chat-bubble dialogue from status bar agent avatars) for agent questions. Dashboard-level questions use the input area; agent questions use the bubble system.

### The Tree Growing

**Tree rendering:** ASCII-style tree structure with crystallizing animation. Random fitting characters (subtle typographic noise) resolve into final tree characters as content appears. The tree *grows* visually as the AI proposes structure.

**Scope headers:** Text only. Precise typographical hierarchy using font weight — no icons, no background tints, no card styling. When more detail is needed, additional ASCII characters (with or without color) can provide highlighting.

**Tree rendering:** The tree only shows approved/graduated steps (solid characters). Forming items live in the left column with physics. The transition is subtle — a gentle shift as blocks graduate from left column to tree.

**Approval is conversational:** There is no "accept all" button as a separate UI element. The AI proposes conversationally: *"I think OAuth endpoints, session middleware, and rate limiting are ready — should we start?"* with simple yes/no text links. The user can respond naturally: "lets only do frontend" or "yeah, start the API work."

**Inspection when needed:** For steps requiring review (low confidence, high complexity, UI/taste decisions), an "obvious" element appears in the conversation — a raised card that opens a **sheet** (panel sliding in from the side, drop shadow overlay). The user can also click any tree element directly to inspect details via tree zoom.

**Empty sections don't exist.** Zen garden principle: Work and Artifacts sections only appear in the tree when they have content. No empty placeholders.

### Agents & The Interviewer

The **interviewer agent** is the central facilitator between working agents and the user. Agents don't talk to the user directly in most cases — they pass questions and observations to the interviewer in the background, who then decides what to surface and when.

**The interviewer's role:**
- Observes all agent activity in the background
- Decides what the user needs to know and when
- Structures information before presenting it — doesn't overload the user "right when it happens"
- Uses the conversation (with multiple choice in the input area) for non-urgent questions
- Reserves QA bubbles (from status bar) strictly for blocking situations: an agent needs an answer to finish a step, plan, or build

**Agent display in status bar:**
- Default: text-based — agent name + ASCII progress indicator
- When space is tight (many agents): collapse to initial in brackets `[C]` `[T]` `[S]`
- Status bar does NOT show cost (not zen). Cost lives in project settings or a subtle hover.

**Progress indicators — two dimensions, not percentages:**
- **Confidence:** How well the agent understands what to build and how (understanding confidence, not completion %)
- **Activity:** Idle vs working — just indicating any activity (reasoning, coding, testing). A simple animated indicator, not a percentage bar.

Detailed step-by-step percentages are misleading for AI agents. These two signals (does it know what to do? is it doing something?) are more honest and useful.

**Stuck agents:** The interviewer notices when an agent is stuck and investigates in the background — asking the agent what questions would help unblock it, then surfacing those to the user through conversation. The user doesn't need to see "Agent stuck at 40%" — they see the interviewer asking a relevant question.

There's a distinction between:
- **"Normal stuck"** — needs information or a decision → interviewer facilitates
- **"System stuck"** — agent needs respawn, hit a wall, looping → deterministic system-level handling, not the interviewer's job. The system detects and handles this (restart, escalate, notify user).

### Attention Level System

A consistent system for how information is presented, based on urgency and importance:

**Principle:** Every piece of information has an attention level. The rendering system takes structured input and applies consistent visual treatment.

```
Input:  { level: 1-3, text: "...", choices?: [...], route?: "..." }
```

**Level 1 — Background (subtle):** Text blends into the background. Lower font weight. The user sees it if they're looking, ignores it if not. Used for: system events, progress updates, completed steps.

**Level 2 — Foreground (noticeable):** Normal to slightly elevated font weight. The user notices it in the flow of conversation. Used for: AI questions, interviewer observations, step state changes.

**Level 3 — Raised (obvious):** Raised card element with drop shadow, above the background layer. Can include badges, icons, colored indicators. Used sparingly for: blocking questions (QA bubbles), items requiring immediate action, inspection cards that open sheets.

Typography does the heavy lifting: weight and size, not color. Color is reserved for semantic meaning (status indicators, not attention hierarchy).

### Dashboard Layout (Corrected)

The dashboard uses the **same three-column layout** as the workspace. No exceptions. The three columns are conceptually consistent everywhere:

- **Left (The Now):** May be empty at dashboard level, or show forming blocks across projects
- **Center (Conversation):** The AI — discusses priorities, suggests what to work on. Attention items surface here using the normal attention level system. No special 'Navigator' persona — it's the same AI everywhere.
- **Right (The Tree):** Projects rendered as a tree-like list. Items needing interaction pulse or show attention-level indicators directly on the project/step

There is NO separate "Your Attention" column. Attention is handled through the existing systems: the conversation (center) and visual indicators on tree items (right). This keeps the layout consistent and avoids a special-case dashboard design.

```
Dashboard tree (right column):
  Auth System
  └ 7/10 · 3 running
    └ ⟳ Session middleware · needs input     ← pulses

  Mobile App
  └ ideating · 3 blocks
```

### Attention Queue → Reply Bar

The attention queue is NOT a section in the left column. Pending items that need the user's response accumulate as **compact reply-to lines just above the chat input** — visible whenever the user goes to type.

```
Main conversation
  messages scroll here
  ...
─────────────────────────────────
  ↩ refresh tokens? · Interviewer · 8h ago
  ↩ frontend scope? · Interviewer · 7h ago
┌─────────────────────────────────┐
│ Type here...                    │
└─────────────────────────────────┘
```

Click a reply-to line to focus it (scrolls conversation to the original question, highlights it). The reply bar is minimal — one line per pending item, clickable, dismissible.

This replaces the earlier "attention queue in left column" concept. The left column is purely for forming blocks (physics). The reply bar is more natural — it's where the user's eyes already go when they want to interact.

### Coming Back (Async Catch-up)

**Open where you left it.** tend remembers which project you were in and returns you there. Continuity over routing to dashboard.

**Overnight events:** Compact system event lines in the conversation timeline. When many events happened:
- Show top ~3 individually (most recent or most significant)
- Collapse the rest: `· 12 more events overnight` — click to expand
- Each event is clickable for full subthread detail

**Pending questions persist above the chat input** as reply-to lines (see Reply Bar above). They don't re-surface in the conversation timeline or get repeated. The original question sits at its timestamp in the conversation; the reply bar is just a pointer to it.

**Context continuity:** The user can scroll up to see the full conversation history, same as after an overnight agent run. When the user types a new message, the AI has the full context — it knows where the conversation was AND what happened since. It responds to the user's intent, not mechanically to the last event.

**System tray behavior:**
- Single pending item → click tray icon → opens directly to that project + question
- Multiple pending items across projects → click tray icon → opens dashboard with pending items visible in the reply bar and tree indicators

### Unified AI Identity

The user experiences **one AI** everywhere in tend. There is no "Navigator" vs "Interviewer" vs "Agent" distinction from the user's perspective. Behind the scenes, specialized agents handle different tasks (ideation, planning, execution, facilitation), but to the user it's just *tend* — the same voice, the same personality, the same experience whether at the dashboard or deep in a project.

The AI "reads the room" at every level:
- **Dashboard:** "We were working on auth — want to continue?" or "Nothing active — revisit Auth System or start something new?"
- **In-project:** Adapts to tree focus, manages agent coordination, surfaces questions
- **Catch-up:** Contextual greeting based on what happened while the user was away

Opening lines are directional but not pushy — inspire and suggest without demanding. Links, not buttons. The AI proposes, the user decides.

### New Project Creation (Corrected)

There is no "What are we working on?" prompt embedded in the tree. Instead:

**`[+ new]` button** — small, bottom-right of the project tree at dashboard level. Clicking it puts options in the chat input area:

```
[+ new] what do you want to start?
  new project · new feature · ...
```

The user replies in text. The AI initiates whatever is needed via MCP tools. This keeps project creation conversational — no forms, no wizards, just talking.

For the **first-time experience** (no projects yet), the empty dashboard shows the same zen garden aesthetic. The `[+ new]` button is still the entry point, but the AI also greets: "What would you like to work on?" — in the conversation, not as UI chrome.

### Conversation Tabs (Subthreads as Tabs)

Tabs sit above the conversation column:

```
┌─ Main ─┬─ OAuth endpoints ─┬─ Session middleware ─┐
│                                                     │
│  (active tab's conversation content)                │
│                                                     │
```

**Rules:**
- **Main tab** — always present. The user's primary conversation with the AI
- **Agent tabs** — spawned when agents start working. Show that agent's trace, progress, questions
- **Tree and left column don't change per tab** — they're project-level. Only the conversation column swaps
- **Tabs are ephemeral** — they exist while the agent is active or the user is reviewing its work. Finished agents auto-collapse back to subthread lines in main conversation
- **Project switching ≠ tabs** — clicking a different project in the tree/dashboard changes everything (tree, conversation, left column). That's navigation, not tabs

This maps to Conductor's model:

| Conductor | tend |
|-----------|------|
| Workspace | Project |
| Worktree | Scope |
| Tab (agent) | Promoted subthread tab |

The key difference from Conductor: agent tabs are Claude instances with configurable tool access (same as specialists — it's the same architecture). The main conversation has a summary of what each agent is doing. To see full detail, visit the agent's tab. Agents don't see the user's main conversation in real-time — they got instructions when spawned and work independently.

### Sheets & Detail Views (Refined)

Sheets are the primary surface for rich detail and editing. They slide in from the right, overlay the current view, and are **always user-initiated** (never triggered by the AI). Sheets may include a focused chat input at the bottom for AI interaction scoped to the detail being viewed.

**Step sheets** contain the same fields already built in planner-ui's StepEditor: title, scope, owner role, description, dependencies (with cross-scope indicators), acceptance criteria (checklist), approval gate, and specification domains. In tend, these render inside a `DetailPanel`/`Sheet` container rather than inline expandable cards. Editing is direct manipulation — click a field, type, save on blur.

**Forming block inspection:** Clicking a forming block opens **focus mode** — the layout shifts to show block detail alongside a scoped conversation (same pattern as ideation-ui's FocusMode). The block's content, confidence, specialist scores, and related context are shown. The user can ask the AI about the block, and the AI responds with awareness of what they're looking at. Close to return to three-column layout. Forming blocks don't get sheets — focus mode is their detail view.

**Sheet chat:** A chat input at the bottom of the sheet. Messages appear in the main conversation thread, and the AI responds with awareness of what the user is viewing ("user is viewing the Session middleware step sheet"). When the user closes the sheet, their sheet messages are visible in the main conversation — there's no hidden or separate thread.

**Sheet navigation:** Close and re-click. No lateral "next/previous" navigation between sheets. Sheets are focused views of a single item, not a browsing experience.

**What triggers a sheet:**
- Click a step that's already at STEP zoom level (the tree is already showing this step's detail — clicking it again opens the sheet for editing)
- Click any element that needs editing (acceptance criteria, step title from a list, etc.)
- Never triggered by AI or system events

**What doesn't need a sheet:**
- Quick status checks (tree zoom handles this)
- Conversation context (the conversation column adapts when you click tree nodes)
- External artifacts (PRs open in browser with inline stats: `+150 | -150`)
- Forming blocks in left column — clicking opens focus mode (block detail + scoped conversation). No sheet needed.

### Garden Vocabulary (Proposed)

The tend aesthetic extends to terminology. Garden-themed words replace technical jargon where it feels natural:

| Concept | Garden word | Notes |
|---------|-------------|-------|
| The app | **tend** | Product name. Lowercase, always |
| Incoming signals | **cultivate** | Intake — research, monitoring, external signals |
| Grouping of work | *scope* | Keep as-is — clear and unambiguous |
| Unit of work | *step* | Keep as-is — neutral, clear |
| Forming work | *block* / *seed* | Seeds grow into steps |
| The project | *project* | Keep universal term |

Use garden words where they add warmth without confusion. Don't force the metaphor on technical concepts where clarity matters more.

---

## Resolved Design Decisions

Decisions made during vision development, preserved for reference:

| # | Question | Decision |
|---|----------|----------|
| 1 | **Mobile/responsive** | Conversation is primary on mobile. Swipe left for Now column, swipe right for Tree. Status bar becomes top bar. Defer detailed mobile design to implementation phase. |
| 2 | **Multiple conversations** | One thread per user per project. Agent work lives in tabs. Main thread stays readable with compact system event markers. |
| 3 | **Collaborative projects** | Each person gets their own conversation view of the shared tree. Team activity appears as a separate log view, not mixed into personal conversation. Relay channels already support multi-user. |
| 4 | **Tree ordering** | Dependency-first within scope. Running/blocked floats up, completed sinks down. Between scopes: active > pending > completed. |
| 5 | **Status bar bubble timing** | 10-15 seconds default. Blocking questions (🔴) stay as bubbles longer (~30s). FYI items minimize faster (~8s). Configurable in settings. |
| 6 | **Physics for forming blocks** | Yes — messiness signals "not finished yet." Scoped to left column forming section only. Adapts from existing ideation-ui physics engine. |
| 7 | **Agent overflow in status bar** | Show current project's agents + grouped "+N in other projects" pill. Click pill for dropdown grouped by project. |
| 8 | **Tree as URL state** | Yes — `/projects/:id?focus=api-service.session-middleware&zoom=step`. Browser back/forward becomes tree navigation. Deep linking works. |
| 9 | **Draft step approval UX** | Conversational only. AI proposes: "I think X, Y, Z are ready — should we start?" User responds naturally. No "accept all" buttons or checkmarks. Approval is dialogue, not UI controls. |
| 10 | **Context switching** | Append new context at bottom of conversation (preserves linear timeline). Add a "jump to last discussion" link at top of new context section for continuity. |

---

## Cultivate: Intake Integration Points

tend handles conversation → structure → execution. **Cultivate** completes the loop: world → conversation. It's the intake layer — monitoring external channels (Slack, email, GitHub issues, support tickets, analytics, user interviews) for signals that feed into what you build.

**Cultivate is a separate package** (`packages/cultivate/`), not part of tend itself. It runs independently, collecting and scoring signals from external sources. Tend consumes cultivate's output through a defined API — it doesn't own the collection, classification, or source integration logic. This separation means cultivate can evolve its integrations without touching tend, and tend can render signals without knowing how they were gathered.

Cultivate ships separately from tend's core. But tend's architecture must account for it now so we don't paint ourselves into a corner.

### Where Cultivate Plugs In

**1. Left column at dashboard level**

When you're not inside a garden, the left column's forming blocks section has nothing to show (no active conversation = no forming insights). This is cultivate's natural home: incoming signals from the outside world, surfaced as seeds.

```
THE NOW (dashboard)          THE NOW (inside a garden)

┊ 3 customers mentioned      ◉ OAuth2 with PKCE
┊ session timeouts            ◎ Sessions fragmented
┊                             ○ Rate limiting...
┊ GitHub #412: auth crash
┊ NPS dropped 8→6 this week
┊
cultivate signals             forming blocks from conversation
```

Same component, different content source. The left column accepts a pluggable data feed.

**2. The AI's contextual awareness**

When working inside a garden, the AI can reference cultivate signals naturally:

> "By the way, two GitHub issues came in this week about the exact auth session problem you're working on. Want me to pull them in?"

This is passive — the AI mentions signals when they're relevant, not as a notification. The user can say "pull them in" and they become forming blocks in the left column.

**3. "What should we build next?"**

This is YC's exact question. Cultivate provides the evidence. When you ask tend this at the dashboard level, it draws from the signal pool:

> "Based on what I'm seeing: 3 support tickets about session timeouts, NPS dropped from 8 to 6 on auth flows, and two engineers flagged auth as tech debt in their retros. Auth system overhaul seems high-signal. Want to start a garden for that?"

**4. Seed → Garden flow**

A cultivate signal that gets pulled into a garden becomes a seed (proto-step). Its provenance is preserved — steps can trace back not just to "Sessions fragmented" but *why* we know this: linked to the support tickets, the NPS data, the GitHub issue.

### Data Model Considerations

Cultivate needs a lightweight entity that tends architecture should anticipate:

```
Signal {
  id: string
  source: string          // "slack", "github", "support", "analytics"
  content: string         // raw signal text
  relevance_score: number // AI-assessed
  garden_id?: string      // null until connected to a project
  created_at: string
  metadata?: Record<string, unknown>  // source-specific data
}
```

Key architectural decisions for tend:
- **Left column component** should accept a content source prop (forming blocks OR signals)
- **The AI context** should have a slot for external signals, even if empty initially
- **Steps** should have an optional `provenance` field linking to signal sources
- **The dashboard view** should have a place for cultivate content, even if it's placeholder

### What Cultivate Does NOT Do (Yet)

- No channel monitors or integrations in the initial tend release
- No automatic signal ingestion
- No classification or routing logic
- No multi-source aggregation

For now, cultivate is a reserved concept with defined touch points. Signals could even be manually added initially — a user pastes a support ticket into the conversation and the AI suggests creating a signal from it.

### The Full Loop

```
WORLD → cultivate → tend → agents → WORLD
         (intake)   (plan)  (build)

signals    seeds     tree    artifacts
 from       form     grows    ship
 outside    inside
```

This is what makes tend the complete answer to "Cursor for PMs" — not just "figure out what to build" but the full cycle from world signals through structured intent to shipped artifacts and back.

---

## Open Questions (Remaining)

1. **Offline / connection loss:** What happens when the user loses connection mid-execution? Agents continue (relay handles this), but the UI needs a reconnection + sync strategy.

2. **Cost controls:** Cost is not shown in the status bar (not zen). But should there be project-level budgets with automatic pause? Per-step cost limits? Cost visible somewhere in settings/details but not the ambient UI?

3. **Plan export / handoff:** Can a tree (or subtree) be exported as a standalone plan document for stakeholders who don't use the app? Markdown? PDF?

4. **Undo / version history:** The tree changes over time. Can the user "rewind" to see what the tree looked like yesterday? Git-like versioning of tree state?

---

## Appendix: UX Design Session Log

Raw questions and answers from the UX refinement process, preserved as reference.

### Moment 1: Opening tend / First Experience

**Q1: The empty dashboard** — Is it literally just the input and nothing else? Or is there a subtle sidebar showing "Projects" (empty)? Does the app sidebar exist from the start, or does it fade in after the first project is created?

> I really like this ... but lets do "What are we working on?" - but this would be the first time opening it? or toggleable (show simple start vs show existing projects?) or?

**Q2: The first input** — Is this a chat-style input (like Cursor's cmd+L), or more of a "title field" that becomes the project's name? Or is it truly freeform — you type whatever, and the AI figures out what the project is about?

> freeform, you type whatever, ai figures out the naming etc (unless user expressly states what they want) ..

**Q3: The transition** — When you press Enter on that first message, do the three columns animate in (slide, fade, grow)? Or do they appear instantly? Does the conversation column feel like it was always there and you just started typing into it? Or is there a clear "moment of creation" — the garden being planted?

> subtle, graceful animations - elements slide in from the top/bottom and sides? like little "side dishes" coming into view .. then for larger elements - animation for how things appear inside them - for the tree, each line appears like its growing? (random letters expand --> fully formed) ?

**Q4: The project name** — Does tend auto-generate a project name from your first message (like "Auth System Fix"), or does it ask you? Or does it stay unnamed until you name it?

> it stays unnamed until ai / user names it? or it can have a clearly temp name <api ideation 1> (with the < .. > or some other chars?)

**Q5: Returning to the dashboard later** — When you have 3-4 projects and open tend, what does the dashboard look like? Is it a list? Cards? A garden metaphor with visual representations of each project's state?

> i think clickable text based lists more than buttons and blocks? I like the ascii symbols, like
> Continue
> └ project name
>
> Lets preserve blocks (visually more styled cards etc?) for things that are more important for the user to be aware of - or click .. maybe blocks are only for things that have detail views in sheets? or ?

### Moment 2: The Conversation

**Q1: AI response style** — How does the AI "sound"? Is it concise and direct (like a sharp colleague)? Warm and exploratory (like a thoughtful collaborator)? Does it use bullet points or flowing prose? Should it feel different from ChatGPT/Claude chat?

> its highly intelligent and wise - meaning; it does not add or subtract, it destills. It captures the essential points, and asks essential questions. Its highly directional, without being pushy. But its not "autistic" - it has some warmth, but not articial. It doesnt have to feel very different from the LLM we end up using, it would be hard to escape the training anyhow. But it has to feel constructive, focused, engaged - focused, sharp - but helpful .. not "endearing" or "apologetic" or overly friendly etc...

**Q2: Forming blocks appearing** — When the AI mentions a concept that becomes a forming block, should there be a visual connection? Like a brief line/trail from the conversation text to the new block in the left column? Or should blocks just appear independently — the user notices them peripherally?

> i liked what you described in your preamble... as the ai says it, it appears.. and maybe there are purposeful animations, both in the chat and the sidebars -- there is a connection ... an ai can add emphasis(?) or blocks in the chat that is interpreted by the backend / frontend to display things in a certain manner - or in certain steps? --> How do we treat reasoning? Not fully related, but I really like how text flows / feels in the "Conductor" app I'm using

**Q3: Quick-answer chips** — Love them or hate them? Are they too "chatbot"? Or do they add speed? Should they only appear for direct questions, or also for suggested directions?

> not sure i know what quick-answer chips are, but we need to be able to answer multiple choice -- conductor adds it to its chat input field (usually max 4 (fourth is "other- user inputs freeform") -- we already have a QA function that opens as a kind of chat-bubble dialogue if you click the status bar

**Q4: Conversation pacing** — Should the AI ever pause and wait, or always respond immediately?

> we shouldnt synthesize or edit anything related to this - the only thing about pacing was the item #2 that i mentioned - to give it some options on how things appear .... Or maybe we should do it automatically -- if it mentions a block title, that block apperas? but maybe thats messy .. maybe the AI should carry in the message json which blocks it is referencing - etc? I dont know, we might have to think about this more

**Q5: System events in conversation** — When a forming block graduates to the tree (auto-curation at 65% confidence), should a small system line appear in the conversation?

> I think we can have two ways of helpfully indicating to the user that something worth looking into is happening.. subtle and obvious
>
> * subtle is always text based, with elegant animation -- text on the background. ... (progress bars uses ascii characters)
>
> * obvious is "above" the background layer -- a raised (drop shadow) card or element etc with info thats not purely just text (can be badges, icons, colored progress bars, etc)

### Moment 3: The Tree Growing

**Q1: Draft step appearance** — Dashed lines and muted text signal "draft." When a step gets approved, what's the visual transition?

> i think in the first iteration we should essentially use ascii diagrams like you're doing now to show me the tree -- but have animation mixed with the ascii -- like random chars ( # & ( . - -- (maybe not exacly these, but something fitting) -- are appearing and becoming the final ascii character its supposed to be, as the tree grows

**Q2: Scope headers** — Are these just text labels? Or do they have a visual treatment?

> text only as far as possible.. we need to be extremely precice with our typographical hierarchy and how we use weights ... if more detail is needed, we can add additional ascii caracters (with / without color) for highlighting?

**Q3: The "accept all" action** — Where does this live?

> not sure i understand the "accept all" -- what am i acceptiing? why do i have to accept it? can it be part of the conversation? what am i as the user supposed to be doing? look into details? if detail inspection really is needed (low confidence? high complexity? personal taste (ui stuff?)?) -> show me a "obvious" element in the chat that opens to a sliding drawer (dont remember the name.. curtain? no.. the whole rectangle window coming in from the side, with drop shadow on everything else) -- but I guess i can still click the elements in the tree to see details if i want? --- maybe the ai can say things in the chat like like: "I think X, Y and Z are ready for building - should we start?" ( very simple yes / no links ) ? or the user can keep chatting?: "lets only do frontend"

**Q4: Partial approval** — How do you express approving some scopes but not others?

> see above

**Q5: Empty Artifacts section** — Should sections show before they have content?

> we dont show things that are empty (zen garden?)

### Moment 4: Agents Working

**Meta-note (cost in status bar):**

> (i dont think the status bar should show cost, thats not "zen")

**Meta-note (attention levels):**

> (the compact system event - we have to be very consistent in what levels of attention we have at our disposal - meaning, the text will blend more or less into the background and will have more or less font weight, and last resort (?) more font size? -- maybe there should be some handler for this that takes a "type: attention level 1" - "text: this is the info", "choices: [</route:link text>,</route:link text 2> " etc as input?)

**Q1: Agent avatars** — What do they look like? How much visual weight should agents have?

> lets try to se text (+ progress bars when needed etc) as default - but if there are a lot of agents (not enough space) we show [ A ] initial?

**Q2: The bubble** — Should agent question bubbles be subtle or obvious?

> the agents should really mostly pass questions or observations in the background - to the interviewer agent, who then facilitiates - asks or directs the conversation - as it sees fit. so the QA is mainly for "i need an answer now, because its blocking something important like finishing a step, plan or a build" etc.. so the QAs are really meant for that.. otherwise - i think the interviewer should use multiple choice (shows in the users chat-input box?

**Q3: Multiple agents** — Do system events interleave chronologically or get grouped?

> i think the interviewer is the facilitator -- it observes whats going on, and structures it -- we dont overload the user "right when it happens" if we dont need to

**Q4: Progress granularity** — What does progress mean for an AI agent?

> i think we might need two things -- an indication of confidence (i know what the user wants to build, and how to build it) and idle/working? working is just indicating any activity (reasoning, doing?)

**Q5: The "agent is stuck" state** — How does the UI signal a stuck agent?

> is it again, the interviewers job to notice and ask the agent in the background (user doesnt have to be aware?) interviewer can ask the stuck agent which questions it should ask the user to help it become unstuck? .. or is there a difference between "normal stuck" and "the agent actually needs to be respawned stuck" -- i guess thats not the interviewers job? but perhaps something more deterministic? or?

### Moment 5: Coming Back (Async Catch-up)

**Meta-note (dashboard layout):**

> (why are attention items on the right, im used to seeing the tree there? and getting attention stuff in the middle chat, am in not? when working in the sessions)

> (why isnt the tree just showing me these projects with some subitems that pulse or something to indicate that they need interaction, but also show me the subtle or obvious callouts in the chat?)

**Q1: The catch-up flow** — Do you land on the dashboard first and navigate to the project? Or does tend remember which project you were in?

> it opens where you left it (continuity)

**Q2: System event density** — What if 20 things happened overnight? Collapse or show each?

> collapse and allow to expand -- maybe show top 3 items as separate?

**Q3: The interviewer's pending question** — Where does an unanswered question live when you come back hours later?

> if its unanswered, maybe it accumulates just on top of the chat-input as sort of "reminder-reply-to" - and i can click it? or the left column attention queue is enough? or the attention queue should be actually moved to what i described (low-height lines just above my chat-input window) -- with the main chat above? (M- main chat, R - reply needed, C - chat input)
>
> M
> M
> M
> M
> R
> C
> C

**Q4: Stale context** — When you type after overnight events, does the AI pick up the conversation or the project state?

> i can scroll up as needed? like i would if i ran an agent overnight?

**Q5: System tray → app transition** — The tray icon showed a badge. What happens when you click it?

> pending-> go to that question? multiple pending -> go to some queue/inbox?

### Moment 6: The Dashboard (Refined) + Tabs Discussion

**Meta-note (left column at dashboard):**

> ("Left (The Now): Forming blocks from any project." -- wouldnt this be chaotic if im working at 4-5 projects at the same time? - isnt it better to show projects as blocks then on the dash? or?)

**Meta-note (unified AI):**

> (center - navigator ... navigator .. interviewer ... as a user i dont care - i want the experience to feel exactly the same, and i dont need this agent to have a name -- to me, its what i talk to when i use tend)

**Meta-note (no "What are we working on?" in tree):**

> ("What are we working on?" - why? .. we can have a small [ + new ] button at the bottom right? .. and then if I click it, that adds text in my chat-input window: [+ new] what do you want to start <new project | new feature | ?> ) -- and i reply in text and the nav/interviewer initiates whatever i want with mcp

**Q1: Project tree detail level** — How much do you see per project at dashboard level?

> i see whatever warrants or needs my attention (something finished that i can check out, something needs my attention, etc) -- if nothing warrants my attention, i just see the project title?

**Q2: The Navigator AI** — At dashboard level, what's its personality?

> it feels eactly the same - it "is" exactly the same in my user experience. When i open the app again, it should "greet me" with - "we were working on xxx - want to <continue with that>? .. <...> is a link .. or "we dont have anything going on at the moment .. want to revisit <project> or <project2> (most recent or close to finished) or <start something new?> (clicking would be same as clicking + new) etc.. the agent should "read the room" and give me an opening line that inspires me / directs me in a non-pushy way
>
> an interjection ... in Conductor -- at the top of the main messaging window, there are tabs - one per agent -- so i can have multiple conversations going (doing multiple investigations, running agents in parallell etc - one tab can be ideation, one can be building) ... do we need a tab system like this? should each run its own agent (like a "web version" of a claude cli instance?) how on earth does that work with the left and right sidebars then? are they singular or change per agent tab?

**Q3: The left column at dashboard level** — Always collapsed? Or a dashboard-level forming concept?

> at some point we need an "intake" -- maybe with a name like "cultivate"? ... so it could show incoming blocks -- maybe based on reasearch ive asked my agents to do, web sites ive asked it to take note of, etc etc? or like the larger architecture - maybe more relevant for a team -- to show blocks based on incoming signals from slack, support tickets etc?

**Tabs resolution:**

> I think it feels right ... (subthreads as tabs model confirmed)

**Naming:**

> do we need different word than scope (cultivate - tend - <word> ... )

### Moment 7: The Full Flow — From Idea to Running Agents

**Q1: The transition from understanding to plan.** At some point, the AI has enough understanding to propose work. How does this happen?

> we've already discussed this briefly? blocks form on the left? once confidence is high enough they move to the right as steps? -- For this case, behind the scenes, AI agent has scanned the relevant source and found the bug? --> interviewer says "The xx class has a bug: <short description of bug and necessary steps> - initiate fixes (only in your local branch for you to test)

**Q2: Steps appearing in the tree.** When the AI proposes work items, they appear in the WORK section of the tree as drafts. What do draft steps look like?

> i dont understand whats going on .. at what point did draft items appear on the right? isnt that what the left side is for (forming / cultivating?)

**Resolution:** Draft steps do NOT appear in the tree. They are forming blocks (proto-steps) in the left column. They graduate to the tree only when approved through conversation. This corrects the original Moment 3 design.

**Q3: The approval moment.** How does partial approval work?

> i think it happens as part of the conversation?

**Q4: Agents spinning up.** What does the moment of spawning feel like?

> its a zen garden .. theres no drama ... people do what they are supposed to do, and take care of their own business, and interact when its strictly necessary

**Q5: Parallel worlds.** Agents building while you're still refining other parts. How do parallel threads feel?

> the AI weaves it in .. "the agent working on your api has hit a snag, do you have time to answer some <questions about redis compatability> (link) ? -> takes us to the subtask tab?

### Moment 8: Going Deeper — Inspecting & Understanding Detail

**Q1: Tree click behavior.** What's the primary surface for detail? Does the tree expand inline or is detail always in conversation/sheets?

> the primary surface for ACTUAL detail (the user has to read paragraphs of text, look at a diagram, etc) is a sheet (or maybe in some cases a drawer) -- the tree itself can expand inline if we, for example click a project title (it is not displaying any subitems, because nothing in particular is happening there) .. clicking the title zooms in on that project -- showing features/steps(?) .. now i can click that again to see detail? ... but the tree never shows DETAIL, meaning "a lot of information" - like I said, thats for sheet / drawer type views that appear on top of the current view - and once the user has finished interacting, they close it.. (we may also need to have some chat ability here if the user needs to interact with the AI on the sheet / drawer)

**Q2: Artifacts — code, diffs, PRs.** Where do you review actual code an agent produced?

> we're not building github.. its a link ... "The PR is ready -> <http://www.github.com/repo/pr> (link)" maybe with some very short stats in text (300 loc .. +150 (green) | -150 (red)

**Q3: The sheet.** When exactly does a sheet appear vs. the conversation handling it?

> a sheet or drawer is reserved for rich content, and never appears unless a user has clicked something specific to make it appear (its never initiated by the AI)

**Q4: Conversation history navigation.** You click a step that was discussed 45 messages ago. What does "adapts" mean concretely?

> a step is in a subtask? -> navigates to the subtask tab and scrolls to the question? there might be edge cases, im not sure how to handle

**Q5: Editing structured data.** Always through conversation or direct manipulation in the tree?

> editing is in sheets / drawer -- click the thing i want to edit, and the sheet opens

### Moment 9: The Sheet — Rich Detail & Editing

**Q1: Sheet anatomy.** What's in a step sheet?

> i think this is already pretty much covered in the planner-ui implementation? we may have some visual / structural changes etc - but i think a lof of the core content is there? investigate that first and figure out how it fits (and ask questions if you cant see how it fits)

**Resolution:** Investigated planner-ui. StepEditor already renders: title (inline editable), scope, owner role, description, dependencies, acceptance criteria (checklist), approval gate, specification domains. The existing `DetailPanel` from shared-ui and `Sheet` from planner-ui provide the container. The transition for tend is wiring these fields into a sheet instead of inline expandable cards.

**Q2: Sheet + chat.** When you're in a sheet and type, where does the message go?

> its a chat box at the bottom of the sheet (overlaying whatever content is there? -- and it leads to the main chat (but the AI is informed that you're looking at a detail (sheet) about X

**Q3: Editing in sheets.** Direct manipulation or forms?

> see #1 -- i think a lot is covered in planner-ui, but might need tweaks. The user does the necessary changes that are natural. if it has to ask the user - it does (subagents ask through the interviewer, like discussed before)

**Q4: Sheet for understanding blocks.** What's in it?

> what is an understanding block? what does it contain? ... do you know? if you dont how can you ask about it?

**Resolution:** Investigated ideation package. Blocks have: id, type, title, keyword, emoji, confidence (0-100), status (forming → emerging → developing → ready → curated), content (markdown), specialist provenance, sourceContext, user edit tracking, and V3-prep merge/split fields. BlockDetailPanel in ideation-ui already renders: emoji, keyword, type, confidence bar, editable markdown, source context, curate/delete actions.

**Q5: Sheet dismissal and navigation.** Can you navigate between sheets?

> close and re-click for now

### Moment 10: The Data Model — Blocks, Understanding & Trajectories

**Q1: Two types of forming blocks?** Should left column have both understanding blocks and draft step blocks?

> i dont know if we need both? arent draft steps just steps that are invisible until curated? is the flow understanding -> step? or the flow is understanding + step? .. why does the user need to interact with an understanding? isnt that formed by the AI - and just to be checked by the user? I think our 'understanding' previously was something more 'behind the scenes' - but I might be mistaken?

> but for A - isnt all 'work' a piece of understanding (context) + something to do (task?)

**Q2: Graduation animation.** When a forming block graduates to the tree, what's the visual?

> if we can do it in a classy way, the animation (left to right) might be a nice indication... but it has to be tasteful and smooth

**Q3: Why does the user see forming blocks on the left?** What's the purpose?

> peripheral awareness, error correction and pacing signal -- yes these are good

**Q4: Why does understanding appear on BOTH left and right?** If it's "certain" on the right, is it immutable?

> before work exists -- but i see the understanding forming on the LEFT side? like you just described? why would i see that both on the left and right side? we're saying the understanding on the right is certain - right? what does that mean then? is it not mutable? will it still keep changing if the conversation drifts to some other way of doing things?

**Q5: Blocks and trajectories relationship.** What is it?

> this is important .. this I like -- but we also have 'trajectories' -- maybe thats something to talk about more in depth .. whats the relation between blocks and trajectories?

**Resolution:** Three conclusions emerged:

1. **Understanding is invisible infrastructure.** It's stored as `understanding_json` on PlanVersion — used by the AI as context, never shown as visible blocks in the tree or left column. The current codebase already treats it this way.

2. **Forming blocks are proto-steps.** The left column shows early forms of work items that will graduate to the tree. Same entity, different maturity. Not two types (understanding + steps) — just one type: work taking shape. The user sees them for peripheral awareness (what's the AI working on?), error correction (that doesn't look right), and pacing (the AI is making progress).

3. **Trajectories provide traceability.** "Why does this step exist?" is answered by the trajectory system — decisions recorded with reasoning, alternatives considered, provenance from cultivate signals. The trajectory is richer than understanding block linkage because it captures the decision chain, not just topic association. Step sheets show trajectory data for full traceability.

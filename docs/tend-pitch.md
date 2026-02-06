# tend

**You talk. A project grows.**

tend is an AI-native workspace where conversation turns into structured projects — understanding, plans, running agents, and shipped artifacts — all in one continuous flow. No phase transitions. No tool switching. Just talk, and tend to what grows.

---

## The Problem

Building software requires three distinct activities: **understanding** what to build, **planning** how to build it, and **executing** the build. Today, these live in separate tools with separate mental models:

- Brainstorming happens in docs, Slack, or meetings — unstructured and lost
- Planning happens in Jira, Linear, or Notion — disconnected from the "why"
- Execution happens in Cursor, CI/CD, and PRs — disconnected from both

Every handoff loses context. Every transition requires translating one format into another. And when reality changes mid-execution (it always does), you're back to square one across three different tools.

AI makes this worse, not better. Current AI tools accelerate each phase independently — better brainstorming AI, better planning AI, better coding AI — but they don't solve the fundamental fragmentation. They make each silo faster while keeping the walls between them.

---

## The Insight

**Understanding, planning, and execution aren't phases. They're parallel activities that share one growing structure.**

You're still discovering requirements while agents are already building the first scope. A completed feature reveals new understanding that reshapes the next feature's plan. Execution exposes gaps that restart ideation — for that one branch, while everything else continues.

This isn't a bug. This is how every real project works. The tool should reflect this reality.

---

## How tend Works

You open tend. You start talking.

```
You: "We need to fix our auth system. Users keep getting
     locked out and our session management is a mess."

tend: starts forming understanding blocks — OAuth2, session
      fragmentation, rate limiting gaps. High-confidence
      blocks auto-graduate into the project tree. The AI
      asks clarifying questions. Understanding deepens.

You: "Yeah, let's break this down."

tend: proposes 7 steps across 3 scopes (api-service,
      web-frontend, infrastructure). Draft steps appear
      in the tree. Each traces back to the understanding
      block that motivated it.

You: "The API steps look right. Start those."

tend: approves the API steps, spawns coding agents. The
      agents appear in the status bar with progress rings.
      Meanwhile, you keep discussing the frontend scope —
      the AI asks about social login while agents build
      the API in the background.

You: (later) "Looks good, merge it."

tend: PR merged. Artifact appears in the tree. Agent moves
      to the next step. You're still refining frontend
      requirements. Everything coexists.
```

### The Interface

Three columns. Always the same layout. The content adapts.

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│                  │                          │                      │
│    THE NOW       │     CONVERSATION         │     THE TREE         │
│                  │                          │                      │
│  What's forming  │  The ongoing dialogue    │  What's accumulated  │
│  right now.      │  with the AI.            │  and structured.     │
│                  │                          │                      │
│  Ephemeral.      │  Always primary.         │  Persistent.         │
│  Things appear   │  Adapts to whatever      │  The source of       │
│  and disappear.  │  you're focused on.      │  truth.              │
│                  │                          │                      │
├──────────────────┴──────────────────────────┴──────────────────────┤
│  [◉ Coder ████░░]  [◉ Tester ██░░░░]        💬 1       $2.14     │
└───────────────────────────────────────────────────────────────────┘
```

**Left: The Now.** Insights forming from conversation (floating, physics-driven blocks with confidence indicators) and a queue of items needing your attention. Ephemeral — things graduate to the tree or fade away.

**Center: Conversation.** One continuous thread per project. The AI adapts to what you're focused on in the tree. System events (agent spawned, step completed, PR merged) appear as compact inline markers. Agent work lives in collapsible subthreads — expand for detail, collapse for clarity.

**Right: The Tree.** The project's accumulated structure:

```
AUTH SYSTEM
│
├─ Understanding        ← what we know
│  ◉ OAuth2 with PKCE
│  ◉ Sessions fragmented
│  ◉ Rate limiting absent
│
├─ Work                 ← what's happening
│  api-service
│  ✓ OAuth endpoints    ← done, PR merged
│  ⟳ Session middleware ← agent working, 75%
│  ○ Rate limiting      ← approved, waiting
│
│  web-frontend
│  ┊ Login page         ← still draft
│  ┊ Protected routes   ← still draft
│
└─ Artifacts            ← what's been produced
   ✓ PR #42 (merged)
```

**The tree breathes.** Three zoom levels (overview, scope, step) controlled by clicking. The tree never auto-scrolls — you navigate, the conversation follows. Completed work sinks, active work floats. Auto-collapse keeps it manageable.

### The Status Bar

Agents live at the bottom of the screen — always visible, never intrusive. Each agent has an avatar with a progress ring. When an agent needs input, a chat bubble pops up from its avatar for 10-15 seconds. Click to answer. Miss it? It moves to your attention queue in the left column. Three layers of attention: immediate (bubble) → soon (queue) → permanent (tree).

---

## What Makes tend Different

**1. No phases, no handoffs.**
Understanding, planning, and execution are sections of one tree, not stages in a pipeline. You can be ideating on one branch while agents execute another. The tool mirrors how work actually happens.

**2. Conversation is the interface.**
You don't fill forms, drag cards, or configure workflows. You talk. The AI structures the output. Steps are proposed conversationally, approved conversationally, executed by agents, and results reported back — all in one thread.

**3. Every step knows why it exists.**
Each step in the plan traces back to the understanding block that motivated it. When reviewing work, you see not just what was built but why. When understanding changes, you know which steps are affected.

**4. The tree is the source of truth.**
Not a Gantt chart. Not a Kanban board. A living tree that shows understanding, work, and artifacts in one connected structure. Click any node — the conversation adapts. The tree IS the project.

**5. Agents are first-class citizens.**
Not a "run AI" button. Agents have identities, progress, questions. They live in the status bar. They report back through the conversation. They're part of the team, not a black box.

---

## The Aesthetic

tend feels like tending a zen garden.

Minimalistic. Warm. Deliberate placement. Generous negative space. Earth tones — sand, stone, moss, clay. The empty state is beautiful: a new project is a raked sand garden, peaceful and full of potential.

Forming blocks in the left column drift gently — their messiness signals "still cooking." When a block graduates to the tree, it goes from floating and chaotic to structured and fixed. That transition IS the signal. No labels needed.

Progress rings fill smoothly. Transitions are slow enough to notice, fast enough not to wait for. Typography does the heavy lifting — hierarchy through weight and size, not color or decoration.

The UI stays calm even when agents are running and the tree is growing.

---

## The Market

AI is great at writing code. But product success depends on deciding **what** to build.

Cursor revolutionized how individual developers write code. tend does the same for the step before: deciding what to build, structuring it, and shepherding it through execution — all in one AI-native flow.

The tools in this space today are either:
- **AI wrappers on old paradigms** (Jira + AI sidebar, Notion AI, Linear AI) — bolt-on intelligence that doesn't change the fundamental workflow
- **Point solutions** (brainstorming AI, PRD generators, coding agents) — each phase is faster but the handoffs remain

tend is neither. It's built from scratch around the insight that these aren't separate activities. The conversation IS the interface. The tree IS the project. The AI IS your collaborator, not your tool.

---

## How We Build It

tend isn't starting from zero. It's built on top of a working backend infrastructure:

| Layer | Status | What it does |
|-------|--------|-------------|
| **Ideation engine** | Working | Conversation-driven brainstorming, specialist agents, block crystallization |
| **Planner** | Working | Plan versioning, step management, approval workflows, dependency DAGs |
| **Forge** | Working | Agent spawning, task execution, result handling, progress tracking |
| **Relay** | Mature | Real-time agent-to-agent messaging, WebSocket proxy, channel system |

tend is a new frontend (`packages/tend/`) that unifies these backends through a single conversation interface. Phase 1 requires zero backend changes — the Project entity that links session + plan + run starts as a client-side concept in localStorage.

### Desktop App (Tauri)

tend is a desktop app, not a browser tab. Agents work on local code repos. Databases are local SQLite. The Relay daemon is a local process. A browser tab with bookmarks and address bar breaks the zen garden — tend deserves its own window.

**Tauri** wraps the React frontend with a native window. The Express backend runs as a sidecar process. When you close the window, agents keep running — a system tray icon shows status at a glance. Click to reopen. tend is ambient: always there, never demanding attention unless something needs you.

Built as a web app first (standard Vite dev against localhost), packaged as Tauri for distribution. Single installer for macOS, Windows, and Linux.

### Phased Delivery

**Phase 1: The conversation and tree.**
- Three-column layout with conversation, tree, and now column
- Conversation drives ideation (existing API) and planning (existing API)
- Tree renders understanding blocks and plan steps
- Project entity in localStorage
- Web app (localhost) for development

**Phase 2: Agents and execution.**
- Status bar with agent avatars and progress rings
- Forge integration for step execution
- Tiered attention model (bubble → badge → queue)
- Subthreads for agent traces
- Tauri wrapper + system tray

**Phase 3: Polish and team.**
- Forming block physics (Matter.js)
- Tree zoom levels and breathing
- Project entity in database
- Multi-user: shared tree, personal conversations

---

## Team-Ready From Day One

Built for one person first. Designed for teams from the data model up.

The tree is always project-level (shared, like a Figma canvas). The conversation is always per-user (personal, like your Cursor session). Steps already have `owner_role`. Projects already have `owner_id`.

Adding team features later is additive, not a rewrite: shared trees, personal AI conversations, role-based approvals, team activity logs. The architecture is ready. The UX principles don't change.

---

*tend — you talk, a project grows.*

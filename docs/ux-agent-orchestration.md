# Agent Orchestration UX: Mission Control

> Design document for human-agent interaction during collaborative planning sessions.

## Overview

When multiple planning agents work in parallel (Architect, UI/UX Designer, Data Modeler, etc.), the human needs to:

1. **Overwatch** - See what agents are doing without micromanaging
2. **Respond** - Answer questions when agents need human input
3. **Not be overwhelmed** - Handle parallel questions gracefully

This document defines the UX patterns for this "mission control" experience.

---

## Core Principle: Ambient Awareness + Focused Interaction

The human should have **ambient awareness** of agent activity at all times, but only be **interrupted** when truly needed. Questions queue intelligently, and the UI never shows multiple simultaneous demands.

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [Left Nav]        │              MAIN CONTENT                     │ [Contextual       │
│                   │                                                │  Right Sidebar]   │
│ ═══════════════   │                                                │                   │
│ 🏠 Home           │   Whatever view is active                      │  (optional,       │
│ 📋 Plans          │                                                │   per-view)       │
│ 🎯 Initiatives    │                        ┌─────────────────────┐ │                   │
│ 🔀 Pipeline       │                        │ Chat bubble         │ │  Could show:      │
│                   │                        │ (when question)     │ │  - Step details   │
│ ───────────────   │                        └─────────────────────┘ │  - Properties     │
│ 💬 Messages       │                                                │  - History        │
│    (2 unread)     │                                                │  - Or nothing     │
│                   │                                                │                   │
│ ⚙️ Settings       │                                                │                   │
│                   │                                                │                   │
├───────────────────┴────────────────────────────────────────────────┴───────────────────┤
│                                    STATUS BAR                                          │
│  📋 Auth System v3   │  [🏗️●] [🎨●] [💾◉] [📊]  │  ❓2  ✓12  │  Agents: 4 active     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Three-Column Layout

| Column | Purpose | Behavior |
|--------|---------|----------|
| **Left Sidebar** | Navigation | Fixed, always visible |
| **Main Content** | Active view | Changes based on navigation |
| **Right Sidebar** | Contextual details | Optional, dynamic per view |

### Permanent Bottom Status Bar

The status bar is always visible across all views. It provides:
- Current context (plan name, version, status)
- Agent presence indicators
- Aggregate statistics
- Session metadata

---

## The Status Bar

### Anatomy

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  [Context]              │  [Agent Avatars]              │  [Stats]        │  [Meta]    │
│                         │                               │                 │            │
│  📋 Plan name           │   🏗️  🎨  💾  📊  🔒           │  ❓ 2  ✓ 12    │  ⏱️ 3m     │
│     Version             │                               │                 │            │
│     Status              │   Agent presence indicators   │  Pending /      │  Session   │
│                         │                               │  Resolved       │  duration  │
│                         │                               │                 │            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Sections

#### Context Section
- Current plan name
- Version number
- Status badge (draft, submitted, approved)

#### Agent Avatars
Shows all agents active in the current context. Each avatar has visual states:

```
  Normal          Working         Needs Input      Idle
  ┌────┐          ┌────┐          ┌────┐          ┌────┐
  │ 🏗️ │          │ 🏗️ │ ●        │ 🏗️ │ ◉        │ 🏗️ │
  └────┘          └────┘          └────┘          └────┘
                   green          red ring        dimmed
                   pulse          (attention)     opacity
```

| State | Visual | Meaning |
|-------|--------|---------|
| **Normal** | Standard icon | Agent exists but not currently active |
| **Working** | Green pulsing dot | Agent is actively processing |
| **Needs Input** | Red ring | Agent has a question for @user |
| **Idle** | Dimmed opacity | Agent finished or waiting for dependencies |

#### Stats Section
- `❓ N` - Number of pending questions
- `✓ N` - Number of decisions made this session

Clicking `❓ N` opens Messages view filtered to pending questions.

#### Meta Section
- Session duration
- Or other contextual info (e.g., "Syncing...", "Offline")

---

## Agent Avatar Interactions

### Click Behaviors

| Action | Result |
|--------|--------|
| **Hover** | Tooltip showing current status/activity |
| **Click (normal/working)** | Opens activity popover |
| **Click (needs input)** | Opens chat bubble with question |

### Activity Popover

When clicking a working agent:

```
┌─────────────────────────────────┐
│ 🏗️ ARCHITECT                   │
│ ─────────────────────────────── │
│ Status: Analyzing dependencies  │
│                                 │
│ Working on: Step 4              │
│ "Define authentication flow"    │
│                                 │
│ Current thought:                │
│ "The OAuth flow needs to        │
│  complete before the session    │
│  middleware can..."             │
│                                 │
│ [View Full Trajectory →]        │
└─────────────────────────────────┘
```

---

## Chat Bubbles

When an agent needs human input, a chat bubble appears anchored to their avatar.

### Bubble Anatomy

```
                    ┌─────────────────────────────────────────┐
                    │ 💾 Data Modeler              [−] [×]   │
                    │ ─────────────────────────────────────── │
                    │                                         │
                    │ Context:                                │
                    │ ┌─────────────────────────────────────┐ │
                    │ │  Current estimates:                 │ │
                    │ │  • ~1000 plans per org              │ │
                    │ │  • Multi-tenant in future           │ │
                    │ │                                     │ │
                    │ │  SQLite ─────── PostgreSQL          │ │
                    │ │  Simple         Scalable            │ │
                    │ │  File-based     Multi-tenant        │ │
                    │ └─────────────────────────────────────┘ │
                    │                                         │
                    │ Which database approach?                │
                    │                                         │
                    │ ○ SQLite (start simple)                 │
                    │ ○ PostgreSQL (scale ready)              │
                    │ ○ SQLite now, design for migration      │
                    │                                         │
                    │ ┌─────────────────────────────────────┐ │
                    │ │ Or type your answer...              │ │
                    │ └─────────────────────────────────────┘ │
                    │                                         │
                    │ 📝 Add reasoning (optional)             │
                    │ ┌─────────────────────────────────────┐ │
                    │ │                                     │ │
                    │ └─────────────────────────────────────┘ │
                    │                                         │
                    │        [Skip for now]    [Send →]       │
                    └──────────────────────────┬──────────────┘
                                               │
                                               ▼
                    ─────────────────────────[💾]─────────────────
                                          Status Bar
```

### Bubble Sections

1. **Header** - Agent name/role, minimize/close buttons
2. **Context** - Diagram, ASCII art, or explanation from agent
3. **Question** - The actual question being asked
4. **Options** - Multiple choice when applicable
5. **Free text** - Always available as alternative
6. **Reasoning** - Optional field for human to explain their choice
7. **Actions** - Skip for now, Send

### Button Behaviors

| Button | Action |
|--------|--------|
| **[−] Minimize** | Collapse bubble, return to red-ring avatar, stays in queue |
| **[×] Close** | Dismiss/skip question entirely |
| **[Skip for now]** | Move to back of queue, will resurface later |
| **[Send →]** | Submit answer, notify agent, close bubble |

---

## Question Queue

### The Problem

Multiple agents may have questions simultaneously. Showing all at once is overwhelming.

### The Solution

Questions queue and display **one at a time**, prioritized intelligently.

### Priority Order

1. **Blocking** - Agent cannot proceed without answer
2. **Time-sensitive** - Been waiting longest
3. **Preference** - Agent could pick default but wants confirmation
4. **Confirmation** - Agent informing of decision, optional override

### Queue Visualization

```
Queue: [💾 blocking] → [🎨 preference] → [🏗️ confirmation]
              ▲
         Currently showing
```

### After Answering

```
                                        ┌──────────────────────────┐
                                        │  ✓ Sent to Data Modeler  │
                                        │                          │
                                        │  Next: UI/UX Designer    │
                                        │  has a question...       │
                                        │                          │
                                        │  [Show Now] [Later]      │
                                        └──────────────────────────┘
```

User can immediately proceed to next question or take a break.

---

## Question Types

### Blocking Question

Agent is stuck and cannot proceed.

```
┌─────────────────────────────────────────┐
│ 💾 Data Modeler         🔴 BLOCKING    │
│ ─────────────────────────────────────── │
│                                         │
│ This decision blocks 3 other steps:     │
│ • Step 5: Implement storage layer       │
│ • Step 8: Add migration system          │
│ • Step 12: Write integration tests      │
│                                         │
│ [Context and options...]                │
└─────────────────────────────────────────┘
```

### Preference Question

Agent can proceed with a default but wants confirmation.

```
┌─────────────────────────────────────────┐
│ 🎨 UI/UX Designer                       │
│ ─────────────────────────────────────── │
│                                         │
│ I'm planning to use shadcn/ui for       │
│ components. This matches the existing   │
│ patterns I see in the codebase.         │
│                                         │
│ ○ Yes, use shadcn/ui (recommended)      │
│ ○ No, use something else                │
│                                         │
│ [Context...]                            │
│                                         │
│ ⏱️ Will auto-proceed in 5 min if no     │
│    response                             │
└─────────────────────────────────────────┘
```

### Confirmation (FYI)

Agent informing of a decision, override optional.

```
┌─────────────────────────────────────────┐
│ 🏗️ Architect                    ℹ️ FYI  │
│ ─────────────────────────────────────── │
│                                         │
│ I've structured the plan with 3 phases: │
│                                         │
│ 1. Core infrastructure (steps 1-4)      │
│ 2. Feature implementation (steps 5-9)   │
│ 3. Testing & polish (steps 10-12)       │
│                                         │
│ Proceeding with this structure.         │
│                                         │
│        [Looks good]    [Wait, change]   │
└─────────────────────────────────────────┘
```

---

## Trajectory Architecture

Trajectories are JSON documents that capture reasoning over time. Agents can read trajectories, which enables intelligent behavior around questions.

### The Core Insight

**Agents should check trajectories before asking questions.** If a similar question was already answered, the agent should use that answer rather than asking again.

### Trajectory Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLAN                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     PLANNING SESSION                                 │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  Architect   │  │  UI/UX       │  │  Data        │  ... agents   │   │
│  │  │  Trajectory  │  │  Trajectory  │  │  Trajectory  │               │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │   │
│  │         │                 │                 │                        │   │
│  │         │    ┌────────────┴────────────┐    │                        │   │
│  │         │    │                         │    │                        │   │
│  │         ▼    ▼                         ▼    ▼                        │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                    USER TRAJECTORY                          │    │   │
│  │  │                                                             │    │   │
│  │  │  Questions asked ←──────── referenced by agents             │    │   │
│  │  │  Answers given   ←──────── before asking new questions      │    │   │
│  │  │  Reasoning       ←──────── builds preference model          │    │   │
│  │  │                                                             │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Trajectory Types

| Trajectory | Owner | Contains | Scope |
|------------|-------|----------|-------|
| **Agent Trajectory** | Individual agent | Reasoning, decisions, questions asked | Per agent, per session |
| **User Trajectory** | Human user | Answers, reasoning, preferences | Per plan (or global) |
| **Session Trajectory** | The planning session | Cross-references, timeline | Per planning session |

### The User Trajectory

Yes, **the user has their own trajectory**. It captures:

```typescript
interface UserTrajectory {
  id: string;
  user_id: string;
  scope: 'plan' | 'global';  // Plan-specific or cross-plan
  plan_id?: string;          // If plan-scoped

  events: UserTrajectoryEvent[];
}

type UserTrajectoryEvent =
  | QuestionAnsweredEvent
  | PreferenceExpressedEvent
  | OverrideEvent
  | FeedbackEvent;

interface QuestionAnsweredEvent {
  type: 'question_answered';
  timestamp: string;

  // The question
  question_id: string;
  asking_agent: string;
  question_text: string;
  context_provided: string;
  options_presented: string[];

  // The answer
  selected_option: string | null;
  free_text_response?: string;
  reasoning?: string;

  // Linking
  plan_id: string;
  step_id?: string;
  agent_trajectory_ref: string;  // Links to agent's trajectory
}

interface PreferenceExpressedEvent {
  type: 'preference_expressed';
  timestamp: string;

  // What preference was learned
  category: string;           // "database", "ui_library", "architecture"
  preference: string;         // "prefer simplicity over scale"
  confidence: number;         // How confident (based on consistency)

  // Evidence
  derived_from: string[];     // IDs of questions that established this
}
```

### Agent Question Flow

Before asking a question, agents follow this flow:

```
Agent wants to ask a question
            │
            ▼
┌───────────────────────────────────┐
│  1. CHECK USER TRAJECTORY         │
│                                   │
│  Has this question (or similar)   │
│  been answered before?            │
└───────────────┬───────────────────┘
                │
        ┌───────┴───────┐
        │               │
       YES              NO
        │               │
        ▼               ▼
┌───────────────┐ ┌───────────────────────────────────┐
│ Use existing  │ │  2. CHECK OTHER AGENT TRAJECTORIES │
│ answer        │ │                                    │
│               │ │  Did another agent already ask     │
│ Log reference │ │  this and get an answer?           │
│ in own        │ └───────────────┬────────────────────┘
│ trajectory    │                 │
└───────────────┘         ┌───────┴───────┐
                          │               │
                         YES              NO
                          │               │
                          ▼               ▼
                  ┌───────────────┐ ┌───────────────────────────────────┐
                  │ Use that      │ │  3. CHECK QUESTION QUEUE           │
                  │ answer        │ │                                    │
                  │               │ │  Is a similar question already     │
                  │ Log reference │ │  in the queue waiting for answer?  │
                  └───────────────┘ └───────────────┬────────────────────┘
                                                    │
                                            ┌───────┴───────┐
                                            │               │
                                           YES              NO
                                            │               │
                                            ▼               ▼
                                    ┌───────────────┐ ┌───────────────────┐
                                    │ Wait for that │ │  4. ASK QUESTION   │
                                    │ question to   │ │                    │
                                    │ be answered   │ │  Add to queue with │
                                    │               │ │  self-assigned     │
                                    │ Subscribe to  │ │  priority          │
                                    │ its answer    │ │                    │
                                    └───────────────┘ └───────────────────┘
```

### Self-Assigned Priority

When an agent adds a question to the queue, it self-assigns priority based on:

```typescript
interface QuestionPriority {
  // Agent's assessment
  blocking_level: 'hard_block' | 'soft_block' | 'preference' | 'fyi';

  // Impact analysis
  steps_blocked: string[];        // Which steps can't proceed
  agents_waiting: string[];       // Which other agents need this
  cascade_depth: number;          // How deep the dependency chain goes

  // Timing
  time_sensitivity: 'immediate' | 'soon' | 'whenever';
  can_use_default: boolean;       // Can agent proceed with a default?
  default_choice?: string;        // What default would be used

  // Computed score (for queue ordering)
  priority_score: number;         // Higher = more urgent
}
```

**Priority scoring formula:**
```
score = (blocking_level_weight * 100)
      + (steps_blocked.length * 10)
      + (agents_waiting.length * 15)
      + (cascade_depth * 5)
      + (time_sensitivity_weight * 20)
      - (can_use_default ? 30 : 0)
```

### Question-Answer Trajectory Linking

When a question is answered, multiple trajectories are updated:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUESTION ANSWERED                                 │
│                                                                             │
│   User clicks "SQLite" with reasoning "start simple"                        │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  USER TRAJECTORY                                                    │   │
│   │                                                                     │   │
│   │  + QuestionAnsweredEvent {                                          │   │
│   │      question_id: "q-123",                                          │   │
│   │      asking_agent: "data-modeler",                                  │   │
│   │      selected_option: "SQLite",                                     │   │
│   │      reasoning: "start simple",                                     │   │
│   │      agent_trajectory_ref: "traj-456#event-789"                     │   │
│   │    }                                                                │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      │ linked                               │
│                                      ▼                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  AGENT TRAJECTORY (Data Modeler)                                    │   │
│   │                                                                     │   │
│   │  + AnswerReceivedEvent {                                            │   │
│   │      question_id: "q-123",                                          │   │
│   │      answer: "SQLite",                                              │   │
│   │      user_reasoning: "start simple",                                │   │
│   │      user_trajectory_ref: "user-traj-001#event-042",                │   │
│   │      proceeding_with: "SQLite implementation"                       │   │
│   │    }                                                                │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      │ notifies                             │
│                                      ▼                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  OTHER AGENT TRAJECTORIES (Architect, etc.)                         │   │
│   │                                                                     │   │
│   │  + RelevantDecisionEvent {                                          │   │
│   │      decision: "database = SQLite",                                 │   │
│   │      source: "user-traj-001#event-042",                             │   │
│   │      relevance: "affects my storage layer assumptions"              │   │
│   │    }                                                                │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Trajectory Scoping

| Scope | When to Use | Example |
|-------|-------------|---------|
| **Step-level** | Decision affects specific step | "How should step 4 handle auth?" |
| **Plan-level** | Decision affects whole plan | "Which database for this project?" |
| **Global** | Decision reflects user preference | "I always prefer TypeScript" |

Agents query at appropriate scope:
```typescript
// Check if user has expressed a preference about databases
const dbPreference = await queryUserTrajectory({
  scope: ['global', 'plan'],  // Check both
  category: 'database',
  plan_id: currentPlan.id
});

if (dbPreference) {
  // Use existing preference, don't ask again
  log(`Using previous preference: ${dbPreference.preference}`);
} else {
  // Need to ask
  enqueueQuestion(...);
}
```

### Building User Preference Model

Over time, the user trajectory builds a preference model:

```typescript
interface UserPreferenceModel {
  // Derived from trajectory events
  preferences: {
    category: string;
    value: string;
    confidence: number;      // 0-1, based on consistency
    evidence_count: number;  // How many decisions support this
    last_expressed: string;  // Timestamp
  }[];

  // Patterns observed
  patterns: {
    pattern: string;         // "prefers_simplicity", "risk_averse"
    confidence: number;
    derived_from: string[];  // Event IDs
  }[];
}

// Example:
{
  preferences: [
    { category: "database", value: "SQLite", confidence: 0.8, evidence_count: 3 },
    { category: "ui_library", value: "shadcn/ui", confidence: 1.0, evidence_count: 2 },
    { category: "architecture", value: "monorepo", confidence: 0.6, evidence_count: 1 }
  ],
  patterns: [
    { pattern: "prefers_simplicity", confidence: 0.85, derived_from: ["evt-1", "evt-3", "evt-7"] },
    { pattern: "values_consistency", confidence: 0.9, derived_from: ["evt-2", "evt-5"] }
  ]
}
```

Agents can query this model:
```typescript
// "Should I propose the simple or scalable option?"
const prefersSimplicity = await getUserPattern('prefers_simplicity');
if (prefersSimplicity.confidence > 0.7) {
  // Lead with the simpler option
  options = [simpleOption, scalableOption];
} else {
  // Present neutrally
  options = [scalableOption, simpleOption];
}
```

### Cross-Plan Learning

User trajectories can span plans, enabling:

1. **Preference continuity** - "Last time you chose React, use React again?"
2. **Consistency checking** - "You chose PostgreSQL for Project A but SQLite here - intentional?"
3. **Reduced questions** - Established preferences don't need re-asking

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER'S GLOBAL TRAJECTORY                            │
│                                                                             │
│  Plan A (2024-01)        Plan B (2024-03)        Plan C (2024-06)          │
│  ├─ SQLite              ├─ SQLite               ├─ (new plan)              │
│  ├─ React               ├─ React                │                           │
│  ├─ Tailwind            ├─ Tailwind             │   Agent: "Based on your   │
│  └─ Monorepo            └─ Monorepo             │   history, I'll assume    │
│                                                  │   SQLite + React +        │
│                                                  │   Tailwind. Override?"    │
│                                                  │                           │
│                                                  │   [Sounds good] [Change]  │
│                                                  │                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decisions as Trajectories

User decisions are captured as first-class trajectory records (as detailed above).

### Decision Event Schema

```typescript
interface QuestionAnsweredEvent {
  // Identity
  id: string;
  type: 'question_answered';

  // Context
  plan_id: string;
  plan_version: number;
  step_id?: string;

  // The question
  question_id: string;
  asking_agent: string;
  question_type: 'blocking' | 'preference' | 'confirmation';
  question_text: string;
  context_provided: string;
  options_presented: string[];

  // The decision
  selected_option: string | null;
  free_text_response?: string;
  reasoning?: string;

  // Linking
  agent_trajectory_ref: string;

  // Impact
  unblocked_steps: string[];

  // Metadata
  timestamp: string;
  response_time_ms: number;
}
```

### Why This Matters

1. **Replayability** - Future agents can see what was decided and why
2. **Learning** - Patterns emerge ("this human prefers simplicity")
3. **Deduplication** - Agents check before asking, reducing question fatigue
4. **Audit trail** - For compliance, "why did we build it this way?"
5. **Handoff** - New team members understand past decisions
6. **Consistency** - Similar questions can reference past decisions
7. **Cross-plan intelligence** - Preferences carry forward

### Decision Log View

Accessible from Messages or dedicated view:

```
┌─────────────────────────────────────────────────────────────────┐
│  DECISION HISTORY                                    [Filter ▼] │
├─────────────────────────────────────────────────────────────────┤
│  #12  ✓ UI Designer - "Component library?"                      │
│       → Chose: shadcn/ui                                        │
│       "Matches existing code, good accessibility"               │
│       5 mins ago · Unblocked: Steps 7, 9                        │
├─────────────────────────────────────────────────────────────────┤
│  #11  ✓ Architect - "Monorepo structure?"                       │
│       → Chose: packages/ with Turbo                             │
│       "Aligns with relay repo conventions"                      │
│       12 mins ago · Unblocked: Steps 2, 3, 4                    │
├─────────────────────────────────────────────────────────────────┤
│  #10  ✓ Data Modeler - "Database choice?"                       │
│       → Chose: SQLite now, design for migration                 │
│       "Start simple, we can migrate later if needed"            │
│       18 mins ago · Unblocked: Steps 5, 8, 12                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Messages View

Full conversation history, relay-style, accessible from left navigation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MESSAGES                                          [Filter: All ▼] [Search] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🏗️ Architect → @user                                    2 mins ago  │   │
│  │ ─────────────────────────────────────────────────────────────────   │   │
│  │ Re: Step dependencies                                               │   │
│  │                                                                     │   │
│  │ I've identified a potential circular dependency between steps      │   │
│  │ 4 and 7. Here's what I see:                                        │   │
│  │                                                                     │   │
│  │ [diagram...]                                                        │   │
│  │                                                                     │   │
│  │                    [View Thread] [Reply] [Mark Resolved]            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🎨 UI Designer → 🏗️ Architect                        5 mins ago     │   │
│  │ ─────────────────────────────────────────────────────────────────   │   │
│  │ Re: Component library choice                                        │   │
│  │                                                                     │   │
│  │ Agreed on shadcn/ui. I'll proceed with that assumption.            │   │
│  │                                                                     │   │
│  │                                        [View Thread] [Jump to step] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Options

- **All** - Everything
- **@user** - Messages directed at human
- **Agent-to-agent** - The "ballet" chatter
- **By agent** - Single agent's messages
- **By step** - Messages about specific step
- **Pending** - Unanswered questions only

---

## Dynamic Right Sidebar

Freed from messaging duties, the right sidebar becomes contextual:

| View | Right Sidebar Content |
|------|----------------------|
| **Plan Editor** | Step details, acceptance criteria, dependencies |
| **Pipeline** | Selected plan properties, execution status |
| **Initiatives** | Initiative details, child plans, progress |
| **Messages** | Thread details, trajectory view |
| **Home** | Quick actions, recent activity |
| **Settings** | Nothing (full width) |

The sidebar can also be **collapsed entirely** for views that don't need it.

---

## Notification Strategy

### When Agent Has Question

| Question Type | Notification |
|---------------|--------------|
| **Blocking** | Red ring on avatar + badge increment + optional sound |
| **Preference** | Red ring on avatar + badge increment |
| **Confirmation** | Badge increment only |

### User-Configurable

- **Always popup** - Show chat bubble immediately for any question
- **Smart** - Popup for blocking only, badge for others (default)
- **Badge only** - Never popup, user manually checks

---

## Edge Cases

### No Agents Active

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 No active plan   │  [Start Planning →]  │  No agents active            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Questions Ignored Too Long

Progressive urgency:
1. Red ring appears (immediate)
2. Ring gets thicker/animated (after 2 min)
3. Badge pulses (after 5 min)
4. Optional: gentle notification sound

Never forces interruption, but makes it increasingly visible.

### Too Many Pending Questions

When `❓ N` exceeds threshold (e.g., 5):
- Show "5+ questions waiting" toast
- Suggest entering "triage mode"
- Triage mode shows queue as list, can batch dismiss confirmations

### Agent Crashes/Disconnects

Avatar shows error state:
```
  ┌────┐
  │ 🏗️ │ ⚠️
  └────┘
  disconnected
```

Click shows reconnection options.

---

## Implementation Notes

### Components Needed

1. **StatusBar** - Permanent bottom bar component
2. **AgentAvatar** - Individual agent indicator with states
3. **AgentActivityPopover** - Popover showing agent's current work
4. **ChatBubble** - Question/answer interface
5. **QuestionQueue** - State management for pending questions
6. **DecisionLog** - History view of past decisions

### State Management

```typescript
interface AgentOrchestrationState {
  // Active agents
  agents: Map<string, AgentStatus>;

  // Question queue
  questionQueue: Question[];
  currentQuestion: Question | null;

  // Decision history
  decisions: DecisionTrajectory[];

  // UI state
  statusBarCollapsed: boolean;
  chatBubbleMinimized: boolean;
  notificationPreference: 'always' | 'smart' | 'badge-only';
}

interface AgentStatus {
  id: string;
  role: string;
  state: 'idle' | 'working' | 'waiting' | 'error';
  currentActivity?: string;
  currentStep?: string;
  hasQuestion: boolean;
}

interface Question {
  id: string;
  agentId: string;
  type: 'blocking' | 'preference' | 'confirmation';
  priority: number;
  createdAt: string;
  context: string;
  questionText: string;
  options: string[];
  blockedSteps?: string[];
}
```

### Integration with Relay

The status bar and chat bubbles integrate with the agent-relay:

1. **Agent status** - Subscribe to agent presence/activity channels
2. **Questions** - Listen for `@user` mentions in agent messages
3. **Responses** - Publish human decisions back to agent channels
4. **Trajectories** - Store decisions in trajectory system

### Trajectory Integration

```typescript
interface TrajectoryService {
  // Query existing trajectories
  queryUserTrajectory(params: {
    scope: ('global' | 'plan' | 'step')[];
    category?: string;
    plan_id?: string;
    step_id?: string;
  }): Promise<UserTrajectoryEvent[]>;

  // Check for similar questions
  findSimilarQuestions(params: {
    question_text: string;
    similarity_threshold: number;
    scope: string[];
  }): Promise<QuestionAnsweredEvent[]>;

  // Get user preference model
  getUserPreferences(user_id: string): Promise<UserPreferenceModel>;

  // Record events
  recordQuestionAsked(event: QuestionAskedEvent): Promise<void>;
  recordAnswerReceived(event: QuestionAnsweredEvent): Promise<void>;
  recordPreferenceUpdate(event: PreferenceExpressedEvent): Promise<void>;

  // Cross-reference
  linkTrajectories(params: {
    source_ref: string;
    target_ref: string;
    relationship: 'answers' | 'references' | 'supersedes';
  }): Promise<void>;
}
```

### Question Queue with Trajectory Awareness

```typescript
interface TrajectoryAwareQuestionQueue {
  // Before adding to queue, check trajectories
  async enqueue(question: Question): Promise<EnqueueResult> {
    // 1. Check if already answered
    const existing = await trajectoryService.findSimilarQuestions({
      question_text: question.questionText,
      similarity_threshold: 0.85,
      scope: ['plan', 'global']
    });

    if (existing.length > 0) {
      return {
        status: 'found_existing',
        existing_answer: existing[0],
        action: 'use_existing'
      };
    }

    // 2. Check if already in queue
    const inQueue = this.queue.find(q =>
      similarity(q.questionText, question.questionText) > 0.85
    );

    if (inQueue) {
      return {
        status: 'already_queued',
        existing_question: inQueue,
        action: 'subscribe_to_answer'
      };
    }

    // 3. Add to queue with priority
    this.queue.push(question);
    this.sortByPriority();

    return {
      status: 'queued',
      position: this.queue.indexOf(question),
      action: 'wait_for_answer'
    };
  }
}
```

---

## Summary

| Element | Location | Purpose |
|---------|----------|---------|
| **Left sidebar** | Fixed left | Navigation |
| **Main content** | Center | Active view |
| **Right sidebar** | Optional right | Contextual details per view |
| **Status bar** | Fixed bottom | Agent presence, stats, session info |
| **Chat bubbles** | Anchored to status bar | One-at-a-time question interface |

This design provides:
- **Ambient awareness** without distraction
- **Focused interaction** when needed
- **Intelligent queuing** to prevent overwhelm
- **Trajectory capture** for future reference
- **Flexibility** in right sidebar usage

---

## Trajectory Summary

| Concept | Description |
|---------|-------------|
| **User has own trajectory** | Yes - captures all answers, reasoning, and derived preferences |
| **Agents peek before asking** | Required - check user + other agent trajectories first |
| **Questions in queue** | Agents also check queue to avoid duplicates |
| **Self-assigned priority** | Agents score their own question importance |
| **Answers stored twice** | On user trajectory (primary) + agent trajectory (reference) |
| **Scoping** | Step-level, plan-level, or global depending on question type |
| **Preference learning** | Over time, user trajectory builds preference model |
| **Cross-plan** | Global preferences carry forward to new plans |

### The Key Flow

```
Agent has question
       │
       ├──→ Check user trajectory (was this answered?)
       │         │
       │        YES → Use existing answer, don't ask
       │         │
       │        NO
       │         │
       ├──→ Check other agent trajectories (did someone else ask?)
       │         │
       │        YES → Use that answer
       │         │
       │        NO
       │         │
       ├──→ Check question queue (is it already queued?)
       │         │
       │        YES → Subscribe to that question's answer
       │         │
       │        NO
       │         │
       └──→ Add to queue with self-assigned priority
                 │
                 ▼
           User answers via chat bubble
                 │
                 ├──→ Answer recorded on USER trajectory
                 ├──→ Reference recorded on AGENT trajectory
                 ├──→ Other agents notified
                 └──→ Preference model updated (if applicable)

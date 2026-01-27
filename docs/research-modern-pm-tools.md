# Research: Modern Project Management Tools (Linear, Shortcut, Height, Plane)

## Why This Matters

These tools represent the modern approach to project management for software teams. Understanding them helps us:

1. **Identify integration targets**: Where do work requests originate?
2. **Learn patterns**: How do they handle planning, prioritization, triage?
3. **Avoid reinventing**: What should we delegate vs. build?
4. **Define boundaries**: Where does Planner fit in their ecosystem?

## Tool Comparison Matrix

| Tool | Type | AI Features | API | Self-Host | Target User |
|------|------|-------------|-----|-----------|-------------|
| **Linear** | SaaS | Triage Intelligence, AI workflows | GraphQL | No | Dev teams, startups |
| **Shortcut** | SaaS | AI task scoping, Korey integration | REST | No | Engineering teams |
| **Height** | SaaS | Copilot (autonomous AI PM) | REST | No | Cross-functional teams |
| **Plane** | Open Source | AI-powered pages | GraphQL | **Yes** | Self-hosting teams |
| **Jira** | SaaS/DC | AI summaries, smart routing | REST | Ending* | Enterprise |
| **monday dev** | SaaS | AI summaries, risk signals | REST | No | Dev + stakeholders |

*Jira Data Center ends March 2029; new subscriptions stop March 2026.

## Deep Dive: Linear

### Conceptual Model

```
Workspace (company)
├── Teams (groups)
│   ├── Issues (work items)
│   │   └── Sub-issues
│   ├── Cycles (sprints)
│   └── Views (filters)
├── Projects (cross-team deliverables)
│   └── Milestones
└── Initiatives (strategic goals)
    └── Projects
```

**Key insight**: Linear has a hierarchy that maps well to planning:
- **Initiatives** = High-level goals (what Planner might receive)
- **Projects** = Deliverables (what Planner might produce as plans)
- **Issues** = Tasks (what Planner produces as steps)

### AI Features: Triage Intelligence

Linear's most relevant AI feature for our case:

**What it does**:
- Analyzes issues in triage queue
- Suggests assignees, teams, labels, projects
- Explains reasoning for suggestions
- Detects duplicates and related issues

**How it works**:
- Uses "agentic models" to analyze issues
- Takes 1-4 minutes per issue (prioritizes quality over speed)
- Can be guided with natural language prompts
- Enterprise: Custom triage rules for automation

**Future direction**:
> "If you trust certain types of suggestions, you'll be able to opt in to having them applied automatically—whether that's assigning an issue, adding a label, or routing work to the right team."

### GraphQL API

**Capabilities**:
- Full read/write access to all entities
- Real-time updates via subscriptions
- Same API Linear uses internally

**Key entities**:
- `Issue` - Work items with status, assignee, labels
- `Project` - Cross-team deliverables
- `Cycle` - Time-boxed sprints
- `Initiative` - Strategic goals
- `Team` - Organizational groups

**Webhooks**:
- Issues, Comments, Projects, Cycles, Labels
- HTTP push notifications on data changes
- Retry with backoff (1min, 1hr, 6hr)

### Integration Pattern for Planner

```
┌────────────────────────────────────────────────────────────────┐
│                         Linear                                  │
│                                                                 │
│  Initiative: "Implement dark mode"                              │
│       │                                                         │
│       │ (webhook or API poll)                                   │
│       ▼                                                         │
└───────┼─────────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────────┐
│                        Planner                                   │
│                                                                 │
│  PlanVersion:                                                   │
│    goal: "Implement dark mode"                                  │
│    steps:                                                       │
│      - Research color systems                                   │
│      - Design theme tokens                                      │
│      - Implement toggle component                               │
│      - Update existing components                               │
│      - Test accessibility                                       │
│                                                                 │
│  (creates version, gets approval)                               │
└───────┬─────────────────────────────────────────────────────────┘
        │
        │ (sync back to Linear)
        ▼
┌────────────────────────────────────────────────────────────────┐
│                         Linear                                  │
│                                                                 │
│  Project: "Dark Mode Implementation"                            │
│    ├── Issue: Research color systems                            │
│    ├── Issue: Design theme tokens                               │
│    ├── Issue: Implement toggle component                        │
│    └── ...                                                      │
└────────────────────────────────────────────────────────────────┘
```

**Two-way sync**:
1. **Linear → Planner**: Initiative/request triggers plan creation
2. **Planner → Linear**: Approved plan creates issues/project in Linear
3. **Linear → Planner**: Issue status updates feed back to plan status

## Deep Dive: Shortcut

### Key Differentiators

- **Objectives**: Align work with company goals
- **Docs**: Built-in documentation
- **Sprints**: Called "Iterations"
- **Robust API**: Well-documented REST API

### AI Features

- Work side-by-side with AI to scope tasks
- Connect to Cursor and Claude Code
- **Korey integration**: AI agent that creates user stories, specs, sub-tasks

### API

- REST API with full CRUD
- Webhooks for real-time updates
- Third-party integrations: GitHub, Slack, Zendesk

### Relevance

Similar integration pattern to Linear. Could serve as alternative intake source.

## Deep Dive: Height

### Unique Approach: AI Copilot

Height positions itself as the "first AI project manager" with:

**Autonomous workflows**:
- AI creates tasks from natural language
- Suggests assignees and organization
- Turns messages into subtasks
- Auto-generates standups

**Copilot Chat**:
- Tag @Copilot like a team member
- Uses task/workspace context
- Private conversations with AI

**Key insight**: Height's Copilot is essentially an AI PM assistant. It handles triage, organization, and status updates autonomously.

### Relevance

Height demonstrates what "AI-native" PM looks like. Their patterns could inform:
- How Planner communicates (natural language)
- What autonomous actions to support
- How to expose AI assistance

## Deep Dive: Plane

### Why Plane is Interesting

**Open source + self-hosted**:
- Full control over data
- No vendor lock-in
- Customizable

**Jira migration path**:
- Jira Data Center ending (2029)
- New DC subscriptions stop March 2026
- Teams need alternatives

**Modern UX**:
- Linear-like clean interface
- Fast, lightweight
- Developer-focused

### Features

- **Work Items**: Issues with rich text, sub-properties
- **Cycles**: Sprint-like time boxes
- **Modules**: Project breakdown
- **Views**: Custom filters
- **Pages**: AI-powered documentation

### API

- GraphQL API (like Linear)
- Self-hosted = full API access
- Extensible for custom integrations

### Relevance

Plane could be:
1. **Integration target**: Like Linear, source of initiatives
2. **Embedded PM**: If we want built-in issue tracking
3. **Reference implementation**: Patterns for our own data model

## Comparison: What They Do vs. What Planner Does

| Aspect | Linear/Shortcut/etc. | Planner |
|--------|---------------------|---------|
| **Focus** | Day-to-day task management | High-level plan creation |
| **Granularity** | Individual issues | Steps in a plan |
| **Versioning** | Issue history | Full plan versioning |
| **Approval** | Status workflows | Plan approval gates |
| **Execution** | Teams work on issues | Orchestrator dispatches to agents |
| **AI** | Triage, suggestions | Plan generation, decomposition |

**Key distinction**: These tools are about **managing work in progress**. Planner is about **defining what work should be done** before it starts.

## Integration Strategies

### Strategy 1: Linear/Shortcut as Intake Source

```
Linear Initiative → Planner → Approved Plan → Orchestrator → Agents
```

**Pros**:
- Teams already use Linear for requests
- Natural intake channel
- Rich context (labels, priorities, attachments)

**Cons**:
- Depends on external service
- Sync complexity
- Linear's model may not match plan structure

### Strategy 2: Planner Syncs Back to Linear

```
Planner → Creates Linear Project + Issues → Teams track progress in Linear
```

**Pros**:
- Visibility for stakeholders
- Use Linear's UI for status
- Leverage Linear's integrations (GitHub, Slack)

**Cons**:
- Dual source of truth risk
- Sync conflicts
- Added complexity

### Strategy 3: Planner as Standalone + Export

```
Planner → Exports plan as Linear-compatible JSON → One-time import to Linear
```

**Pros**:
- Simple, no ongoing sync
- Planner stays independent
- Supports multiple targets

**Cons**:
- No real-time sync
- Manual re-export on changes
- Less integrated experience

### Strategy 4: Plane as Embedded Issue Tracking

```
Planner (with embedded Plane) → Self-contained plan + issue management
```

**Pros**:
- Full control (self-hosted)
- No external dependencies
- Customizable integration

**Cons**:
- More to build/maintain
- May not fit teams already on Linear
- Scope creep

## Recommendations

### For MVP

1. **Don't build issue tracking** — focus on planning
2. **Define export format** that maps to Linear/Shortcut/Plane
3. **Webhook listener** for intake from Linear (optional)

### For v2

1. **Two-way sync** with one PM tool (Linear recommended)
2. **Status aggregation** from PM tool back to plan
3. **Multiple export targets** (Linear, Shortcut, Plane, Jira)

### What to Learn From These Tools

| Tool | Pattern to Adopt |
|------|------------------|
| **Linear** | Clean data model (Initiative → Project → Issue) |
| **Height** | AI-first UX, natural language interaction |
| **Plane** | Open source + self-hosted option |
| **Shortcut** | Developer-focused simplicity |

## Open Questions

1. **Primary integration target**: Linear is most popular with modern teams. Start there?

2. **Sync direction**:
   - One-way (Planner → Linear)?
   - Two-way (Linear ↔ Planner)?
   - Export-only (Planner → JSON → Manual import)?

3. **Issue tracking scope**: Should Planner ever show/manage individual issues, or always delegate to external tools?

4. **Self-hosted option**: Is Plane integration valuable for teams that can't use SaaS?

## Sources

- [Linear: Triage Intelligence](https://linear.app/docs/triage-intelligence)
- [Linear: Conceptual Model](https://linear.app/docs/conceptual-model)
- [Linear: API and Webhooks](https://linear.app/docs/api-and-webhooks)
- [Linear: AI Workflows](https://linear.app/ai)
- [Height: Copilot](https://height.app/copilot)
- [Shortcut](https://www.shortcut.com)
- [Plane GitHub](https://github.com/makeplane/plane)
- [Plane: Open Source PM](https://plane.so/blog/top-6-open-source-project-management-software-in-2026)
- [Monday: Linear Alternatives](https://monday.com/blog/rnd/linear-alternatives/)
- [Zapier: AI PM Tools](https://zapier.com/blog/best-ai-project-management-tools/)

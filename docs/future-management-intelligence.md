# Distant Future: Management Intelligence Layer

> **Status**: Aspirational architecture — documents a long-term vision, not immediate roadmap.

This document explores how our architecture could evolve to become a comprehensive **management operating system** — one that monitors all trajectories (human and agent), surfaces strategic insights, and provides unprecedented directional clarity.

## Inspiration: Modern Management Wiring Diagram

The traditional management operating model shows interconnected concerns:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          MODERN MANAGEMENT WIRING                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   STRATEGY FOUNDATION          PROCESS & MEASUREMENT         PEOPLE & PERFORMANCE│
│   ──────────────────          ─────────────────────         ────────────────────│
│                                                                                  │
│   Strategy ──────────► Strategic Risk Register               Performance Coaching│
│      │                        │                                     ▲           │
│      ▼                        ▼                                     │           │
│   Values ───────────► Balanced Scorecard ◄──────────► Self-Managed Work Teams  │
│      │                        │                                     │           │
│      ▼                        ▼                                     ▼           │
│   Strategy Map ─────► Strategic Process    ──────────► Rewards & Compensation  │
│      │                Analysis                                      │           │
│      ▼                        │                                     ▼           │
│   Organization ◄──────────────┼──────────────────────► Employee Engagement     │
│   Design                      │                                     │           │
│                               ▼                                     │           │
│                    Objectives & Key Results ◄───────────────────────┘           │
│                               │                                                  │
│                               ▼                                                  │
│                    Process Improvement ◄────► Strategic Project Management      │
│                                                                                  │
│                    Everything flows, everything connects.                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key insight**: Management is a system of interconnected feedback loops, not isolated functions.

## What We Currently Cover

| Management Concept | Our Current Coverage | Status |
|-------------------|---------------------|--------|
| Strategic Project Management | Planner + Orchestrator | ✅ Core |
| Process Improvement | Insights.patterns (future) | 🔮 Planned |
| Risk Management | Operational only (Platform) | 🔮 Planned |
| OKRs / Balanced Scorecard | Initiative objectives only | ⚠️ Partial |
| Strategy / Values | None | ❌ Gap |
| Business Capabilities | None | ❌ Gap |
| Organization Design | Agent roles only | ❌ Gap |
| Performance Coaching | Agent stats only | ❌ Gap |
| Employee Engagement | None | ❌ Gap |
| Self-Managed Teams | None | ❌ Gap |

## The Vision: Full Management Operating System

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GOVERNANCE                                          │
│                        (the meta-orchestrator)                                   │
│                                                                                  │
│  • Monitors ALL trajectories (human + agent)                                     │
│  • Surfaces strategic decisions to leadership                                    │
│  • Detects misalignment between strategy and execution                           │
│  • Provides "management cockpit" with directional clarity                        │
│  • AI-powered strategic recommendations                                          │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────────┐
        │                          │                              │
        ▼                          ▼                              ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   STRATEGY    │          │   ALIGNMENT   │          │     RISK      │
│               │          │               │          │               │
│ • Values      │          │ • Cascade     │          │ • Strategic   │
│ • Strategy map│◀────────▶│ • OKR links   │◀────────▶│   risk reg.   │
│ • Trade-offs  │          │ • Drift detect│          │ • Scenarios   │
│ • Horizons    │          │ • Score at    │          │ • Early warn  │
│               │          │   each level  │          │               │
└───────────────┘          └───────────────┘          └───────────────┘
        │                          │                              │
        └──────────────────────────┼──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CAPABILITIES                                          │
│                                                                                  │
│  • Business capability hierarchy (what the business does)                        │
│  • Maturity assessment (how well can we do it?)                                  │
│  • Provider mapping (who/what delivers each capability)                          │
│  • Demand forecasting (what do initiatives need?)                                │
│  • Gap analysis (where are we under-invested?)                                   │
│  • Build vs buy vs automate decisions                                            │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             ORGANIZATION                                         │
│                                                                                  │
│  • Team design & boundaries (human + agent)                                      │
│  • Teams mapped to capabilities they deliver                                     │
│  • Workforce planning (humans, agents, hybrids)                                  │
│  • Decision rights & autonomy levels                                             │
│  • Coordination patterns between teams                                           │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────────┐
        │                          │                              │
        ▼                          ▼                              ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  PERFORMANCE  │          │  ENGAGEMENT   │          │   COACHING    │
│               │          │               │          │               │
│ • Human perf  │          │ • Satisfaction│          │ • Skill gaps  │
│ • Agent perf  │◀────────▶│ • Motivation  │◀────────▶│ • Growth paths│
│ • Team perf   │          │ • Autonomy    │          │ • Recommend-  │
│ • Rewards     │          │ • Purpose fit │          │   ations      │
└───────────────┘          └───────────────┘          └───────────────┘
                                   │
                                   │ feeds into
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TRAJECTORIES                                            │
│                     (observability layer)                                        │
│                                                                                  │
│  NOW: Agent reasoning capture                                                    │
│  FUTURE: Human decision capture, meeting transcripts, collaboration logs         │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────────┐
        │                          │                              │
        ▼                          ▼                              ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   INSIGHTS    │          │   PLATFORM    │          │   PROCESS     │
│               │          │               │          │  IMPROVEMENT  │
│ • Patterns    │          │ • Health      │          │               │
│ • Learnings   │◀────────▶│ • Alerts      │◀────────▶│ • How we work │
│ • Effective-  │          │ • Costs       │          │ • Bottlenecks │
│   ness        │          │ • SLAs        │          │ • Automation  │
└───────────────┘          └───────────────┘          └───────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CORE WORKFLOW                                            │
│                                                                                  │
│   INTAKE ──▶ PORTFOLIO ──▶ PLANNER ──▶ ORCHESTRATOR ──▶ RELAY                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## New Subdomain: Strategy

**Purpose**: Define what the organization IS and ISN'T.

Portfolio manages tactical initiatives; Strategy defines the "why" and the trade-offs.

```sql
CREATE SCHEMA strategy;

-- Strategic choices (including what we WON'T do)
CREATE TABLE strategy.choices (
  choice_id UUID PRIMARY KEY,

  -- The choice
  choice_type TEXT NOT NULL,  -- 'pursue', 'avoid', 'defer'
  domain TEXT NOT NULL,       -- 'market', 'capability', 'technology', 'customer'
  description TEXT NOT NULL,
  rationale TEXT,

  -- Time horizon
  horizon TEXT,               -- 'h1' (now), 'h2' (next), 'h3' (future)

  -- Governance
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  review_due TIMESTAMPTZ,

  -- Evidence
  supporting_data JSONB,      -- Market research, trajectory patterns, etc.

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Values with behavioral indicators
CREATE TABLE strategy.values (
  value_id UUID PRIMARY KEY,

  name TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Observable behaviors (for trajectory analysis)
  positive_indicators JSONB,  -- ["Ships quality over speed", "Asks clarifying questions"]
  negative_indicators JSONB,  -- ["Cuts corners under pressure", "Skips reviews"]

  -- Measurement from trajectories
  current_score DECIMAL(3,2),
  score_trend TEXT,           -- 'improving', 'stable', 'declining'
  last_assessed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Strategy map: cause-and-effect relationships
CREATE TABLE strategy.strategy_map (
  link_id UUID PRIMARY KEY,

  from_objective_id UUID NOT NULL,
  to_objective_id UUID NOT NULL,

  relationship_type TEXT,     -- 'enables', 'requires', 'measures'
  hypothesis TEXT,            -- "If we improve X, then Y should increase"

  -- Validation from trajectories
  evidence_strength DECIMAL(3,2),
  last_validated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Strategic objectives (Balanced Scorecard perspectives)
CREATE TABLE strategy.objectives (
  objective_id UUID PRIMARY KEY,

  perspective TEXT NOT NULL,  -- 'financial', 'customer', 'process', 'learning'
  name TEXT NOT NULL,
  description TEXT,

  -- Measurement
  measure_type TEXT,          -- 'leading', 'lagging'
  target_value DECIMAL(20,4),
  current_value DECIMAL(20,4),
  unit TEXT,

  -- Status
  status TEXT,                -- 'on_track', 'at_risk', 'off_track'

  -- Cascade links
  parent_objective_id UUID,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key capability**: Values are measured by analyzing trajectories for behavioral indicators, not self-reported surveys.

---

## New Subdomain: Capabilities

**Purpose**: Define what the business CAN DO, independent of how it's organized.

Business capabilities are the bridge between strategy ("what we want to achieve") and organization ("how we're structured"). They answer: "What does this business do?" — not how, not who, not where.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         BUSINESS CAPABILITIES                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Level 1 (Domain)              Level 2 (Capability)       Level 3 (Sub-cap)     │
│  ───────────────               ────────────────────       ─────────────────     │
│                                                                                  │
│  Product Development           Design Products            UX Research           │
│                                Build Products             Frontend Dev          │
│                                Test Products              QA Automation         │
│                                                                                  │
│  Customer Management           Acquire Customers          Lead Generation       │
│                                Serve Customers            Support Tickets       │
│                                Retain Customers           Churn Prevention      │
│                                                                                  │
│  Operations                    Manage Infrastructure      Cloud Ops             │
│                                Process Payments           Billing               │
│                                Ensure Compliance          Security Audits       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Why Capabilities Matter for Agentic Systems

In a human+agent workforce, capabilities become critical:

| Question | Without Capabilities | With Capabilities |
|----------|---------------------|-------------------|
| "What can agents do?" | List of agent skills | Mapped to business capabilities |
| "Where do we need humans?" | Gut feel | Capability maturity + risk assessment |
| "What to automate next?" | Ad hoc | Capability heat map (cost × volume × complexity) |
| "Impact of this change?" | Unknown | Capability dependency map |

```sql
CREATE SCHEMA capabilities;

-- Business capability hierarchy
CREATE TABLE capabilities.capabilities (
  capability_id UUID PRIMARY KEY,

  -- Hierarchy
  parent_id UUID REFERENCES capabilities.capabilities(capability_id),
  level INT NOT NULL,              -- 1, 2, or 3
  path TEXT NOT NULL,              -- 'product_dev.build_products.frontend_dev'

  -- Identity
  name TEXT NOT NULL,
  description TEXT,

  -- Classification
  domain TEXT,                     -- 'core', 'supporting', 'generic'
  strategic_importance TEXT,       -- 'differentiating', 'competitive_parity', 'commodity'

  -- Lifecycle
  lifecycle_stage TEXT,            -- 'emerging', 'growing', 'mature', 'declining'

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Capability maturity assessment
CREATE TABLE capabilities.maturity (
  maturity_id UUID PRIMARY KEY,
  capability_id UUID NOT NULL REFERENCES capabilities.capabilities(capability_id),

  assessment_date DATE NOT NULL,

  -- Maturity dimensions (1-5 scale)
  process_maturity INT,            -- How standardized/optimized?
  technology_maturity INT,         -- How well-tooled?
  people_maturity INT,             -- How skilled is workforce?
  automation_maturity INT,         -- How automated? (key for agent planning)

  overall_score DECIMAL(3,2),      -- Weighted average

  -- Evidence
  assessment_notes TEXT,
  trajectory_evidence UUID[],      -- Supporting trajectories

  assessed_by TEXT,

  UNIQUE(capability_id, assessment_date)
);

-- Capability providers (who/what delivers this capability)
CREATE TABLE capabilities.providers (
  provider_id UUID PRIMARY KEY,
  capability_id UUID NOT NULL REFERENCES capabilities.capabilities(capability_id),

  -- What provides this capability
  provider_type TEXT NOT NULL,     -- 'team', 'agent', 'vendor', 'system'
  provider_ref TEXT NOT NULL,      -- team_id, agent_id, vendor_name, system_name

  -- Contribution
  coverage_pct DECIMAL(3,2),       -- What % of this capability does this provider cover?
  primary_provider BOOLEAN DEFAULT false,

  -- Quality
  quality_score DECIMAL(3,2),      -- Based on trajectory analysis
  reliability_score DECIMAL(3,2),

  -- Cost (for build vs buy vs automate decisions)
  cost_per_unit DECIMAL(12,2),
  cost_unit TEXT,                  -- 'per_transaction', 'per_month', 'per_hour'

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Capability demand (what initiatives/plans need this capability)
CREATE TABLE capabilities.demand (
  demand_id UUID PRIMARY KEY,
  capability_id UUID NOT NULL REFERENCES capabilities.capabilities(capability_id),

  -- Source of demand
  source_type TEXT NOT NULL,       -- 'initiative', 'plan', 'step'
  source_id UUID NOT NULL,

  -- Demand characteristics
  volume_estimate INT,             -- Estimated units needed
  criticality TEXT,                -- 'must_have', 'should_have', 'nice_to_have'
  timeline TEXT,                   -- 'immediate', 'quarter', 'year'

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Capability gaps (demand exceeds supply)
CREATE TABLE capabilities.gaps (
  gap_id UUID PRIMARY KEY,
  capability_id UUID NOT NULL REFERENCES capabilities.capabilities(capability_id),

  -- Gap analysis
  gap_type TEXT NOT NULL,          -- 'capacity', 'maturity', 'coverage', 'quality'
  description TEXT NOT NULL,

  -- Quantification
  current_capacity DECIMAL(12,2),
  required_capacity DECIMAL(12,2),
  gap_severity TEXT,               -- 'critical', 'significant', 'moderate', 'minor'

  -- Resolution options
  resolution_options JSONB,        -- [{ option, cost, timeline, risk }]
  recommended_option TEXT,

  -- Status
  status TEXT DEFAULT 'open',      -- 'open', 'planned', 'in_progress', 'resolved'
  resolution_initiative_id UUID,   -- If we created an initiative to address it

  identified_at TIMESTAMPTZ DEFAULT now()
);

-- Capability dependencies (what other capabilities does this one need?)
CREATE TABLE capabilities.dependencies (
  dependency_id UUID PRIMARY KEY,

  capability_id UUID NOT NULL REFERENCES capabilities.capabilities(capability_id),
  depends_on_id UUID NOT NULL REFERENCES capabilities.capabilities(capability_id),

  dependency_type TEXT,            -- 'requires', 'enhances', 'optional'
  strength TEXT,                   -- 'strong', 'moderate', 'weak'

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(capability_id, depends_on_id)
);
```

### Capability Heat Map

The system can generate a capability heat map showing where to invest:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       CAPABILITY INVESTMENT HEAT MAP                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  High Strategic Value                                                            │
│       ▲                                                                          │
│       │     ┌─────────────┐                    ┌─────────────┐                  │
│       │     │  AUTOMATE   │                    │   INVEST    │                  │
│       │     │             │                    │             │                  │
│       │     │ High volume │                    │ Strategic   │                  │
│       │     │ Routine     │                    │ gaps        │                  │
│       │     │ Agent-ready │                    │ Build/buy   │                  │
│       │     └─────────────┘                    └─────────────┘                  │
│       │                                                                          │
│       │     ┌─────────────┐                    ┌─────────────┐                  │
│       │     │  MAINTAIN   │                    │  CONSIDER   │                  │
│       │     │             │                    │             │                  │
│       │     │ Low volume  │                    │ Emerging    │                  │
│       │     │ Working OK  │                    │ needs       │                  │
│       │     │ No change   │                    │ Watch       │                  │
│       │     └─────────────┘                    └─────────────┘                  │
│       │                                                                          │
│       └─────────────────────────────────────────────────────────────────►       │
│                              Low Maturity → High Maturity                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Integration with Other Subdomains

| Subdomain | Capability Integration |
|-----------|----------------------|
| **Strategy** | Objectives link to capability investments |
| **Alignment** | Initiatives scored on capability contribution |
| **Organization** | Teams mapped to capabilities they deliver |
| **People** | Skills mapped to capabilities they enable |
| **Portfolio** | Initiatives prioritized by capability impact |
| **Planner** | Steps tagged with capability requirements |
| **Orchestrator** | Agents selected by capability match |

**Key capability**: Build vs buy vs automate decisions driven by trajectory-analyzed capability maturity and strategic importance.

---

## New Subdomain: Alignment

**Purpose**: Ensure execution aligns with strategy at every level.

This is the "cascade" function — linking strategy to initiatives to plans to tasks.

```sql
CREATE SCHEMA alignment;

-- Alignment scores at each level
CREATE TABLE alignment.cascade_scores (
  score_id UUID PRIMARY KEY,

  level TEXT NOT NULL,        -- 'strategy', 'portfolio', 'initiative', 'plan', 'task'
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- Alignment measurement
  strategic_alignment DECIMAL(3,2),  -- 0-1: Does this serve strategy?
  value_alignment DECIMAL(3,2),      -- 0-1: Does this reflect values?
  priority_alignment DECIMAL(3,2),   -- 0-1: Is this the right priority?

  -- Drift detection
  drift_from_intent TEXT,     -- Natural language: "Started as API feature, now includes mobile"
  drift_severity TEXT,        -- 'none', 'minor', 'significant', 'critical'

  -- Evidence from trajectories
  supporting_trajectories UUID[],

  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- OKR linkages
CREATE TABLE alignment.okr_links (
  link_id UUID PRIMARY KEY,

  -- The objective
  objective_id UUID NOT NULL,  -- References strategy.objectives

  -- What it links to
  linked_type TEXT NOT NULL,  -- 'initiative', 'plan', 'step'
  linked_id UUID NOT NULL,

  -- Contribution
  contribution_weight DECIMAL(3,2),  -- How much does this contribute?
  contribution_actual DECIMAL(3,2),  -- Actual contribution so far

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Misalignment alerts (surfaced to Governance)
CREATE TABLE alignment.misalignment_alerts (
  alert_id UUID PRIMARY KEY,

  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  alert_type TEXT NOT NULL,   -- 'scope_creep', 'priority_drift', 'value_violation', 'orphan_work'
  description TEXT NOT NULL,

  -- Evidence
  trajectory_evidence JSONB,

  -- Resolution
  status TEXT DEFAULT 'open',
  resolved_by TEXT,
  resolution TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key capability**: Automatic drift detection — "this plan started as X but trajectories show it's becoming Y."

---

## New Subdomain: Organization

**Purpose**: Manage the combined human-agent workforce.

```sql
CREATE SCHEMA organization;

-- Teams (human, agent, or hybrid)
CREATE TABLE organization.teams (
  team_id UUID PRIMARY KEY,

  name TEXT NOT NULL,
  team_type TEXT NOT NULL,    -- 'human', 'agent', 'hybrid'

  -- Purpose and scope
  purpose TEXT,
  domains TEXT[],             -- What this team owns

  -- Autonomy level
  autonomy_level TEXT,        -- 'directed', 'guided', 'self_managed'
  decision_rights JSONB,      -- What can they decide without escalation?

  -- Composition
  human_count INT DEFAULT 0,
  agent_count INT DEFAULT 0,

  -- Health (computed from trajectories)
  health_score DECIMAL(3,2),
  collaboration_score DECIMAL(3,2),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Capabilities (what the organization can do)
CREATE TABLE organization.capabilities (
  capability_id UUID PRIMARY KEY,

  name TEXT NOT NULL,
  description TEXT,

  -- Maturity
  maturity_level TEXT,        -- 'emerging', 'developing', 'established', 'optimizing'

  -- Providers
  provided_by_teams UUID[],
  provided_by_agents UUID[],

  -- Strategic importance
  strategic_value TEXT,       -- 'core', 'enabling', 'commodity'

  -- Gaps
  gap_assessment TEXT,
  gap_priority TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workforce planning
CREATE TABLE organization.workforce_plan (
  plan_id UUID PRIMARY KEY,

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Current state
  current_humans INT,
  current_agents INT,
  current_capacity JSONB,     -- { "backend_dev": 100, "frontend_dev": 80 }

  -- Projected demand (from Pipeline)
  projected_demand JSONB,

  -- Gaps
  capacity_gaps JSONB,

  -- Recommendations
  recommendations JSONB,      -- { "hire": [...], "train": [...], "deploy_agents": [...] }

  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key capability**: Unified view of human + agent workforce with capability mapping.

---

## New Subdomain: People (Performance + Engagement + Coaching)

**Purpose**: Track and improve human AND agent effectiveness.

```sql
CREATE SCHEMA people;

-- Performance tracking (humans and agents unified)
CREATE TABLE people.performance (
  performance_id UUID PRIMARY KEY,

  actor_type TEXT NOT NULL,   -- 'human', 'agent'
  actor_id TEXT NOT NULL,     -- User ID or agent ID

  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Quantitative metrics
  tasks_completed INT,
  tasks_quality_score DECIMAL(3,2),
  collaboration_score DECIMAL(3,2),

  -- Value alignment (from trajectory analysis)
  value_alignment_scores JSONB,  -- { "quality_focus": 0.85, "collaboration": 0.72 }

  -- Growth
  skills_demonstrated TEXT[],
  skills_developing TEXT[],

  -- For humans only
  engagement_score DECIMAL(3,2),
  manager_rating DECIMAL(3,2),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Engagement signals (detected from trajectories)
CREATE TABLE people.engagement_signals (
  signal_id UUID PRIMARY KEY,

  actor_id TEXT NOT NULL,

  signal_type TEXT NOT NULL,  -- 'positive', 'negative', 'neutral'
  signal_source TEXT,         -- 'trajectory', 'survey', 'behavior', 'communication'

  description TEXT NOT NULL,

  -- Evidence
  trajectory_id UUID,

  detected_at TIMESTAMPTZ DEFAULT now()
);

-- Coaching recommendations (AI-generated from trajectories)
CREATE TABLE people.coaching_recommendations (
  recommendation_id UUID PRIMARY KEY,

  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,

  -- The recommendation
  recommendation_type TEXT,   -- 'skill_development', 'behavior_adjustment', 'assignment_change'
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Evidence
  based_on_trajectories UUID[],
  confidence DECIMAL(3,2),

  -- Status
  status TEXT DEFAULT 'pending',
  actioned_by TEXT,
  outcome TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key capability**: AI-generated coaching recommendations based on trajectory analysis, not just metrics.

---

## New Subdomain: Governance (The Meta-Orchestrator)

**Purpose**: The "management cockpit" that sees everything and surfaces decisions.

```sql
CREATE SCHEMA governance;

-- Strategic decisions requiring leadership attention
CREATE TABLE governance.decision_queue (
  decision_id UUID PRIMARY KEY,

  -- What needs deciding
  decision_type TEXT NOT NULL,  -- 'strategic_choice', 'resource_allocation', 'risk_response', 'misalignment'
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Context (AI-assembled from across all subdomains)
  context_summary TEXT,
  supporting_data JSONB,
  trajectory_evidence UUID[],

  -- Options
  options JSONB,              -- [{ option, pros, cons, recommendation }]
  ai_recommendation TEXT,
  ai_confidence DECIMAL(3,2),

  -- Urgency
  urgency TEXT,               -- 'low', 'medium', 'high', 'critical'
  deadline TIMESTAMPTZ,

  -- Resolution
  status TEXT DEFAULT 'pending',
  decided_by TEXT,
  decision TEXT,
  rationale TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Directional clarity metrics ("are we on track?")
CREATE TABLE governance.directional_clarity (
  snapshot_id UUID PRIMARY KEY,

  snapshot_at TIMESTAMPTZ DEFAULT now(),

  -- Overall direction
  strategic_momentum TEXT,    -- 'accelerating', 'steady', 'slowing', 'stalled'
  alignment_health TEXT,      -- 'strong', 'adequate', 'weak', 'misaligned'

  -- By perspective (BSC-style)
  financial_trajectory TEXT,
  customer_trajectory TEXT,
  process_trajectory TEXT,
  learning_trajectory TEXT,

  -- Key indicators
  key_wins JSONB,             -- Recent successes
  key_concerns JSONB,         -- Things requiring attention
  emerging_patterns JSONB,    -- Patterns detected in trajectories

  -- Recommendations
  strategic_recommendations JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Management intelligence queries
CREATE TABLE governance.intelligence_queries (
  query_id UUID PRIMARY KEY,

  -- The question
  question TEXT NOT NULL,     -- "Why did Q4 initiatives underperform?"
  asked_by TEXT,

  -- AI-generated answer from trajectory analysis
  answer TEXT,
  confidence DECIMAL(3,2),
  evidence JSONB,

  -- Sources
  trajectories_analyzed INT,
  time_range_start TIMESTAMPTZ,
  time_range_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key capability**: Natural language queries answered by AI analyzing trajectories across all subdomains.

---

## The Killer Feature: Trajectory-Powered Management Intelligence

The real power comes from having **trajectories capture everything** — not just agent reasoning, but:

- Human decision-making (meeting transcripts, Slack threads, email decisions)
- Collaboration patterns (who works with whom, how effectively)
- Knowledge flow (how information moves through the organization)
- Value expression (when do people/agents embody or violate values)

### Example Queries

```
"Why did the authentication initiative take 3x longer than estimated?"

→ AI analyzes 47 trajectories, finds:
  - 3 scope changes (detected in planning agent trajectories)
  - 2 unplanned dependencies (detected in execution agent trajectories)
  - 1 key person unavailable for 2 weeks (detected in human collaboration patterns)
  - Values alignment issue: "shipped fast" vs "shipped right" tension in 12 conversations
```

```
"Which teams are most effective at cross-functional collaboration?"

→ AI analyzes collaboration trajectories, ranks teams by:
  - Response time to requests
  - Quality of handoffs
  - Knowledge sharing patterns
  - Conflict resolution effectiveness
```

```
"What capabilities should we build vs buy vs automate?"

→ AI analyzes execution trajectories + strategic objectives:
  - "Backend API development" — core, high-performing agents, keep
  - "Documentation" — commodity, agents struggle, consider automation
  - "Security review" — core, human expertise critical, invest in training
```

```
"Are we living our values?"

→ AI analyzes trajectories for behavioral indicators:
  - "Quality over speed": 78% alignment (down from 85% last quarter)
    - Evidence: 12 instances of shipping without review under deadline pressure
  - "Collaborative problem-solving": 92% alignment
    - Evidence: Strong cross-team trajectory connections
```

---

## Expanded Trajectories: Human + Agent

For this vision to work, Trajectories must expand beyond agent reasoning:

| Trajectory Type | Source | Captures |
|-----------------|--------|----------|
| **Agent work** | Orchestrator results | Reasoning, tool calls, decisions |
| **Human decisions** | Meeting transcripts, Slack | Decision rationale, alternatives considered |
| **Collaboration** | Communication tools | Who talked to whom, about what, when |
| **Knowledge sharing** | Documentation, code review | Information flow patterns |
| **Approvals** | Portfolio, Planner | Approval reasoning, concerns raised |

### Privacy and Consent

This level of trajectory capture raises important considerations:

1. **Opt-in by default** — Humans choose what gets captured
2. **Aggregation over surveillance** — Patterns, not individual monitoring
3. **Transparent algorithms** — People can see what's being measured
4. **Right to explanation** — Any recommendation can be traced to evidence

---

## The Learning Loop

The system learns what "good" looks like from trajectories, not from human definition:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           THE LEARNING LOOP                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   1. CAPTURE                                                                     │
│      All work produces trajectories (human + agent)                              │
│                           │                                                      │
│                           ▼                                                      │
│   2. CORRELATE                                                                   │
│      Link trajectories to outcomes (success, failure, time, quality)             │
│                           │                                                      │
│                           ▼                                                      │
│   3. PATTERN                                                                     │
│      Identify what behaviors correlate with good outcomes                        │
│                           │                                                      │
│                           ▼                                                      │
│   4. SURFACE                                                                     │
│      Present patterns to Governance for validation                               │
│                           │                                                      │
│                           ▼                                                      │
│   5. CODIFY (optional)                                                           │
│      Validated patterns become recommendations or constraints                    │
│                           │                                                      │
│                           ▼                                                      │
│   6. FEEDBACK                                                                    │
│      Monitor if codified patterns improve outcomes                               │
│                           │                                                      │
│                           └──────────────────────────────────────────────────────┤
│                                                                                  │
│   This is DESCRIPTIVE → PREDICTIVE → PRESCRIPTIVE management intelligence.      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phased Roadmap

| Phase | Timeframe | Focus | Subdomains |
|-------|-----------|-------|------------|
| **Now** | Current | Core workflow | Intake, Portfolio, Planner, Orchestrator |
| **Near** | +6mo | Operational intelligence | + Insights, + Platform |
| **Medium** | +12mo | Strategic clarity | + Strategy, + Alignment |
| **Far** | +18mo | Business architecture | + Capabilities |
| **Further** | +24mo | Workforce intelligence | + Organization, + People |
| **Distant** | +30mo | Full management OS | + Governance |

### Extraction Triggers

| Subdomain | Extract When |
|-----------|-------------|
| **Strategy** | Need to track strategic choices and their outcomes |
| **Alignment** | Detecting drift between strategy and execution becomes valuable |
| **Capabilities** | Want build/buy/automate decisions driven by capability analysis; need to map agents to business capabilities |
| **Organization** | Managing hybrid human-agent teams requires unified view |
| **People** | Want AI-generated coaching from trajectory analysis |
| **Governance** | Leadership needs single "cockpit" for all decisions |

---

## Key Design Principles

### 1. Learn from Trajectories, Don't Prescribe

Instead of defining KPIs upfront, the system:
- Captures all work trajectories
- Identifies patterns in successful vs unsuccessful outcomes
- Surfaces what actually predicts success
- Recommends adjustments based on evidence

### 2. Unified Human + Agent View

No separate systems for human and agent management. One workforce, one system.

### 3. Transparency Over Surveillance

Every recommendation traces to evidence. No black-box decisions.

### 4. Phased Extraction

Start simple, extract complexity only when the value justifies the coordination cost.

---

## Relationship to Existing Architecture

This future architecture sits **above** the current four subdomains:

```
                              ┌─────────────┐
                              │ GOVERNANCE  │
                              │ (future)    │
                              └──────┬──────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
   │  STRATEGY   │           │  ALIGNMENT  │           │    RISK     │
   │  (future)   │           │  (future)   │           │  (future)   │
   └─────────────┘           └─────────────┘           └─────────────┘
          │                          │                          │
          └──────────────────────────┼──────────────────────────┘
                                     │
                              ┌──────┴──────┐
                              │CAPABILITIES │
                              │  (future)   │
                              └──────┬──────┘
                                     │
                              ┌──────┴──────┐
                              │ORGANIZATION │
                              │  (future)   │
                              └──────┬──────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
   │ PERFORMANCE │           │ ENGAGEMENT  │           │  COACHING   │
   │  (future)   │           │  (future)   │           │  (future)   │
   └─────────────┘           └─────────────┘           └─────────────┘
                                     │
                                     ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                        TRAJECTORIES                              │
   │                    (observability layer)                         │
   └─────────────────────────────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
   │  INSIGHTS   │           │  PLATFORM   │           │   PROCESS   │
   │  (planned)  │           │  (planned)  │           │ IMPROVEMENT │
   └─────────────┘           └─────────────┘           └─────────────┘
                                     │
                                     ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                        CORE WORKFLOW                             │
   │                                                                  │
   │    INTAKE ──▶ PORTFOLIO ──▶ PLANNER ──▶ ORCHESTRATOR ──▶ RELAY  │
   │                         (current)                                │
   └─────────────────────────────────────────────────────────────────┘
```

The current architecture remains the foundation. Future layers add management intelligence on top without replacing the core workflow.

---

## Summary

This document describes a long-term vision where:

1. **Trajectories expand** to capture human AND agent work
2. **Strategy becomes explicit** with values, choices, and objectives
3. **Alignment is measured** from strategy to task
4. **Capabilities map** what the business does to who/what delivers it
5. **Organization is unified** across human and agent workforce
6. **Performance is trajectory-driven** not just metric-driven
7. **Governance provides clarity** via AI-powered management intelligence

The result: unprecedented visibility into whether the organization is moving in the right direction, backed by evidence from actual work trajectories.

This is not a 6-month roadmap. It's a North Star for what management operating systems could become in an AI-native world.

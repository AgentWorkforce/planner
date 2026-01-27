# Research: Intake, Triage & Portfolio Management for AI Agents

## Overview

Our architecture identifies three layers above the Planner:

1. **Intake**: Captures messy inbound into structured initiatives
2. **Triage**: Classifies, routes, and prioritizes requests
3. **Portfolio Control**: Manages multiple initiatives, allocates resources

This document explores what exists in the market and what patterns are emerging.

## Current State of the Market

### The Gap

While orchestration frameworks (LangGraph, CrewAI, Temporal) are mature, the **intake and portfolio layers are fragmented**:

- Most solutions are **domain-specific** (IT tickets, customer support, HR requests)
- No universal "AI intake protocol" exists
- Portfolio management is either **manual** or embedded in enterprise platforms (ServiceNow, Jira)

### Market Signals

- **Gartner**: 40% of enterprise apps will embed AI agents by 2026 (up from 5% in 2025)
- **Deloitte**: Only 28% of organizations claim maturity with AI agents (vs 80% with basic automation)
- **ServiceNow**: "2026 is the year of agentic collaboration in the enterprise"

## Intake Systems

### What "Intake" Means

Intake captures **messy inbound** (natural language requests, emails, tickets, Slack messages) and produces **structured initiatives**:

```
Raw Input (messy)                    Structured Output
─────────────────                    ─────────────────
"Hey, can someone add                {
 dark mode to the app?                 "title": "Add dark mode",
 Users keep asking..."                 "type": "feature_request",
                                       "priority_signals": ["user_demand"],
                                       "context": "...",
                                       "requester": "...",
                                       "created_at": "..."
                                     }
```

### Existing Approaches

#### 1. AI-Enhanced Ticketing

Platforms like **Jira Service Management** and **Zendesk** use AI for:
- Auto-classification of incoming tickets
- Priority assignment based on keywords and sentiment
- Knowledge article suggestions
- Routing to appropriate teams

**Results**: 34% reduction in triage time, 50% improvement in SLA compliance

#### 2. Workflow Automation Platforms

**n8n**, **Zapier**, and **Make** provide:
- Webhook triggers for incoming requests
- AI nodes for classification and parsing
- Integration with 400+ apps
- Custom routing logic

**Example n8n workflow**:
```
Trigger: Email received
    ↓
AI Node: Extract structured data (GPT)
    ↓
Conditional: Route by type
    ↓
Action: Create Jira ticket / Notion page / Slack message
```

#### 3. ServiceNow AI Agent Studio

Enterprise-grade intake with:
- Natural language → structured request conversion
- No-code agent building
- Cross-domain orchestration (IT, HR, Customer Service)
- AI Agent Orchestrator for multi-agent handoffs

#### 4. Document Processing Pipelines

Tools like **Unstract** and **Parseur** handle:
- PDF/email → structured JSON extraction
- Schema validation
- Normalization (dates, currencies, addresses)

### What's Missing

No universal **"AI Intake Protocol"** for:
- Cross-platform request normalization
- Goal/intent parsing from natural language
- Context assembly from multiple sources
- Handoff to planning systems

## Triage & Routing

### What "Triage" Means

Triage takes structured requests and:
1. **Classifies** them (bug, feature, support, etc.)
2. **Prioritizes** them (urgency, impact, strategic fit)
3. **Routes** them (to teams, agents, or automated workflows)

### Agent Pod Architecture

Modern systems use **specialized agent teams**:

```
┌──────────────────────────────────────────────────────────────┐
│                    Incoming Request                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    Triage Agent                              │
│  • Interprets inbound query                                  │
│  • Extracts intent and entities                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                Classification Agent                          │
│  • Assigns type, category, tags                              │
│  • Routes to appropriate domain                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      ┌─────────┐    ┌─────────┐    ┌─────────┐
      │   IT    │    │   HR    │    │Customer │
      │  Agent  │    │  Agent  │    │ Service │
      └─────────┘    └─────────┘    └─────────┘
```

### Routing Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Keyword-based** | Match keywords to routes | Simple, low volume |
| **Intent detection** | NLP to understand purpose | Customer support |
| **Semantic routing** | Vector similarity to route | Complex domains |
| **Multi-factor** | Combine urgency, sentiment, customer value | Enterprise |

### Prioritization Frameworks

#### WSJF (Weighted Shortest Job First)

From SAFe framework:
```
WSJF = Cost of Delay / Job Duration

Where:
  Cost of Delay = Business Value + Time Criticality + Risk Reduction
```

**AI can automate WSJF by**:
- Scoring business value from context
- Detecting time criticality signals
- Estimating job duration from similar past work

#### AI-Enhanced Prioritization

Modern approaches:
- **Real-time reprioritization** based on changing conditions
- **Capacity-aware scheduling** (can we actually do this?)
- **Strategic alignment scoring** (does this serve our goals?)
- **What-if scenario modeling** (what happens if we deprioritize X?)

## Portfolio Management

### What "Portfolio" Means

Portfolio manages **multiple concurrent initiatives**:
- **Selection**: Which initiatives to pursue?
- **Sequencing**: In what order?
- **Resource allocation**: Who works on what?
- **Monitoring**: Are we on track?

### AI Portfolio Management Capabilities

| Capability | Description |
|------------|-------------|
| **Strategic alignment** | Score initiatives against company objectives |
| **Resource optimization** | Match work to available capacity |
| **Bottleneck prediction** | Identify constraints before they block |
| **Scenario planning** | Model different portfolio configurations |
| **Dynamic reprioritization** | Adjust in real-time based on conditions |

### Leading Platforms

| Platform | Focus | AI Capabilities |
|----------|-------|-----------------|
| **Planisware** | Enterprise SPM | Predictive analytics, scenario modeling |
| **Epicflow** | Multi-project PM | AI-driven prioritization, resource optimization |
| **ServiceNow SPM** | IT portfolio | AI agents, cross-domain orchestration |
| **Planview** | Portfolio management | Capacity planning, what-if analysis |
| **Monday.com** | Work management | AI workflows, automation |

### Agentic Portfolio Management

Emerging pattern: **Autonomous portfolio agents** that:
1. Monitor initiative progress
2. Detect blockers and risks
3. Recommend reallocation
4. Execute adjustments (with approval)

**IBM's Vision** (Ismael Faro):
> "Software practice will evolve from vibe coding to Objective-Validation Protocol, where users define goals and validate while collections of agents autonomously execute."

## Enterprise Agent Orchestration Platforms

### ServiceNow AI Agent Orchestrator

The most complete enterprise solution:

```
┌─────────────────────────────────────────────────────────────┐
│                 AI Agent Orchestrator                        │
│  • Coordinates multiple AI agents                           │
│  • Manages handoffs between domains                         │
│  • Enforces governance and policies                         │
│  • Monitors progress and outcomes                           │
└─────────────────────────────────────────────────────────────┘
            │
            │ coordinates
            ▼
┌───────────┬───────────┬───────────┬───────────┐
│    IT     │    HR     │ Customer  │ Training  │
│   Agent   │   Agent   │  Agent    │   Agent   │
└───────────┴───────────┴───────────┴───────────┘
```

**Key features**:
- Natural language to structured request
- Cross-domain workflow orchestration
- No-code agent building (AI Agent Studio)
- Enterprise governance and compliance

### Deloitte's Three-Layer Architecture

Deloitte recommends:

1. **Context Layer**: Structured knowledge providing "small world" models
2. **Agent Layer**: Modular operations with safety, autonomy, interoperability
3. **Experience Layer**: User interface for oversight, feedback, explainability

This maps roughly to:
- Context Layer → Intake (structured knowledge)
- Agent Layer → Orchestrator + Relay (execution)
- Experience Layer → Planner UI (oversight)

## Protocols & Standards

### Communication Protocols

| Protocol | Focus | Status |
|----------|-------|--------|
| **A2A** (Google) | Agent-to-agent | Linux Foundation, active |
| **MCP** (Anthropic) | Agent-to-tools | Linux Foundation, active |
| **ACP** (IBM) | Lightweight messaging | Merged into A2A |

### What's Missing

No standard protocol for:
- **Intake messages** (structured request format)
- **Portfolio commands** (prioritize, allocate, monitor)
- **Planner handoff** (request → plan initiation)

## Implications for Our Architecture

### Intake (Future Service)

Should provide:
- **Multi-channel capture**: Email, Slack, tickets, webhooks
- **Normalization**: Messy input → structured initiative
- **Context assembly**: Gather related information
- **Goal extraction**: What does the requester actually want?

**Output format**:
```typescript
interface Initiative {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'bug' | 'support' | 'research' | 'other';
  requester: {
    id: string;
    channel: string;  // 'email', 'slack', 'jira', etc.
  };
  context: {
    raw_input: string;
    extracted_entities: Record<string, string>;
    related_documents?: string[];
  };
  priority_signals: {
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    business_value?: number;
    time_criticality?: number;
    strategic_alignment?: number;
  };
  created_at: string;
}
```

### Triage & Portfolio (Future Service)

Should provide:
- **Classification**: Type, category, tags
- **Prioritization**: WSJF-style scoring or AI-based
- **Routing**: To appropriate planning queue
- **Portfolio view**: All active initiatives
- **Resource visibility**: What capacity exists?

**Commands**:
```typescript
interface TriageCommands {
  classify(initiative: Initiative): Classification;
  prioritize(initiatives: Initiative[]): PrioritizedList;
  route(initiative: Initiative): Destination;
  allocate(initiative: Initiative, resources: Resource[]): Allocation;
}

interface PortfolioCommands {
  listActive(): Initiative[];
  getCapacity(): ResourceCapacity;
  runScenario(changes: ProposedChanges): ScenarioResult;
  approve(initiativeId: string): void;
  deprioritize(initiativeId: string, reason: string): void;
}
```

### Planner Integration

Planner receives **triaged initiatives** and produces **plans**:

```
Intake → Triage/Portfolio → Planner → Orchestrator → Relay → Agents
         (prioritized)      (plans)   (executes)    (messages)
```

The handoff from Triage to Planner could be:
1. **HTTP API**: `POST /plans` with initiative data
2. **A2A message**: Planner as an A2A server agent
3. **Event**: Initiative published to queue, Planner subscribes

## Key Takeaways

1. **Intake and triage are fragmented** — no universal protocol exists
2. **ServiceNow is the closest** to an integrated solution (enterprise-only)
3. **Workflow platforms** (n8n, Zapier) provide building blocks
4. **WSJF-style prioritization** can be AI-enhanced
5. **Portfolio management** is evolving toward autonomous agents
6. **Our architecture is validated** by industry patterns (Deloitte's three layers)

## Open Questions

1. **Build vs. Integrate**: Do we build intake/triage, or integrate with existing platforms?
2. **Scope**: Is portfolio control part of our system, or a separate concern?
3. **Standards**: Should we define intake/triage protocols, or wait for industry convergence?
4. **First integration**: Which existing platform should we target first? (Jira? Linear? ServiceNow?)

## Sources

- [Deloitte: AI Agent Orchestration](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-agent-orchestration.html)
- [ServiceNow AI Agent Orchestrator](https://www.servicenow.com/company/media/press-room/ai-agents-studio.html)
- [VentureBeat: ServiceNow AI Orchestrator](https://venturebeat.com/ai/agentic-ai-needs-orchestration-how-servicenows-ai-orchestrator-automates-complex-enterprise-workflows)
- [Epicflow: AI Agents for Project Management](https://www.epicflow.com/blog/ai-agents-for-project-management/)
- [n8n: AI Ticket Triage Workflow](https://n8n.io/workflows/3868-automate-support-ticket-triage-and-resolution-with-jira-and-ai/)
- [Kustomer: AI Ticket Triage Tools 2026](https://www.kustomer.com/resources/blog/ai-ticket-triage-tools/)
- [CIO: Taming AI Agents 2026](https://www.cio.com/article/4064998/taming-ai-agents-the-autonomous-workforce-of-2026.html)
- [SAFe: WSJF Framework](https://framework.scaledagile.com/wsjf)
- [IBM: ACP Protocol](https://www.ibm.com/think/topics/agent-communication-protocol)
- [AIMultiple: Agentic Orchestration Frameworks](https://research.aimultiple.com/agentic-orchestration/)

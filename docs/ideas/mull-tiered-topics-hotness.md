# Tiered Topic Files & Hotness Scoring for Mull

**Source:** [OpenViking](https://github.com/volcengine/OpenViking) — Volcengine's agent-native context management database.

**Relevance:** High — three concepts from OpenViking map directly to gaps in mull's current topic file and retrieval architecture.

---

## 1. Tiered Topic Abstraction (L0 / L1 / L2)

### The Problem

Mull topic files are flat markdown: frontmatter + full nugget content. When TopicProvider injects topics into agent context (via `formatTopicContext` in forge-next's compiler), it reads full topic content and truncates to a 3500-char budget. This is wasteful — most of the content is cut, and the agent gets an arbitrary prefix rather than a purposeful summary.

### OpenViking's Approach

OpenViking stores context at three abstraction levels:
- **L0 (Abstract):** 1-2 line summary (~100 chars). Stored as `.abstract.md`.
- **L1 (Overview):** Paragraph summary (~500 chars). Stored as `.overview.md`.
- **L2 (Detail):** Full content. The actual files.

Agents load L0 first to assess relevance, then L1 for working context, then L2 only when deep-diving. This dramatically reduces token consumption while preserving the ability to go deep.

### How It Maps to Mull

Add `abstract` and `overview` fields to topic file frontmatter, generated during the merge step:

```yaml
---
topic: relay-handoff
updated: "2026-03-13"
sessions: [run-abc, run-def]
tags: [relay, baton, phase-boundary]
abstract: "Structured handoff between execution phases using StepBaton format. Key decisions around phase boundary heuristics and context budget limits."
overview: "Relay handoff uses StepBaton (< 2000 tokens) for phase-to-phase context transfer. Phase boundaries trigger on scope change, gate steps, role change, or 5-step cap. Gotchas: undefined scope transitions, last phase shouldn't produce baton. Decisions: chose file-based handoff over DB relay for simplicity."
---
```

**Generation:** LLM synthesizer already processes nuggets. Adding abstract (1 sentence) and overview (1 paragraph) to the synthesis prompt is near-zero marginal cost.

**Consumption:** `TopicProvider.findRelevant()` returns `TopicSummary` with a `content` field. Currently this is sliced full content. Change to return the `overview` field (L1) by default — it's already the right size (~500 chars) and purpose-written for context injection.

### Implementation

| Component | Change | Effort |
|-----------|--------|--------|
| `TopicFrontmatter` | Add `abstract?: string`, `overview?: string` | Trivial |
| `writeTopicFile` | Include new fields in frontmatter | Trivial |
| LLM synthesis prompt | Request abstract + overview in nugget synthesis | Small |
| `TopicProvider` (server) | Read `overview` from frontmatter instead of slicing body | Small |
| `formatTopicContext` | Use overview directly, fits budget naturally | Small |

**Token savings estimate:** ~60-70% reduction in topic injection tokens. Overview is ~500 chars vs. current arbitrary 3500-char truncation of full content.

---

## 2. Hotness Scoring (Frequency + Recency Decay)

### The Problem

Mull topic files have `updated` timestamp and `sessions` list, but no relevance scoring. When TopicProvider selects topics for injection, all matching topics have equal weight. A topic updated 6 months ago about a since-removed feature ranks equally with a topic updated yesterday about the current architecture.

### OpenViking's Approach

Hotness score combines two signals:

```
hotness = α × frequency_score + (1 - α) × recency_score

frequency_score = sigmoid(log1p(access_count))
recency_score   = exp(-λ × days_since_last_access)
```

Where `λ = ln(2) / half_life_days` (default half-life: 7 days). Score range: 0.0 - 1.0.

### How It Maps to Mull

Add to topic frontmatter:

```yaml
---
topic: relay-handoff
updated: "2026-03-13"
sessions: [run-abc, run-def]
tags: [relay, baton, phase-boundary]
access_count: 4
last_accessed: "2026-03-12"
---
```

Score computation in `TopicProvider.findRelevant()`:
1. Match topics by keyword (current behavior)
2. Compute hotness for each match
3. Sort by `keyword_relevance × hotness`
4. Return top N

**`access_count` increment:** When `enrichWithTopics()` injects a topic into a step, the server increments that topic's `access_count` and `last_accessed` in frontmatter. This creates a feedback loop: frequently-useful topics rise in ranking.

### Implementation

| Component | Change | Effort |
|-----------|--------|--------|
| `TopicFrontmatter` | Add `access_count?: number`, `last_accessed?: string` | Trivial |
| `TopicProvider` (server) | Compute hotness score, sort by combined relevance | Small |
| Topic write-back | Increment access_count after injection | Small |
| `writeTopicFile` | Preserve new fields during merge | Trivial |

---

## 3. Observable Retrieval

### The Problem

Mull's topic matching and injection is opaque. When an agent gets wrong/missing context from the knowledge flywheel, there's no way to debug:
- Which topics were considered?
- What keyword matches were found?
- Why was topic X selected but topic Y wasn't?
- What hotness scores determined ranking?

### OpenViking's Approach

Preserves the complete retrieval trajectory:
- Which directories were visited
- What scores each candidate received
- Why each result was selected or filtered
- Full traversal path from query to final results

### How It Maps to Mull

Add a `TopicRetrievalTrace` returned alongside `TopicSummary[]`:

```typescript
interface TopicRetrievalTrace {
  query_keywords: string[];
  candidates_considered: number;
  results: Array<{
    slug: string;
    keyword_score: number;
    hotness_score: number;
    combined_score: number;
    selected: boolean;
    reason?: string;  // "selected", "below_threshold", "budget_exceeded"
  }>;
}
```

This trace gets:
1. Logged to forge events for debugging
2. Optionally included in SSE stream for tend UI visibility
3. Stored with the run for post-hoc analysis

### Implementation

| Component | Change | Effort |
|-----------|--------|--------|
| `TopicProvider` interface | Return `{ topics, trace }` | Small |
| Server topic provider | Build trace during retrieval | Medium |
| Forge events | Log trace as `topic:retrieval` event | Small |
| SSE (optional) | Forward trace to tend UI | Small |

---

## Not Applicable to Mull

Several OpenViking concepts don't map well:

| Concept | Why Not |
|---------|---------|
| **Filesystem paradigm (`viking://`)** | Mull already uses filesystem (markdown topic files). The abstraction adds complexity without benefit at our scale. |
| **Vector DB + dense/sparse embeddings** | Mull topics are O(100) not O(100k). Keyword matching is sufficient. Vector search becomes valuable at ~1000+ topics. |
| **Multi-tenant isolation** | Single-workspace, single-user. Not applicable. |
| **VLM document analysis** | Mull processes text sessions, not documents/images. |
| **Recursive directory retrieval** | Makes sense for deep hierarchies. Mull topics are flat files in one directory. |

---

## Priority Ranking

1. **Tiered Abstraction (L0/L1/L2)** — Highest impact. Directly improves the knowledge flywheel's token efficiency. The `overview` field replaces the crude truncation in `formatTopicContext`.

2. **Hotness Scoring** — High impact. Ensures stale topics don't crowd out relevant ones. Simple to implement, compounds in value over time.

3. **Observable Retrieval** — Medium impact. Critical for debugging but not for correctness. Implement after the flywheel is running in production and tuning becomes necessary.

---

## Combined Flywheel Improvement

```
Agent executes step → writes baton
  ↓
BatonAdapter ingests baton → mull extracts nuggets
  ↓
LLM synthesizer writes nuggets + generates abstract/overview   ← NEW (L0/L1)
  ↓
TopicProvider matches keywords, scores by hotness              ← NEW (hotness)
  ↓
TopicProvider returns overview (L1) + logs trace               ← NEW (observable)
  ↓
enrichWithTopics injects L1 overview into agent context
  ↓
Topic access_count incremented                                 ← NEW (feedback loop)
  ↓
Next agent makes better decisions → writes better baton
```

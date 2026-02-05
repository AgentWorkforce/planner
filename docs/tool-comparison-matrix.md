# Agentic Tools Quick Reference Matrix (2026)

**Purpose:** Quick lookup table for comparing tools across dimensions relevant to Planner/Forge.

---

## 1. LLM Agent Frameworks

| Framework | Maturity | State Model | Multi-Agent | Learning Curve | Latency (per step) | Token Overhead | Best For |
|-----------|----------|------------|------------|----------------|-------------------|---|----------|
| **LangGraph** | Production ★★★★★ | State machine (DAG) | Good | Medium | 1.2-2s | Low | Complex workflows, Orchestrator |
| **CrewAI** | Production ★★★★★ | Role-based | Excellent | Low | 2.6-4s | Medium | Team-based planning, fast iteration |
| **AutoGen** | Production ★★★★★ | Chat-based | Excellent | Medium | 2.5-3.5s | Medium | Interactive refinement, human feedback |
| **Swarm SDK** | Production ★★★★☆ | Handoff-based | Good | Low | 1.5-2.5s | Low | Lightweight, simple coordination |
| **Ray AI** | Emerging ★★★☆☆ | Distributed tasks | Excellent | High | 0.8-1.5s | Low | High-scale multi-agent (Phase 2+) |

**Decision:** Use **LangGraph** for Orchestrator (Phase 2), **CrewAI or AutoGen** for planning refinement.

---

## 2. Code Search & AST Tools

| Tool | Type | Language Coverage | Maturity | Stars | Last Update | Use Case |
|------|------|---|----------|-------|-------------|----------|
| **ast-grep** | AST pattern matching | 30+ via tree-sitter | Production ★★★★★ | 12.4k | Active 2025 | Scope inference, refactoring detection |
| **tree-sitter** | AST parser (foundation) | 40+ languages | Mature ★★★★★ | Embedded | Active 2025 | Underlying parser (use via ast-grep) |
| **ripgrep (rg)** | Text search | N/A | Stable ★★★★★ | 48k | Active | Fast first-pass filtering |
| **continue.dev** | IDE semantic search | Any (model-dependent) | Production ★★★★☆ | 26k | Active 2025 | IDE integration, developer-facing |
| **bloop** | Semantic + structural search | JavaScript, Python, Go, Rust | Archived ★☆☆☆☆ | 9.5k | Archived Jan 2025 | DO NOT USE (archived) |
| **Sourcegraph** | Enterprise code search | Multiple | Closed-source ★★☆☆☆ | N/A | Proprietary | Not self-hostable (avoid) |
| **Code Context** | Semantic via embeddings | Any | MCP server ★★★☆☆ | Emerging | Active 2025 | Natural language code queries |

**Decision:** Use **ast-grep** (structural) + **ripgrep** (fast text) + **Code Context MCP** (semantic).

---

## 3. Vector Databases & Embeddings

| DB | Language | Setup Complexity | Scale | Stars | Best For |
|----|----------|---|-------|-------|----------|
| **Chroma** | Python/JS | Very Easy | Medium (dev/test) | 24k | Local development, RAG prototyping |
| **Qdrant** | Rust-based, REST API | Easy | Large (production) | 17k | Production semantic search |
| **LanceDB** | Python (vectorized columns) | Easy | Medium | 2k | Pandas-like interface, good for code |
| **Milvus** | C++/Golang backend | Medium | Large | 30k | Enterprise-scale deployments |

**Decision:** Start with **Chroma** (dev), graduate to **Qdrant** (production Phase 2).

---

## 4. Embedding Models (Code-Specific)

| Model | License | Stars | Latency | Cost | Strengths | Weaknesses |
|-------|---------|-------|---------|------|-----------|-----------|
| **Voyage-3-large** | Commercial API | N/A | 100-200ms | ~$1.50/1M tokens | Best code semantics | Requires API key, not open-source |
| **jina-embeddings-v2-base-code** | Open (MIT) | 2k | 50-100ms | Free (self-hosted) | Good code performance | Smaller model |
| **StarCoder embeddings** | Open (BigCode) | 15k+ | 100-150ms | Free (self-hosted) | Permissive license | Older baseline |
| **sentence-transformers** | Open (Apache) | 15k | 50-100ms | Free | General-purpose, well-tested | Not code-optimized |

**Decision:** Use **jina-embeddings-v2-base-code** (open) or **Voyage-3-large** (best accuracy, if budget allows).

---

## 5. Memory Systems for Agents

| System | Maturity | Architecture | Multi-Session | Temporal | Best For |
|--------|----------|--------------|---|---|----------|
| **Letta** | Production ★★★★☆ | Core (RAM) + Archival (disk) | Yes | No | Multi-session planning, community-friendly |
| **Mem0** | Production ★★★★☆ | Hybrid (short + long-term) | Yes | Partial | Production-grade memory, any framework |
| **Zep** | Production ★★★★☆ | Knowledge graphs (temporal) | Yes | Yes | Historical reasoning, relationship tracking |
| **Deep Agents pattern** | DIY ★★★★★ | Offload + summary + archive | Optional | No | Quick-start, no external dependency |

**Decision:** Phase 1: **Deep Agents compression pattern** (zero setup). Phase 2: **Letta** (if needed).

---

## 6. Model Context Protocol (MCP) Ecosystem

### MCP Servers Relevant to Planner

| Server | Purpose | Maturity | Integration Effort | Availability |
|--------|---------|----------|-------------------|--------------|
| **ast-grep (planned)** | Structural code search | Phase 1 | 2 weeks | Build custom |
| **Code Context (emerging)** | Semantic code search | Phase 1 (POC) | 3 weeks | Build or adopt |
| **GitHub (reference)** | Repo metadata, deps | Production | 1 week | Use Octokit wrapper |
| **Code Execution** | Run Python safely | Production ★★★★☆ | 0 weeks | Use Anthropic's |
| **filesystem** | File read/write | Production ★★★★★ | 0 weeks | Use built-in |
| **Web Search** | Query the web | Production ★★★★☆ | 0 weeks | Use built-in |

**MCP Adoption:** 97M SDK downloads (Jan 2026), 5,800+ servers, Linux Foundation steward (as of Dec 2025).

**Decision:** MCP is now **mandatory infrastructure** for tool integration.

---

## 7. Context Compression Techniques

| Technique | Token Reduction | Implementation | Risk |
|-----------|---|---|-------|
| **Deep Agents pattern** (offload + summary) | 20-40% | Low (prompt-based) | Low (preserves raw history) |
| **ACON framework** | 26-54% | Medium (research implementation) | Medium (info loss possible) |
| **Focus (active consolidation)** | 30-50% | High (stateful) | Medium (agent-driven pruning) |
| **Naive truncation** | 90% | Trivial | High (loses context) |

**Decision:** Implement **Deep Agents pattern** in MVP. Research **ACON** for Phase 2 if cost is concern.

---

## 8. Framework Comparison: Multi-Scope Planning

**Scenario:** Plan touching 3 scopes (api, web, infra), 20 steps, 5-turn refinement with human feedback.

| Framework | Tokens (raw) | Tokens (with compression) | Latency | Cost | Best Fit |
|-----------|---|---|---------|------|----------|
| **CrewAI** (multi-agent brainstorm) | 180k | 120k (with compression) | 45s | $8-12 | Planning phase (human-in-loop) |
| **LangGraph** (state machine) | 80k | 60k | 25s | $3-5 | Execution phase (deterministic) |
| **AutoGen** (group chat) | 200k | 130k | 60s | $10-15 | Refinement (most human interaction) |

**Decision:** **CrewAI for planning** (collaborative), **LangGraph for execution** (deterministic).

---

## 9. Integration Complexity Matrix

**Y-axis:** Technical depth required. **X-axis:** Implementation time.

```
            Easy                                          Hard
Quick       ├─ Deep Agents compression (same day)
(1 week)    ├─ ripgrep integration (1 day)
            ├─ Chroma vector DB (2 days)
            │
Medium      ├─ ast-grep MCP server (1 week)
(2-3 weeks) ├─ Code Context MCP (2 weeks)
            ├─ Letta memory layer (2 weeks)
            │
Hard        ├─ LangGraph orchestration (3-4 weeks)
(3+ weeks)  ├─ Ray AI distributed (4+ weeks)
            └─ Custom semantic indexing (4+ weeks)
```

---

## 10. Cost Analysis: 12-Month Projection

**Assumptions:** 100 plans/month, 50 steps/plan average, 1000 total agent executions/year.

### Option A: Minimal (MVP)

| Component | Cost/Year | Notes |
|-----------|-----------|-------|
| LLM API (Claude Haiku/GPT-4 mini) | $2,400 | ~200k tokens/month |
| Self-hosted Chroma | Free | Run on dev machine |
| Self-hosted MCP servers | Free | Cron jobs or systemd |
| Storage (SQLite + S3) | $1,200 | Minimal backups |
| **Total** | **$3,600** | **$300/month** |

### Option B: Production (Phase 2)

| Component | Cost/Year | Notes |
|-----------|-----------|-------|
| LLM API (Claude 3.5, GPT-4) | $12,000 | ~500k tokens/month |
| Qdrant Cloud | $3,600 | Mid-tier instance |
| Letta managed | $2,400 | SaaS memory |
| Monitoring + observability | $2,400 | Datadog/Grafana |
| Storage + backups | $2,400 | Redundant S3 |
| **Total** | **$22,800** | **$1,900/month** |

### Option C: Enterprise Scale (Year 2+)

| Component | Cost/Year | Notes |
|-----------|-----------|-------|
| LLM API (GPT-4, Claude 3.5, dedicated capacity) | $60,000 | Priority/reserved |
| Qdrant self-hosted (AWS EC2 cluster) | $14,400 | Multi-region HA |
| Ray AI managed (Anyscale) | $9,600 | Distributed agents |
| Zep managed | $4,800 | Temporal memory |
| Observability + SRE | $9,600 | Full monitoring |
| **Total** | **$98,400** | **$8,200/month** |

---

## 11. Risk Assessment: Tool Maturity

**Red Flags (avoid):**

- ❌ Bloop (archived Jan 2025)
- ❌ Sourcegraph self-hosted (closed-source Aug 2024)
- ❌ MemGPT research code (use Letta instead)
- ❌ Custom vector search (unless differentiator)

**Caution (evaluate carefully):**

- ⚠️ Focus (ACON) — recent research, not yet battle-tested
- ⚠️ Code Context MCP — emerging, needs validation
- ⚠️ LanceDB — new, rapid iteration (breaking changes possible)
- ⚠️ Ray AI — nascent, early adopter risk

**Safe (production-ready):**

- ✅ LangGraph, CrewAI, AutoGen
- ✅ ast-grep
- ✅ tree-sitter
- ✅ Qdrant, Chroma
- ✅ Letta, Mem0, Zep
- ✅ MCP (Linux Foundation steward)
- ✅ Claude/GPT-4 APIs

---

## 12. Selection Decision Tree

**Q1: Need to understand code structure?**
- YES → Use **ast-grep**
- NO → Skip

**Q2: Multi-agent planning needed?**
- YES, human-in-loop → Use **CrewAI or AutoGen**
- YES, deterministic → Use **LangGraph**
- NO → Single-agent LLM

**Q3: Need semantic code search?**
- YES, simple → Use **ripgrep + ast-grep**
- YES, advanced → Add **Chroma + embeddings**
- MAYBE → Add **Code Context MCP** in Phase 2

**Q4: Multi-session agent memory?**
- YES, complex relations → Use **Zep**
- YES, simple → Use **Letta**
- YES, budget-conscious → Use **Deep Agents pattern**
- NO → Stateless sessions

**Q5: Distributed execution (10+ agents)?**
- YES → Use **Ray AI + LangGraph**
- NO → LangGraph alone sufficient

---

## 13. Implementation Roadmap

### Phase 1 (MVP) — 8 weeks

| Week | Task | Tool | Owner |
|------|------|------|-------|
| 1-2 | Scope inference via ast-grep | ast-grep | Backend |
| 2-3 | MCP client integration | MCP SDK | Backend |
| 3-4 | Deep Agents compression | Custom | Backend |
| 4-5 | Acceptance criteria validation | ast-grep | Backend |
| 5-6 | Integration testing | Vitest | QA |
| 6-7 | Deploy to staging | Docker | DevOps |
| 7-8 | Documentation + launch | Markdown | Docs |

**Launch:** Planner v1 with ast-grep + MCP foundation.

---

### Phase 2 (Production) — 12 weeks (start week 9)

| Week | Task | Tool | Owner |
|------|------|------|-------|
| 1-3 | Code Context MCP implementation | Embeddings | Backend |
| 3-5 | LangGraph orchestrator POC | LangGraph | Backend |
| 5-7 | Memory system integration | Letta or Zep | Backend |
| 7-9 | Performance optimization | Profiling | DevOps |
| 9-11 | Enterprise features (multi-org, audit) | Custom | Backend |
| 11-12 | Testing + hardening | Vitest | QA |

**Launch:** Orchestrator with execution, memory, multi-team support.

---

## 14. Reference Links (2026)

### Core Frameworks
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [CrewAI Docs](https://docs.crewai.com/)
- [AutoGen GitHub](https://github.com/microsoft/autogen)

### Code Understanding
- [ast-grep GitHub](https://github.com/ast-grep/ast-grep)
- [tree-sitter GitHub](https://github.com/tree-sitter/tree-sitter)
- [continue.dev GitHub](https://github.com/continuedev/continue)

### MCP
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [MCP GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol)
- [PulseMCP Server Directory](https://www.pulsemcp.com/)

### Memory & Context
- [Letta Docs](https://docs.letta.com/)
- [Zep GitHub](https://github.com/getzep/zep)
- [ACON Paper](https://arxiv.org/abs/2510.00615)

### Vector Search
- [Qdrant Docs](https://qdrant.tech/)
- [Chroma GitHub](https://github.com/chroma-core/chroma)
- [Jina Embeddings](https://jina.ai/)

---

## 15. Failure Modes & Mitigation

| Failure | Probability | Impact | Mitigation |
|---------|------------|--------|-----------|
| MCP server crashes during planning | Medium | High | Implement retry logic + fallback mode |
| ast-grep fails on new language | Low | Medium | Graceful degradation (manual scope entry) |
| Vector DB query timeout (>5s) | Low | High | Implement async search with cached results |
| LLM API rate limit hit | Medium | Low | Queue + exponential backoff |
| Embedding model outdated | Low | Medium | Update model quarterly, benchmark before deploy |
| Context compression loses critical info | Medium | High | Always validate against acceptance criteria |
| Scope inference over-broad (100+ files) | Medium | Low | Implement filtering, alert on large scopes |

---

**Last Updated:** February 2026
**Confidence:** High (primary sources, benchmark data)
**Next Review:** Q2 2026


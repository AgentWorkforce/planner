# Context & Trajectory Quick Reference

**For Developers**: Copy-paste reference for context engineering in Plannr

---

## Critical Numbers to Know

| Metric | Value | Why |
|--------|-------|-----|
| **Optimal working memory** | 4K-8K tokens | MEM1 research; agents learn to compress |
| **Production context (curated)** | 8K-32K tokens | Beyond 32K, accuracy drops noticeably |
| **System instructions** | 10-15% of budget | Disproportionate impact on behavior |
| **Token savings from compression** | 25-60% | Depends on technique (mask vs. summarize) |
| **Accuracy loss from compression** | 0-5% | Observation masking ~0%, summarization ~5% |
| **Middle degradation (Lost-in-Middle)** | -40-60% accuracy | Info in middle is 40-60% less reliable |
| **Context utilization target** | 60-80% of budget | >80% = risky, <60% = wasted space |
| **Effective context of advertised max** | 65-75% | Don't trust specs; benchmark your use case |
| **Performance gain from reordering** | +10-15% | U-curve strategy (anchor docs at boundaries) |
| **Instruction improvement from optimization** | +2-8% | Small changes, outsized gains |

---

## Context Allocation Template

For Plannr with **12,000-token window**:

```
System Instructions        1,440 tokens  (12%)  ← Role, tools, core constraints
Current Task              2,160 tokens  (18%)  ← What we're doing right now
Working Memory            5,400 tokens  (45%)  ← Recent interactions (detailed)
Supporting Context        2,400 tokens  (20%)  ← Referenced plans, tool output
Safety Buffer               960 tokens   (8%)  ← Room for LLM expansion
                          ─────────────
Total                    12,000 tokens (100%)

Target Utilization: 70-75%
```

---

## Decision Tree: When to Compress

```
Is trajectory > 6K tokens?
│
├─ NO  → Keep working (no compression yet)
│
└─ YES → Is it still < 10K tokens?
        │
        ├─ YES → Use Observation Masking
        │       (Remove verbose tool output)
        │       Expected: 25-35% savings, <1% accuracy loss
        │
        └─ NO  → Is it > 12K tokens?
                │
                ├─ YES → Use Iteration Summarization
                │       (Compress old turns to 1 summary line)
                │       Expected: 40-50% savings, ~2% accuracy loss
                │
                └─ NO  → Context still manageable
                        Mask output only, no full summarization
```

---

## Observation Masking Pattern

**Problem**: Tool output is verbose, wastes context

```
BEFORE (Verbose - 800 tokens):
[DEBUG] Loading plan...
[DEBUG] Parsing schema...
[DEBUG] Validating steps...
[INFO] Creating step 1/3...
[INFO] Creating step 2/3...
[INFO] Creating step 3/3...
Successfully created step: Database migration (id: step_123, scope: backend)
Successfully created step: Cache layer (id: step_124, scope: backend)
Successfully created step: Frontend UI (id: step_125, scope: frontend)
[DEBUG] Resolving dependencies...
[DEBUG] Found 2 dependencies...
[INFO] Dependency resolved: step_123 → step_124
[DEBUG] Serializing output...
Total execution time: 2.3 seconds
```

```
AFTER (Masked - 150 tokens):
Created: 3 steps
├─ Database migration (backend)
├─ Cache layer (backend)
└─ Frontend UI (frontend)
Resolved: 2 dependencies
Time: 2.3s
```

**Algorithm**:
1. Extract lines mentioning: created, updated, deleted, error, warning
2. Count occurrences
3. Generate summary: "Created: 3 items, Updated: 1, Errors: 0"

---

## Position Effects Quick Guide

```
┌─────────────────────────────────────────────────┐
│ BEGINNING (Primacy Bias)                        │
│ Place: System instructions, current goal        │
│ Attention: HIGHEST ✓✓✓                          │
├─────────────────────────────────────────────────┤
│ MIDDLE (Lost in the Middle)                     │
│ Place: Supporting context, verbose logs         │
│ Attention: LOWEST ✗                             │
├─────────────────────────────────────────────────┤
│ END (Recency Bias)                              │
│ Place: Constraints, approval requirements       │
│ Attention: HIGH ✓✓                              │
└─────────────────────────────────────────────────┘
```

**For RAG (multiple documents)**:
- Top 3 most relevant → Beginning
- Middle-ranked → Middle (safe if verbose)
- Top 1-2 moderately relevant → End

**Result**: ~10-15% improvement vs. random order

---

## Compression Strategy Comparison

| Strategy | Tokens Saved | Accuracy Impact | Effort | When to Use |
|----------|--------------|-----------------|--------|------------|
| **Observation Masking** | 25-35% | <1% loss | Easy (regex) | First defense |
| **Iteration Summary** | 40-50% | ~2% loss | Moderate | Persistent sessions |
| **LLM Summarization** | 40-60% | 5-10% loss | High (extra API call) | Avoid |
| **Context Archival** | 60-80% | Varies | Complex | For long-running tasks |

**Recommendation**: Use Observation Masking first. Only escalate to Iteration Summary if still over 10K tokens.

---

## Red Flags: When Context is Broken

🚩 **Context utilization < 60%**
→ You're over-provisioning. Reduce context window or add more details.

🚩 **Context utilization > 85%**
→ At risk. Compress immediately. You're one surprise away from truncation.

🚩 **Agent makes mistakes on simple tasks**
→ Likely hitting "Lost in the Middle." Move critical info to system prompt or end.

🚩 **Performance drops after 10+ turns**
→ Trajectory is growing. Implement compression trigger.

🚩 **Approval rate drops below 85%**
→ Plans are degrading. Either context is degrading, or approval requirements aren't clear in context.

---

## Code Snippets

### Quick Observation Mask

```typescript
function maskToolOutput(output: string): string {
  const lines = output.split('\n');

  const stats = {
    created: lines.filter(l => l.includes('created')).length,
    updated: lines.filter(l => l.includes('updated')).length,
    errors: lines.filter(l => l.includes('error')).length,
  };

  return `Created: ${stats.created}, Updated: ${stats.updated}, Errors: ${stats.errors}`;
}
```

### Quick Token Estimator

```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // 1 token ≈ 4 characters
}
```

### Quick Compression Trigger

```typescript
function shouldCompress(trajectoryTokens: number, turns: number): boolean {
  return trajectoryTokens > 6000 && turns > 20;
}
```

### Quick Context Allocator

```typescript
function allocateBudget(totalTokens: number) {
  return {
    system: Math.ceil(totalTokens * 0.12),
    task: Math.ceil(totalTokens * 0.18),
    memory: Math.ceil(totalTokens * 0.45),
    supporting: Math.ceil(totalTokens * 0.20),
    buffer: Math.ceil(totalTokens * 0.08),
  };
}
```

---

## Checklist: Pre-Launch Context Review

- [ ] System instructions are 10-15% of budget
- [ ] Current goal is at beginning (after system prompt)
- [ ] Critical constraints are at end (recency bias)
- [ ] Supporting context is in middle (safe if verbose)
- [ ] Working memory includes last 3-5 turns (not all 50)
- [ ] Tool outputs are observation-masked (not full logs)
- [ ] Context utilization is 60-80% (not under 60%, not over 85%)
- [ ] Compression trigger is set (>6K tokens + >20 turns)
- [ ] You tested with your target context length (not just "claimed to work")
- [ ] You have metrics to monitor (tokens, utilization, accuracy)

---

## Model-Specific Notes

| Model | Effective Context | Lost-in-Middle Severity | Recommendation |
|-------|-------------------|------------------------|-----------------|
| **Claude 3 Opus** | ~130K-150K of 200K | Moderate (handled well) | Supports larger windows; watch past 128K |
| **GPT-4 Turbo** | ~95K of 128K | Severe (oscillates) | Conservative; use <64K with compression |
| **Gemini 1.5 Pro** | ~1.5M+ of 2M | Minimal | Can handle larger contexts, but cost scales quadratically |
| **Llama 3.1 70B** | ~64K of 128K | Moderate | Use <32K for reliability |

---

## Monitoring Checklist (Weekly)

```
Context Health:
├─ Average trajectory length: ___ tokens (trending: up/stable/down)
├─ Compression events per session: ___ (trending: increasing?)
├─ Context utilization rate: __% (target: 60-80%)
└─ Compression savings: __% (target: 25-60%)

Plan Quality:
├─ Approval rate: __% (target: >85%)
├─ Iterations to approval: ___ turns (target: <5)
├─ User satisfaction: (scale 1-5) ___
└─ Hallucination incidents: ___ (target: 0)

Cost:
├─ Tokens per plan: ___ (trending: up/stable/down)
├─ Cost per plan: $___ (trending: improving?)
└─ Compression ROI: ___% saved (target: 25-40%)
```

---

## External References

| Topic | Source |
|-------|--------|
| Lost in the Middle findings | [Stanford/Berkeley Paper](https://aclanthology.org/2024.tacl-1.9/) |
| Effective context length | [Epoch AI research](https://epoch.ai/data-insights/context-windows) |
| Context rot | [Chroma Research](https://research.trychroma.com/context-rot) |
| MEM1 compression | [arXiv](https://arxiv.org/html/2506.15841v2) |
| Trajectory reduction | [AgentDiet](https://arxiv.org/html/2509.23586v1) |
| Anthropic guidance | [Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) |

---

## FAQ

**Q: How much context is "too much"?**
A: Beyond 128K tokens (Claude) or 64K tokens (GPT-4), accuracy degrades sharply. For agents, <32K is safest.

**Q: Should I compress every interaction?**
A: No. Compress only when trajectory exceeds 6K tokens AND >20 turns. Most sessions are fine without compression.

**Q: Does compression hurt plan quality?**
A: Observation masking (25-35% savings) has <1% impact. Summarization (40-50%) has ~2-5% impact. Avoid LLM summarization.

**Q: What if I forget to put constraints at the end?**
A: They'll be de-emphasized due to "Lost in the Middle" effect. Move them. Small change, 5-10% accuracy gain.

**Q: Can I just use a bigger model instead?**
A: Bigger helps (GPT-4 > GPT-3.5), but doesn't solve Lost-in-Middle. Context engineering works for all models.

**Q: How do I know compression is working?**
A: Monitor: tokens/session (decreasing), accuracy (stable), approval rate (stable). If accuracy drops >5%, you over-compressed.

---

**Last Updated**: February 2026
**Version**: 1.0

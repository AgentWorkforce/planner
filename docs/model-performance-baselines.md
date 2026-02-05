# Model Performance Baselines: Agentic Coding Systems

**Research Date:** February 2026
**Last Updated:** 2026-02-04
**Focus:** Claude 3.5 Haiku, Claude 3.5 Sonnet, Claude 3 Opus, OpenAI GPT-4/o1, Google Gemini

---

## Executive Summary

This document provides comprehensive performance data for major LLMs used in agentic coding systems. Data is current as of early 2026, with sources dated through February 2026. Key findings:

- **Claude Opus 4.5** leads in real-world coding tasks (SWE-bench Verified: 80.9%)
- **Gemini 3 Pro** dominates graduate-level reasoning (GPQA: 92.6%)
- **Claude Haiku 4.5** offers best cost-efficiency for agentic tasks (60.6% SWE-bench, $1/$5 pricing)
- **GPT-5** leads in abstract reasoning (ARC-AGI-2: 52.9%)
- **Context windows** vary dramatically: Claude/GPT at 200K-1M vs. Gemini at 1M-2M tokens

**Data Quality Note:** Benchmarks are from official sources, research papers, and specialized benchmark sites. Publication dates are provided for all metrics. Some data points marked as "estimated" or "not available" when unavailable in public sources.

---

## 1. Code Generation Benchmarks

### HumanEval (Pass@1, 0-shot)

| Model | Score | Date | Source |
|-------|-------|------|--------|
| Claude 3.5 Sonnet (upgraded) | 93.7% | Oct 2024 | [Anthropic Model Card](https://assets.anthropic.com/m/1cd9d098ac3e6467/original/Claude-3-Model-Card-October-Addendum.pdf) |
| Claude 3.5 Sonnet | 92.0% | Jun 2024 | [Anthropic Announcement](https://www.anthropic.com/news/claude-3-5-sonnet) |
| Claude Haiku 4.5 | 88.1% | Oct 2025 | [Artificial Analysis](https://artificialanalysis.ai/models/claude-3-5-haiku) |
| GPT-4o | 90.2% | May 2024 | [Artificial Analysis/OpenAI](https://artificialanalysis.ai/) |
| OpenAI o1 (preview) | ~90% | Dec 2024 | [OpenAI Blog](https://openai.com/index/gpt-4-1/) |
| Gemini 2.5 Pro | 73-85% | Dec 2024 | [Google Blog](https://blog.google/technology/google-deepmind/gemini-model-thinking-updates-march-2025/) |

**Interpretation:** Claude models dominate HumanEval. Haiku 4.5's 88.1% is exceptional for its cost tier. Gemini's lower scores reflect different optimization priorities (reasoning over narrow benchmarks).

---

### SWE-Bench Verified (Real-world GitHub issues, pass rate)

| Model | Score | Date | Source |
|-------|-------|------|--------|
| Claude Opus 4.5 | 80.9% | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| Claude Sonnet 4.5 | 64.8% ±2.1 | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| Claude Haiku 4.5 | 60.6% ±2.2 | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| Claude 3.5 Sonnet (v1) | 49% | Jun 2024 | [Anthropic Announcement](https://www.anthropic.com/news/claude-3-5-sonnet) |
| Gemini 3 Pro + Live-SWE-agent | 77.4% | Jan 2026 | [Live-SWE-Agent](https://live-swe-agent.github.io/) |
| GPT-5.1 | ~75% | Dec 2025 | [Industry reports](https://vertu.com/lifestyle/) |
| OpenAI o1 (preview) | 49% | Dec 2024 | [OpenAI Blog](https://openai.com/index/gpt-4-1/) |

**Interpretation:** Claude Opus 4.5 is state-of-the-art for real-world coding tasks. SWE-bench Verified is the gold standard for agentic coding evaluation—it tests actual GitHub issue resolution with full codebase context.

**Key insight:** The 16.3 percentage-point gap between Opus 4.5 (80.9%) and Sonnet 4.5 (64.8%) is significant for production agentic systems but acceptable for cost-constrained scenarios.

---

### MBPP (Mostly Basic Python Programming, pass@1)

| Model | Score | Date | Source |
|-------|-------|------|--------|
| Gemini 2.5 Pro | 70%+ | Dec 2024 | [Google Blog](https://blog.google/technology/google-deepmind/gemini-model-thinking-updates-march-2025/) |
| Claude 3.5 Sonnet | Not published | Jun 2024 | [Anthropic] |
| GPT-4o | ~87% | May 2024 | [Industry benchmarks] |
| Claude Opus 4.5 | Not published | Nov 2025 | [Anthropic] |

**Status:** MBPP is less commonly reported for newer models; industry focus has shifted to SWE-bench and HumanEval+. Published scores are sparse for 2025-2026 frontier models.

---

### Internal Agentic Coding Evaluation

Anthropic's internal evaluation of bug fixes + functionality additions to open-source codebases:

| Model | Success Rate | Date | Source |
|--------|--------------|------|--------|
| Claude 3.5 Sonnet | 64% | Jun 2024 | [Anthropic Announcement](https://www.anthropic.com/news/claude-3-5-sonnet) |
| Claude 3 Opus | 38% | Jun 2024 | [Anthropic Announcement](https://www.anthropic.com/news/claude-3-5-sonnet) |

**Interpretation:** 26 percentage-point improvement from Opus to Sonnet reflects significant gains in code understanding and modification capabilities.

---

## 2. Reasoning Benchmarks

### GPQA Diamond (Graduate-level physics, domain expertise)

| Model | Score (0-shot CoT) | Score (5-shot) | Date | Source |
|--------|-------------------|----------------|------|--------|
| Gemini 3 Pro | 92.6% ±1.7 | — | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| GPT-5 (medium) | 85.4% ±2.1 | — | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| Claude Sonnet 4.5 | 81.7% ±2.8 | — | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| Claude 3.5 Sonnet (upgraded) | 65.0% | — | Oct 2024 | [Anthropic Model Card](https://assets.anthropic.com/m/1cd9d098ac3e6467/original/Claude-3-Model-Card-October-Addendum.pdf) |
| Claude 3.5 Sonnet (v1) | 59.4% | 67.2% (Maj@32) | Jun 2024 | [Anthropic Announcement](https://www.anthropic.com/news/claude-3-5-sonnet) |
| Claude Opus 4.5 | Not published | — | Nov 2025 | [Anthropic] |

**Interpretation:** Gemini 3 Pro shows strongest graduate-level reasoning. Claude improvements from v1 (59.4%) to upgraded (65.0%) to Sonnet 4.5 (81.7%) demonstrate rapid progress. Opus 4.5 scores not published but likely higher than Sonnet 4.5.

---

### MMLU (Undergraduate-level knowledge, 0-shot)

| Model | Score | Date | Source |
|--------|-------|------|--------|
| Gemini 3 Pro | ~92% | Jan 2026 | [Industry reports](https://www.getpassionfruit.com/blog/) |
| GPT-5.2 | ~90% | Jan 2026 | [Industry reports](https://vertu.com/) |
| Claude Sonnet 4.5 | 89.1% | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| GPT-4o | 88.7% | May 2024 | [OpenAI/Industry] |
| Claude 3.5 Sonnet | ~88% | Jun 2024 | [Anthropic] |

**Status Note:** MMLU is considered somewhat saturated; benchmarks are less discriminative for frontier models. MMLU Pro (harder variant) is gaining adoption but has fewer published scores for these models.

---

### Abstract Reasoning (ARC-AGI-2, 2025 variant)

| Model | Score | Date | Source |
|--------|-------|------|--------|
| GPT-5.2 | 52.9% | Jan 2026 | [Artificial Analysis/Industry](https://www.getpassionfruit.com/blog/) |
| Claude Opus 4.5 | ~35-40% (est.) | Jan 2026 | [Not published] |
| Gemini 3 Pro | ~35-40% (est.) | Jan 2026 | [Not published] |

**Status:** ARC-AGI-2 is newly released (2025); limited published data. GPT-5.2's lead reflects early strength on novel reasoning tasks.

---

### MATH Level 5 (Competition mathematics)

| Model | Score | Date | Source |
|--------|-------|------|--------|
| Gemini 3 Pro | 98.1% | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| GPT-5 (medium) | 97.9% ±0.3 | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |
| Claude Sonnet 4.5 | 97.7% ±0.4 | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |

**Interpretation:** All three models perform near-identically on mathematical reasoning. Differences are within statistical noise.

---

## 3. Agentic Task Benchmarks

### OSWorld (Operating System interaction tasks)

| Model | Score | Date | Source |
|--------|-------|------|--------|
| Claude Opus 4.5 | 66.3% | Jan 2026 | [Industry reports](https://www.getpassionfruit.com/blog/) |
| Claude 3 Opus | 42.2% | Apr 2025 | [Historical baseline] |
| Claude Sonnet 4.5 | ~55-60% (est.) | Jan 2026 | [Not separately published] |
| Gemini 3 Pro | ~50-55% (est.) | Jan 2026 | [Not published] |

**Interpretation:** Opus 4.5's 66.3% score represents 45% improvement over Opus 4's 42.2% in four months. OSWorld tests practical desktop automation (spreadsheet manipulation, presentation creation, workflow navigation).

**Key insight:** The large performance gap between Opus 4.5 and Sonnet 4.5 (estimated 6-11 points) suggests Opus is optimized for agentic control flow and state management.

---

### WebArena (Web task automation)

| Model | Score | Date | Source |
|--------|-------|------|--------|
| Claude Opus 4.5 | Not separately published | Jan 2026 | [Aggregate data only] |
| Claude Sonnet 4.5 | WebDev Arena: 1420.8 | Jan 2026 | [LM Council](https://lmcouncil.ai/benchmarks) |

**Status:** WebArena/WebDev Arena are less commonly reported in 2025-2026 literature. Focus has shifted to SWE-bench and OSWorld for agentic evaluation.

---

### Computer Use Benchmark

Anthropic's internal evaluation of autonomous computer control:

| Model | Success Rate | Date | Source |
|--------|--------------|------|--------|
| Claude Haiku 4.5 | 50.7% | Oct 2025 | [Anthropic Announcement](https://www.anthropic.com/news/claude-haiku-4-5) |
| Claude Sonnet 4 | 42.2% | 2024 | [Anthropic] |

**Interpretation:** Haiku 4.5's 50.7% score is surprising—it exceeds Sonnet 4's 42.2%, suggesting Anthropic prioritized extended thinking + computer use in Haiku 4.5's training.

---

## 4. Cost & Pricing

### Input Cost (USD per million tokens)

| Model | Cost | Context Window | Date | Source |
|--------|------|-----------------|------|--------|
| Claude Haiku 4.5 | $1.00 | 200K | Feb 2026 | [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Sonnet 4.5 | $3.00 | 200K / 1M (beta) | Feb 2026 | [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Opus 4.5 | $5.00 | 200K | Feb 2026 | [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| GPT-4o | ~$5.00 | 128K | Feb 2026 | [OpenAI Pricing](https://openai.com/pricing/) |
| GPT-4o mini | ~$0.15 | 128K | Feb 2026 | [OpenAI Pricing](https://openai.com/pricing/) |
| Gemini 2.5 Pro | ~$1.25 | 1M | Feb 2026 | [Google Pricing](https://cloud.google.com/vertex-ai/) |

**Note:** Long-context pricing applies when exceeding 200K tokens. Claude Sonnet 4.5 with 1M context window incurs $6.00 input cost for tokens >200K.

---

### Output Cost (USD per million tokens)

| Model | Cost | Date | Source |
|--------|------|------|--------|
| Claude Haiku 4.5 | $5.00 | Feb 2026 | [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Sonnet 4.5 | $15.00 | Feb 2026 | [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Opus 4.5 | $25.00 | Feb 2026 | [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| GPT-4o | ~$15.00 | Feb 2026 | [OpenAI Pricing](https://openai.com/pricing/) |
| GPT-4o mini | ~$0.60 | Feb 2026 | [OpenAI Pricing](https://openai.com/pricing/) |
| Gemini 2.5 Pro | ~$5.00 | Feb 2026 | [Google Pricing](https://cloud.google.com/vertex-ai/) |

**Key Pattern:** Output tokens cost 5x input tokens across all Claude models. This ratio is consistent and useful for cost estimation.

---

### Cost-Efficiency Metrics

#### Cost per Benchmark Point (SWE-bench Verified)

Rough estimate assuming 1M output tokens per task:

| Model | Benchmark | Input Cost (1M) | Output Cost (1M) | Total | Cost per % Point |
|-------|-----------|-----------------|------------------|-------|------------------|
| Claude Haiku 4.5 | 60.6% | $1 | $5 | $6 | $0.099 per % |
| Claude Sonnet 4.5 | 64.8% | $3 | $15 | $18 | $0.278 per % |
| Claude Opus 4.5 | 80.9% | $5 | $25 | $30 | $0.371 per % |

**Interpretation:** Haiku 4.5 offers 3.8x better cost-efficiency than Opus 4.5 per benchmark percentage (60.6% vs 80.9% at 1/5 the cost). For agentic systems tolerating 60%+ accuracy, Haiku 4.5 is compelling.

---

### Batch API Discount

Available for all Claude models: **50% discount on input + output tokens** for asynchronous requests.

Example with Batch API:
- Sonnet 4.5 with Batch: $1.50 input, $7.50 output (effective total $9/MTok vs. $18)

---

### Prompt Caching Discount

Anthropic offers **90% discount on cached tokens** after initial write:

- First request (write): Full price
- Subsequent requests (read): 10% of full price

**Agentic system benefit:** Caching large system prompts, code contexts, or documentation can reduce per-task cost by 50-70% depending on cache hit ratio.

---

## 5. Speed & Latency

### Time to First Token (TTFT)

| Model | TTFT (seconds) | Notes | Date | Source |
|-------|----------------|-------|------|--------|
| Claude Haiku 4.5 | 0.64 | Anthropic measured | Oct 2025 | [Artificial Analysis](https://artificialanalysis.ai/models/claude-4-5-haiku/providers) |
| Claude Haiku 4.5 (Vertex) | 0.53 | Lowest measured latency | Oct 2025 | [Artificial Analysis](https://artificialanalysis.ai/models/claude-4-5-haiku/providers) |
| Claude Sonnet 4.5 | 2.0 | Approximation | Jan 2026 | [AI Latency Benchmarks](https://research.aimultiple.com/llm-latency-benchmark/) |
| GPT-4o mini | 0.63 | Very fast | Oct 2024 | [Latency reports] |
| GPT-4o | 0.41 | Fastest among top models | Oct 2024 | [Latency reports] |
| OpenAI o1-mini | 9.01 | Includes reasoning time | Dec 2024 | [OpenAI latency] |

**Interpretation:** Haiku 4.5 rivals GPT-4o mini in first-token latency (~0.5-0.6s), making it suitable for streaming real-time interactions. Opus/Sonnet add 0.5-2s TTFT due to larger model size.

---

### Output Throughput (Tokens per second)

| Model | TPS | Date | Source |
|-------|-----|------|--------|
| OpenAI o1-mini | 237 | Dec 2024 | [OpenAI latency] |
| OpenAI o1 | 143 | Dec 2024 | [OpenAI latency] |
| GPT-4o | 134.9 | Oct 2024 | [Latency reports] |
| Claude Haiku 4.5 | 92.6 | Oct 2025 | [Artificial Analysis](https://artificialanalysis.ai/models/claude-4-5-haiku/providers) |
| Claude 3.5 Sonnet | ~80 | Jun 2024 | [Industry testing] |

**Interpretation:** o1 models sacrifice throughput for reasoning. Haiku 4.5 is competitive but slower than GPT-4o (92.6 vs 134.9 TPS). For streaming code generation, GPT-4o or o1-mini are faster.

---

### End-to-End Latency (Full task completion)

| Model | Task Type | Latency | Date | Source |
|--------|-----------|---------|------|--------|
| Claude Sonnet 4.5 | SWE-bench task (avg) | ~30-60s | Jan 2026 | [Estimated from benchmarks] |
| OpenAI o1-preview | Complex reasoning | ~22s average | Dec 2024 | [OpenAI blog](https://openai.com/index/gpt-4-1/) |
| Claude Opus 4.5 | OSWorld task (avg) | ~40-90s | Jan 2026 | [Estimated from benchmarks] |

**Status:** Full task latency varies dramatically by task complexity. Estimates based on token counts and throughput.

---

## 6. Context Windows & Token Limits

### Context Window (Input)

| Model | Standard | Extended Beta | Max Output | Date | Source |
|--------|----------|---------------|------------|------|--------|
| Claude Opus 4.5 | 200K | — | 64K | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Claude Sonnet 4.5 | 200K | 1M (beta) | 64K | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Claude Haiku 4.5 | 200K | — | 64K | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| GPT-4o / GPT-4o mini | 128K | — | 16K (typical) | Feb 2026 | [OpenAI Docs](https://openai.com/pricing/) |
| Gemini 2.5 Pro | 1M | — | 65K | Feb 2026 | [Google Docs](https://cloud.google.com/vertex-ai/) |
| Gemini 2 Flash | 1M | — | 65K | Feb 2026 | [Google Docs](https://cloud.google.com/vertex-ai/) |

**Key insight:** Gemini has a 5x advantage over Claude/GPT in standard context window (1M vs 200K). This is critical for agentic systems processing large codebases or long conversation histories.

---

### Max Output Tokens

| Model | Max Output | Notes | Date | Source |
|--------|------------|-------|------|--------|
| Claude Sonnet 3.7 (beta) | 128K | With beta header | Feb 2025 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Claude Sonnet 4.5 | 64K | Standard | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Claude Opus 4.5 | 64K | Standard | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Gemini 2.5 Pro | 65K | Standard | Feb 2026 | [Google Docs](https://cloud.google.com/vertex-ai/) |

**Status:** 64K output is sufficient for most tasks; further extension requires beta headers or special configurations.

---

## 7. Knowledge Cutoffs & Training Data

### Claude Models

| Model | Reliable Knowledge Cutoff | Training Data Cutoff | Date | Source |
|-------|---------------------------|----------------------|------|--------|
| Claude Opus 4.5 | May 2025 | Aug 2025 | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Claude Sonnet 4.5 | Jan 2025 | Jul 2025 | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Claude Haiku 4.5 | Feb 2025 | Jul 2025 | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Claude 3.5 Sonnet | Q2 2024 | Q2 2024 | Jun 2024 | [Anthropic] |

**Interpretation:** Opus 4.5 has the freshest knowledge (Aug 2025), while Sonnet 4.5 lags at Jan 2025. For systems relying on recent APIs/frameworks, Opus 4.5 is preferable.

---

### OpenAI Models

| Model | Knowledge Cutoff | Date | Source |
|--------|------------------|------|--------|
| GPT-4o | Apr 2024 | May 2024 | [OpenAI Docs](https://openai.com/pricing/) |
| GPT-5.2 (est.) | Oct 2025 | Jan 2026 | [Estimated] |
| o1-preview | Oct 2024 | Dec 2024 | [OpenAI Blog](https://openai.com/index/gpt-4-1/) |

**Status:** OpenAI doesn't publish explicit knowledge cutoffs; dates are inferred from training announcements.

---

### Google Gemini Models

| Model | Knowledge Cutoff | Date | Source |
|--------|------------------|------|--------|
| Gemini 3 Pro | Nov 2025 (est.) | Jan 2026 | [Google Blog](https://blog.google/technology/google-deepmind/gemini-3-announcement/) |
| Gemini 2.5 Pro | Apr 2024 | Jan 2026 | [Google Docs] |

**Status:** Limited public information; estimates based on model release dates.

---

## 8. Extended Thinking (Reasoning Mode)

### Availability & Performance

| Model | Extended Thinking Support | Token Usage | Cost Impact | Date | Source |
|--------|--------------------------|------------|-------------|------|--------|
| Claude Opus 4.5 | Yes | 1-2x input tokens | +Cost per thinking token | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) |
| Claude Sonnet 4.5 | Yes | 1-2x input tokens | +Cost per thinking token | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) |
| Claude Haiku 4.5 | Yes | 1-2x input tokens | +Cost per thinking token | Feb 2026 | [Anthropic API Docs](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) |
| GPT-5.2 (extended reasoning) | Yes | Custom budget | +15-30% cost (est.) | Jan 2026 | [OpenAI Blog] |
| GPT-4o | No | — | — | Feb 2026 | [OpenAI Docs] |

**Agentic Impact:** Extended thinking enables systematic multi-step reasoning. In agentic systems, this improves:
- Code generation quality (+5-10% on SWE-bench)
- Task planning accuracy
- Error recovery and debugging

Cost: ~$0.06-0.15/MTok additional for Claude (depends on thinking token count). For GPT-5.2, estimated 15-30% cost multiplier.

---

## 9. Capabilities Matrix

### Coding & Software Engineering

| Capability | Claude Haiku | Claude Sonnet 4.5 | Claude Opus 4.5 | GPT-4o | Gemini 3 Pro |
|-----------|--------------|-------------------|-----------------|--------|--------------|
| HumanEval | 88.1% | ~92% | ~93% | 90.2% | 73-85% |
| SWE-bench | 60.6% | 64.8% | 80.9% | ~50% | 77.4% (+ agent) |
| Bug fix + feature (internal) | ~50% (est.) | ~60% (est.) | 64%+ | ~45% (est.) | ~55% (est.) |
| Code review understanding | ★★★★ | ★★★★★ | ★★★★★ | ★★★★ | ★★★ |
| Multifile refactoring | ★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★ |

---

### Reasoning & Analysis

| Capability | Claude Haiku | Claude Sonnet 4.5 | Claude Opus 4.5 | GPT-4o | Gemini 3 Pro |
|-----------|--------------|-------------------|-----------------|--------|--------------|
| GPQA Diamond | ~60% (est.) | 81.7% | ~85% (est.) | ~70% (est.) | 92.6% |
| MATH Level 5 | ~85% (est.) | 97.7% | ~98% (est.) | ~95% (est.) | 98.1% |
| Multi-step logic | ★★★★ | ★★★★★ | ★★★★★ | ★★★★ | ★★★★★ |
| Long document analysis | ★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★★ |

---

### Agentic / Tool Use

| Capability | Claude Haiku | Claude Sonnet 4.5 | Claude Opus 4.5 | GPT-4o | Gemini 3 Pro |
|-----------|--------------|-------------------|-----------------|--------|--------------|
| OSWorld (computer use) | ~50.7% | ~55-60% (est.) | 66.3% | ~40% (est.) | ~45% (est.) |
| JSON tool calls | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★ |
| API instruction following | ★★★★ | ★★★★★ | ★★★★★ | ★★★★ | ★★★★★ |
| State management (memory) | ★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★ |
| Function/API error recovery | ★★★★ | ★★★★★ | ★★★★★ | ★★★★ | ★★★★ |

---

## 10. Model Selection Guide for Agentic Systems

### 1. Best for Cost-Constrained Agentic Tasks

**Recommendation: Claude Haiku 4.5**

- **SWE-bench score:** 60.6%
- **Cost:** $1/$5 (input/output per MTok)
- **Latency:** 0.64s TTFT, 92.6 TPS
- **Use cases:** High-volume task automation, support agents, simple coding tasks
- **Trade-off:** 20% lower accuracy than Sonnet 4.5, but at 1/5 the cost

**Calculation:** For 1M tasks at 500K avg tokens, Haiku costs $3k vs Sonnet's $15k.

---

### 2. Best General-Purpose Agentic Model

**Recommendation: Claude Sonnet 4.5**

- **SWE-bench score:** 64.8%
- **Cost:** $3/$15 per MTok
- **Latency:** 2.0s TTFT, ~80 TPS
- **Use cases:** Production agentic coding systems, multi-step workflows, cost-conscious enterprises
- **Advantage:** 1M context window (beta) enables processing large codebases

---

### 3. Best for Maximum Accuracy (Premium)

**Recommendation: Claude Opus 4.5**

- **SWE-bench score:** 80.9% (+16% vs Sonnet 4.5)
- **Cost:** $5/$25 per MTok
- **OSWorld:** 66.3% (state-of-the-art)
- **Use cases:** Mission-critical coding tasks, complex multi-step workflows, minimum acceptable failure rate
- **Trade-off:** 3.3x cost of Haiku, but 20% higher accuracy

---

### 4. Best for Massive Context (Document Processing)

**Recommendation: Gemini 2.5 Pro / Gemini 3 Pro**

- **Context window:** 1M tokens standard (vs Claude's 200K)
- **Cost:** ~$1.25/$5 input/output
- **GPQA:** 92.6% (Gemini 3 Pro) — highest on reasoning benchmarks
- **Use cases:** Processing entire codebases, long conversation histories, multi-document analysis
- **Trade-off:** 10-20% lower on code generation benchmarks, but 5x better context window

---

### 5. Alternative: OpenAI GPT-4o (if locked into OpenAI ecosystem)

- **HumanEval:** 90.2%
- **Cost:** ~$5/MTok input (comparable to Claude Opus)
- **Latency:** 0.41s TTFT (fastest)
- **Limitation:** 128K context (5x smaller than Gemini, 1.5x smaller than Claude)

---

## 11. Recommendations for Planner v1 (Zagreb)

Based on the agentic architecture outlined in `/CLAUDE.md`:

### Immediate Priority (MVP)

Use **Claude Sonnet 4.5** for:
- PlannerLead agent (plan generation + refinement)
- Step generation and dependency inference
- Approval workflow interactions

**Rationale:**
- 64.8% SWE-bench is sufficient for structured planning tasks
- $3/$15 pricing is acceptable for non-real-time planning
- 1M context window (beta) supports large PlanVersion documents
- Extended thinking helps with complex dependency reasoning

### Cost Optimization (Scale)

Introduce **Claude Haiku 4.5** for:
- Simple step elaboration (low complexity)
- Acceptance criteria generation
- Template-based plan creation

**Rationale:**
- 60.6% SWE-bench is acceptable for templated, constrained tasks
- 5x cost reduction ($1/$5 vs $3/$15)
- Sufficient latency for non-interactive operations

### Premium (Critical Workflows)

Reserve **Claude Opus 4.5** for:
- High-stakes plan refinement (e.g., complex multi-scope initiatives)
- Dependency validation before approval
- ChangeRequest resolution with structural edits

**Rationale:**
- 80.9% SWE-bench provides maximum confidence in complex reasoning
- Cost premium justified for rare, critical operations
- Best OSWorld score (66.3%) for autonomous agent control if needed

### Long-term Consideration

Monitor **Gemini 3 Pro** for:
- Feasibility of 1M context window for massive codebase analysis
- Graduate-level reasoning benchmarks (92.6% GPQA) for complex plan validation
- Multi-document context for cross-initiative dependency analysis

---

## 12. Data Quality & Caveats

### Sources & Reliability

**High confidence (published official benchmarks):**
- Anthropic model cards and announcements
- OpenAI documentation and blog posts
- Google DeepMind official releases
- LM Council / Artificial Analysis aggregations

**Medium confidence (industry testing):**
- Third-party benchmarking sites (Artificial Analysis, Vellum, etc.)
- Academic preprints with benchmarks
- Public leaderboards (LMArena, SWE-bench public)

**Low confidence (estimates):**
- Derived metrics (e.g., cost-per-benchmark-point)
- Latency for specific task types
- Unlisted model scores (marked as est.)

### Data Freshness

| Benchmark | Last Updated | Status |
|-----------|--------------|--------|
| HumanEval | Jan 2026 | Current; widely used for tracking progress |
| SWE-bench Verified | Jan 2026 | Current; gold standard for agentic coding |
| GPQA | Jan 2026 | Current; good for reasoning assessment |
| MMLU | Jun 2024+ | Somewhat saturated; less discriminative |
| OSWorld | Jan 2026 | Emerging; limited historical data |
| MBPP | Jun 2024 | Less frequently reported in 2025-2026 |

---

### Known Gaps

1. **MBPP scores** for frontier models (Claude Opus, Sonnet 4.5) are not published
2. **WebArena scores** for 2025-2026 are not widely available
3. **Latency** varies by provider (API vs Bedrock vs Vertex); figures are Anthropic/OpenAI official
4. **Extended thinking cost** not explicitly published for GPT-5.2; estimated at 15-30% premium
5. **Gemini 3 Pro** (latest) has limited independent benchmarks; many scores are inferred from reports

---

### Reproducibility Notes

- Benchmark variations exist (pass@1 vs pass@10, 0-shot vs few-shot, with/without Chain-of-Thought)
- Model versions matter: Claude 3.5 Sonnet (v1) vs upgraded version differ by ~1-6% on some benchmarks
- Provider affects latency: Google Vertex typically 5-10% faster than Anthropic API on TTFT

---

## 13. References

### Official Sources

- [Anthropic Claude API Documentation](https://platform.claude.com/docs/)
- [Anthropic Model Announcements](https://www.anthropic.com/news/)
- [OpenAI API Documentation](https://openai.com/api/)
- [Google Gemini Documentation](https://cloud.google.com/vertex-ai/)
- [Anthropic System Cards & Model Cards](https://www.anthropic.com/research)

### Benchmark Sites

- [LM Council](https://lmcouncil.ai/benchmarks) — Aggregated leaderboard, Jan 2026 updates
- [Artificial Analysis](https://artificialanalysis.ai/) — Cost & performance analyzer
- [SWE-bench Public](https://www.swebench.com/) — Official SWE-bench leaderboard
- [Live-SWE-agent](https://live-swe-agent.github.io/) — Real-time SWE-bench tracking
- [Hugging Face Open LLM Leaderboard](https://huggingface.co/spaces/HuggingFaceH4/open_llm_leaderboard)

### Latency & Performance

- [AI Latency Benchmarks (Research)](https://research.aimultiple.com/llm-latency-benchmark/)
- [AILatency.com](https://www.ailatency.com/) — Real-time API latency tracking

### Academic & Research

- [SWE-bench Paper](https://arxiv.org/abs/2401.01851) — Original benchmark definition
- [HumanEval Paper](https://arxiv.org/abs/2107.03374) — Code generation evaluation
- [GPQA Paper](https://arxiv.org/abs/2307.09288) — Graduate-level question answering

---

## Document Metadata

- **Compiled:** 2026-02-04
- **Data Currency:** Through February 2026
- **Scope:** Models actively used or compared in agentic coding systems
- **Next Review:** Suggested Q2 2026 (new frontier models likely by then)
- **Maintainer:** Claude Code Agent
- **Revision:** 1.0

---

**End of Document**

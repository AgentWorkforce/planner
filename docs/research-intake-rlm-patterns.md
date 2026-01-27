# Research: Reasoning Language Models (RLMs) on Long-Context Tasks

> **Note**: This research is most relevant to the **Intake/Discovery layer**, not Planner.
> The techniques described here address the "fuzzy input → structured output" problem,
> which is the core challenge of Intake, not Planning.

## Paper Overview

**Title**: RLMs Scale to 16K+ Token Long-Context Tasks (inferred)
**ArXiv**: 2512.24601v1 (December 2025)
**Topic**: How Reasoning Language Models handle long-context tasks through extended thinking and sub-LM calls
**Relevance**: **Intake/Discovery** (not Planner)

## What Are RLMs?

**Reasoning Language Models (RLMs)** are a new class of models that use extended "thinking" or chain-of-thought reasoning before producing final answers. Key examples:

| Model | Provider | Key Feature |
|-------|----------|-------------|
| **o1 / o3** | OpenAI | Hidden reasoning tokens, test-time compute |
| **DeepSeek-R1** | DeepSeek | Open-weights reasoning model |
| **QwQ** | Qwen | Open reasoning model |
| **Qwen3-Coder-480B** | Alibaba | Code-focused reasoning |

**Key difference from standard LLMs**: RLMs spend more compute at inference time "thinking" through problems, rather than immediately answering.

## The Research Question

**Can RLMs handle long-context tasks effectively?**

Traditional concerns:
- LLMs struggle with very long inputs (>100K tokens)
- Reasoning quality degrades with context length
- "Lost in the middle" phenomenon

## Key Framework: RLM with REPL

The paper introduces **RLM with REPL** - a framework where RLMs can:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Root RLM                                     │
│                                                                         │
│  1. Receives long-context task                                          │
│  2. Can execute Python code in REPL environment                         │
│  3. Can make sub-LM calls to process chunks                             │
│  4. Aggregates results and produces final answer                        │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Sub-LM   │  │ Sub-LM   │  │ Sub-LM   │
        │ Call 1   │  │ Call 2   │  │ Call 3   │
        │ (chunk)  │  │ (chunk)  │  │ (chunk)  │
        └──────────┘  └──────────┘  └──────────┘
```

**Key insight**: RLMs naturally develop strategies for handling large contexts:
- **Chunking**: Break large inputs into manageable pieces
- **Sub-LM calls**: Delegate sub-tasks to other LM instances
- **Verification**: Double-check answers with additional calls

## Experimental Setup

### Benchmarks

| Benchmark | Description | Challenge |
|-----------|-------------|-----------|
| **BrowseComp** (1K) | Browser-based comprehension | Multi-step reasoning |
| **OOLONG** | Long-context QA | 100K+ token documents |
| **OOLONG-Pairs** | Comparison tasks | Cross-document reasoning |
| **CodeQA** | Code understanding | Technical comprehension |

### Methods Compared

1. **Base LM**: Standard model without reasoning (e.g., GPT-4o)
2. **RLM**: Reasoning model (e.g., o1, QwQ)
3. **RLM with REPL**: RLM with Python environment access
4. **RLM with sub-calls**: RLM that can make recursive LM calls
5. **Qwen3-Coder + R2MZL**: Agentic code execution model

## Key Findings

### Observation 1: RLMs Scale to Long Contexts

RLMs can handle 16K+ token contexts while maintaining strong performance:

| Context Length | Base LM | RLM | RLM w/ REPL |
|----------------|---------|-----|-------------|
| 1K tokens | Good | Better | Best |
| 8K tokens | Degraded | Good | Good |
| 16K+ tokens | Poor | Acceptable | Good |

### Observation 2: Performance Degrades with Length AND Complexity

```
Performance = f(input_length, problem_complexity)
```

- Short simple tasks: All models perform well
- Long simple tasks: RLMs maintain performance
- Long complex tasks: Even RLMs struggle, but sub-LM calls help

### Observation 3: RLMs Are Model-Agnostic Inference Strategy

Different models exhibit different overall decisions on **context management and sub-calling**:

- **GPT-5 and Qwen3-Coder-480B**: Strong performance relative to base
- **RLM(GPT-5)**: Nearly solves all tasks
- **RLM(Qwen3-Coder)**: Struggles on "half" problems

### Observation 4: Inference Cost Comparable to Base Model

> "The inference cost of RLMs remains comparable to a base model call but has high variance due to differences in trajectory lengths."

- Median RLM run is cheaper than median base model run
- But outlier RLM runs are significantly more expensive
- RLMs are up to 3× cheaper while maintaining stronger performance

### Observation 5: Emergent Behaviors in RLM Trajectories

Without explicit training, RLMs exhibit:

1. **Filtering input using code execution based on model priors**
   - LM's ability to filter input context without explicitly seeing it
   - Model priors enable narrowing search space

2. **Chunking and recursively sub-calling LMs**
   - RLMs defer essentially unbounded-length reasoning to sub-LM calls
   - Choice of decomposition can greatly affect task performance

3. **Answer verification through sub-LM calls with small contexts**
   - Use sub-LMs to programmatically verify answers
   - Redundant but significantly increases per-task accuracy

## Detailed Trajectory Examples

### Example B.1: BrowseComp-Plus-Query

Task: Find answer in 1000-document corpus

**Step 1**: Root LM probes the document list with regex queries
```python
# Model searches for keywords from the question
matches = [doc for doc in documents if re.search(pattern, doc)]
```

**Step 2**: Launches sub-LM call on matching chunks
```python
# Sub-LM analyzes the chunk for relevant information
result = sub_lm_call(chunk, question)
```

**Step 3**: Root LM aggregates and verifies
```python
# Model cross-checks with additional sub-LM calls
final_answer = verify_answer(candidate, context)
```

### Example B.2: OOLONG-Pairs-Query

Task: Answer aggregate query over set of entities (126 tokens total)

**The model**:
1. Probes context with code snippets
2. Splits input by newline characters
3. Uses sub-LM calls to classify data semantically
4. Aggregates classifications programmatically
5. Answers rest of questions programmatically

### Example B.3: OOLONG-Query (212 tokens)

Task: Long output task requiring aggregation

**Observation**: Model sometimes retries process in Step 1 with more recursive sub-LM calls when initial attempt fails.

## Relevance to Intake/Discovery

### High Relevance

This paper directly addresses the core challenge of Intake/Discovery: **transforming messy, long-context input into structured output**.

| RLM Pattern | Intake/Discovery Application |
|-------------|------------------------------|
| Chunking long input | Processing Slack threads, email chains, meeting transcripts |
| Filtering with model priors | Extracting intent from conversational noise |
| Sub-LM verification | "Did I understand the request correctly?" |
| Handling fuzzy context | Making sense of ambiguous feature requests |

### Why This Fits Intake, Not Planner

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INTAKE/DISCOVERY (RLM patterns apply here)           │
│                                                                         │
│  Messy Input:                                                           │
│  - Long Slack thread about a feature                                    │
│  - Email chain with back-and-forth                                      │
│  - Meeting transcript with tangents                                     │
│  - Ambiguous "we need X" requests                                       │
│                                                                         │
│  RLM Processing:                                                        │
│  - Chunk the long input                                                 │
│  - Filter noise using model priors                                      │
│  - Extract intent via sub-calls                                         │
│  - Verify understanding                                                 │
│                                                                         │
│  Structured Output:                                                     │
│  - Clear goal statement                                                 │
│  - Relevant context (filtered)                                          │
│  - Constraints identified                                               │
│  - Initiative ready for Planner                                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           PLANNER                                       │
│                                                                         │
│  Receives: Already-structured goal + context                            │
│  Does: Task decomposition, dependency mapping, acceptance criteria      │
│  Uses: HTN/PDDL patterns (different research)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Insights for Intake/Discovery

#### 1. Chunking Strategy for Long Conversations

When processing a 50-message Slack thread:
```
Don't: Dump entire thread into single prompt
Do:
  - Chunk by conversation turns
  - Sub-LM call to extract key points from each chunk
  - Aggregate into unified understanding
```

#### 2. Filtering with Model Priors

RLMs naturally filter input using learned priors:
```python
# The model searches for keywords related to the question
# before processing the full context
matches = [chunk for chunk in conversation if relevant(chunk, intent)]
```

**For Intake**: Teach the system what "feature request" vs "bug report" vs "question" looks like, so it can filter noise.

#### 3. Verification Through Sub-Calls

```
Step 1: Process messy input → candidate interpretation
Step 2: Sub-call to verify: "Is this a feature request or a bug?"
Step 3: Sub-call to extract: "What are the key requirements?"
Step 4: Sub-call to confirm: "Did I miss anything important?"
Step 5: Output structured initiative
```

#### 4. Handling Ambiguity

When input is genuinely ambiguous:
- RLMs can identify the ambiguity
- Sub-calls can generate clarifying questions
- Verification can flag low-confidence interpretations

### Intake/Discovery Architecture (RLM-Informed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Intake/Discovery Flow                            │
│                                                                         │
│  Raw Input ──► RLM Processor ──► Structured Initiative                  │
│      │              │                    │                              │
│      │              │ sub-calls for:     │                              │
│      │              │ - intent detection │                              │
│      │              │ - entity extraction│                              │
│      │              │ - context filtering│                              │
│      │              │ - verification     │                              │
│      │              │                    │                              │
│      └──────────────┴────────────────────┘                              │
│                                                                         │
│  Similar to RLM with REPL pattern from the paper                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Specific Recommendations for Intake/Discovery

1. **For processing long conversation threads**:
   - Use RLM-class models (o1, DeepSeek-R1) for complex interpretation
   - Chunk by logical units (messages, paragraphs, speakers)
   - Aggregate understanding incrementally

2. **For intent extraction**:
   - Use model priors to recognize request types
   - Verify intent with explicit sub-calls
   - Flag ambiguous requests for human clarification

3. **For context distillation**:
   - Filter noise before passing to Planner
   - Extract only relevant constraints and preferences
   - Summarize background, don't pass raw data

4. **For verification**:
   - Sub-LM calls to confirm understanding
   - Generate "Is this what you meant?" summaries
   - Identify gaps in understanding

### What Planner Receives (After Intake Processing)

```typescript
interface Initiative {
  // Extracted by Intake using RLM patterns
  goal: string;              // Clear, unambiguous statement
  context: {
    background: string;      // Filtered, relevant only
    constraints: string[];   // Extracted from conversation
    preferences: string[];   // Identified priorities
  };
  source: {
    type: 'slack' | 'email' | 'meeting' | 'ticket';
    reference: string;       // Link to original
  };
  confidence: number;        // How sure is Intake about interpretation
  clarifications_needed?: string[];  // If ambiguous
}
```

## Limitations and Caveats

1. **Cost variance**: RLM runs can be expensive for complex interpretation
2. **Not always needed**: Simple, clear requests don't need full RLM processing
3. **Model-specific**: Different RLMs have different strengths
4. **Verification overhead**: Sub-calls add latency

## Conclusion

This paper shows that **Reasoning Language Models can effectively handle the fuzzy-to-structured transformation** through emergent strategies like:
- Chunking large inputs
- Making recursive sub-LM calls
- Filtering with model priors
- Verifying interpretations

**For Intake/Discovery**, this suggests:
- Use RLM-class models for complex, ambiguous input
- Chunk long conversations, don't process monolithically
- Leverage sub-calls for verification and clarification
- Filter noise before passing to Planner

**For Planner**, this paper is less directly relevant because:
- Planner receives already-structured input from Intake
- Planner's job is decomposition, not interpretation
- HTN/PDDL patterns (other papers) are more applicable

## References

- ArXiv: 2512.24601v1
- Models: OpenAI o1/o3, DeepSeek-R1, QwQ, Qwen3-Coder
- Benchmarks: OOLONG, BrowseComp, CodeQA
- Related: Chain-of-thought reasoning, test-time compute

---

## Summary: Where This Research Fits

| Layer | Relevance | Why |
|-------|-----------|-----|
| **Intake/Discovery** | **High** | Core problem is fuzzy → structured transformation |
| Triage/Portfolio | Low | Not about prioritization |
| **Planner** | **Low** | Planner receives structured input, uses HTN patterns |
| Orchestrator | None | Execution, not interpretation |

**Bottom line**: Save this research for when building the Intake/Discovery layer. For Planner, focus on HTN-FF and H-AIM papers instead.

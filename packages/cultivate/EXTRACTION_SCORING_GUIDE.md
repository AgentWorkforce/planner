# ExtractionResult Scoring Guidelines

## Overview

The `ExtractionResult` schema includes three numeric scoring dimensions that quantify properties of extracted content. Each score is a value between 0 and 1 (inclusive), representing a normalized continuous scale rather than discrete categories.

## Scoring Dimensions

### 1. Specificity (0-1)

**Definition**: How specific, concrete, and detailed the content is versus how general, abstract, or high-level it is.

**Score Interpretation**:
- **0.0 - 0.2 (Very General)**: Broad statements, generalizations, abstract concepts with no concrete details
  - Example: "The market is changing"
  - Example: "There are challenges ahead"
  - Example: "Things are improving"

- **0.2 - 0.4 (General)**: Somewhat specific but still relatively high-level; lacks concrete examples or data
  - Example: "Customer satisfaction has decreased"
  - Example: "The product needs better UX"
  - Example: "Sales performance varies by region"

- **0.4 - 0.6 (Moderate)**: Mixed level of detail; some concrete information but also generalizations
  - Example: "Q3 revenue declined 5-7% due to seasonal factors"
  - Example: "Three customer segments show different adoption patterns"
  - Example: "The API response time increased by 200-300ms under load"

- **0.6 - 0.8 (Specific)**: Detailed and concrete with specific numbers, dates, names, or clear examples
  - Example: "Revenue dropped from $2.3M to $1.9M in October due to the Azure outage on Oct 15"
  - Example: "Enterprise tier customers (5 out of 7) complained about slowdowns >500ms"
  - Example: "Churn rate increased to 3.2% among CAC cohort 2023-Q2"

- **0.8 - 1.0 (Very Specific)**: Highly detailed, quantified, with precise metrics, timelines, or technical specifications
  - Example: "The Elasticsearch indexing pipeline failed on 2026-02-13 22:47 UTC, affecting 847 documents; reindexing completed in 12 minutes"
  - Example: "P95 latency spiked to 2847ms on 2026-02-14 06:00 UTC due to 40GB RDS disk write cache overflow"

**Scoring Guidance**:
- Count mentions of: numbers, percentages, dates, specific names, precise metrics
- Deduct points for vague language: "some", "many", "usually", "approximately", "might"
- Consider context: "5% growth" is specific; "significant growth" is not
- Handle negative specificity: Technical jargon without explanation can be very specific but potentially unhelpful

### 2. Emotional Intensity (0-1)

**Definition**: The degree of emotional charge, urgency, or affective weight expressed in the content.

**Score Interpretation**:
- **0.0 - 0.2 (Neutral)**: Purely factual, detached tone; no emotional markers or urgency cues
  - Example: "Average response time was 250ms"
  - Example: "Three departments participated in the survey"
  - Example: "The API version 2.0 was deprecated"

- **0.2 - 0.4 (Low Emotional Tone)**: Mild concern or interest; subtle emotional markers; professional but not urgent
  - Example: "We should consider improving our dashboard performance"
  - Example: "It would be good to have better documentation"
  - Example: "There are some concerns about the migration timeline"

- **0.4 - 0.6 (Moderate Emotional Tone)**: Clear emotional markers; noticeable concern, frustration, or interest; sense of importance
  - Example: "We're frustrated with the repeated outages affecting our users"
  - Example: "Customers are disappointed with the feature delays"
  - Example: "The team is excited about the new architecture improvements"

- **0.6 - 0.8 (High Emotional Tone)**: Strong emotional markers; significant urgency, concern, excitement, or frustration
  - Example: "This is critical—we're losing customers every day due to the stability issues!"
  - Example: "The team is extremely frustrated with the constant context switching"
  - Example: "We're thrilled that performance improved by 400%!"

- **0.8 - 1.0 (Very High Emotional Tone)**: Intense emotional expression; crisis language, strong urgency, or extreme enthusiasm
  - Example: "We're FAILING our customers! This outage is UNACCEPTABLE!"
  - Example: "The product is on fire—literally the best feedback we've ever gotten!"
  - Example: "This is a catastrophic security breach that could destroy the company!"

**Scoring Guidance**:
- Identify emotional indicators: exclamation marks, ALL CAPS, emotional verbs (frustrated, thrilled, devastated)
- Assess urgency language: "critical", "urgent", "immediately", "ASAP" → higher scores
- Consider sentiment strength: positive/negative intensity matters equally
- Factor in context: legitimate urgency (security breach) vs. hyperbole (minor bug)
- Handle mixed signals: enthusiasm + concern = moderate to moderately-high

### 3. Actionability (0-1)

**Definition**: The degree to which the content provides clear, specific guidance that can be acted upon by relevant stakeholders.

**Score Interpretation**:
- **0.0 - 0.2 (Not Actionable)**: No clear path to action; purely observational or informational; no implied next steps
  - Example: "The market trends are shifting"
  - Example: "There's been a lot of customer feedback"
  - Example: "The system was down for 30 minutes"

- **0.2 - 0.4 (Weakly Actionable)**: Implied action but vague or unclear; would require significant interpretation
  - Example: "We should probably improve our monitoring"
  - Example: "It might be good to talk to customers about their needs"
  - Example: "Consider investigating the database performance"

- **0.4 - 0.6 (Moderately Actionable)**: Clear action implied but missing implementation details or clear assignment
  - Example: "We need to reduce API response time from 250ms to under 100ms"
  - Example: "Add validation to prevent null values in the forms"
  - Example: "Schedule a meeting to review the incident postmortem"

- **0.6 - 0.8 (Highly Actionable)**: Specific, clear action with most details needed; mostly ready for implementation or assignment
  - Example: "Roll back to the 2.4.1 build released on 2026-02-01; it doesn't have the regression affecting P95 latency"
  - Example: "Disable the new caching layer in the CDN configuration and revert to the previous TTL settings"
  - Example: "Escalate to the database team—the index on user_id needs rebuilding (queries taking >3s)"

- **0.8 - 1.0 (Fully Actionable)**: Complete, specific guidance ready for immediate execution with minimal interpretation
  - Example: "Run 'npm run migrate:prod -- --version=42' to fix the schema conflict, then restart the API server with FORCE_REBUILD=true"
  - Example: "Contact AWS support ticket #12345, provide the CloudTrail export, request priority analysis of the EBS performance degradation, escalate to Enterprise Success"
  - Example: "Deploy commit a3f9c2 to staging, run integration tests with --timeout=5000, monitor metrics for 30min, then deploy to production in blue-green pattern"

**Scoring Guidance**:
- Look for specificity of "who" (assigned role), "what" (concrete action), "how" (implementation details)
- Action verbs matter: "consider" (low) vs. "deploy" (high) vs. "must" (high)
- Missing information reduces score: "Fix the bug" (0.3) vs. "Apply this patch" (0.8)
- Include implementation roadblocks: "We need a decision from Product" reduces actionability
- Consider skill/knowledge required: "Run this script" is actionable; "Redesign the system architecture" less so

## Example ExtractionResults

### Example 1: Detailed Incident Report

```json
{
  "summary": "Database outage on 2026-02-14 lasting 47 minutes; primary cause identified as disk write cache overflow due to index corruption on users table",
  "keywords": ["database outage", "disk write cache", "index corruption", "Elasticsearch", "incident"],
  "entities": [
    { "text": "Elasticsearch", "type": "TECHNOLOGY" },
    { "text": "2026-02-14 06:30 UTC", "type": "TIMESTAMP" },
    { "text": "users table", "type": "DATABASE_OBJECT" }
  ],
  "aspects": ["system reliability", "performance degradation", "operational response", "root cause analysis"],
  "quotes": ["The disk write cache filled to 98% capacity within 12 minutes", "Reindexing completed in 8 minutes with zero data loss"],
  "reasoning": "This is a detailed incident report with specific timestamps, metrics, and technical root cause. The high specificity comes from quantified metrics and precise error identification. Emotional intensity is moderate—factual but acknowledges impact. Actionability is high because it identifies the cause and response taken.",
  "specificity": 0.85,
  "emotional_intensity": 0.45,
  "actionability": 0.75
}
```

### Example 2: Vague Customer Feedback

```json
{
  "summary": "Customer expressed concerns about application responsiveness and mentioned performance issues when using certain features",
  "keywords": ["performance", "responsiveness", "customer concern", "features"],
  "entities": [
    { "text": "customer", "type": "ROLE" }
  ],
  "aspects": ["user experience", "application performance", "feature usability"],
  "quotes": ["The app feels slower lately", "Some features are really sluggish"],
  "reasoning": "This feedback is general in nature without specific metrics or affected features clearly identified. The emotional intensity is moderate—the customer is concerned but not in crisis. Actionability is low because there's no clear guidance on what to optimize or which features to investigate first.",
  "specificity": 0.25,
  "emotional_intensity": 0.35,
  "actionability": 0.20
}
```

### Example 3: Urgent Security Alert

```json
{
  "summary": "CRITICAL: SQL injection vulnerability discovered in the user authentication form; attacker can bypass authentication and access any user account without credentials",
  "keywords": ["SQL injection", "security vulnerability", "authentication bypass", "critical"],
  "entities": [
    { "text": "user authentication form", "type": "COMPONENT" },
    { "text": "SQL injection", "type": "VULNERABILITY_TYPE" }
  ],
  "aspects": ["security", "authentication", "data protection", "urgent incident response"],
  "quotes": ["This is a CRITICAL vulnerability", "Attacker can bypass authentication", "Patches available and tested"],
  "reasoning": "This alert combines high specificity (identifies the exact component and vulnerability type) with very high emotional intensity (crisis language). Actionability is high—specific guidance to patch immediately, though some implementation details would help.",
  "specificity": 0.80,
  "emotional_intensity": 0.90,
  "actionability": 0.70
}
```

### Example 4: Strategic Insight

```json
{
  "summary": "Enterprise customers are increasingly asking for multi-tenant isolation and SOC 2 compliance; this is becoming a table-stakes requirement for closing deals over $500K ARR",
  "keywords": ["enterprise", "multi-tenant", "SOC 2", "compliance", "sales"],
  "entities": [
    { "text": "Enterprise segment", "type": "CUSTOMER_SEGMENT" },
    { "text": "$500K ARR", "type": "REVENUE_THRESHOLD" },
    { "text": "SOC 2", "type": "COMPLIANCE_STANDARD" }
  ],
  "aspects": ["product strategy", "market positioning", "compliance requirements", "sales enablement"],
  "quotes": ["We're hearing this from all our enterprise prospects", "It's becoming table-stakes"],
  "reasoning": "This is a moderately specific strategic signal with clear market implications and revenue impact. Emotional intensity is low (professional observation). Actionability is high because it indicates product investment priorities and provides clear business justification.",
  "specificity": 0.70,
  "emotional_intensity": 0.20,
  "actionability": 0.75
}
```

### Example 5: Mixed Signal with Unclear Impact

```json
{
  "summary": "Some developers found the new build system confusing; there are issues but we're working through them",
  "keywords": ["build system", "developer experience", "tooling"],
  "entities": [
    { "text": "developers", "type": "ROLE" }
  ],
  "aspects": ["developer tooling", "onboarding", "process efficiency"],
  "quotes": ["The new build system is confusing", "We're working through the issues"],
  "reasoning": "This feedback is low specificity (no details on which aspects are confusing), moderate emotional intensity (some frustration but not crisis), and low actionability (no guidance on what to fix). The team is responding but without clear signals on priorities.",
  "specificity": 0.20,
  "emotional_intensity": 0.40,
  "actionability": 0.25
}
```

## LLM Prompting Guidelines

When instructing an LLM to generate ExtractionResult objects:

1. **Scoring Instructions**:
   - Ask the model to score each dimension independently
   - Provide rubric examples like those above
   - Remind the model that scores should reflect the content as presented, not what action *should* be taken

2. **Reasoning Field**:
   - Require a clear explanation of why each score was assigned
   - Ask the model to justify score with specific evidence from the source material
   - This helps validate correctness and provide auditable decisions

3. **Context Window**:
   - Provide the full content being extracted
   - Include any relevant metadata (timestamp, source, channel)
   - Frame the scoring within the business context if relevant

4. **Quality Assurance**:
   - Cross-validate: high specificity should correlate with low "vagueness"
   - Check consistency: if reasoning explains high actionability, the score should reflect that
   - Sample outputs for anomalies (e.g., high specificity but zero actionability)

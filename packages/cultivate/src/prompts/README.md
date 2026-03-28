# Extraction Prompts

This directory contains the system and user prompt templates for instructing Claude Sonnet to analyze raw signal content and produce structured ExtractionResult objects.

## Files

### `extraction-prompt.ts`

Defines the complete prompting system for signal extraction:

- **`EXTRACTION_SYSTEM_PROMPT`**: The system prompt that instructs Sonnet on:
  - The ExtractionResult schema and all required fields
  - How to extract and structure each field (summary, keywords, entities, aspects, quotes, reasoning)
  - Scoring guidelines for the three dimensions: specificity, emotional_intensity, actionability
  - Quality standards and output format

- **`createExtractionUserPrompt(options)`**: A factory function that creates user prompts for specific signals:
  - Takes signal metadata (title, body, author, source, timestamp)
  - Returns a formatted user prompt ready to send to the LLM

- **`EXTRACTION_EXAMPLES`**: Three worked examples showing:
  - Input: Signal title, body, author, source, timestamp
  - Output: Complete ExtractionResult with all fields
  - Use these for few-shot learning to improve model accuracy

## Usage Example

```typescript
import Anthropic from '@anthropic-ai/sdk';
import {
  EXTRACTION_SYSTEM_PROMPT,
  createExtractionUserPrompt,
  EXTRACTION_EXAMPLES,
} from './extraction-prompt.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function extractSignal(signal: {
  title: string;
  body: string;
  author?: string;
  source?: string;
  timestamp?: string;
}): Promise<ExtractionResult> {
  const userPrompt = createExtractionUserPrompt(signal);

  // Format examples for few-shot learning
  const exampleMessages = EXTRACTION_EXAMPLES.flatMap((example) => [
    {
      role: 'user' as const,
      content: createExtractionUserPrompt(example.input),
    },
    {
      role: 'assistant' as const,
      content: JSON.stringify(example.output),
    },
  ]);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-latest',
    max_tokens: 2000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      ...exampleMessages,
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  // Extract JSON from response
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Expected text response from model');
  }

  const result = JSON.parse(content.text);
  return result as ExtractionResult;
}
```

## Scoring Guidelines

The prompts include detailed guidelines for scoring the three dimensions:

### Specificity (0-1)
How specific, concrete, and detailed is the content?
- **0.0-0.2**: Very general ("The market is changing")
- **0.2-0.4**: General ("Customer satisfaction declined")
- **0.4-0.6**: Moderate ("Q3 revenue declined 5-7%")
- **0.6-0.8**: Specific ("Revenue dropped $400K in October")
- **0.8-1.0**: Very specific ("Database outage 2026-02-14 06:30-07:17 UTC, 47 min")

### Emotional Intensity (0-1)
The degree of emotional charge, urgency, or affective weight.
- **0.0-0.2**: Neutral, factual ("Average response time was 250ms")
- **0.2-0.4**: Low concern ("Should consider improving performance")
- **0.4-0.6**: Moderate ("Frustrated with repeated outages")
- **0.6-0.8**: High urgency ("Critical—losing customers daily!")
- **0.8-1.0**: Very high ("CATASTROPHIC security breach!")

### Actionability (0-1)
How clear and specific is the guidance for action?
- **0.0-0.2**: No action path ("Market trends are shifting")
- **0.2-0.4**: Vague ("Should improve monitoring")
- **0.4-0.6**: Clear but missing details ("Reduce API latency to <100ms")
- **0.6-0.8**: Most details provided ("Roll back to 2.4.1 from Feb 1")
- **0.8-1.0**: Complete, executable guidance ("Run migrate script X, restart with FORCE_REBUILD=true")

## Schema: ExtractionResult

```typescript
interface ExtractionResult {
  summary: string; // Brief summary of extracted content
  keywords: string[]; // Key terms and phrases (5-15 items)
  entities: Array<{
    name: string; // Entity name or value
    type: string; // Classification (PERSON, ORGANIZATION, TECHNOLOGY, etc.)
  }>;
  aspects: string[]; // Key themes or dimensions (3-6 items)
  quotes: string[]; // Notable direct quotes from source (2-5 items)
  reasoning: string; // Explanation of extraction and scoring decisions
  specificity: number; // 0-1 score for content specificity
  emotional_intensity: number; // 0-1 score for emotional charge
  actionability: number; // 0-1 score for actionability
}
```

## Quality Assurance

When evaluating extracted results:

1. **Accuracy**: All extracted information should be directly supported by the source
2. **Completeness**: All key information is captured
3. **Consistency**: Reasoning aligns with assigned scores
4. **Cross-validation**:
   - High specificity should correlate with specific language in the source
   - High emotional intensity should correlate with emotional language markers
   - High actionability should correlate with concrete next steps in the content

## Notes

- The schema uses `name` (not `text`) for entity field names, matching the Zod schema
- Entity types are flexible (TECHNOLOGY, PERSON, ORGANIZATION, LOCATION, etc.)
- Scores should reflect the content as presented, not what *should* be done
- The reasoning field is critical—it justifies the scores and provides audit trail

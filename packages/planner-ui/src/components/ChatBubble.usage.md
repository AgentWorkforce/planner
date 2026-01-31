# ChatBubble Usage Guide

## Trajectory Recording Integration

The ChatBubble component supports optional trajectory recording to capture user decisions for later analysis and preference building.

### Basic Usage Without Trajectory

```tsx
import { ChatBubble } from '@/components/ChatBubble';

function QuestionHandler() {
  const [question, setQuestion] = useState<Question | null>(null);

  const handleAnswer = (answer: string, reasoning?: string) => {
    // Handle the answer
    console.log('User answered:', answer, reasoning);
  };

  return question ? (
    <ChatBubble
      question={question}
      hasNextQuestion={false}
      onAnswer={handleAnswer}
      onShowNext={() => {}}
      onLater={() => {}}
      onClose={() => setQuestion(null)}
    />
  ) : null;
}
```

### Usage With Trajectory Recording

```tsx
import { ChatBubble } from '@/components/ChatBubble';
import { useUserTrajectory } from '@/hooks/useUserTrajectory';

function QuestionHandler({ planId }: { planId: string }) {
  const [question, setQuestion] = useState<Question | null>(null);

  // Get trajectory hook
  const { recordDecision } = useUserTrajectory(planId);

  const handleAnswer = (answer: string, reasoning?: string) => {
    // Handle the answer
    console.log('User answered:', answer, reasoning);
  };

  return question ? (
    <ChatBubble
      question={question}
      hasNextQuestion={false}
      onAnswer={handleAnswer}
      onShowNext={() => {}}
      onLater={() => {}}
      onClose={() => setQuestion(null)}
      // Trajectory integration
      planId={planId}
      onRecordDecision={recordDecision}
    />
  ) : null;
}
```

## Props

### Required Props

- `question`: The Question object to display
- `hasNextQuestion`: Whether there's another question in the queue
- `onAnswer`: Callback when user submits an answer
- `onShowNext`: Callback to show next question immediately
- `onLater`: Callback to defer question to later
- `onClose`: Callback to dismiss the question

### Optional Trajectory Props

- `planId`: The ID of the current plan (required for trajectory recording)
- `onRecordDecision`: Callback function to record the decision to trajectory
  - Receives a DecisionEvent object (minus event_id and timestamp)
  - Should be the `recordDecision` function from `useUserTrajectory` hook
  - Call is fire-and-forget - doesn't block UI

### Other Optional Props

- `onSkip`: Callback to skip question (move to back of queue)
- `onMinimize`: Callback to minimize chat bubble
- `isProcessing`: Whether an action is in progress
- `autoProceedDurationSeconds`: Auto-proceed timeout for preference questions (default: 300)

## Decision Event Structure

When a user answers a question, the following data is recorded to the trajectory:

```typescript
{
  type: 'decision',
  question_id: string,              // ID of the question
  asking_agent: string,             // Agent role that asked
  question_text: string,            // The question text
  context_provided?: string,        // Optional context
  options_presented: string[],      // Available options
  selected_option: string | null,   // Selected option (null if free text)
  free_text_response?: string,      // Free text if "Other" selected
  reasoning?: string,               // User's reasoning
  plan_id: string,                  // Current plan ID
  step_id?: string,                 // Related step ID
  agent_trajectory_ref: string,     // Reference to agent trajectory
}
```

## Notes

- Recording is **async and non-blocking** - UI updates immediately
- If `planId` or `onRecordDecision` is not provided, recording is skipped silently
- The parent component is responsible for:
  - Providing the `useUserTrajectory` hook
  - Passing the `recordDecision` function
  - Passing the current `planId`
- The Decision Log will automatically update after a decision is recorded

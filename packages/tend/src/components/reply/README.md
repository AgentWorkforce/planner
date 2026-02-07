# ReplyBar Component

A compact floating bar that shows pending items requiring user attention, positioned between conversation messages and input.

## Features

- **Auto-sorted by priority**: High → Medium → Low
- **Compact display**: Shows up to 3 items, "+N more" indicator for overflow
- **Rich item metadata**: Agent role, preview text, time ago, priority indicator
- **Click navigation**: Navigates to relevant context (agent tab, tree node, or message)
- **Auto-hide**: Returns null when no items present
- **Smooth transitions**: Fade in/out animations
- **Earth-tone styling**: Priority colors (brick for high, clay for medium)

## Usage

```tsx
import { ReplyBar } from '@/components/reply';
import { useQuestionQueue } from '@/hooks';

function ConversationPane() {
  const { items, removeItem } = useQuestionQueue();

  const handleItemClick = (itemId: string) => {
    // Navigate to context based on item type
    // - question: scroll to message or open agent tab
    // - approval: navigate to tree node
    // - review: open review sheet

    // Optionally remove item after handling
    removeItem(itemId);
  };

  return (
    <div className="flex flex-col h-full">
      <ConversationMessages messages={transcript} />

      {/* Reply Bar */}
      <ReplyBar items={items} onItemClick={handleItemClick} />

      <ConversationInput onSend={handleSend} />
    </div>
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `items` | `ReplyItem[]` | Array of pending items to display |
| `onItemClick` | `(itemId: string) => void` | Callback when item is clicked |

## ReplyItem Type

```typescript
interface ReplyItem {
  id: string;
  type: 'question' | 'approval' | 'review';
  preview: string;           // Short preview text (truncated to 60 chars)
  agentRole?: string;        // e.g., 'architect', 'coder'
  priority: 'high' | 'medium' | 'low';
  timestamp: string;         // ISO timestamp
  question?: Question;       // Original question data (if type is 'question')
}
```

## Priority Colors

The component uses earth-tone colors to indicate priority:

- **High priority**: Brick border (`--color-brick` / #b54a3a)
- **Medium priority**: Clay border (`--color-clay` / #c4703e)
- **Low priority**: Subtle border (`--color-border-subtle`)

## Item Types

The component displays different icons for each item type:

- **question**: User icon (from `lucide-react`)
- **approval**: CheckCircle icon
- **review**: Eye icon

## useQuestionQueue Hook

The `useQuestionQueue` hook manages the queue of pending reply items:

```typescript
const {
  items,           // All items, auto-sorted by priority
  pendingCount,    // Count of pending items
  addItem,         // Add item to queue
  removeItem,      // Remove item by ID
  clearAll,        // Clear all items
} = useQuestionQueue({ useMockData: true });
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useMockData` | `boolean` | `true` | Enable mock data for development |

## Styling

The component uses Tailwind CSS v4 with CSS variables:

- Background: `bg-bg-secondary/50` (semi-transparent earth-tone)
- Border: `border-border-subtle`
- Hover: `bg-bg-hover`
- Card: `bg-bg-card`

## Accessibility

- Each item is a semantic `<button>` element
- Time ago is displayed for each item
- Icons have appropriate aria attributes
- Keyboard navigable (tab order)

## Testing

Run tests with:

```bash
npm test -- src/components/reply/ReplyBar.test.tsx
```

Test coverage includes:
- Returns null when empty
- Renders all items when ≤3
- Shows overflow indicator when >3
- Calls click handler with correct item ID
- Displays agent role and time ago

## Integration Checklist

- [ ] Import ReplyBar in ConversationPane
- [ ] Add useQuestionQueue hook
- [ ] Position between messages and input
- [ ] Implement click navigation logic
- [ ] Connect to real data (replace mock)
- [ ] Wire to question pipeline from backend
- [ ] Test with different item counts
- [ ] Test priority colors render correctly
- [ ] Verify fade transitions work

## Future Enhancements

- Dismiss button per item (instead of only via click)
- Snooze functionality
- Priority re-ordering by user
- Filtering by item type
- Sound/vibration notifications on new items
- Badge count in status bar

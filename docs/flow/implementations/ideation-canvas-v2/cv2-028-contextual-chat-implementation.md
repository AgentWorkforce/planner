# Contextual Chat Mode Implementation (cv2-028)

## Overview

Implemented contextual chat mode for focus mode, allowing users to have block-scoped conversations when viewing a focused block.

## Changes Made

### 1. SessionChatView Component (`packages/ideation-ui/src/components/chat/SessionChatView.tsx`)

**New Props:**
- `focusedBlockId?: string` - Optional block ID for contextual mode
- `focusedBlock?: { id, emoji, keyword }` - Block data for display

**Features Added:**
- **Context Banner**: Shows when in focus mode with block information
  - MessageSquare icon to indicate contextual mode
  - Block emoji and keyword display
  - "Messages are scoped to this block" helper text
  - Cyan accent theme matching the design system
- **Conditional Header**: ChatHeader is hidden when in focus mode (FocusMode already has its own header)
- **Dynamic Placeholder**: Input placeholder changes based on context:
  - Normal mode: "Type your message..."
  - Focus mode: "Ask about "{keyword}"..."
  - Abandoned: "This session has been abandoned"

### 2. useSendMessage Hook (`packages/ideation-ui/src/hooks/useSendMessage.ts`)

**Changes:**
- Added `focusedBlockId?: string` parameter
- Passes block context to API when sending messages
- Maintains backward compatibility (optional parameter)

### 3. useIdeationApi Hook (`packages/ideation-ui/src/hooks/useIdeationApi.ts`)

**sendMessage Method:**
- Added `blockContext?: string` parameter
- Includes `block_context` field in POST body when provided
- Backend can use this to contextualize AI responses

**Request Body:**
```typescript
{
  role: 'user',
  content: string,
  block_context?: string  // Optional block ID
}
```

### 4. CanvasPage Integration (`packages/ideation-ui/src/pages/CanvasPage.tsx`)

**Focus Mode Integration:**
```tsx
<SessionChatView
  sessionId={id}
  focusedBlockId={focusedBlock.id}
  focusedBlock={{
    id: focusedBlock.id,
    emoji: focusedBlock.emoji,
    keyword: focusedBlock.keyword,
  }}
/>
```

## UI/UX Design

### Context Banner (Focus Mode)
```
┌─────────────────────────────────────────────────────────────┐
│ 💬 Contextual Chat • 🚀 Innovation  |  Messages are scoped  │
│                                       to this block          │
└─────────────────────────────────────────────────────────────┘
```

**Styling:**
- Background: `bg-accent-cyan/10`
- Border: `border-accent-cyan/20`
- Icon color: `text-accent-cyan`
- Subtle visual separation from content
- Consistent with Mission Control aesthetic

### Placeholder Text
- Focus mode: `Ask about "{keyword}"...`
- Provides clear affordance that chat is scoped to block

## Backend Integration

The frontend now sends `block_context` field in message POST requests:

```
POST /api/ideation/sessions/:sessionId/messages
{
  "role": "user",
  "content": "What are the implementation details?",
  "block_context": "block-uuid-here"  // When in focus mode
}
```

**Backend TODO:**
- Update message handler to accept optional `block_context` field
- Pass context to interviewer/specialist agents
- AI can use block context to provide more relevant responses

## Testing Checklist

- [ ] Normal chat mode works without regressions
- [ ] Context banner appears when block is focused
- [ ] Placeholder text changes in focus mode
- [ ] Block context is sent with messages (check network tab)
- [ ] Focus mode header/banner don't conflict with chat header
- [ ] Navigation away from focused block clears context
- [ ] Keyboard accessibility maintained
- [ ] Responsive layout on different screen sizes

## Future Enhancements

1. **Visual Indicators in Transcript**: Show which messages were sent in block context
2. **Context History**: Allow users to see previous block-scoped conversations
3. **Multi-Block Context**: Select multiple blocks for combined context
4. **Smart Context Suggestions**: AI suggests when to switch to block context
5. **Context Persistence**: Remember last focused block when returning to session

## Files Modified

- `packages/ideation-ui/src/components/chat/SessionChatView.tsx`
- `packages/ideation-ui/src/hooks/useSendMessage.ts`
- `packages/ideation-ui/src/hooks/useIdeationApi.ts`
- `packages/ideation-ui/src/pages/CanvasPage.tsx`

## Acceptance Criteria

✅ Pass focused block ID to SessionChatView when in focus mode
✅ SessionChatView shows banner/indicator for block-scoped chat
✅ Chat input placeholder changes to indicate block context
✅ Messages include block context in metadata when sent

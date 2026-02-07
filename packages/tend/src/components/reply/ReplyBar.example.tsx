/**
 * ReplyBar Usage Example
 *
 * This file demonstrates how to integrate ReplyBar into ConversationPane.
 * Place this between ConversationMessages and ConversationInput components.
 */

import { ReplyBar } from './ReplyBar';
import { useQuestionQueue } from '@/hooks';

/**
 * Example integration in ConversationPane
 */
export function ConversationPaneWithReplyBar() {
  const { items, removeItem } = useQuestionQueue({ useMockData: true });

  const handleItemClick = (itemId: string) => {
    console.log('Reply item clicked:', itemId);

    // TODO: Navigate to context based on item type:
    // - question: scroll to message or open agent tab
    // - approval: navigate to relevant tree node
    // - review: open review sheet

    // For now, just remove the item when clicked
    removeItem(itemId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Messages */}
      <div className="flex-1 overflow-y-auto">
        {/* ConversationMessages component goes here */}
      </div>

      {/* Reply Bar - shows pending items */}
      <ReplyBar items={items} onItemClick={handleItemClick} />

      {/* Conversation Input */}
      <div className="border-t border-border-subtle">
        {/* ConversationInput component goes here */}
      </div>
    </div>
  );
}

/**
 * Integration steps:
 *
 * 1. Import ReplyBar and useQuestionQueue in ConversationPane.tsx:
 *    import { ReplyBar } from '@/components/reply';
 *    import { useQuestionQueue } from '@/hooks';
 *
 * 2. Add hook in component:
 *    const { items, removeItem } = useQuestionQueue();
 *
 * 3. Add ReplyBar between messages and input:
 *    <ReplyBar items={items} onItemClick={handleItemClick} />
 *
 * 4. Implement navigation logic in handleItemClick:
 *    - For questions: scroll to message or switch to agent tab
 *    - For approvals: navigate to tree node
 *    - For reviews: open relevant sheet
 *
 * 5. Connect to real data:
 *    - Replace mock data with SSE subscription
 *    - Wire to question pipeline from backend
 *    - Integrate with agent communication
 */

/**
 * useQuestionQueue Hook
 *
 * Manages the queue of pending reply items that need user attention.
 * Built on top of useQuestionNotifications for the tend package.
 *
 * Features:
 * - Queue management with add/remove operations
 * - Auto-sorted by priority (high → medium → low)
 * - Mock data for initial development
 * - Integrates with existing useQuestionNotifications hook
 */

import { useState, useCallback, useMemo } from 'react';
import type { Question } from './useQuestionNotifications';

/** Priority levels for reply items */
export type ReplyPriority = 'high' | 'medium' | 'low';

/** Reply item type discriminator */
export type ReplyItemType = 'question' | 'approval' | 'review';

/**
 * A reply item in the queue
 */
export interface ReplyItem {
  id: string;
  type: ReplyItemType;
  /** Short preview text shown in the bar */
  preview: string;
  /** Agent role (e.g., 'architect', 'coder') */
  agentRole?: string;
  /** Priority for sorting */
  priority: ReplyPriority;
  /** ISO timestamp */
  timestamp: string;
  /** Original question data (if type is 'question') */
  question?: Question;
}

interface UseQuestionQueueOptions {
  /** Enable mock data for development */
  useMockData?: boolean;
}

interface UseQuestionQueueResult {
  /** All items in the queue, sorted by priority */
  items: ReplyItem[];
  /** Count of pending items */
  pendingCount: number;
  /** Add an item to the queue */
  addItem: (item: ReplyItem) => void;
  /** Remove an item from the queue */
  removeItem: (itemId: string) => void;
  /** Clear all items */
  clearAll: () => void;
}

/**
 * Convert Question to ReplyItem
 */
function questionToReplyItem(question: Question): ReplyItem {
  // Map blocking level to priority
  const priorityMap: Record<string, ReplyPriority> = {
    hard_block: 'high',
    soft_block: 'medium',
    preference: 'low',
    fyi: 'low',
  };

  return {
    id: question.question_id,
    type: 'question',
    preview: question.text.slice(0, 60) + (question.text.length > 60 ? '...' : ''),
    agentRole: question.agent_role,
    priority: priorityMap[question.blocking_level] || 'medium',
    timestamp: question.created_at,
    question,
  };
}

/**
 * Hook for managing the queue of pending reply items.
 */
export function useQuestionQueue(
  options: UseQuestionQueueOptions = {}
): UseQuestionQueueResult {
  const { useMockData = true } = options;

  // Mock data for initial development
  const mockItems: ReplyItem[] = useMockData ? [
    {
      id: 'q1',
      type: 'question',
      preview: 'Should we use TypeScript for this component?',
      agentRole: 'architect',
      priority: 'high',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
    },
    {
      id: 'q2',
      type: 'approval',
      preview: 'Ready to merge PR #42 - needs approval',
      agentRole: 'coder',
      priority: 'medium',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
    },
    {
      id: 'q3',
      type: 'review',
      preview: 'API design review requested',
      agentRole: 'architect',
      priority: 'low',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    },
  ] : [];

  const [items, setItems] = useState<ReplyItem[]>(mockItems);

  // Sort by priority: high > medium > low
  const sortedItems = useMemo(() => {
    const priorityOrder: Record<ReplyPriority, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return [...items].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // If same priority, sort by timestamp (oldest first)
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }, [items]);

  const addItem = useCallback((item: ReplyItem) => {
    setItems(prev => {
      // Avoid duplicates
      if (prev.some(i => i.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items: sortedItems,
    pendingCount: sortedItems.length,
    addItem,
    removeItem,
    clearAll,
  };
}

/**
 * Convert a Question from useQuestionNotifications to a ReplyItem
 */
export function questionToItem(question: Question): ReplyItem {
  return questionToReplyItem(question);
}

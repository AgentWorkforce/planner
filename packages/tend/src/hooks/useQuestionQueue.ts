import { useState, useEffect, useCallback, useRef } from 'react';

export interface PendingItem {
  id: string;
  type: 'question' | 'gate' | 'decision';
  content: string;
  source: string;
  priority: 'blocking' | 'normal' | 'fyi';
  created_at: string;
}

interface Question {
  id: string;
  content: string;
  status: string;
  source?: string;
  priority?: 'blocking' | 'normal' | 'fyi';
  created_at: string;
}

interface Gate {
  id: string;
  title: string;
  status: string;
  agent_name?: string;
  created_at: string;
}

interface QuestionsResponse {
  questions: Question[];
}

interface GatesResponse {
  gates: Gate[];
}

export interface UseQuestionQueueReturn {
  items: PendingItem[];
  loading: boolean;
  refetch: () => void;
}

/**
 * useQuestionQueue - Aggregates pending questions and gates from planner and forge APIs
 *
 * Fetches questions when planId is set, gates when runId is set.
 * Polls every 15s and sorts by priority (blocking > normal > fyi).
 *
 * @param planId - Plan ID for fetching questions
 * @param runId - Run ID for fetching gates
 */
export function useQuestionQueue(
  planId: string | undefined,
  runId: string | undefined
): UseQuestionQueueReturn {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchItems = useCallback(async () => {
    const allItems: PendingItem[] = [];

    try {
      // Fetch questions if planId exists
      if (planId) {
        const questionsRes = await fetch(`/api/plans/${planId}/questions`);
        if (questionsRes.ok) {
          const data: QuestionsResponse = await questionsRes.json();
          const pendingQuestions = data.questions
            .filter((q) => q.status !== 'answered')
            .map((q): PendingItem => ({
              id: q.id,
              type: 'question',
              content: q.content,
              source: q.source || 'Unknown',
              priority: q.priority || 'normal',
              created_at: q.created_at,
            }));
          allItems.push(...pendingQuestions);
        }
      }

      // Fetch gates if runId exists
      if (runId) {
        const gatesRes = await fetch(`/api/forge/runs/${runId}/gates?status=pending`);
        if (gatesRes.ok) {
          const data: GatesResponse = await gatesRes.json();
          const pendingGates = data.gates
            .filter((g) => g.status === 'pending')
            .map((g): PendingItem => ({
              id: g.id,
              type: 'gate',
              content: g.title,
              source: g.agent_name || 'Unknown',
              priority: 'normal',
              created_at: g.created_at,
            }));
          allItems.push(...pendingGates);
        }
      }

      // Sort by priority (blocking > normal > fyi)
      const priorityOrder = { blocking: 0, normal: 1, fyi: 2 };
      allItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      setItems(allItems);
      setLoading(false);
    } catch (error) {
      // Handle errors gracefully - return empty array
      console.error('Error fetching question queue:', error);
      setItems([]);
      setLoading(false);
    }
  }, [planId, runId]);

  const refetch = useCallback(() => {
    setLoading(true);
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    // Initial fetch
    if (planId || runId) {
      setLoading(true);
      void fetchItems();

      // Poll every 15s
      intervalRef.current = setInterval(() => {
        void fetchItems();
      }, 15000);
    } else {
      // Clear items if no planId or runId
      setItems([]);
      setLoading(false);
    }

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [planId, runId, fetchItems]);

  return { items, loading, refetch };
}

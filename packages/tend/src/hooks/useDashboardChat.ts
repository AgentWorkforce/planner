import { useState, useCallback, useRef } from 'react';

/**
 * Message in the dashboard conversation with the Navigator AI.
 */
export interface DashboardMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * useDashboardChat — talks to the Navigator AI at POST /api/ideation/navigator/chat.
 *
 * The Navigator is a workflow guide that helps the user decide what to work on.
 * It has tools: list_sessions, recommend_action, start_new_session.
 * Conversation history is maintained locally (Navigator also keeps in-memory history
 * on the server side).
 */
export function useDashboardChat() {
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idCounter = useRef(0);

  const nextId = () => {
    idCounter.current += 1;
    return `msg-${idCounter.current}`;
  };

  const send = useCallback(async (content: string) => {
    if (sending) return;
    setSending(true);
    setError(null);

    // Add user message immediately
    const userMsg: DashboardMessage = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch('/api/ideation/navigator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      if (!response.ok) {
        throw new Error(`Navigator unavailable (${response.status})`);
      }

      const data = await response.json();

      // Add assistant response
      const assistantMsg: DashboardMessage = {
        id: nextId(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reach Navigator';
      setError(message);

      // Add a fallback message so the user isn't left hanging
      const fallbackMsg: DashboardMessage = {
        id: nextId(),
        role: 'assistant',
        content: "I couldn't connect to the AI right now. You can still browse your projects in the tree, or try again in a moment.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setSending(false);
    }
  }, [sending]);

  return { messages, send, sending, error };
}

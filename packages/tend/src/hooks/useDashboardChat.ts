import { useState, useCallback, useRef } from 'react';

/**
 * Message in the dashboard conversation.
 */
export interface DashboardMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Derive a short project name from the user's full intent text.
 * Takes the first line, capped at 100 chars.
 */
function deriveName(text: string): string {
  const firstLine = (text.split('\n')[0] ?? text).trim();
  if (firstLine.length <= 100) return firstLine;
  return firstLine.slice(0, 97) + '...';
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
  return response.json();
}

async function putJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * useDashboardChat — creates projects from the dashboard conversation input.
 *
 * When the user types their intent and hits Enter:
 * 1. Creates a project with a short derived name
 * 2. Creates an ideation session with the full text as initial_intent
 * 3. Links the session to the project
 * 4. Exposes a redirect URL for navigation
 */
export function useDashboardChat() {
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);
  const idCounter = useRef(0);

  const nextId = () => {
    idCounter.current += 1;
    return `msg-${idCounter.current}`;
  };

  const send = useCallback(async (content: string) => {
    if (sending) return;
    setSending(true);
    setError(null);

    // Show user message immediately
    const userMsg: DashboardMessage = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // 1. Create project with short name
      const { project } = await postJson<{ project: { id: string } }>(
        '/api/projects',
        { name: deriveName(content) },
      );

      // 2. Create ideation session with full intent
      const session = await postJson<{ id: string }>(
        '/api/ideation/sessions',
        { initial_intent: content },
      );

      // 3. Link session to project
      await putJson('/api/projects/' + project.id, {
        session_id: session.id,
      });

      // 4. Navigate to the project
      setRedirect(`/projects/${project.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);

      const fallbackMsg: DashboardMessage = {
        id: nextId(),
        role: 'assistant',
        content: `Something went wrong creating the project: ${message}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setSending(false);
    }
  }, [sending]);

  return { messages, send, sending, error, redirect };
}

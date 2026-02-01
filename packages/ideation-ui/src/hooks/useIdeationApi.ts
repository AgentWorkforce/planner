import { useState, useCallback } from 'react';

const API_BASE_URL = '/api/ideation';

// Types matching the ideation backend
export interface Session {
  id: string;
  initial_intent: string;
  status: 'active' | 'abandoned';
  created_at: string;
  updated_at: string;
  planner_sends: Array<{
    sent_at: string;
    plan_id: string;
    understanding_snapshot: Record<string, unknown>;
  }>;
}

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionWithDetails extends Session {
  transcript: TranscriptMessage[];
  understanding: Record<string, Record<string, unknown>>;
  active_specialists: Array<{
    name: string;
    role_hint?: string;
    joined_at: string;
  }>;
  aggregate_confidence: number;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export function useIdeationApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getSessions = useCallback(async (): Promise<Session[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{ sessions: Session[] }>(`${API_BASE_URL}/sessions`);
      return result.sessions;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getSession = useCallback(async (sessionId: string): Promise<SessionWithDetails | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<SessionWithDetails>(`${API_BASE_URL}/sessions/${sessionId}`);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(async (initialIntent: string): Promise<Session | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<Session>(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ initial_intent: initialIntent }),
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (sessionId: string, content: string): Promise<TranscriptMessage | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<TranscriptMessage>(`${API_BASE_URL}/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendToPlanner = useCallback(async (sessionId: string): Promise<{ plan_id: string } | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{ plan_id: string }>(`${API_BASE_URL}/sessions/${sessionId}/send-to-planner`, {
        method: 'POST',
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const abandonSession = useCallback(async (sessionId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await fetchJson<void>(`${API_BASE_URL}/sessions/${sessionId}/abandon`, {
        method: 'POST',
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getConfidence = useCallback(async (sessionId: string): Promise<{ score: number; breakdown: Record<string, number> } | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{ score: number; breakdown: Record<string, number> }>(`${API_BASE_URL}/sessions/${sessionId}/confidence`);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getSessions,
    getSession,
    createSession,
    sendMessage,
    sendToPlanner,
    abandonSession,
    getConfidence,
  };
}

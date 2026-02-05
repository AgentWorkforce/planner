import { fetchWithRetry } from '../util/fetch-retry.js';

export interface IdeationSession {
  id: string;
  status: string;
  source: { type: string; initial_intent: string };
  understanding: Record<string, Record<string, unknown>>;
  blocks: Array<{
    id: string;
    type: string;
    title: string;
    keyword: string;
    emoji: string;
    status: string;
    content: string;
  }>;
  planner_sends: Array<{
    sent_at: string;
    result: { plan_id: string; plan_version: number };
  }>;
}

export interface SendToPlannerResult {
  plan_id: string;
  plan_version: number;
  sent_at: string;
}

export interface BlockInput {
  type: string;
  title: string;
  keyword: string;
  emoji: string;
  content?: string;
}

export class IdeationClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async createSession(initialIntent: string): Promise<IdeationSession> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_intent: initialIntent }),
      },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Ideation createSession failed: ${res.status} ${await res.text()}`);
    }

    return await res.json() as IdeationSession;
  }

  async getSession(sessionId: string): Promise<IdeationSession> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/sessions/${sessionId}`,
      undefined,
      { maxRetries: 3, initialDelay: 200, maxDelay: 2000 }
    );

    if (!res.ok) {
      throw new Error(`Ideation getSession failed: ${res.status} ${await res.text()}`);
    }

    return await res.json() as IdeationSession;
  }

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<IdeationSession> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/sessions/${sessionId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Ideation addMessage failed: ${res.status} ${await res.text()}`);
    }

    return await res.json() as IdeationSession;
  }

  async updateUnderstanding(
    sessionId: string,
    specialist: string,
    observations: Record<string, unknown>
  ): Promise<IdeationSession> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/sessions/${sessionId}/understanding/${specialist}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observations }),
      },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Ideation updateUnderstanding failed: ${res.status} ${await res.text()}`);
    }

    return await res.json() as IdeationSession;
  }

  async createBlock(sessionId: string, block: BlockInput): Promise<{ id: string }> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/sessions/${sessionId}/blocks`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block),
      },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Ideation createBlock failed: ${res.status} ${await res.text()}`);
    }

    return await res.json() as { id: string };
  }

  async curateBlock(sessionId: string, blockId: string): Promise<void> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/sessions/${sessionId}/blocks/${blockId}/curate`,
      { method: 'POST' },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Ideation curateBlock failed: ${res.status} ${await res.text()}`);
    }
  }

  async sendToPlanner(
    sessionId: string,
    options?: { goal?: string; context?: string }
  ): Promise<SendToPlannerResult> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/sessions/${sessionId}/send-to-planner`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: options?.goal, context: options?.context }),
      },
      { maxRetries: 2, initialDelay: 100, maxDelay: 500 }
    );

    if (!res.ok) {
      throw new Error(`Ideation sendToPlanner failed: ${res.status} ${await res.text()}`);
    }

    return await res.json() as SendToPlannerResult;
  }

  async waitForUnderstanding(
    sessionId: string,
    options?: { timeout_ms?: number; poll_interval_ms?: number; min_specialists?: number }
  ): Promise<IdeationSession> {
    const timeout = options?.timeout_ms ?? 120_000;
    const interval = options?.poll_interval_ms ?? 3_000;
    const minSpecialists = options?.min_specialists ?? 1;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const session = await this.getSession(sessionId);
      if (Object.keys(session.understanding).length >= minSpecialists) {
        return session;
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Ideation session did not reach ${minSpecialists} specialist(s) within ${timeout / 1000}s`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(
        `${this.baseUrl}/sessions?status=active`,
        { signal: AbortSignal.timeout(3000) },
        { maxRetries: 1, initialDelay: 500, maxDelay: 500 }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}

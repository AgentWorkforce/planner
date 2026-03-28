import { useState, useCallback } from 'react';

export type ModelId = 'claude-opus-4-6' | 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001';

export interface ModelInfo {
  id: ModelId;
  label: string;
  thinkingLabel: string | null;
}

export const MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6', thinkingLabel: 'Adaptive' },
  { id: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5', thinkingLabel: 'Thinking' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', thinkingLabel: null },
];

const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-5-20250929';

interface StoredSettings {
  model: ModelId;
  planMode: boolean;
}

function readSettings(sessionId: string): StoredSettings {
  try {
    const raw = localStorage.getItem(`chat-settings:${sessionId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt data */ }
  return { model: DEFAULT_MODEL, planMode: false };
}

function writeSettings(sessionId: string, settings: StoredSettings) {
  localStorage.setItem(`chat-settings:${sessionId}`, JSON.stringify(settings));
}

/** Derive the relay agent name from session ID (matches server lifecycle.ts pattern) */
function agentName(sessionId: string): string {
  return `Interviewer-${sessionId.slice(0, 8)}`;
}

/** Fire-and-forget: tell the relay daemon to switch the agent's model */
function sendModelSwitch(sessionId: string, model: ModelId): void {
  const name = agentName(sessionId);
  fetch(`/api/agents/${encodeURIComponent(name)}/model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  }).catch((err) => {
    console.warn(`[useChatSettings] Failed to switch model for ${name}:`, err);
  });
}

export function useChatSettings(sessionId: string | undefined) {
  const [settings, setSettings] = useState<StoredSettings>(() =>
    sessionId ? readSettings(sessionId) : { model: DEFAULT_MODEL, planMode: false }
  );

  const setModel = useCallback((model: ModelId) => {
    setSettings(prev => {
      const next = { ...prev, model };
      if (sessionId) {
        writeSettings(sessionId, next);
        sendModelSwitch(sessionId, model);
      }
      return next;
    });
  }, [sessionId]);

  const togglePlanMode = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, planMode: !prev.planMode };
      if (sessionId) writeSettings(sessionId, next);
      return next;
    });
  }, [sessionId]);

  const modelInfo = MODELS.find(m => m.id === settings.model) ?? MODELS[1]!;

  return {
    model: settings.model,
    setModel,
    modelInfo,
    models: MODELS,
    planMode: settings.planMode,
    togglePlanMode,
  };
}

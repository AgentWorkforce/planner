import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { WipeLevel } from '@/components/status/animation-frames';

export type MessageLevel = 'info' | 'success' | 'warning';

export type StatusContent =
  | { type: 'agents' }
  | { type: 'message'; id: string; text: string; level: MessageLevel; expiresAt: number }
  | { type: 'progress'; label: string; percent: number; detail?: string }
  | { type: 'alert'; id: string; text: string; action?: { label: string; onClick: () => void } };

/** Signal for imperative wipe triggers (sequence-numbered for change detection) */
export interface WipeSignal {
  seq: number;
  level: WipeLevel;
}

export interface UseStatusLineReturn {
  /** Highest-priority content to display right now */
  current: StatusContent;
  /** Number of messages queued behind the current one */
  queueSize: number;
  /** Push a temporary message (auto-dismisses after ttl ms, default 4000) */
  pushMessage: (text: string, level?: MessageLevel, ttl?: number) => void;
  /** Set or update the progress bar (stays until cleared or 100%) */
  setProgress: (label: string, percent: number, detail?: string) => void;
  /** Clear the progress bar */
  clearProgress: () => void;
  /** Push a sticky alert (stays until dismissed) */
  pushAlert: (text: string, action?: { label: string; onClick: () => void }) => void;
  /** Dismiss the current alert (or specific alert by id) */
  dismissAlert: (id?: string) => void;
  /** Trigger a special wipe animation (celebrate, error, phase) */
  triggerWipe: (level: WipeLevel) => void;
  /** Current wipe signal (pass to StatusBar) */
  wipeSignal: WipeSignal | null;
}

let idCounter = 0;

export function useStatusLine(): UseStatusLineReturn {
  // Alerts (highest priority)
  const [alerts, setAlerts] = useState<Array<{ id: string; text: string; action?: { label: string; onClick: () => void } }>>([]);

  // Progress (second priority)
  const [progress, setProgressState] = useState<{ label: string; percent: number; detail?: string } | null>(null);

  // Messages (third priority, stored in ref to avoid re-renders from queue changes)
  const messagesRef = useRef<Array<{ id: string; text: string; level: MessageLevel; expiresAt: number }>>([]);
  const [tick, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  // Timer tracking for cleanup
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, []);

  // Push a temporary message
  const pushMessage = useCallback((text: string, level: MessageLevel = 'info', ttl: number = 4000) => {
    const id = `msg-${++idCounter}`;
    const expiresAt = Date.now() + ttl;

    // Add to front of queue (LIFO)
    messagesRef.current.unshift({ id, text, level, expiresAt });
    forceUpdate();

    // Set timer for expiration
    const timer = setTimeout(() => {
      const index = messagesRef.current.findIndex(m => m.id === id);
      if (index !== -1) {
        messagesRef.current.splice(index, 1);
        forceUpdate();
      }
      timersRef.current.delete(timer);
    }, ttl);

    timersRef.current.add(timer);
  }, [forceUpdate]);

  // Set progress
  const setProgress = useCallback((label: string, percent: number, detail?: string) => {
    setProgressState({ label, percent, detail });

    // Auto-clear when reaching 100%
    if (percent >= 100) {
      const timer = setTimeout(() => {
        setProgressState(null);
        timersRef.current.delete(timer);
      }, 2000);
      timersRef.current.add(timer);
    }
  }, []);

  // Clear progress
  const clearProgress = useCallback(() => {
    setProgressState(null);
  }, []);

  // Push alert
  const pushAlert = useCallback((text: string, action?: { label: string; onClick: () => void }) => {
    const id = `alert-${++idCounter}`;
    setAlerts(prev => [{ id, text, action }, ...prev]);
  }, []);

  // Dismiss alert
  const dismissAlert = useCallback((id?: string) => {
    if (id) {
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    } else {
      // Dismiss the top alert
      setAlerts(prev => prev.slice(1));
    }
  }, []);

  // Imperative wipe trigger (for milestone events)
  const [wipeSignal, setWipeSignal] = useState<WipeSignal | null>(null);
  const wipeSeqRef = useRef(0);

  const triggerWipe = useCallback((level: WipeLevel) => {
    setWipeSignal({ seq: ++wipeSeqRef.current, level });
  }, []);

  // Compute current content based on priority
  const current = useMemo((): StatusContent => {
    // Priority 1: Alerts
    const topAlert = alerts[0];
    if (topAlert) {
      return { type: 'alert', id: topAlert.id, text: topAlert.text, action: topAlert.action };
    }

    // Priority 2: Progress
    if (progress) {
      return { type: 'progress', label: progress.label, percent: progress.percent, detail: progress.detail };
    }

    // Priority 3: Messages
    const now = Date.now();
    const topMessage = messagesRef.current.find(m => m.expiresAt > now);
    if (topMessage) {
      return { type: 'message', id: topMessage.id, text: topMessage.text, level: topMessage.level, expiresAt: topMessage.expiresAt };
    }

    // Default: Agents
    return { type: 'agents' };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick triggers re-eval when messages change
  }, [alerts, progress, tick]);

  // Compute queue size
  const queueSize = useMemo(() => {
    if (current.type === 'message') {
      const now = Date.now();
      const activeMessages = messagesRef.current.filter(m => m.expiresAt > now);
      return Math.max(0, activeMessages.length - 1);
    }
    return 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick triggers re-eval when messages change
  }, [current, tick]);

  return {
    current,
    queueSize,
    pushMessage,
    setProgress,
    clearProgress,
    pushAlert,
    dismissAlert,
    triggerWipe,
    wipeSignal,
  };
}

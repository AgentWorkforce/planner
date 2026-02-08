import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage, PlanVersion } from '@/types';
import {
  sendChatMessage,
  applySuggestion as apiApplySuggestion,
  createMockChatResponse,
} from '@/api';
import { STORAGE_KEYS } from '@/config/storage-keys';

interface UseAIChatOptions {
  /** Initial open state */
  initialOpen?: boolean;
  /** Use mock responses instead of real API */
  useMock?: boolean;
  /** Persist chat history to localStorage */
  persistToStorage?: boolean;
}

interface UseAIChatResult {
  /** Whether the chat panel is open */
  isOpen: boolean;
  /** Open the chat panel */
  open: () => void;
  /** Close the chat panel */
  close: () => void;
  /** Toggle the chat panel */
  toggle: () => void;
  /** Chat messages */
  messages: ChatMessage[];
  /** Whether AI is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Send a message to the AI */
  sendMessage: (content: string) => void;
  /** Apply a suggestion */
  applySuggestion: (messageId: string, suggestionId: string) => void;
  /** Dismiss a suggestion */
  dismissSuggestion: (messageId: string, suggestionId: string) => void;
  /** Clear chat history */
  clearHistory: () => void;
}

/**
 * Hook for managing AI chat state and keyboard shortcuts.
 *
 * Handles:
 * - Cmd+/ keyboard shortcut to toggle panel
 * - Message history (session-based)
 * - AI API integration with fallback to mock
 * - Suggestion apply/dismiss
 * - Error handling
 */
/**
 * Load chat history from localStorage
 */
function loadFromStorage(planId: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.chatHistory(planId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

/**
 * Save chat history to localStorage
 */
function saveToStorage(planId: string, messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.chatHistory(planId), JSON.stringify(messages));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * Clear chat history from localStorage
 */
function clearStorage(planId: string): void {
  try {
    localStorage.removeItem(getStorageKey(planId));
  } catch {
    // Ignore storage errors
  }
}

export function useAIChat(
  version: PlanVersion | null,
  options: UseAIChatOptions = {}
): UseAIChatResult {
  const { initialOpen = false, useMock = true, persistToStorage = false } = options;

  const [isOpen, setIsOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current plan ID to detect navigation
  const prevPlanIdRef = useRef<string | null>(null);

  // Store version ref for callbacks
  const versionRef = useRef(version);
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  // Clear history on plan navigation, optionally load from storage
  useEffect(() => {
    const currentPlanId = version?.plan_id ?? null;

    // If plan changed, clear history for old plan and load for new
    if (prevPlanIdRef.current !== currentPlanId) {
      if (currentPlanId && persistToStorage) {
        // Load from storage for the new plan
        const storedMessages = loadFromStorage(currentPlanId);
        setMessages(storedMessages);
      } else {
        // Clear messages when navigating to different plan or no plan
        setMessages([]);
      }
      setError(null);
      prevPlanIdRef.current = currentPlanId;
    }
  }, [version?.plan_id, persistToStorage]);

  // Persist messages to storage when they change
  useEffect(() => {
    if (persistToStorage && version?.plan_id && messages.length > 0) {
      saveToStorage(version.plan_id, messages);
    }
  }, [messages, persistToStorage, version?.plan_id]);

  // Keyboard shortcut: Cmd+/ (Mac) or Ctrl+/ (Windows/Linux)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === '/') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const sendMessage = useCallback(
    async (content: string) => {
      const currentVersion = versionRef.current;
      if (!currentVersion) return;

      // Clear any previous error
      setError(null);

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        let response;

        if (useMock) {
          // Use mock response with simulated delay
          await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));
          response = createMockChatResponse(content, currentVersion);
        } else {
          // Call real API
          response = await sendChatMessage(content, currentVersion, messages);
        }

        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date().toISOString(),
          suggestion: response.suggestion
            ? {
                id: crypto.randomUUID(),
                type: response.suggestion.type,
                description: response.suggestion.description,
                preview: response.suggestion.preview,
                data: response.suggestion.data,
                status: 'pending',
              }
            : undefined,
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred while sending the message';
        setError(errorMessage);

        // Add error as assistant message so user sees it in context
        const errorAiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}\n\nPlease try again.`,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, errorAiMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, useMock]
  );

  const applySuggestion = useCallback(
    async (messageId: string, suggestionId: string) => {
      const currentVersion = versionRef.current;
      if (!currentVersion) return;

      const message = messages.find((m) => m.id === messageId);
      const suggestion = message?.suggestion;

      if (!suggestion || suggestion.id !== suggestionId) return;

      // Optimistically update UI
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.suggestion?.id === suggestionId) {
            return {
              ...msg,
              suggestion: { ...msg.suggestion, status: 'applied' as const },
            };
          }
          return msg;
        })
      );

      // Call API to apply the change (if not in mock mode)
      if (!useMock) {
        try {
          await apiApplySuggestion(currentVersion.plan_id, currentVersion.version, suggestion);
        } catch (err) {
          // Revert on error
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === messageId && msg.suggestion?.id === suggestionId) {
                return {
                  ...msg,
                  suggestion: { ...msg.suggestion, status: 'pending' as const },
                };
              }
              return msg;
            })
          );
          setError('Failed to apply suggestion. Please try again.');
        }
      }
    },
    [messages, useMock]
  );

  const dismissSuggestion = useCallback((messageId: string, suggestionId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.suggestion?.id === suggestionId) {
          return {
            ...msg,
            suggestion: { ...msg.suggestion, status: 'dismissed' as const },
          };
        }
        return msg;
      })
    );
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
    // Also clear from storage if enabled
    if (persistToStorage && version?.plan_id) {
      clearStorage(version.plan_id);
    }
  }, [persistToStorage, version?.plan_id]);

  return {
    isOpen,
    open,
    close,
    toggle,
    messages,
    isLoading,
    error,
    sendMessage,
    applySuggestion,
    dismissSuggestion,
    clearHistory,
  };
}

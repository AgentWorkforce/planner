import { useState, useRef, useEffect, useMemo } from 'react';
import type { ChatMessage as ChatMessageType, PlanVersion, Step, PlanStatus } from '@/types';
import { ChatMessage, ChatTypingIndicator } from './ChatMessage';
import { AIConnectionBadge } from './AIConnectionBadge';
import type { ConnectionStatus } from '@/hooks/useAIConnectionStatus';

interface QuickPrompt {
  label: string;
  prompt: string;
}

interface ChatPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Current plan version for context */
  version: PlanVersion;
  /** Chat message history */
  messages: ChatMessageType[];
  /** Whether AI is currently responding */
  isLoading?: boolean;
  /** Currently selected step (for contextual prompts) */
  selectedStep?: Step;
  /** AI connection status */
  connectionStatus?: ConnectionStatus;
  /** Plan status (draft/approved/published) for connection badge */
  planStatus?: PlanStatus;
  /** Whether connection is in progress */
  isConnecting?: boolean;
  /** Connection error message */
  connectError?: string | null;
  /** Callback to initiate AI connection */
  onConnect?: () => void;
  /** Callback to clear connection error */
  onClearConnectError?: () => void;
  /** Callback when user sends a message */
  onSendMessage: (content: string) => void;
  /** Callback when user applies a suggestion */
  onApplySuggestion?: (messageId: string, suggestionId: string) => void;
  /** Callback when user dismisses a suggestion */
  onDismissSuggestion?: (messageId: string, suggestionId: string) => void;
}

/**
 * Generate contextual quick prompts based on the current state.
 */
function getQuickPrompts(version: PlanVersion, selectedStep?: Step): QuickPrompt[] {
  // If a step is selected, show step-specific prompts
  if (selectedStep) {
    const prompts: QuickPrompt[] = [
      {
        label: 'Improve clarity',
        prompt: `How can I make step "${selectedStep.title}" clearer and more actionable?`,
      },
    ];

    // Add criteria prompt if step has few or no criteria
    if (!selectedStep.acceptance_criteria || selectedStep.acceptance_criteria.length < 2) {
      prompts.push({
        label: 'Add criteria',
        prompt: `Suggest acceptance criteria for step "${selectedStep.title}"`,
      });
    }

    // Add dependency prompt if step has no dependencies
    if (selectedStep.dependencies.length === 0) {
      prompts.push({
        label: 'Check dependencies',
        prompt: `Should step "${selectedStep.title}" depend on any other steps?`,
      });
    }

    // Add scope prompt if step has no scope
    if (!selectedStep.scope) {
      prompts.push({
        label: 'Suggest scope',
        prompt: `What scope should step "${selectedStep.title}" belong to?`,
      });
    }

    return prompts.slice(0, 3); // Limit to 3 prompts
  }

  // Plan-level prompts
  const prompts: QuickPrompt[] = [];

  // Always show general analysis prompt
  prompts.push({
    label: 'Analyze plan',
    prompt: 'Review my plan and suggest improvements',
  });

  // Show missing criteria prompt if many steps lack criteria
  const stepsWithoutCriteria = version.steps.filter(
    (s) => !s.acceptance_criteria || s.acceptance_criteria.length === 0
  );
  if (stepsWithoutCriteria.length > 0) {
    prompts.push({
      label: 'Add missing criteria',
      prompt: `${stepsWithoutCriteria.length} steps lack acceptance criteria. Which should I prioritize?`,
    });
  }

  // Show dependency prompt
  prompts.push({
    label: 'Review dependencies',
    prompt: 'Are my step dependencies correct? Are there any missing?',
  });

  // Show scope prompt if no scopes defined
  const hasScopes = version.steps.some((s) => s.scope);
  if (!hasScopes && version.steps.length > 3) {
    prompts.push({
      label: 'Add scopes',
      prompt: 'My steps have no scopes. Suggest how to organize them by scope.',
    });
  }

  return prompts.slice(0, 3); // Limit to 3 prompts
}

/**
 * Slide-in panel for AI chat assistance.
 * Provides contextual planning help with message history.
 */
export function ChatPanel({
  isOpen,
  onClose,
  version,
  messages,
  isLoading = false,
  selectedStep,
  connectionStatus = 'demo',
  planStatus = 'draft',
  isConnecting = false,
  connectError = null,
  onConnect,
  onClearConnectError,
  onSendMessage,
  onApplySuggestion,
  onDismissSuggestion,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate contextual quick prompts
  const quickPrompts = useMemo(
    () => getQuickPrompts(version, selectedStep),
    [version, selectedStep]
  );

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && !isLoading) {
      onSendMessage(trimmed);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    if (!isLoading) {
      onSendMessage(prompt);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="chat-panel-overlay" onClick={onClose}>
      <div
        className="chat-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI Chat"
        aria-modal="true"
      >
        <div className="chat-panel-header">
          <div className="chat-panel-title">
            <span className="chat-icon" aria-hidden="true">
              💬
            </span>
            <h3>AI Assistant</h3>
            <AIConnectionBadge
              status={connectionStatus}
              planStatus={planStatus}
              isConnecting={isConnecting}
              connectError={connectError}
              onConnect={onConnect}
              onClearError={onClearConnectError}
            />
          </div>
          <button
            className="chat-panel-close"
            onClick={onClose}
            aria-label="Close chat panel"
          >
            ×
          </button>
        </div>

        <div className="chat-panel-context">
          <span className="context-label">Context:</span>
          <span className="context-goal">
            {selectedStep ? `Step: ${selectedStep.title}` : version.summary.goal}
          </span>
        </div>

        <div className="chat-panel-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <p>Ask me anything about your plan!</p>
              <p className="chat-empty-hint">
                Try: "Is step 3 clear enough?" or "What acceptance criteria should this have?"
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onApplySuggestion={onApplySuggestion}
                  onDismissSuggestion={onDismissSuggestion}
                />
              ))}
              {isLoading && <ChatTypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick prompts */}
        {quickPrompts.length > 0 && !isLoading && (
          <div className="chat-quick-prompts">
            {quickPrompts.map((qp) => (
              <button
                key={qp.label}
                className="chat-quick-prompt"
                onClick={() => handleQuickPrompt(qp.prompt)}
                title={qp.prompt}
              >
                {qp.label}
              </button>
            ))}
          </div>
        )}

        <form className="chat-panel-input" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your plan..."
            rows={2}
            disabled={isLoading}
            aria-label="Chat message input"
          />
          <div className="chat-input-footer">
            <span className="chat-input-hint">Enter to send, Shift+Enter for new line</span>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!inputValue.trim() || isLoading}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

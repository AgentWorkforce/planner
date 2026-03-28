import { useState, useRef, useEffect, useMemo } from 'react';
import type { ChatMessage as ChatMessageType, PlanVersion, Step, PlanStatus } from '@/types';
import { ChatMessage, ChatTypingIndicator } from './ChatMessage';
import { AIConnectionBadge } from './AIConnectionBadge';
import { MessageIcon, CloseIcon } from './icons';
import type { ConnectionStatus } from '@/hooks/useAIConnectionStatus';

interface QuickPrompt {
  label: string;
  prompt: string;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  version: PlanVersion;
  messages: ChatMessageType[];
  isLoading?: boolean;
  selectedStep?: Step;
  connectionStatus?: ConnectionStatus;
  planStatus?: PlanStatus;
  isConnecting?: boolean;
  connectError?: string | null;
  onConnect?: () => void;
  onClearConnectError?: () => void;
  onSendMessage: (content: string) => void;
  onApplySuggestion?: (messageId: string, suggestionId: string) => void;
  onDismissSuggestion?: (messageId: string, suggestionId: string) => void;
}

function getQuickPrompts(version: PlanVersion, selectedStep?: Step): QuickPrompt[] {
  if (selectedStep) {
    const prompts: QuickPrompt[] = [
      {
        label: 'Improve clarity',
        prompt: `How can I make step "${selectedStep.title}" clearer and more actionable?`,
      },
    ];

    if (!selectedStep.acceptance_criteria || selectedStep.acceptance_criteria.length < 2) {
      prompts.push({
        label: 'Add criteria',
        prompt: `Suggest acceptance criteria for step "${selectedStep.title}"`,
      });
    }

    if (selectedStep.dependencies.length === 0) {
      prompts.push({
        label: 'Check dependencies',
        prompt: `Should step "${selectedStep.title}" depend on any other steps?`,
      });
    }

    if (!selectedStep.scope) {
      prompts.push({
        label: 'Suggest scope',
        prompt: `What scope should step "${selectedStep.title}" belong to?`,
      });
    }

    return prompts.slice(0, 3);
  }

  const prompts: QuickPrompt[] = [];

  prompts.push({
    label: 'Analyze plan',
    prompt: 'Review my plan and suggest improvements',
  });

  const stepsWithoutCriteria = version.steps.filter(
    (s) => !s.acceptance_criteria || s.acceptance_criteria.length === 0
  );
  if (stepsWithoutCriteria.length > 0) {
    prompts.push({
      label: 'Add missing criteria',
      prompt: `${stepsWithoutCriteria.length} steps lack acceptance criteria. Which should I prioritize?`,
    });
  }

  prompts.push({
    label: 'Review dependencies',
    prompt: 'Are my step dependencies correct? Are there any missing?',
  });

  const hasScopes = version.steps.some((s) => s.scope);
  if (!hasScopes && version.steps.length > 3) {
    prompts.push({
      label: 'Add scopes',
      prompt: 'My steps have no scopes. Suggest how to organize them by scope.',
    });
  }

  return prompts.slice(0, 3);
}

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

  const quickPrompts = useMemo(
    () => getQuickPrompts(version, selectedStep),
    [version, selectedStep]
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
    <div
      className="fixed inset-0 bg-black/30 z-30 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="fixed right-0 top-0 h-full w-[420px] bg-bg-secondary border-l border-border-subtle z-40 flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI Chat"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex-shrink-0 h-14 border-b border-border-subtle px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageIcon size="lg" className="text-accent-cyan" />
            <h3 className="font-display text-lg text-text-primary">AI Assistant</h3>
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
            className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-bg-hover"
            onClick={onClose}
            aria-label="Close chat panel"
          >
            <CloseIcon size="lg" />
          </button>
        </div>

        {/* Context */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-border-subtle bg-bg-tertiary/50">
          <span className="text-xs text-text-muted">Context: </span>
          <span className="text-xs text-text-secondary">
            {selectedStep ? `Step: ${selectedStep.title}` : version.summary.goal}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">Ask me anything about your plan!</p>
              <p className="text-sm text-text-muted mt-2">
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
          <div className="flex-shrink-0 px-4 py-2 border-t border-border-subtle flex flex-wrap gap-2">
            {quickPrompts.map((qp) => (
              <button
                key={qp.label}
                className="px-3 py-1.5 text-xs bg-bg-tertiary text-text-secondary rounded-full border border-border-subtle hover:border-accent-cyan hover:text-accent-cyan transition-colors"
                onClick={() => handleQuickPrompt(qp.prompt)}
                title={qp.prompt}
              >
                {qp.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form className="flex-shrink-0 border-t border-border-subtle p-4" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your plan..."
            rows={2}
            disabled={isLoading}
            aria-label="Chat message input"
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-text-muted">Enter to send, Shift+Enter for new line</span>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
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

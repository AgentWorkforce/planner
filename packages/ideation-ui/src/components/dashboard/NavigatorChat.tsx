import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainIcon, LightbulbIcon } from '@/components/icons';
import { ChatInput } from '@/components/chat/ChatInput';
import { NewSessionModal } from '@/components/sessions/NewSessionModal';
import { useSessions } from '@/hooks/useSessions';
import { cn } from '@/lib/utils';

/**
 * NavigatorChat
 *
 * Center column of SessionDashboard showing Navigator agent meta-chat.
 * cv2-045 (Navigator meta-chat UI).
 *
 * Purpose:
 * - Help users decide what to work on today
 * - Surface high-priority or stalled sessions
 * - Suggest next actions based on session states
 * - Navigate to specific sessions or create new ones
 *
 * Features:
 * - Chat interface with Navigator agent
 * - Context-aware suggestions
 * - Quick actions for session management
 * - Integration with session attention indicators
 */

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

interface Suggestion {
  id: string;
  label: string;
  icon?: 'continue' | 'new';
  action?: () => void;
}

export function NavigatorChat() {
  const navigate = useNavigate();
  const { sessions } = useSessions();
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);

  // Generate suggestions from real session data
  const suggestions = useMemo<Suggestion[]>(() => {
    const result: Suggestion[] = [];

    // Add suggestions for recent/active sessions (up to 2)
    const recentSessions = sessions.slice(0, 2);
    recentSessions.forEach((session) => {
      const title = session.source?.initial_intent || 'Untitled session';
      const shortTitle = title.length > 30 ? title.slice(0, 30) + '...' : title;
      result.push({
        id: session.id,
        label: `Continue working on "${shortTitle}"`,
        icon: 'continue',
        action: () => navigate(`/ideation/session/${session.id}`),
      });
    });

    return result;
  }, [sessions, navigate]);

  // Add "start new session" separately so it can reference modal state
  const allSuggestions = useMemo<Suggestion[]>(() => [
    ...suggestions,
    {
      id: 'new',
      label: 'Start a new ideation session',
      icon: 'new',
      action: () => setIsNewSessionModalOpen(true),
    },
  ], [suggestions]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'What would you like to work on today?',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async (content: string) => {
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Call Navigator API
    setIsTyping(true);
    try {
      const res = await fetch('/api/ideation/navigator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const assistantMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.action) {
      suggestion.action();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center">
          <BrainIcon size="sm" className="text-accent-purple" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-text-primary">Navigator</h2>
          <p className="text-xs text-text-muted">Workflow guidance</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center shrink-0">
              <BrainIcon size="sm" className="text-accent-purple" />
            </div>
            <div className="bg-bg-tertiary rounded-lg px-4 py-3 flex items-center gap-1">
              <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce-dot" />
              <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce-dot-delay-1" />
              <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce-dot-delay-2" />
            </div>
          </div>
        )}

        {/* Suggestions - show after first message */}
        {messages.length === 1 && !isTyping && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-text-muted mb-2">Suggested actions:</p>
            {allSuggestions.map((suggestion) => (
              <SuggestionButton
                key={suggestion.id}
                suggestion={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chat input */}
      <ChatInput
        onSend={handleSend}
        placeholder="Ask Navigator for guidance..."
        disabled={false}
      />

      {/* New Session Modal */}
      <NewSessionModal
        open={isNewSessionModalOpen}
        onOpenChange={setIsNewSessionModalOpen}
      />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex gap-2 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar - only for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center shrink-0">
          <BrainIcon size="sm" className="text-accent-purple" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-accent-cyan/20 text-text-primary'
            : 'text-text-primary'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <span
          className={cn(
            'text-xs mt-1 block',
            isUser ? 'text-accent-cyan/60 text-right' : 'text-text-muted'
          )}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

interface SuggestionButtonProps {
  suggestion: Suggestion;
  onClick: () => void;
}

function SuggestionButton({ suggestion, onClick }: SuggestionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-bg-secondary hover:bg-bg-tertiary',
        'border border-border-subtle hover:border-accent-cyan/30',
        'text-left text-sm text-text-primary',
        'transition-colors duration-200'
      )}
    >
      {suggestion.icon === 'continue' && (
        <div className="w-6 h-6 rounded-full bg-accent-cyan/20 flex items-center justify-center shrink-0">
          <span className="text-xs">▶</span>
        </div>
      )}
      {suggestion.icon === 'new' && (
        <div className="w-6 h-6 rounded-full bg-accent-purple/20 flex items-center justify-center shrink-0">
          <LightbulbIcon size="sm" className="text-accent-purple" />
        </div>
      )}
      <span>{suggestion.label}</span>
    </button>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

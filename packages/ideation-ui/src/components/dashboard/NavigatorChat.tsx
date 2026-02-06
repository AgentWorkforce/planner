import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainIcon } from '@/components/icons';
import { ChatInput } from '@/components/chat/ChatInput';
import { useSessions } from '@/hooks/useSessions';
import { cn } from '@/lib/utils';

/**
 * NavigatorChat
 *
 * Center column of SessionDashboard showing Navigator agent meta-chat.
 *
 * Features:
 * - Continue links to recent sessions (above chat input)
 * - Chat interface with Navigator agent
 */

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

interface RecentSession {
  id: string;
  title: string;
}

export function NavigatorChat() {
  const navigate = useNavigate();
  const { sessions } = useSessions();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Get recent sessions for "Continue" list (up to 3)
  const recentSessions = useMemo<RecentSession[]>(() => {
    return sessions.slice(0, 3).map((session) => {
      const title = session.source?.initial_intent || 'Untitled session';
      const shortTitle = title.length > 40 ? title.slice(0, 40) + '...' : title;
      return { id: session.id, title: shortTitle };
    });
  }, [sessions]);

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

  return (
    <div className="h-full flex flex-col">
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
      </div>

      {/* Continue Section - above chat input */}
      {recentSessions.length > 0 && messages.length === 0 && (
        <div className="px-4 pb-2">
          <p className="text-sm text-[var(--canvas-text-muted)] mb-2">Continue</p>
          <div className="space-y-1">
            {recentSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/ideation/session/${session.id}`)}
                className={cn(
                  'block w-full text-left text-sm',
                  'text-[var(--canvas-text-primary)] hover:text-[var(--canvas-accent)]',
                  'transition-colors'
                )}
              >
                <span className="text-[var(--canvas-text-muted)] mr-2">└</span>
                {session.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat input */}
      <ChatInput
        onSend={handleSend}
        placeholder="Ask Navigator for guidance..."
        disabled={false}
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

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

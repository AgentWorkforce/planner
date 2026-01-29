import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
  onApplySuggestion?: (messageId: string, suggestionId: string) => void;
  onDismissSuggestion?: (messageId: string, suggestionId: string) => void;
}

/**
 * Individual chat message component.
 * User messages are right-aligned, AI messages are left-aligned with avatar.
 */
export function ChatMessage({
  message,
  onApplySuggestion,
  onDismissSuggestion,
}: ChatMessageProps) {
  return (
    <div className={`chat-message chat-message--${message.role}`}>
      {message.role === 'assistant' && (
        <span className="chat-avatar" aria-hidden="true">
          🤖
        </span>
      )}
      <div className="chat-message-content">
        <div className="chat-message-text">
          <MarkdownContent content={message.content} />
        </div>
        {message.suggestion && message.suggestion.status === 'pending' && (
          <ChatSuggestion
            message={message}
            onApply={onApplySuggestion}
            onDismiss={onDismissSuggestion}
          />
        )}
        {message.suggestion && message.suggestion.status === 'applied' && (
          <div className="chat-suggestion chat-suggestion--applied">
            <span className="suggestion-applied">✓ Change applied</span>
          </div>
        )}
        <span className="chat-message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

interface ChatSuggestionProps {
  message: ChatMessageType;
  onApply?: (messageId: string, suggestionId: string) => void;
  onDismiss?: (messageId: string, suggestionId: string) => void;
}

/**
 * Suggestion card within a chat message.
 */
function ChatSuggestion({ message, onApply, onDismiss }: ChatSuggestionProps) {
  const suggestion = message.suggestion!;

  return (
    <div className="chat-suggestion">
      <div className="chat-suggestion-header">
        <span className="suggestion-label">Suggested change:</span>
      </div>
      <div className="chat-suggestion-description">{suggestion.description}</div>
      <pre className="chat-suggestion-preview">{suggestion.preview}</pre>
      <div className="chat-suggestion-actions">
        <button
          className="btn btn-sm btn-primary"
          onClick={() => onApply?.(message.id, suggestion.id)}
        >
          Apply
        </button>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => onDismiss?.(message.id, suggestion.id)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

interface MarkdownContentProps {
  content: string;
}

/**
 * Simple markdown renderer for chat messages.
 * Supports: bold, italic, code, code blocks, lists, and links.
 */
function MarkdownContent({ content }: MarkdownContentProps) {
  // Split by code blocks first to preserve them
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, index) => {
        // Code block
        if (part.startsWith('```')) {
          const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
          return (
            <pre key={index} className="chat-code-block">
              <code>{code}</code>
            </pre>
          );
        }

        // Process inline markdown
        return <InlineMarkdown key={index} content={part} />;
      })}
    </>
  );
}

function InlineMarkdown({ content }: { content: string }) {
  // Process line by line for lists
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (currentList.length > 0) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <ListTag key={elements.length} className="chat-list">
          {currentList.map((item, i) => (
            <li key={i}>{processInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
      currentList = [];
      listType = null;
    }
  };

  lines.forEach((line, lineIndex) => {
    // Ordered list
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      currentList.push(olMatch[2]);
      return;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      currentList.push(ulMatch[1]);
      return;
    }

    // Regular line
    flushList();
    if (line.trim()) {
      elements.push(
        <span key={`line-${lineIndex}`}>
          {processInlineMarkdown(line)}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      );
    } else if (lineIndex < lines.length - 1) {
      elements.push(<br key={`br-${lineIndex}`} />);
    }
  });

  flushList();

  return <>{elements}</>;
}

/**
 * Process inline markdown: bold, italic, code, links
 */
function processInlineMarkdown(text: string): React.ReactNode {
  // Simple regex-based parsing
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="chat-inline-code">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Plain text until next special character
    const nextSpecial = remaining.search(/[`*\[]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Special char at start but no match, treat as plain text
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/**
 * Typing indicator shown while AI is responding.
 */
export function ChatTypingIndicator() {
  return (
    <div className="chat-message chat-message--assistant">
      <span className="chat-avatar" aria-hidden="true">
        🤖
      </span>
      <div className="chat-message-content">
        <div className="chat-typing-indicator" role="status" aria-label="AI is typing">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

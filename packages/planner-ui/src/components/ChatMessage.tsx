import type { ChatMessage as ChatMessageType } from '@/types';
import { CheckIcon } from './icons';

interface ChatMessageProps {
  message: ChatMessageType;
  onApplySuggestion?: (messageId: string, suggestionId: string) => void;
  onDismissSuggestion?: (messageId: string, suggestionId: string) => void;
}

export function ChatMessage({
  message,
  onApplySuggestion,
  onDismissSuggestion,
}: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center text-sm">
          AI
        </div>
      )}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'ml-8' : 'mr-8'}`}>
        <div
          className={`rounded-lg p-3 ${
            isUser
              ? 'bg-accent-cyan/10 text-text-primary'
              : 'bg-bg-tertiary text-text-primary'
          }`}
        >
          <div className="text-sm">
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
            <div className="mt-2 flex items-center gap-1 text-xs text-success">
              <CheckIcon size="sm" />
              <span>Change applied</span>
            </div>
          )}
        </div>
        <span className="text-xs text-text-muted mt-1 block">
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

function ChatSuggestion({ message, onApply, onDismiss }: ChatSuggestionProps) {
  const suggestion = message.suggestion!;

  return (
    <div className="mt-3 p-3 bg-bg-elevated rounded-lg border border-border-subtle">
      <div className="text-xs font-medium text-accent-cyan mb-2">Suggested change:</div>
      <div className="text-sm text-text-secondary mb-2">{suggestion.description}</div>
      <pre className="text-xs bg-bg-secondary p-2 rounded overflow-x-auto text-text-muted font-mono">
        {suggestion.preview}
      </pre>
      <div className="flex gap-2 mt-3">
        <button
          className="px-3 py-1.5 text-xs bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan"
          onClick={() => onApply?.(message.id, suggestion.id)}
        >
          Apply
        </button>
        <button
          className="px-3 py-1.5 text-xs bg-bg-tertiary text-text-primary border border-border-subtle font-medium rounded-lg transition-colors hover:border-border-light"
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

function MarkdownContent({ content }: MarkdownContentProps) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
          return (
            <pre key={index} className="my-2 p-2 bg-bg-secondary rounded text-xs overflow-x-auto font-mono">
              <code>{code}</code>
            </pre>
          );
        }
        return <InlineMarkdown key={index} content={part} />;
      })}
    </>
  );
}

function InlineMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (currentList.length > 0) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <ListTag key={elements.length} className={`my-2 ${listType === 'ol' ? 'list-decimal' : 'list-disc'} list-inside text-text-secondary`}>
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
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      currentList.push(olMatch[2]);
      return;
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      currentList.push(ulMatch[1]);
      return;
    }

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

function processInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 bg-bg-secondary rounded text-xs font-mono text-accent-cyan">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold text-text-primary">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline">
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    const nextSpecial = remaining.search(/[`*\[]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function ChatTypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center text-sm">
        AI
      </div>
      <div className="flex-1 mr-8">
        <div className="bg-bg-tertiary rounded-lg p-3">
          <div className="flex gap-1" role="status" aria-label="AI is typing">
            <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import type { Message } from '@plannr/shared-ui';

interface TerminalMessageListProps {
  messages: Message[];
  currentUserId?: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  className?: string;
  onRemoveQueued?: (messageId: string) => void;
}

interface MessageGroup {
  senderId: string;
  senderName: string | null;
  messages: Message[];
  timestamp: string;
}

type RenderItem =
  | { kind: 'group'; group: MessageGroup }
  | { kind: 'tool_action'; message: Message }
  | { kind: 'thinking'; message: Message };

function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;
  const FIVE_MINUTES = 5 * 60 * 1000;

  messages.forEach((msg) => {
    const msgTime = new Date(msg.timestamp).getTime();

    if (
      currentGroup &&
      currentGroup.senderId === msg.from &&
      msgTime - new Date(currentGroup.timestamp).getTime() < FIVE_MINUTES
    ) {
      currentGroup.messages.push(msg);
    } else {
      currentGroup = {
        senderId: msg.from,
        senderName: msg.fromName || null,
        messages: [msg],
        timestamp: msg.timestamp,
      };
      groups.push(currentGroup);
    }
  });

  return groups;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
}

function shouldShowDateSeparator(
  currentMsg: Message,
  prevMsg: Message | null
): boolean {
  if (!prevMsg) return true;

  const current = new Date(currentMsg.timestamp);
  const prev = new Date(prevMsg.timestamp);

  return current.toDateString() !== prev.toDateString();
}

// Known role → short ASCII tag mapping
const ROLE_TAGS: Record<string, string> = {
  architect: 'arc',
  designer: 'des',
  performance: 'prf',
  navigator: 'nav',
  planner: 'pln',
  researcher: 'res',
  reviewer: 'rev',
  tester: 'tst',
};

// Tool action display config
const TOOL_ICONS: Record<string, string> = {
  read_session: '◇',
  update_understanding: '◆',
  spawn_specialist: '⊕',
  send_to_planner: '↑',
  graduate_blocks: '↑',
  update_synthesis: '◆',
  list_blocks: '◇',
  start_session: '⊕',
  report_agent_status: '◎',
  read_file: '◇',
  edit_file: '✎',
  write_file: '◇',
  run_command: '▸',
  search_files: '◇',
};

const TOOL_LABELS: Record<string, string> = {
  read_session: 'Read session',
  update_understanding: 'Update understanding',
  spawn_specialist: 'Spawn specialist',
  send_to_planner: 'Send to planner',
  graduate_blocks: 'Graduate blocks',
  update_synthesis: 'Update synthesis',
  list_blocks: 'List blocks',
  start_session: 'Start session',
  report_agent_status: 'Report status',
  read_file: 'Read',
  edit_file: 'Edit',
  write_file: 'Write',
  run_command: 'Run',
  search_files: 'Search',
};

/**
 * Derive a short bracketed tag for an agent name.
 * - Interviewer-* → null (default voice, no prefix)
 * - Known roles → `[arc]`, `[des]`, etc.
 * - Unknown → first 3 lowercase chars of the name
 */
function getAgentTag(name: string | null): string | null {
  if (!name) return null;

  // Interviewer is the default voice — invisible
  if (/^interviewer/i.test(name)) return null;

  // Strip any trailing hash (e.g. "Architect-8b3f2ebe" → "Architect")
  const baseName = name.replace(/-[a-f0-9]{6,}$/i, '').toLowerCase();

  // Check known roles
  if (ROLE_TAGS[baseName]) return ROLE_TAGS[baseName];

  // Fallback: first 3 chars
  return baseName.slice(0, 3);
}

function ToolActionIndicator({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const tool = (message.data?.tool as string) || 'unknown';
  const summary = (message.data?.summary as string) || '';
  const icon = TOOL_ICONS[tool] || '◇';
  const label = TOOL_LABELS[tool] || tool.replace(/_/g, ' ');
  const truncated = !expanded && summary.length > 60;
  const displaySummary = truncated ? summary.slice(0, 60) + '...' : summary;

  return (
    <div
      className={`flex items-center gap-2 -my-1.5 px-2 text-xs font-mono text-text-secondary${summary.length > 60 ? ' cursor-pointer' : ''}`}
      onClick={summary.length > 60 ? () => setExpanded(!expanded) : undefined}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span>{label}</span>
      {displaySummary && (
        <span className="px-1.5 py-0.5 rounded bg-bg-deep/50 text-text-muted">
          {displaySummary}
        </span>
      )}
    </div>
  );
}

function ThinkingIndicator({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const thought = (message.data?.thought as string) || '';
  const isTruncated = !expanded && thought.length > 60;
  const displayThought = isTruncated ? thought.slice(0, 60) + '...' : thought;

  return (
    <div
      className={`flex items-center gap-2 -my-1.5 px-2 text-xs font-mono text-text-secondary${thought.length > 60 ? ' cursor-pointer' : ''}`}
      onClick={thought.length > 60 ? () => setExpanded(!expanded) : undefined}
    >
      <span className="text-sm leading-none">◎</span>
      <span>Thinking</span>
      {displayThought && (
        <span className="px-1.5 py-0.5 rounded bg-bg-deep/50 text-text-muted">
          {displayThought}
        </span>
      )}
    </div>
  );
}

const WAITING_SPINNER = ['/', '-', '\\', '|'];

function WaitingIndicator({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(since).getTime();
    const timer = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, [since]);

  const frame = WAITING_SPINNER[Math.floor(elapsed * 4) % WAITING_SPINNER.length];

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-base font-mono text-text-muted">
      <span>{frame}</span>
      <span>{elapsed.toFixed(1)}s</span>
    </div>
  );
}

export function TerminalMessageList({
  messages,
  currentUserId,
  isLoading = false,
  emptyMessage = 'No messages yet',
  emptyDescription = 'Start a conversation',
  className = '',
  onRemoveQueued,
}: TerminalMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Filter out system messages
  const filteredMessages = useMemo(() => messages.filter((msg) => {
    if (msg.from === '__system__') return false;
    if (msg.content?.startsWith('join:') || msg.content?.startsWith('leave:')) return false;
    return true;
  }), [messages]);

  const renderItems = useMemo((): RenderItem[] => {
    const items: RenderItem[] = [];
    // Separate tool_action/thinking messages from regular messages
    const regularMessages: Message[] = [];

    for (const msg of filteredMessages) {
      const dataType = msg.data?.type as string | undefined;
      if (dataType === 'tool_action') {
        // Flush any pending regular messages as a group
        if (regularMessages.length > 0) {
          const groups = groupMessages([...regularMessages]);
          groups.forEach(g => items.push({ kind: 'group', group: g }));
          regularMessages.length = 0;
        }
        items.push({ kind: 'tool_action', message: msg });
      } else if (dataType === 'thinking') {
        if (regularMessages.length > 0) {
          const groups = groupMessages([...regularMessages]);
          groups.forEach(g => items.push({ kind: 'group', group: g }));
          regularMessages.length = 0;
        }
        items.push({ kind: 'thinking', message: msg });
      } else {
        regularMessages.push(msg);
      }
    }

    // Flush remaining regular messages
    if (regularMessages.length > 0) {
      const groups = groupMessages(regularMessages);
      groups.forEach(g => items.push({ kind: 'group', group: g }));
    }

    return items;
  }, [filteredMessages]);

  // Detect waiting state: find the FIRST unanswered user message (not just the last).
  // Walk backward past tool_action/thinking, then collect consecutive user messages
  // to find the earliest one — so multiple queued messages don't reset the timer.
  const waitingSince = useMemo(() => {
    let firstUserTimestamp: string | null = null;

    for (let i = filteredMessages.length - 1; i >= 0; i--) {
      const msg = filteredMessages[i]!;
      const dataType = msg.data?.type as string | undefined;
      if (dataType === 'tool_action' || dataType === 'thinking') continue;
      if (!msg.content) continue;

      if (msg.entityType === 'user') {
        firstUserTimestamp = msg.timestamp;
      } else {
        // Agent content message — stop
        break;
      }
    }

    return firstUserTimestamp;
  }, [filteredMessages]);

  // Auto-scroll to bottom on new messages or waiting state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length, waitingSince]);

  // Loading state
  if (isLoading && filteredMessages.length === 0) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <span className="text-text-muted text-sm">...</span>
      </div>
    );
  }

  // Empty state
  if (filteredMessages.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <p className="text-text-muted text-sm">{emptyMessage}</p>
        {emptyDescription && (
          <p className="text-text-muted text-xs mt-1">{emptyDescription}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {renderItems.map((item, idx) => {
        if (item.kind === 'tool_action') {
          return <ToolActionIndicator key={`action-${item.message.id}`} message={item.message} />;
        }
        if (item.kind === 'thinking') {
          return <ThinkingIndicator key={`thinking-${item.message.id}`} message={item.message} />;
        }

        // Regular message group
        const group = item.group;
        const isCurrentUser = group.senderId === currentUserId || group.messages[0]?.entityType === 'user';
        const firstMessage = group.messages[0]!;

        // Date separator: check previous group-type items
        const prevGroups = renderItems.slice(0, idx).filter(i => i.kind === 'group');
        const prevGroup = prevGroups.length > 0 ? (prevGroups[prevGroups.length - 1] as { kind: 'group'; group: MessageGroup }).group : null;
        const showDateSeparator = !prevGroup || shouldShowDateSeparator(firstMessage, prevGroup.messages[0] ?? null);

        return (
          <div key={`group-${idx}`} className="flex flex-col gap-2">
            {showDateSeparator && (
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 border-t border-border-subtle" />
                <span className="text-text-muted text-xs">
                  {formatDate(firstMessage.timestamp)}
                </span>
                <div className="flex-1 border-t border-border-subtle" />
              </div>
            )}
            <div className={`flex flex-col gap-1 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
              {group.messages.map((msg, msgIdx) => {
                const agentTag = !isCurrentUser && msgIdx === 0
                  ? getAgentTag(group.senderName ?? msg.fromName ?? msg.from)
                  : null;

                if (isCurrentUser) {
                  const isQueued = !!msg.data?.queued;
                  return (
                    <div key={msg.id} className="w-full flex justify-end my-[30px]">
                      <div className="group relative flex items-center gap-1.5">
                        {/* Hover actions for queued messages */}
                        {isQueued && onRemoveQueued && (
                          <div className="hidden group-hover:flex items-center gap-1">
                            <button
                              onClick={() => navigator.clipboard.writeText(msg.content ?? '')}
                              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                              title="Copy"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onRemoveQueued(msg.id)}
                              className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-bg-tertiary transition-colors"
                              title="Remove from queue"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-1.5 prose prose-sm prose-chat max-w-none${isQueued ? ' opacity-60 border-l-2 border-dashed border-text-muted' : ''}`}
                          style={{
                            backgroundColor: 'var(--color-bg-user-bubble)',
                          }}
                        >
                          <Markdown>{msg.content ?? ''}</Markdown>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={msg.id} className="max-w-[80%]">
                      {agentTag && (
                        <span className="text-xs font-mono text-accent-primary">
                          [{agentTag}]{' '}
                        </span>
                      )}
                      <div className="prose prose-sm prose-chat max-w-none">
                        <Markdown>{msg.content ?? ''}</Markdown>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        );
      })}

      {/* Waiting indicator — shows elapsed time while agent is processing */}
      {waitingSince && <WaitingIndicator since={waitingSince} />}

      {/* Auto-scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

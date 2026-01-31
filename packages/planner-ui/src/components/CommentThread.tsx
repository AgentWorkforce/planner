import { useState, useCallback, useMemo } from 'react';
import type { Comment, Step } from '@/types';
import { CloseIcon, CheckIcon } from './icons';

interface CommentThreadProps {
  step: Step;
  comments: Comment[];
  currentUser: string;
  onAddComment: (stepId: string, content: string, parentId?: string) => Promise<void>;
  onResolve?: (commentId: string) => Promise<void>;
  onUnresolve?: (commentId: string) => Promise<void>;
  onClose: () => void;
}

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  currentUser: string;
  onReply: (parentId: string) => void;
  onResolve?: (commentId: string) => Promise<void>;
  onUnresolve?: (commentId: string) => Promise<void>;
  replyingTo: string | null;
  replyContent: string;
  onReplyContentChange: (value: string) => void;
  onSubmitReply: () => void;
  onCancelReply: () => void;
  submitting: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function CommentItem({
  comment,
  replies,
  currentUser,
  onReply,
  onResolve,
  onUnresolve,
  replyingTo,
  replyContent,
  onReplyContentChange,
  onSubmitReply,
  onCancelReply,
  submitting,
}: CommentItemProps) {
  const isReplyingToThis = replyingTo === comment.comment_id;

  return (
    <div className={`p-3 rounded-lg ${comment.resolved ? 'bg-bg-primary opacity-60' : 'bg-bg-elevated'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-text-primary">{comment.author}</span>
        <span className="text-xs text-text-muted">{formatDate(comment.created_at)}</span>
        {comment.resolved && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
            <CheckIcon size="sm" />
            Resolved
          </span>
        )}
      </div>
      <div className="text-sm text-text-secondary mb-2">{comment.content}</div>
      <div className="flex items-center gap-2">
        {!comment.resolved && (
          <button
            type="button"
            className="text-xs text-text-muted hover:text-accent-cyan transition-colors"
            onClick={() => onReply(comment.comment_id)}
          >
            Reply
          </button>
        )}
        {onResolve && !comment.resolved && (
          <button
            type="button"
            className="text-xs text-text-muted hover:text-success transition-colors"
            onClick={() => onResolve(comment.comment_id)}
          >
            Resolve
          </button>
        )}
        {onUnresolve && comment.resolved && (
          <button
            type="button"
            className="text-xs text-text-muted hover:text-warning transition-colors"
            onClick={() => onUnresolve(comment.comment_id)}
          >
            Unresolve
          </button>
        )}
      </div>

      {isReplyingToThis && (
        <div className="mt-3 space-y-2">
          <textarea
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
            disabled={submitting}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-xs bg-accent-cyan text-bg-deep font-medium rounded-md transition-all hover:shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onSubmitReply}
              disabled={!replyContent.trim() || submitting}
            >
              {submitting ? 'Posting...' : 'Reply'}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs bg-bg-tertiary text-text-primary font-medium rounded-md transition-colors hover:bg-bg-hover disabled:opacity-50"
              onClick={onCancelReply}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="mt-3 ml-4 space-y-2 border-l-2 border-border-subtle pl-4">
          {replies.map((reply) => (
            <CommentItem
              key={reply.comment_id}
              comment={reply}
              replies={[]}
              currentUser={currentUser}
              onReply={onReply}
              onResolve={onResolve}
              onUnresolve={onUnresolve}
              replyingTo={replyingTo}
              replyContent={replyContent}
              onReplyContentChange={onReplyContentChange}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
              submitting={submitting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentThread({
  step,
  comments,
  currentUser,
  onAddComment,
  onResolve,
  onUnresolve,
  onClose,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  // Organize comments into threads (top-level and their replies)
  const { topLevelComments, repliesByParent, unresolvedCount, resolvedCount } = useMemo(() => {
    const topLevel: Comment[] = [];
    const replies: Record<string, Comment[]> = {};
    let unresolved = 0;
    let resolved = 0;

    for (const comment of comments) {
      if (comment.resolved) {
        resolved++;
      } else {
        unresolved++;
      }

      if (!comment.parent_id) {
        topLevel.push(comment);
      } else {
        if (!replies[comment.parent_id]) {
          replies[comment.parent_id] = [];
        }
        replies[comment.parent_id].push(comment);
      }
    }

    // Sort by created_at
    topLevel.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const parentId of Object.keys(replies)) {
      replies[parentId].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    return {
      topLevelComments: topLevel,
      repliesByParent: replies,
      unresolvedCount: unresolved,
      resolvedCount: resolved,
    };
  }, [comments]);

  const visibleComments = useMemo(() => {
    if (showResolved) {
      return topLevelComments;
    }
    return topLevelComments.filter((c) => !c.resolved);
  }, [topLevelComments, showResolved]);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(step.step_id, newComment.trim());
      setNewComment('');
    } finally {
      setSubmitting(false);
    }
  }, [newComment, step.step_id, onAddComment]);

  const handleReply = useCallback((parentId: string) => {
    setReplyingTo(parentId);
    setReplyContent('');
  }, []);

  const handleSubmitReply = useCallback(async () => {
    if (!replyContent.trim() || !replyingTo) return;
    setSubmitting(true);
    try {
      await onAddComment(step.step_id, replyContent.trim(), replyingTo);
      setReplyContent('');
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  }, [replyContent, replyingTo, step.step_id, onAddComment]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyContent('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div
      className="fixed inset-0 bg-bg-deep/50 backdrop-blur-sm z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-bg-secondary border-l border-border-subtle flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-4 border-b border-border-subtle">
          <div className="min-w-0">
            <h3 className="font-display text-lg text-text-primary">Comments</h3>
            <span className="text-sm text-text-muted truncate block">{step.title}</span>
          </div>
          <button
            type="button"
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size="md" />
          </button>
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-b border-border-subtle bg-bg-primary">
          <span className="text-sm text-warning">{unresolvedCount} unresolved</span>
          {resolvedCount > 0 && (
            <button
              type="button"
              className="text-sm text-text-muted hover:text-accent-cyan transition-colors"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? 'Hide' : 'Show'} {resolvedCount} resolved
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {visibleComments.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              {unresolvedCount === 0 && resolvedCount === 0
                ? 'No comments yet. Start the conversation!'
                : 'All comments resolved.'}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleComments.map((comment) => (
                <CommentItem
                  key={comment.comment_id}
                  comment={comment}
                  replies={repliesByParent[comment.comment_id] || []}
                  currentUser={currentUser}
                  onReply={handleReply}
                  onResolve={onResolve}
                  onUnresolve={onUnresolve}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  onReplyContentChange={setReplyContent}
                  onSubmitReply={handleSubmitReply}
                  onCancelReply={handleCancelReply}
                  submitting={submitting}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-subtle bg-bg-primary">
          <div className="space-y-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              rows={3}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none transition-colors"
              disabled={submitting}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">
                <kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Cmd</kbd>+<kbd className="px-1 py-0.5 bg-bg-tertiary rounded">Enter</kbd> to submit
              </span>
              <button
                type="button"
                className="px-4 py-2 bg-accent-cyan text-bg-deep text-sm font-medium rounded-lg transition-all hover:shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmit}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? 'Posting...' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

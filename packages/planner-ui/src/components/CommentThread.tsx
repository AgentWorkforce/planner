import { useState, useCallback, useMemo } from 'react';
import type { Comment, Step } from '@/types';

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
    <div className={`comment-item ${comment.resolved ? 'resolved' : ''}`}>
      <div className="comment-header">
        <span className="comment-author">{comment.author}</span>
        <span className="comment-time">{formatDate(comment.created_at)}</span>
        {comment.resolved && <span className="comment-resolved-badge">Resolved</span>}
      </div>
      <div className="comment-content">{comment.content}</div>
      <div className="comment-actions">
        {!comment.resolved && (
          <button
            type="button"
            className="comment-action-btn"
            onClick={() => onReply(comment.comment_id)}
          >
            Reply
          </button>
        )}
        {onResolve && !comment.resolved && (
          <button
            type="button"
            className="comment-action-btn"
            onClick={() => onResolve(comment.comment_id)}
          >
            Resolve
          </button>
        )}
        {onUnresolve && comment.resolved && (
          <button
            type="button"
            className="comment-action-btn"
            onClick={() => onUnresolve(comment.comment_id)}
          >
            Unresolve
          </button>
        )}
      </div>

      {isReplyingToThis && (
        <div className="comment-reply-form">
          <textarea
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            className="comment-input"
            disabled={submitting}
          />
          <div className="comment-reply-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSubmitReply}
              disabled={!replyContent.trim() || submitting}
            >
              {submitting ? 'Posting...' : 'Reply'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onCancelReply}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="comment-replies">
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
    <div className="comment-thread-overlay" onClick={onClose}>
      <div className="comment-thread-panel" onClick={(e) => e.stopPropagation()}>
        <div className="comment-thread-header">
          <div className="comment-thread-title">
            <h3>Comments</h3>
            <span className="comment-thread-step">{step.title}</span>
          </div>
          <button
            type="button"
            className="comment-thread-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="comment-thread-stats">
          <span className="comment-stat">{unresolvedCount} unresolved</span>
          {resolvedCount > 0 && (
            <button
              type="button"
              className="comment-toggle-resolved"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? 'Hide' : 'Show'} {resolvedCount} resolved
            </button>
          )}
        </div>

        <div className="comment-thread-body">
          {visibleComments.length === 0 ? (
            <div className="comment-empty">
              {unresolvedCount === 0 && resolvedCount === 0
                ? 'No comments yet. Start the conversation!'
                : 'All comments resolved.'}
            </div>
          ) : (
            <div className="comment-list">
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

        <div className="comment-thread-footer">
          <div className="comment-new-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment..."
              rows={3}
              className="comment-input"
              disabled={submitting}
            />
            <div className="comment-new-actions">
              <span className="comment-hint">⌘+Enter to submit</span>
              <button
                type="button"
                className="btn btn-primary"
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

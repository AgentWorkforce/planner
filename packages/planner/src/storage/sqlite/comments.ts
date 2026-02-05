import type Database from 'better-sqlite3';
import type { Comment } from '../../domain/comment.js';
import { rowToComment } from './converters.js';
import type { CommentRow } from './converters.js';

// ============================================
// Comment operations
// ============================================

export function createComment(db: Database.Database, comment: Comment): Comment {
  const stmt = db.prepare(`
    INSERT INTO comments (
      comment_id, plan_id, version, step_id, parent_id, author, content,
      resolved, resolved_by, resolved_at, created_at, updated_at
    )
    VALUES (
      @comment_id, @plan_id, @version, @step_id, @parent_id, @author, @content,
      @resolved, @resolved_by, @resolved_at, @created_at, @updated_at
    )
  `);
  stmt.run({
    comment_id: comment.comment_id,
    plan_id: comment.plan_id,
    version: comment.version,
    step_id: comment.step_id,
    parent_id: comment.parent_id,
    author: comment.author,
    content: comment.content,
    resolved: comment.resolved ? 1 : 0,
    resolved_by: comment.resolved_by,
    resolved_at: comment.resolved_at,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
  });
  return comment;
}

export function getComment(db: Database.Database, commentId: string): Comment | null {
  const stmt = db.prepare<string, CommentRow>(`
    SELECT comment_id, plan_id, version, step_id, parent_id, author, content,
           resolved, resolved_by, resolved_at, created_at, updated_at
    FROM comments
    WHERE comment_id = ?
  `);
  const row = stmt.get(commentId);
  if (!row) return null;
  return rowToComment(row);
}

export function updateComment(
  db: Database.Database,
  commentId: string,
  content: string
): Comment | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE comments
    SET content = ?, updated_at = ?
    WHERE comment_id = ?
  `);
  const result = stmt.run(content, now, commentId);
  if (result.changes === 0) return null;
  return getComment(db, commentId);
}

export function resolveComment(
  db: Database.Database,
  commentId: string,
  resolvedBy: string
): Comment | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE comments
    SET resolved = 1, resolved_by = ?, resolved_at = ?, updated_at = ?
    WHERE comment_id = ?
  `);
  const result = stmt.run(resolvedBy, now, now, commentId);
  if (result.changes === 0) return null;
  return getComment(db, commentId);
}

export function unresolveComment(db: Database.Database, commentId: string): Comment | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE comments
    SET resolved = 0, resolved_by = NULL, resolved_at = NULL, updated_at = ?
    WHERE comment_id = ?
  `);
  const result = stmt.run(now, commentId);
  if (result.changes === 0) return null;
  return getComment(db, commentId);
}

export function deleteComment(db: Database.Database, commentId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM comments
    WHERE comment_id = ?
  `);
  const result = stmt.run(commentId);
  return result.changes > 0;
}

export function listCommentsByStep(
  db: Database.Database,
  planId: string,
  version: number,
  stepId: string
): Comment[] {
  const stmt = db.prepare<[string, number, string], CommentRow>(`
    SELECT comment_id, plan_id, version, step_id, parent_id, author, content,
           resolved, resolved_by, resolved_at, created_at, updated_at
    FROM comments
    WHERE plan_id = ? AND version = ? AND step_id = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(planId, version, stepId);
  return rows.map((row) => rowToComment(row));
}

export function listCommentsByVersion(
  db: Database.Database,
  planId: string,
  version: number
): Comment[] {
  const stmt = db.prepare<[string, number], CommentRow>(`
    SELECT comment_id, plan_id, version, step_id, parent_id, author, content,
           resolved, resolved_by, resolved_at, created_at, updated_at
    FROM comments
    WHERE plan_id = ? AND version = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(planId, version);
  return rows.map((row) => rowToComment(row));
}

export function countUnresolvedComments(
  db: Database.Database,
  planId: string,
  version: number
): number {
  const stmt = db.prepare<[string, number], { count: number }>(`
    SELECT COUNT(*) as count
    FROM comments
    WHERE plan_id = ? AND version = ? AND resolved = 0
  `);
  const result = stmt.get(planId, version);
  return result?.count ?? 0;
}

export function countUnresolvedCommentsByStep(
  db: Database.Database,
  planId: string,
  version: number,
  stepId: string
): number {
  const stmt = db.prepare<[string, number, string], { count: number }>(`
    SELECT COUNT(*) as count
    FROM comments
    WHERE plan_id = ? AND version = ? AND step_id = ? AND resolved = 0
  `);
  const result = stmt.get(planId, version, stepId);
  return result?.count ?? 0;
}

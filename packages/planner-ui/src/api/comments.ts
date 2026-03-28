import { apiClient, ApiError } from './client';
import type { Comment } from '@/types';

export { ApiError };

export interface CommentsResponse {
  comments: Comment[];
}

export interface CommentResponse {
  comment: Comment;
}

/**
 * Get all comments for a plan version.
 */
export async function getComments(
  planId: string,
  version: number
): Promise<CommentsResponse> {
  return apiClient.get<CommentsResponse>(
    `/plans/${planId}/versions/${version}/comments`
  );
}

/**
 * Get comments for a specific step.
 */
export async function getStepComments(
  planId: string,
  version: number,
  stepId: string
): Promise<CommentsResponse> {
  return apiClient.get<CommentsResponse>(
    `/plans/${planId}/versions/${version}/steps/${stepId}/comments`
  );
}

/**
 * Create a new comment on a step.
 */
export async function createComment(
  planId: string,
  version: number,
  stepId: string,
  content: string,
  author: string,
  parentId?: string
): Promise<CommentResponse> {
  return apiClient.post<CommentResponse>(
    `/plans/${planId}/versions/${version}/comments`,
    {
      step_id: stepId,
      content,
      parent_id: parentId,
      author,
    }
  );
}

/**
 * Resolve a comment.
 */
export async function resolveComment(
  planId: string,
  version: number,
  commentId: string,
  resolvedBy: string
): Promise<CommentResponse> {
  return apiClient.post<CommentResponse>(
    `/plans/${planId}/versions/${version}/comments/${commentId}/resolve`,
    { resolved_by: resolvedBy }
  );
}

/**
 * Unresolve a comment.
 */
export async function unresolveComment(
  planId: string,
  version: number,
  commentId: string
): Promise<CommentResponse> {
  return apiClient.post<CommentResponse>(
    `/plans/${planId}/versions/${version}/comments/${commentId}/unresolve`,
    {}
  );
}

/**
 * Delete a comment.
 */
export async function deleteComment(
  planId: string,
  version: number,
  commentId: string
): Promise<void> {
  await apiClient.delete(
    `/plans/${planId}/versions/${version}/comments/${commentId}`
  );
}

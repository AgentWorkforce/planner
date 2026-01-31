import { get, post, put, del } from './client';
import type {
  Initiative,
  InitiativeWithPlanCounts,
  CreateInitiativeInput,
  UpdateInitiativeInput,
} from '../types/initiative';

// Initiative operations

/**
 * List all initiatives for the default organization.
 * Returns initiatives with aggregated plan counts by status.
 */
export async function listInitiatives(): Promise<{ initiatives: InitiativeWithPlanCounts[] }> {
  return get<{ initiatives: InitiativeWithPlanCounts[] }>('/initiatives');
}

/**
 * Get a specific initiative by ID
 */
export async function getInitiative(id: string): Promise<Initiative> {
  return get<Initiative>(`/initiatives/${id}`);
}

/**
 * Create a new initiative
 */
export async function createInitiative(data: CreateInitiativeInput): Promise<Initiative> {
  return post<Initiative>('/initiatives', data);
}

/**
 * Update an existing initiative
 */
export async function updateInitiative(
  id: string,
  data: UpdateInitiativeInput
): Promise<Initiative> {
  return put<Initiative>(`/initiatives/${id}`, data);
}

/**
 * Delete an initiative
 */
export async function deleteInitiative(id: string): Promise<void> {
  await del<void>(`/initiatives/${id}`);
}

/**
 * Reorder initiatives by setting display_order
 * @param ids Array of initiative IDs in the desired order
 *
 * NOTE: This endpoint is not yet implemented in the backend.
 * Until the backend adds PUT /initiatives/reorder, this will fail with 404.
 * The frontend uses optimistic updates and refreshes, so the UI will revert
 * to server order on error.
 */
export async function reorderInitiatives(ids: string[]): Promise<void> {
  await put<void>('/initiatives/reorder', { ids });
}

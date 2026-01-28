import type { Plan, PlanVersion } from '../domain/plan.js';
import type { PlanStatus } from '../domain/status.js';
import type { ApprovalInfo } from '../domain/workflow.js';
import type { ChangeRequest, ChangeRequestStatus } from '../domain/change-request.js';

/**
 * PlanStorage interface defines all storage operations for plans and versions.
 */
export interface PlanStorage {
  // Plan operations
  createPlan(plan: Plan): Plan;
  getPlan(planId: string): Plan | null;
  updatePlan(planId: string): Plan | null;
  deletePlan(planId: string): boolean;
  listPlans(status?: PlanStatus): Plan[];

  // Version operations
  createVersion(version: PlanVersion): PlanVersion;
  getVersion(planId: string, version: number): PlanVersion | null;
  getLatestVersion(planId: string): PlanVersion | null;
  listVersions(planId: string): PlanVersion[];
  updateVersionStatus(
    planId: string,
    version: number,
    status: PlanStatus
  ): PlanVersion | null;

  // Workflow operations
  submitVersion(planId: string, version: number): PlanVersion | null;
  approveVersion(
    planId: string,
    version: number,
    approvalInfo: ApprovalInfo
  ): PlanVersion | null;

  // Change request operations
  createChangeRequest(changeRequest: ChangeRequest): ChangeRequest;
  getChangeRequest(changeRequestId: string): ChangeRequest | null;
  updateChangeRequestStatus(
    changeRequestId: string,
    status: ChangeRequestStatus,
    resultVersion?: number
  ): ChangeRequest | null;
  listChangeRequestsByPlan(planId: string): ChangeRequest[];
  listChangeRequestsByRun(runId: string): ChangeRequest[];
  getVersionByChangeRequest(changeRequestId: string): PlanVersion | null;

  // Transaction support
  transaction<T>(fn: () => T): T;

  // Lifecycle
  close(): void;
}

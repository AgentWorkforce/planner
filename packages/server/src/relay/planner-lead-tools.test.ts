/**
 * PlannerLead Tool Execution Tests
 *
 * Tests for tool schemas and execution handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteStorage } from '../../../planner/src/storage/sqlite/index.js';
import { createPlan, createPlanVersion } from '../../../planner/src/domain/plan.js';
import { createOrganization } from '../../../planner/src/domain/organization.js';
import {
  PLANNER_LEAD_TOOLS,
  executeTool,
  getMockToolResult,
  type ToolResult,
} from './planner-lead-tools/index.js';

describe('planner-lead-tools', () => {
  describe('PLANNER_LEAD_TOOLS schema', () => {
    it('defines read_plan tool', () => {
      const tool = PLANNER_LEAD_TOOLS.find((t) => t.name === 'read_plan');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Read a plan');
      expect(tool?.input_schema.required).toContain('plan_id');
    });

    it('defines list_plans tool', () => {
      const tool = PLANNER_LEAD_TOOLS.find((t) => t.name === 'list_plans');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('List all plans');
      expect(tool?.input_schema.required).toEqual([]);
    });

    it('defines add_step tool', () => {
      const tool = PLANNER_LEAD_TOOLS.find((t) => t.name === 'add_step');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Add a new step');
      expect(tool?.input_schema.required).toContain('plan_id');
      expect(tool?.input_schema.required).toContain('title');
    });

    it('defines edit_step tool', () => {
      const tool = PLANNER_LEAD_TOOLS.find((t) => t.name === 'edit_step');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Modify an existing step');
      expect(tool?.input_schema.required).toContain('plan_id');
      expect(tool?.input_schema.required).toContain('step_id');
    });

    it('has all required tools defined', () => {
      const requiredTools = ['read_plan', 'list_plans', 'add_step', 'edit_step'];
      for (const toolName of requiredTools) {
        expect(PLANNER_LEAD_TOOLS.find((t) => t.name === toolName)).toBeDefined();
      }
    });
  });

  describe('executeTool', () => {
    let storage: SqliteStorage;
    let planId: string;
    let testOrgId: string;

    beforeEach(() => {
      storage = new SqliteStorage(':memory:');

      // Get default org created by migrations, or create a test org
      const orgs = storage.listOrganizations();
      if (orgs.length > 0) {
        testOrgId = orgs[0]!.org_id;
      } else {
        const org = createOrganization('Test Org', 'test-org');
        storage.createOrganization(org);
        testOrgId = org.org_id;
      }

      // Create a test plan
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      planId = plan.plan_id;

      // Create initial version
      const version = createPlanVersion(planId, 'Test goal', { context: 'Test context' });
      storage.createVersion(version);
    });

    afterEach(() => {
      storage.close();
    });

    describe('read_plan', () => {
      it('returns plan details for valid plan_id', async () => {
        const result = await executeTool('read_plan', { plan_id: planId }, storage);

        expect(result.success).toBe(true);
        expect(result.result).toMatchObject({
          plan_id: planId,
          goal: 'Test goal',
          context: 'Test context',
          status: 'draft',
          version: 1,
          step_count: 0,
          steps: [],
        });
      });

      it('returns error for non-existent plan', async () => {
        const result = await executeTool(
          'read_plan',
          { plan_id: 'non-existent-uuid' },
          storage
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Plan not found');
      });
    });

    describe('list_plans', () => {
      it('returns all plans when no filter', async () => {
        const result = await executeTool('list_plans', {}, storage);

        expect(result.success).toBe(true);
        expect(Array.isArray(result.result)).toBe(true);
        expect((result.result as unknown[]).length).toBe(1);
      });

      it('filters by status', async () => {
        const result = await executeTool('list_plans', { status: 'draft' }, storage);

        expect(result.success).toBe(true);
        expect((result.result as unknown[]).length).toBe(1);

        const noResults = await executeTool(
          'list_plans',
          { status: 'approved' },
          storage
        );

        expect(noResults.success).toBe(true);
        expect((noResults.result as unknown[]).length).toBe(0);
      });
    });

    describe('add_step', () => {
      it('adds step to draft plan', async () => {
        const result = await executeTool(
          'add_step',
          {
            plan_id: planId,
            title: 'New step',
            description: 'Step description',
            scope: 'backend',
          },
          storage
        );

        expect(result.success).toBe(true);
        expect((result.result as Record<string, unknown>).title).toBe('New step');
        expect((result.result as Record<string, unknown>).step_id).toBeDefined();

        // Verify step was added
        const version = storage.getLatestVersion(planId);
        expect(version?.steps.length).toBe(1);
        expect(version?.steps[0].title).toBe('New step');
        expect(version?.version).toBe(2);
      });

      it('rejects adding step to non-draft plan', async () => {
        // Approve the plan
        storage.submitVersion(planId, 1);
        storage.approveVersion(planId, 1, { approved_by: 'test', approved_at: new Date().toISOString() });

        const result = await executeTool(
          'add_step',
          { plan_id: planId, title: 'New step' },
          storage
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot add steps to approved plan');
      });

      it('returns error for non-existent plan', async () => {
        const result = await executeTool(
          'add_step',
          { plan_id: 'non-existent', title: 'Step' },
          storage
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Plan not found');
      });
    });

    describe('edit_step', () => {
      let stepId: string;

      beforeEach(async () => {
        // Add a step first
        const addResult = await executeTool(
          'add_step',
          { plan_id: planId, title: 'Original title' },
          storage
        );
        stepId = (addResult.result as Record<string, unknown>).step_id as string;
      });

      it('edits step in draft plan', async () => {
        const result = await executeTool(
          'edit_step',
          {
            plan_id: planId,
            step_id: stepId,
            title: 'Updated title',
            description: 'New description',
          },
          storage
        );

        expect(result.success).toBe(true);
        expect((result.result as Record<string, unknown>).title).toBe('Updated title');

        // Verify step was updated
        const version = storage.getLatestVersion(planId);
        expect(version?.steps[0].title).toBe('Updated title');
        expect(version?.steps[0].description).toBe('New description');
      });

      it('rejects editing step in non-draft plan', async () => {
        // Create new version and approve it
        const version = storage.getLatestVersion(planId);
        storage.submitVersion(planId, version!.version);
        storage.approveVersion(planId, version!.version, {
          approved_by: 'test',
          approved_at: new Date().toISOString(),
        });

        const result = await executeTool(
          'edit_step',
          { plan_id: planId, step_id: stepId, title: 'Change' },
          storage
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot edit steps in approved plan');
      });

      it('returns error for non-existent step', async () => {
        const result = await executeTool(
          'edit_step',
          { plan_id: planId, step_id: 'non-existent', title: 'Change' },
          storage
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Step not found');
      });
    });

    describe('unknown tool', () => {
      it('returns error for unknown tool name', async () => {
        const result = await executeTool('unknown_tool', {}, storage);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown tool');
      });
    });
  });

  describe('getMockToolResult', () => {
    it('returns mock result for read_plan', () => {
      const result = getMockToolResult('read_plan', { plan_id: 'test-id' });

      expect(result.success).toBe(true);
      expect((result.result as Record<string, unknown>).plan_id).toBe('test-id');
      expect((result.result as Record<string, unknown>).steps).toBeDefined();
    });

    it('returns mock result for list_plans', () => {
      const result = getMockToolResult('list_plans', {});

      expect(result.success).toBe(true);
      expect(Array.isArray(result.result)).toBe(true);
    });

    it('returns mock result for add_step', () => {
      const result = getMockToolResult('add_step', { title: 'Test step' });

      expect(result.success).toBe(true);
      expect((result.result as Record<string, unknown>).title).toBe('Test step');
      expect((result.result as Record<string, unknown>).message).toContain('Mock');
    });

    it('returns mock result for edit_step', () => {
      const result = getMockToolResult('edit_step', { step_id: 'step-1', title: 'Changed' });

      expect(result.success).toBe(true);
      expect((result.result as Record<string, unknown>).step_id).toBe('step-1');
    });

    it('returns error for unknown tool', () => {
      const result = getMockToolResult('unknown', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteStorage } from '../../storage/sqlite.js';
import { createPlan, createPlanVersion } from '../../domain/plan.js';
import { createStep } from '../../domain/step.js';
import { handleToolCall, tools } from './index.js';

describe('MCP Tools', () => {
  let storage: SqliteStorage;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
  });

  afterEach(() => {
    storage.close();
  });

  function callTool(name: string, args: Record<string, unknown> = {}): { success: boolean; data?: unknown; error?: string } {
    const result = handleToolCall(storage, name, args);
    return JSON.parse((result.content[0] as { text: string }).text);
  }

  describe('tools registry', () => {
    it('should have all required tools', () => {
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('list_plans');
      expect(toolNames).toContain('read_plan');
      expect(toolNames).toContain('create_plan');
      expect(toolNames).toContain('add_step');
      expect(toolNames).toContain('edit_step');
      expect(toolNames).toContain('remove_step');
      expect(toolNames).toContain('set_dependencies');
      expect(toolNames).toContain('add_criteria');
      expect(toolNames).toContain('add_gate');
      expect(toolNames).toContain('submit_plan');
    });

    it('should have descriptions for all tools', () => {
      for (const tool of tools) {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe('list_plans', () => {
    it('should return empty array when no plans exist', () => {
      const result = callTool('list_plans');
      expect(result.success).toBe(true);
      expect((result.data as { plans: unknown[] }).plans).toEqual([]);
    });

    it('should return all plans', () => {
      // Create two plans
      const plan1 = createPlan();
      storage.createPlan(plan1);
      const version1 = createPlanVersion(plan1.plan_id, 'Goal 1');
      storage.createVersion(version1);

      const plan2 = createPlan();
      storage.createPlan(plan2);
      const version2 = createPlanVersion(plan2.plan_id, 'Goal 2');
      storage.createVersion(version2);

      const result = callTool('list_plans');
      expect(result.success).toBe(true);
      expect((result.data as { plans: unknown[] }).plans).toHaveLength(2);
    });

    it('should filter by status', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      const draftResult = callTool('list_plans', { status: 'draft' });
      expect((draftResult.data as { plans: unknown[] }).plans).toHaveLength(1);

      const approvedResult = callTool('list_plans', { status: 'approved' });
      expect((approvedResult.data as { plans: unknown[] }).plans).toHaveLength(0);
    });
  });

  describe('read_plan', () => {
    it('should return plan with latest version', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal', 'Test context');
      storage.createVersion(version);

      const result = callTool('read_plan', { plan_id: plan.plan_id });
      expect(result.success).toBe(true);

      const data = result.data as { plan: { plan_id: string }; version: { summary: { goal: string } } };
      expect(data.plan.plan_id).toBe(plan.plan_id);
      expect(data.version.summary.goal).toBe('Test goal');
    });

    it('should return error for missing plan', () => {
      const result = callTool('read_plan', { plan_id: '00000000-0000-0000-0000-000000000000' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should require plan_id', () => {
      const result = callTool('read_plan', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('create_plan', () => {
    it('should create plan with goal', () => {
      const result = callTool('create_plan', { goal: 'New plan goal' });
      expect(result.success).toBe(true);

      const data = result.data as { plan: { plan_id: string }; version: { summary: { goal: string }; status: string } };
      expect(data.plan.plan_id).toBeDefined();
      expect(data.version.summary.goal).toBe('New plan goal');
      expect(data.version.status).toBe('draft');
    });

    it('should create plan with goal and context', () => {
      const result = callTool('create_plan', {
        goal: 'Goal',
        context: 'Additional context'
      });
      expect(result.success).toBe(true);

      const data = result.data as { version: { summary: { context: string } } };
      expect(data.version.summary.context).toBe('Additional context');
    });

    it('should require goal', () => {
      const result = callTool('create_plan', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('add_step', () => {
    it('should add step to draft version', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      const result = callTool('add_step', {
        plan_id: plan.plan_id,
        title: 'New step',
        description: 'Step description',
        scope: 'backend',
      });

      expect(result.success).toBe(true);
      const data = result.data as { step: { title: string; scope: string }; version: { steps: unknown[] } };
      expect(data.step.title).toBe('New step');
      expect(data.step.scope).toBe('backend');
      expect(data.version.steps).toHaveLength(1);
    });

    it('should error on non-draft version', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);
      storage.submitVersion(plan.plan_id, 1);
      storage.approveVersion(plan.plan_id, 1, { approver: 'test', approved_at: new Date().toISOString() });

      const result = callTool('add_step', {
        plan_id: plan.plan_id,
        title: 'New step',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('draft');
    });
  });

  describe('edit_step', () => {
    it('should update step fields', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Original title');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('edit_step', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        title: 'Updated title',
        description: 'New description',
      });

      expect(result.success).toBe(true);
      const data = result.data as { step: { title: string; description: string } };
      expect(data.step.title).toBe('Updated title');
      expect(data.step.description).toBe('New description');
    });

    it('should error on missing step', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      const result = callTool('edit_step', {
        plan_id: plan.plan_id,
        step_id: '00000000-0000-0000-0000-000000000000',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('remove_step', () => {
    it('should remove step from version', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step1 = createStep('Step 1');
      const step2 = createStep('Step 2');
      version.steps = [step1, step2];
      storage.createVersion(version);

      const result = callTool('remove_step', {
        plan_id: plan.plan_id,
        step_id: step1.step_id,
      });

      expect(result.success).toBe(true);
      const data = result.data as { version: { steps: Array<{ title: string }> } };
      expect(data.version.steps).toHaveLength(1);
      expect(data.version.steps[0]!.title).toBe('Step 2');
    });

    it('should clean up dependencies', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step1 = createStep('Step 1');
      const step2 = createStep('Step 2', { dependencies: [step1.step_id] });
      version.steps = [step1, step2];
      storage.createVersion(version);

      const result = callTool('remove_step', {
        plan_id: plan.plan_id,
        step_id: step1.step_id,
      });

      expect(result.success).toBe(true);
      const data = result.data as { version: { steps: Array<{ dependencies: string[] }> } };
      expect(data.version.steps[0]!.dependencies).toEqual([]);
    });
  });

  describe('set_dependencies', () => {
    it('should set dependencies for a step', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step1 = createStep('Step 1');
      const step2 = createStep('Step 2');
      version.steps = [step1, step2];
      storage.createVersion(version);

      const result = callTool('set_dependencies', {
        plan_id: plan.plan_id,
        step_id: step2.step_id,
        dependencies: [step1.step_id],
      });

      expect(result.success).toBe(true);
      const data = result.data as { step: { dependencies: string[] } };
      expect(data.step.dependencies).toEqual([step1.step_id]);
    });

    it('should error on missing dependency', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('set_dependencies', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        dependencies: ['non-existent-id'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should error on self-dependency', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('set_dependencies', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        dependencies: [step.step_id],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('itself');
    });
  });

  describe('add_criteria', () => {
    it('should add criterion to step', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('add_criteria', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        description: 'Tests pass',
        type: 'test',
      });

      expect(result.success).toBe(true);
      const data = result.data as { step: { acceptance_criteria: Array<{ description: string; type: string }> }; criterion: { id: string } };
      expect(data.step.acceptance_criteria).toHaveLength(1);
      expect(data.step.acceptance_criteria[0]!.description).toBe('Tests pass');
      expect(data.step.acceptance_criteria[0]!.type).toBe('test');
      expect(data.criterion.id).toBeDefined();
    });
  });

  describe('add_gate', () => {
    it('should add gate to step', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('add_gate', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        approver_role: 'tech_lead',
      });

      expect(result.success).toBe(true);
      const data = result.data as { step: { gate: { type: string; approver_role: string } } };
      expect(data.step.gate.type).toBe('human_approval');
      expect(data.step.gate.approver_role).toBe('tech_lead');
    });

    it('should add gate without approver_role', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('add_gate', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
      });

      expect(result.success).toBe(true);
      const data = result.data as { step: { gate: { type: string; approver_role?: string } } };
      expect(data.step.gate.type).toBe('human_approval');
      expect(data.step.gate.approver_role).toBeUndefined();
    });
  });

  describe('submit_plan', () => {
    it('should submit draft version', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      const result = callTool('submit_plan', { plan_id: plan.plan_id });

      expect(result.success).toBe(true);
      const data = result.data as { version: { submitted_at: string } };
      expect(data.version.submitted_at).toBeDefined();
    });

    it('should error if already submitted', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);
      storage.submitVersion(plan.plan_id, 1);

      const result = callTool('submit_plan', { plan_id: plan.plan_id });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already submitted');
    });

    it('should error on non-draft version', () => {
      const plan = createPlan();
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);
      storage.submitVersion(plan.plan_id, 1);
      storage.approveVersion(plan.plan_id, 1, { approver: 'test', approved_at: new Date().toISOString() });

      const result = callTool('submit_plan', { plan_id: plan.plan_id });

      expect(result.success).toBe(false);
      expect(result.error).toContain('draft');
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool', () => {
      const result = callTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });
});

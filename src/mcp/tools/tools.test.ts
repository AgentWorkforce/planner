import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteStorage } from '../../storage/sqlite.js';
import { createPlan, createPlanVersion } from '../../domain/plan.js';
import { createStep } from '../../domain/step.js';
import { createOrganization } from '../../domain/organization.js';
import { handleToolCall, tools } from './index.js';

describe('MCP Tools', () => {
  let storage: SqliteStorage;
  let testOrgId: string;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:', { skipSeed: true });

    // Get default org created by migrations, or create a test org
    const orgs = storage.listOrganizations();
    if (orgs.length > 0) {
      testOrgId = orgs[0]!.org_id;
    } else {
      const org = createOrganization('Test Org', 'test-org');
      storage.createOrganization(org);
      testOrgId = org.org_id;
    }
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
        expect(tool.description!.length).toBeGreaterThan(10);
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
      const plan1 = createPlan(testOrgId);
      storage.createPlan(plan1);
      const version1 = createPlanVersion(plan1.plan_id, 'Goal 1');
      storage.createVersion(version1);

      const plan2 = createPlan(testOrgId);
      storage.createPlan(plan2);
      const version2 = createPlanVersion(plan2.plan_id, 'Goal 2');
      storage.createVersion(version2);

      const result = callTool('list_plans');
      expect(result.success).toBe(true);
      expect((result.data as { plans: unknown[] }).plans).toHaveLength(2);
    });

    it('should filter by status', () => {
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
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
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      const result = callTool('submit_plan', { plan_id: plan.plan_id });

      expect(result.success).toBe(true);
      const data = result.data as { version: { submitted_at: string } };
      expect(data.version.submitted_at).toBeDefined();
    });

    it('should error if already submitted', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);
      storage.submitVersion(plan.plan_id, 1);

      const result = callTool('submit_plan', { plan_id: plan.plan_id });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already submitted');
    });

    it('should error on non-draft version', () => {
      const plan = createPlan(testOrgId);
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

  describe('optimistic locking', () => {
    it('should succeed when expected_version matches current version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      // expected_version = 1 (current version)
      const result = callTool('add_step', {
        plan_id: plan.plan_id,
        title: 'New Step',
        expected_version: 1,
      });

      expect(result.success).toBe(true);
    });

    it('should return VERSION_CONFLICT when expected_version does not match', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      // Simulate a stale version (expected_version = 0, but current is 1)
      const result = callTool('add_step', {
        plan_id: plan.plan_id,
        title: 'New Step',
        expected_version: 0, // stale
      }) as { success: false; error: string; expected_version: number; current_version: number };

      expect(result.success).toBe(false);
      expect(result.error).toBe('VERSION_CONFLICT');
      expect(result.expected_version).toBe(0);
      expect(result.current_version).toBe(1);
    });

    it('should work without expected_version (backward compatible)', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      // No expected_version provided - should work
      const result = callTool('add_step', {
        plan_id: plan.plan_id,
        title: 'New Step',
      });

      expect(result.success).toBe(true);
    });

    it('should detect conflict on edit_step', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step 1');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('edit_step', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        title: 'Updated Step',
        expected_version: 99, // way off
      }) as { success: false; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe('VERSION_CONFLICT');
    });

    it('should detect conflict on remove_step', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step 1');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('remove_step', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        expected_version: 99,
      }) as { success: false; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe('VERSION_CONFLICT');
    });

    it('should detect conflict on set_dependencies', () => {
      const plan = createPlan(testOrgId);
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
        expected_version: 99,
      }) as { success: false; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe('VERSION_CONFLICT');
    });

    it('should detect conflict on add_criteria', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step 1');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('add_criteria', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        description: 'Test passes',
        expected_version: 99,
      }) as { success: false; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe('VERSION_CONFLICT');
    });

    it('should detect conflict on add_gate', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Goal');
      const step = createStep('Step 1');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('add_gate', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        expected_version: 99,
      }) as { success: false; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe('VERSION_CONFLICT');
    });
  });

  describe('suggest_improvement', () => {
    it('should be in the tools registry', () => {
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('suggest_improvement');
    });

    it('should create an improvement', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('suggest_improvement', {
        plan_id: plan.plan_id,
        version: 1,
        type: 'missing_criteria',
        description: 'Step lacks acceptance criteria',
      });

      expect(result.success).toBe(true);
      const data = result.data as { improvement: { improvement_id: string; type: string } };
      expect(data.improvement.improvement_id).toBeDefined();
      expect(data.improvement.type).toBe('missing_criteria');
    });

    it('should create improvement with step_id', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const step = createStep('Test step');
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('suggest_improvement', {
        plan_id: plan.plan_id,
        version: 1,
        type: 'unclear_description',
        description: 'Step description is vague',
        step_id: step.step_id,
      });

      expect(result.success).toBe(true);
      const data = result.data as { improvement: { step_id: string } };
      expect(data.improvement.step_id).toBe(step.step_id);
    });

    it('should create improvement with suggested_change', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const suggestedChange = {
        acceptance_criteria: [{ id: 'ac-1', description: 'Test passes' }],
      };

      const result = callTool('suggest_improvement', {
        plan_id: plan.plan_id,
        version: 1,
        type: 'missing_criteria',
        description: 'Add acceptance criteria',
        suggested_change: suggestedChange,
      });

      expect(result.success).toBe(true);
      const data = result.data as { improvement: { suggested_change: unknown } };
      expect(data.improvement.suggested_change).toEqual(suggestedChange);
    });

    it('should return error for missing plan', () => {
      const result = callTool('suggest_improvement', {
        plan_id: '00000000-0000-0000-0000-000000000000',
        version: 1,
        type: 'missing_criteria',
        description: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });

    it('should return error for missing version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('suggest_improvement', {
        plan_id: plan.plan_id,
        version: 99,
        type: 'missing_criteria',
        description: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version 99 not found');
    });

    it('should return error for invalid step_id', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('suggest_improvement', {
        plan_id: plan.plan_id,
        version: 1,
        type: 'missing_criteria',
        description: 'Test',
        step_id: 'non-existent-step',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Step not found');
    });

    it('should return error for invalid improvement type', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('suggest_improvement', {
        plan_id: plan.plan_id,
        version: 1,
        type: 'invalid_type',
        description: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid improvement type');
    });

    it('should return error for missing required fields', () => {
      const result1 = callTool('suggest_improvement', {
        version: 1,
        type: 'missing_criteria',
        description: 'Test',
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('plan_id is required');

      const result2 = callTool('suggest_improvement', {
        plan_id: '00000000-0000-0000-0000-000000000000',
        type: 'missing_criteria',
        description: 'Test',
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('version is required');

      const result3 = callTool('suggest_improvement', {
        plan_id: '00000000-0000-0000-0000-000000000000',
        version: 1,
        description: 'Test',
      });
      expect(result3.success).toBe(false);
      expect(result3.error).toContain('type is required');

      const result4 = callTool('suggest_improvement', {
        plan_id: '00000000-0000-0000-0000-000000000000',
        version: 1,
        type: 'missing_criteria',
      });
      expect(result4.success).toBe(false);
      expect(result4.error).toContain('description is required');
    });

    it('should support all valid improvement types', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const types = [
        'missing_criteria',
        'unclear_description',
        'missing_dependency',
        'redundant_step',
        'scope_suggestion',
      ];

      for (const type of types) {
        const result = callTool('suggest_improvement', {
          plan_id: plan.plan_id,
          version: 1,
          type,
          description: `Test ${type}`,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('create_draft_version', () => {
    it('should be in the tools registry', () => {
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('create_draft_version');
    });

    it('should create draft from approved version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step = createStep('Test step');
      version.steps = [step];
      storage.createVersion(version);

      // Approve the version
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
      });

      expect(result.success).toBe(true);
      const data = result.data as { version: { version: number; status: string; steps: unknown[] } };
      expect(data.version.version).toBe(2);
      expect(data.version.status).toBe('draft');
      expect(data.version.steps).toHaveLength(1);
    });

    it('should create draft from published version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      // Approve then set to published manually
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });
      // Use updateVersionStatus to set to published
      storage.updateVersionStatus(plan.plan_id, 1, 'published');

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
      });

      expect(result.success).toBe(true);
      const data = result.data as { version: { version: number; status: string } };
      expect(data.version.version).toBe(2);
      expect(data.version.status).toBe('draft');
    });

    it('should include change_request_id when provided', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      // Create a change request first
      const changeRequestId = crypto.randomUUID();
      storage.createChangeRequest({
        change_request_id: changeRequestId,
        run_id: 'test-run',
        plan_id: plan.plan_id,
        reason: 'Test reason',
        suggested_changes: {},
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
        change_request_id: changeRequestId,
      });

      expect(result.success).toBe(true);
      const data = result.data as { version: { change_request_id: string } };
      expect(data.version.change_request_id).toBe(changeRequestId);
    });

    it('should include revision_source in metadata', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
        revision_source: 'agent',
      });

      expect(result.success).toBe(true);
      const data = result.data as { version: { metadata: { revision_source: string; source_version: number } } };
      expect(data.version.metadata.revision_source).toBe('agent');
      expect(data.version.metadata.source_version).toBe(1);
    });

    it('should default revision_source to agent', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
      });

      expect(result.success).toBe(true);
      const data = result.data as { version: { metadata: { revision_source: string } } };
      expect(data.version.metadata.revision_source).toBe('agent');
    });

    it('should return error for missing plan', () => {
      const result = callTool('create_draft_version', {
        plan_id: '00000000-0000-0000-0000-000000000000',
        source_version: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });

    it('should return error for missing version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 99,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version 99 not found');
    });

    it('should return error when source version is draft', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Can only create draft from approved or published versions');
    });

    it('should return error for missing required fields', () => {
      const result1 = callTool('create_draft_version', {
        source_version: 1,
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('plan_id is required');

      const result2 = callTool('create_draft_version', {
        plan_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('source_version is required');
    });

    it('should copy steps from source version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step1 = createStep('Step 1');
      const step2 = createStep('Step 2');
      step2.dependencies = [step1.step_id];
      version.steps = [step1, step2];
      storage.createVersion(version);
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
      });

      expect(result.success).toBe(true);
      const data = result.data as { version: { steps: Array<{ step_id: string; dependencies: string[] }> } };
      expect(data.version.steps).toHaveLength(2);
      expect(data.version.steps[1]!.dependencies).toContain(step1.step_id);
    });

    it('should update change request revision status to drafted', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      // Create a change request
      const changeRequestId = crypto.randomUUID();
      storage.createChangeRequest({
        change_request_id: changeRequestId,
        run_id: 'test-run',
        plan_id: plan.plan_id,
        reason: 'Test reason',
        suggested_changes: {},
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
        change_request_id: changeRequestId,
        revision_source: 'agent',
      });

      expect(result.success).toBe(true);

      // Check change request was updated
      const updatedChangeRequest = storage.getChangeRequest(changeRequestId);
      expect(updatedChangeRequest).not.toBeNull();
      expect(updatedChangeRequest!.revision_status).toBe('drafted');
    });

    it('should return error for non-existent change request', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);
      storage.approveVersion(plan.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      const result = callTool('create_draft_version', {
        plan_id: plan.plan_id,
        source_version: 1,
        change_request_id: crypto.randomUUID(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Change request not found');
    });

    it('should return error when change request belongs to different plan', () => {
      const plan1 = createPlan(testOrgId);
      storage.createPlan(plan1);
      const version1 = createPlanVersion(plan1.plan_id, 'Test goal 1');
      storage.createVersion(version1);
      storage.approveVersion(plan1.plan_id, 1, { approver: 'Approver', approved_at: new Date().toISOString() });

      const plan2 = createPlan(testOrgId);
      storage.createPlan(plan2);

      // Create change request for plan2
      const changeRequestId = crypto.randomUUID();
      storage.createChangeRequest({
        change_request_id: changeRequestId,
        run_id: 'test-run',
        plan_id: plan2.plan_id,
        reason: 'Test reason',
        suggested_changes: {},
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Try to use it with plan1
      const result = callTool('create_draft_version', {
        plan_id: plan1.plan_id,
        source_version: 1,
        change_request_id: changeRequestId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not belong to plan');
    });
  });

  describe('update_understanding', () => {
    it('should be in the tools registry', () => {
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('update_understanding');
    });

    it('should add observations for a new role', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('update_understanding', {
        plan_id: plan.plan_id,
        role: 'architect',
        observations: ['Found existing auth pattern'],
        keywords: ['auth', 'security'],
        confidence: 'forming',
      });

      expect(result.success).toBe(true);
      expect((result.data as { role: string }).role).toBe('architect');
      const obs = (result.data as { observations: { observations: string[]; keywords: string[]; confidence: string } }).observations;
      expect(obs.observations).toContain('Found existing auth pattern');
      expect(obs.keywords).toContain('auth');
      expect(obs.confidence).toBe('forming');
    });

    it('should merge with existing observations', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      // First update
      callTool('update_understanding', {
        plan_id: plan.plan_id,
        role: 'architect',
        observations: ['First observation'],
        keywords: ['keyword1'],
      });

      // Second update should merge
      const result = callTool('update_understanding', {
        plan_id: plan.plan_id,
        role: 'architect',
        observations: ['Second observation'],
        keywords: ['keyword2'],
      });

      expect(result.success).toBe(true);
      const obs = (result.data as { observations: { observations: string[]; keywords: string[] } }).observations;
      expect(obs.observations).toContain('First observation');
      expect(obs.observations).toContain('Second observation');
      expect(obs.keywords).toContain('keyword1');
      expect(obs.keywords).toContain('keyword2');
    });

    it('should return error for invalid confidence', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('update_understanding', {
        plan_id: plan.plan_id,
        role: 'architect',
        confidence: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid confidence');
    });

    it('should return error for non-draft version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);
      storage.submitVersion(plan.plan_id, version.version);
      storage.approveVersion(plan.plan_id, version.version, {
        approver: 'test',
        approved_at: new Date().toISOString(),
      });

      const result = callTool('update_understanding', {
        plan_id: plan.plan_id,
        role: 'architect',
        observations: ['Test'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('draft');
    });

    it('should return error for missing plan', () => {
      const result = callTool('update_understanding', {
        plan_id: 'nonexistent',
        role: 'architect',
        observations: ['Test'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });
  });

  describe('update_step_specification', () => {
    it('should be in the tools registry', () => {
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('update_step_specification');
    });

    it('should add specification to step', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step = createStep('Test step');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('update_step_specification', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        domain: 'architecture',
        specification: {
          decisions: [{ decision_id: 'd001', decision: 'Use PostgreSQL', rationale: 'Better for relational data' }],
        },
      });

      expect(result.success).toBe(true);
      expect((result.data as { domain: string }).domain).toBe('architecture');
      const spec = (result.data as { specification: { decisions: Array<{ decision_id: string }> } }).specification;
      expect(spec.decisions).toHaveLength(1);
      expect(spec.decisions[0].decision_id).toBe('d001');
    });

    it('should merge with existing specification', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step = createStep('Test step');
      version.steps = [step];
      storage.createVersion(version);

      // First update
      callTool('update_step_specification', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        domain: 'testing',
        specification: {
          test_cases: [{ case_id: 't1', type: 'happy', description: 'Test 1' }],
        },
      });

      // Second update should merge
      const result = callTool('update_step_specification', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        domain: 'testing',
        specification: {
          test_cases: [{ case_id: 't2', type: 'edge', description: 'Test 2' }],
          coverage_notes: '80% target',
        },
      });

      expect(result.success).toBe(true);
      const spec = (result.data as { specification: { test_cases: Array<{ case_id: string }>; coverage_notes: string } }).specification;
      expect(spec.test_cases).toHaveLength(2);
      expect(spec.coverage_notes).toBe('80% target');
    });

    it('should return error for invalid domain', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step = createStep('Test step');
      version.steps = [step];
      storage.createVersion(version);

      const result = callTool('update_step_specification', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        domain: 'invalid',
        specification: { test: 'data' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid domain');
    });

    it('should return error for unknown step', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('update_step_specification', {
        plan_id: plan.plan_id,
        step_id: 'nonexistent',
        domain: 'architecture',
        specification: { test: 'data' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Step not found');
    });

    it('should return error for non-draft version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step = createStep('Test step');
      version.steps = [step];
      storage.createVersion(version);
      storage.submitVersion(plan.plan_id, version.version);
      storage.approveVersion(plan.plan_id, version.version, {
        approver: 'test',
        approved_at: new Date().toISOString(),
      });

      const result = callTool('update_step_specification', {
        plan_id: plan.plan_id,
        step_id: step.step_id,
        domain: 'architecture',
        specification: { test: 'data' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('draft');
    });
  });

  describe('read_plan with understanding and specification', () => {
    it('should include understanding in response', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      // Add understanding
      storage.updateVersionUnderstanding(plan.plan_id, version.version, 'architect', {
        observations: ['Test observation'],
      });

      const result = callTool('read_plan', { plan_id: plan.plan_id });

      expect(result.success).toBe(true);
      const data = result.data as { version: { understanding: { architect: { observations: string[] } } } };
      expect(data.version.understanding.architect.observations).toContain('Test observation');
    });

    it('should include step specification in response', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      const step = createStep('Test step');
      version.steps = [step];
      storage.createVersion(version);

      // Add specification
      storage.updateStepSpecification(plan.plan_id, version.version, step.step_id, 'architecture', {
        decisions: [{ decision_id: 'd1', decision: 'Test decision' }],
      });

      const result = callTool('read_plan', { plan_id: plan.plan_id });

      expect(result.success).toBe(true);
      const data = result.data as { version: { steps: Array<{ specification: { architecture: { decisions: Array<{ decision_id: string }> } } }> } };
      expect(data.version.steps[0].specification.architecture.decisions[0].decision_id).toBe('d1');
    });
  });

  describe('get_plan_context', () => {
    it('should be in the tools registry', () => {
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('get_plan_context');
    });

    it('should return empty context when not set', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('get_plan_context', {
        plan_id: plan.plan_id,
      });

      expect(result.success).toBe(true);
      expect((result.data as { context: Record<string, unknown> }).context).toEqual({});
    });

    it('should return context when present', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      // Add context
      storage.updateVersionContext(plan.plan_id, version.version, 'designer', {
        library: 'shadcn/ui',
        theme: 'dark mode',
      });

      const result = callTool('get_plan_context', {
        plan_id: plan.plan_id,
      });

      expect(result.success).toBe(true);
      const data = result.data as { context: Record<string, Record<string, unknown>> };
      expect(data.context.designer).toBeDefined();
      expect(data.context.designer!.library).toBe('shadcn/ui');
      expect(data.context.designer!.theme).toBe('dark mode');
    });

    it('should return specific version context', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version1 = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version1);

      // Add context to version 1
      storage.updateVersionContext(plan.plan_id, version1.version, 'designer', {
        library: 'shadcn/ui',
      });

      const result = callTool('get_plan_context', {
        plan_id: plan.plan_id,
        version: 1,
      });

      expect(result.success).toBe(true);
      expect((result.data as { version: number }).version).toBe(1);
    });

    it('should return error for missing plan', () => {
      const result = callTool('get_plan_context', {
        plan_id: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });

    it('should return error for missing version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('get_plan_context', {
        plan_id: plan.plan_id,
        version: 99,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Version 99 not found');
    });
  });

  describe('update_plan_context', () => {
    it('should be in the tools registry', () => {
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('update_plan_context');
    });

    it('should add context for a new role', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('update_plan_context', {
        plan_id: plan.plan_id,
        role: 'designer',
        fields: {
          library: 'shadcn/ui',
          theme: 'dark mode',
        },
      });

      expect(result.success).toBe(true);
      expect((result.data as { role: string }).role).toBe('designer');
      const context = (result.data as { context: Record<string, unknown> }).context;
      expect(context.library).toBe('shadcn/ui');
      expect(context.theme).toBe('dark mode');
    });

    it('should merge with existing context', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      // First update
      callTool('update_plan_context', {
        plan_id: plan.plan_id,
        role: 'designer',
        fields: {
          library: 'shadcn/ui',
        },
      });

      // Second update should merge
      const result = callTool('update_plan_context', {
        plan_id: plan.plan_id,
        role: 'designer',
        fields: {
          theme: 'dark mode',
        },
      });

      expect(result.success).toBe(true);
      const context = (result.data as { context: Record<string, unknown> }).context;
      expect(context.library).toBe('shadcn/ui');
      expect(context.theme).toBe('dark mode');
    });

    it('should support custom role names', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('update_plan_context', {
        plan_id: plan.plan_id,
        role: 'qa_lead',
        fields: {
          custom_field: 'custom value',
        },
      });

      expect(result.success).toBe(true);
      expect((result.data as { role: string }).role).toBe('qa_lead');
    });

    it('should support nested objects and arrays', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('update_plan_context', {
        plan_id: plan.plan_id,
        role: 'architect',
        fields: {
          boundaries: {
            components: ['auth', 'api'],
            services: ['planner-core', 'orchestrator'],
          },
          tech_stack: ['TypeScript', 'Express'],
        },
      });

      expect(result.success).toBe(true);
      const context = (result.data as { context: Record<string, unknown> }).context;
      expect((context.boundaries as Record<string, unknown>).components).toEqual(['auth', 'api']);
      expect(context.tech_stack).toEqual(['TypeScript', 'Express']);
    });

    it('should return error for non-draft version', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);
      storage.submitVersion(plan.plan_id, version.version);
      storage.approveVersion(plan.plan_id, version.version, {
        approver: 'test',
        approved_at: new Date().toISOString(),
      });

      const result = callTool('update_plan_context', {
        plan_id: plan.plan_id,
        role: 'designer',
        fields: { library: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('draft');
    });

    it('should return error for missing plan', () => {
      const result = callTool('update_plan_context', {
        plan_id: 'nonexistent',
        role: 'designer',
        fields: { library: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan not found');
    });

    it('should return error for missing role', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('update_plan_context', {
        plan_id: plan.plan_id,
        fields: { library: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('role is required');
    });

    it('should return error for missing fields', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);
      const version = createPlanVersion(plan.plan_id, 'Test goal');
      storage.createVersion(version);

      const result = callTool('update_plan_context', {
        plan_id: plan.plan_id,
        role: 'designer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('fields is required');
    });
  });
});

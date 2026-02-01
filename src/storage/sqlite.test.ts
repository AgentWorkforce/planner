import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteStorage } from './sqlite.js';
import { createPlan, createPlanVersion } from '../domain/plan.js';
import { createStep } from '../domain/step.js';
import { PlanStatus } from '../domain/status.js';
import { createOrganization, createInitiative, InitiativeStatus } from '../domain/organization.js';

describe('SqliteStorage', () => {
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

  describe('Plan operations', () => {
    it('should create and retrieve a plan', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);

      const retrieved = storage.getPlan(plan.plan_id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.plan_id).toBe(plan.plan_id);
      expect(retrieved?.created_at).toBe(plan.created_at);
    });

    it('should return null for non-existent plan', () => {
      const result = storage.getPlan('non-existent-id');
      expect(result).toBeNull();
    });

    it('should update a plan', () => {
      // Create plan with a past timestamp to ensure update produces different timestamp
      const plan = createPlan(testOrgId);
      const pastTime = '2020-01-01T00:00:00.000Z';
      const planWithPastTime = { ...plan, updated_at: pastTime };
      storage.createPlan(planWithPastTime);

      const updated = storage.updatePlan(plan.plan_id);

      expect(updated).not.toBeNull();
      expect(updated?.updated_at).not.toBe(pastTime);
    });

    it('should return null when updating non-existent plan', () => {
      const result = storage.updatePlan('non-existent-id');
      expect(result).toBeNull();
    });

    it('should delete a plan', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);

      const deleted = storage.deletePlan(plan.plan_id);
      expect(deleted).toBe(true);

      const retrieved = storage.getPlan(plan.plan_id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent plan', () => {
      const result = storage.deletePlan('non-existent-id');
      expect(result).toBe(false);
    });

    it('should list all plans', () => {
      const plan1 = createPlan(testOrgId);
      const plan2 = createPlan(testOrgId);
      storage.createPlan(plan1);
      storage.createPlan(plan2);

      const plans = storage.listPlans();
      expect(plans).toHaveLength(2);
    });

    it('should list plans by version status', () => {
      const plan1 = createPlan(testOrgId);
      const plan2 = createPlan(testOrgId);
      storage.createPlan(plan1);
      storage.createPlan(plan2);

      const version1 = createPlanVersion(plan1.plan_id, 'Draft goal');
      const version2 = createPlanVersion(plan2.plan_id, 'Approved goal');
      storage.createVersion(version1);
      storage.createVersion(version2);
      storage.updateVersionStatus(plan2.plan_id, 1, PlanStatus.Approved);

      const draftPlans = storage.listPlans({ status: PlanStatus.Draft });
      expect(draftPlans).toHaveLength(1);
      expect(draftPlans[0]!.plan_id).toBe(plan1.plan_id);

      const approvedPlans = storage.listPlans({ status: PlanStatus.Approved });
      expect(approvedPlans).toHaveLength(1);
      expect(approvedPlans[0]!.plan_id).toBe(plan2.plan_id);
    });

    it('should cascade delete versions and steps when plan is deleted', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);

      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [createStep('Step 1'), createStep('Step 2')];
      storage.createVersion(version);

      storage.deletePlan(plan.plan_id);

      const retrievedVersion = storage.getVersion(plan.plan_id, 1);
      expect(retrievedVersion).toBeNull();
    });
  });

  describe('Version operations', () => {
    let plan: ReturnType<typeof createPlan>;

    beforeEach(() => {
      plan = createPlan(testOrgId);
      storage.createPlan(plan);
    });

    it('should create and retrieve a version', () => {
      const version = createPlanVersion(plan.plan_id, 'Test goal', 'Test context');
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.plan_id).toBe(plan.plan_id);
      expect(retrieved?.version).toBe(1);
      expect(retrieved?.status).toBe(PlanStatus.Draft);
      expect(retrieved?.summary.goal).toBe('Test goal');
      expect(retrieved?.summary.context).toBe('Test context');
    });

    it('should create version with steps', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [
        createStep('Step 1', { scope: 'backend' }),
        createStep('Step 2', { scope: 'frontend', dependencies: [] }),
      ];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.steps).toHaveLength(2);
      expect(retrieved?.steps[0]!.title).toBe('Step 1');
      expect(retrieved?.steps[0]!.scope).toBe('backend');
      expect(retrieved?.steps[1]!.title).toBe('Step 2');
    });

    it('should preserve step order', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [
        createStep('First'),
        createStep('Second'),
        createStep('Third'),
      ];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.steps[0]!.title).toBe('First');
      expect(retrieved?.steps[1]!.title).toBe('Second');
      expect(retrieved?.steps[2]!.title).toBe('Third');
    });

    it('should return null for non-existent version', () => {
      const result = storage.getVersion(plan.plan_id, 999);
      expect(result).toBeNull();
    });

    it('should get latest version', () => {
      const v1 = createPlanVersion(plan.plan_id, 'Goal v1');
      const v2 = { ...createPlanVersion(plan.plan_id, 'Goal v2'), version: 2 };
      storage.createVersion(v1);
      storage.createVersion(v2);

      const latest = storage.getLatestVersion(plan.plan_id);
      expect(latest?.version).toBe(2);
      expect(latest?.summary.goal).toBe('Goal v2');
    });

    it('should return null for latest version when no versions exist', () => {
      const result = storage.getLatestVersion(plan.plan_id);
      expect(result).toBeNull();
    });

    it('should list all versions for a plan', () => {
      const v1 = createPlanVersion(plan.plan_id, 'Goal v1');
      const v2 = { ...createPlanVersion(plan.plan_id, 'Goal v2'), version: 2 };
      const v3 = { ...createPlanVersion(plan.plan_id, 'Goal v3'), version: 3 };
      storage.createVersion(v1);
      storage.createVersion(v2);
      storage.createVersion(v3);

      const versions = storage.listVersions(plan.plan_id);
      expect(versions).toHaveLength(3);
      expect(versions[0]!.version).toBe(1);
      expect(versions[1]!.version).toBe(2);
      expect(versions[2]!.version).toBe(3);
    });

    it('should update version status', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      const updated = storage.updateVersionStatus(
        plan.plan_id,
        1,
        PlanStatus.Approved
      );
      expect(updated?.status).toBe(PlanStatus.Approved);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.status).toBe(PlanStatus.Approved);
    });

    it('should return null when updating non-existent version', () => {
      const result = storage.updateVersionStatus(
        plan.plan_id,
        999,
        PlanStatus.Approved
      );
      expect(result).toBeNull();
    });

    it('should update plan updated_at when creating version', () => {
      // Update plan with a past timestamp to ensure version creation updates it
      const pastTime = '2020-01-01T00:00:00.000Z';
      storage.transaction(() => {
        const stmt = (storage as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db.prepare(
          'UPDATE plans SET updated_at = ? WHERE plan_id = ?'
        );
        stmt.run(pastTime, plan.plan_id);
      });

      const version = createPlanVersion(plan.plan_id, 'Goal');
      storage.createVersion(version);

      const updatedPlan = storage.getPlan(plan.plan_id);
      expect(updatedPlan?.updated_at).not.toBe(pastTime);
    });
  });

  describe('Transaction support', () => {
    it('should execute operations in a transaction', () => {
      const plan = createPlan(testOrgId);

      storage.transaction(() => {
        storage.createPlan(plan);
        const version = createPlanVersion(plan.plan_id, 'Goal');
        storage.createVersion(version);
      });

      const retrieved = storage.getPlan(plan.plan_id);
      expect(retrieved).not.toBeNull();

      const versions = storage.listVersions(plan.plan_id);
      expect(versions).toHaveLength(1);
    });

    it('should rollback on error', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);

      try {
        storage.transaction(() => {
          const version = createPlanVersion(plan.plan_id, 'Goal');
          storage.createVersion(version);
          // This will fail - duplicate primary key
          storage.createVersion(version);
        });
      } catch {
        // Expected to fail
      }

      // Transaction rolled back - no version should exist
      const versions = storage.listVersions(plan.plan_id);
      expect(versions).toHaveLength(0);
    });

    it('should return value from transaction', () => {
      const plan = createPlan(testOrgId);

      const result = storage.transaction(() => {
        storage.createPlan(plan);
        return plan.plan_id;
      });

      expect(result).toBe(plan.plan_id);
    });
  });

  describe('Step storage', () => {
    let plan: ReturnType<typeof createPlan>;

    beforeEach(() => {
      plan = createPlan(testOrgId);
      storage.createPlan(plan);
    });

    it('should store and retrieve steps with all fields', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [
        createStep('Complex step', {
          scope: 'backend',
          description: 'A complex step with all fields',
          owner_role: 'backend:Coder',
          dependencies: [],
          acceptance_criteria: [
            { id: 'ac1', description: 'Criterion 1', type: 'test' },
            { id: 'ac2', description: 'Criterion 2' },
          ],
          gate: { type: 'human_approval', approver_role: 'tech_lead' },
        }),
      ];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      const step = retrieved?.steps[0];

      expect(step?.scope).toBe('backend');
      expect(step?.description).toBe('A complex step with all fields');
      expect(step?.owner_role).toBe('backend:Coder');
      expect(step?.acceptance_criteria).toHaveLength(2);
      expect(step?.acceptance_criteria?.[0]!.type).toBe('test');
      expect(step?.gate?.type).toBe('human_approval');
      expect(step?.gate?.approver_role).toBe('tech_lead');
    });

    it('should store steps with dependencies', () => {
      const step1 = createStep('Step 1');
      const step2 = createStep('Step 2', { dependencies: [step1.step_id] });
      const step3 = createStep('Step 3', { dependencies: [step1.step_id, step2.step_id] });

      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [step1, step2, step3];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.steps[1]!.dependencies).toEqual([step1.step_id]);
      expect(retrieved?.steps[2]!.dependencies).toEqual([step1.step_id, step2.step_id]);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty steps array', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);

      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.steps).toEqual([]);
    });

    it('should handle special characters in summary', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);

      const version = createPlanVersion(
        plan.plan_id,
        'Goal with "quotes" and \'apostrophes\'',
        'Context with\nnewlines\tand\ttabs'
      );
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.summary.goal).toBe('Goal with "quotes" and \'apostrophes\'');
      expect(retrieved?.summary.context).toBe('Context with\nnewlines\tand\ttabs');
    });

    it('should handle unicode in step titles', () => {
      const plan = createPlan(testOrgId);
      storage.createPlan(plan);

      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [createStep('Step with émojis 🎉 and ü∫ñîç∂é')];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.steps[0]!.title).toBe('Step with émojis 🎉 and ü∫ñîç∂é');
    });
  });

  describe('Understanding persistence', () => {
    let plan: ReturnType<typeof createPlan>;

    beforeEach(() => {
      plan = createPlan(testOrgId);
      storage.createPlan(plan);
    });

    it('should create and retrieve version with understanding', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.understanding = {
        architect: {
          observations: ['Found a pattern', 'Noticed complexity'],
          keywords: ['auth', 'security'],
          confidence: 'forming',
          updated_at: '2026-01-31T12:00:00.000Z',
          updated_by: 'architect-agent',
        },
        designer: {
          observations: ['Clean UI needed'],
          confidence: 'exploring',
        },
      };
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.understanding).toBeDefined();
      expect(retrieved?.understanding?.architect?.observations).toEqual([
        'Found a pattern',
        'Noticed complexity',
      ]);
      expect(retrieved?.understanding?.architect?.confidence).toBe('forming');
      expect(retrieved?.understanding?.designer?.confidence).toBe('exploring');
    });

    it('should default understanding to empty object when not provided', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      // Do not set understanding
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      // Should have understanding as empty object or undefined
      expect(retrieved?.understanding ?? {}).toEqual({});
    });

    it('should preserve understanding across getLatestVersion', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.understanding = {
        tester: { questions: ['How to test edge cases?'] },
      };
      storage.createVersion(version);

      const latest = storage.getLatestVersion(plan.plan_id);
      expect(latest?.understanding?.tester?.questions).toEqual([
        'How to test edge cases?',
      ]);
    });

    it('should preserve understanding in listVersions', () => {
      const v1 = createPlanVersion(plan.plan_id, 'Goal v1');
      v1.understanding = { role1: { observations: ['v1 obs'] } };

      const v2 = { ...createPlanVersion(plan.plan_id, 'Goal v2'), version: 2 };
      v2.understanding = { role2: { observations: ['v2 obs'] } };

      storage.createVersion(v1);
      storage.createVersion(v2);

      const versions = storage.listVersions(plan.plan_id);
      expect(versions).toHaveLength(2);
      expect(versions[0]?.understanding?.role1?.observations).toEqual(['v1 obs']);
      expect(versions[1]?.understanding?.role2?.observations).toEqual(['v2 obs']);
    });
  });

  describe('Step specification persistence', () => {
    let plan: ReturnType<typeof createPlan>;

    beforeEach(() => {
      plan = createPlan(testOrgId);
      storage.createPlan(plan);
    });

    it('should create and retrieve step with specification', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [
        createStep('Step with spec', {
          specification: {
            architecture: {
              decisions: [
                {
                  decision_id: 'd001',
                  decision: 'Use PostgreSQL',
                  rationale: 'Better for relational data',
                },
              ],
            },
            testing: {
              test_cases: [
                {
                  case_id: 't001',
                  type: 'happy',
                  priority: 'critical',
                  description: 'User can login',
                },
              ],
            },
          },
        }),
      ];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.steps[0]?.specification).toBeDefined();
      expect(
        retrieved?.steps[0]?.specification?.architecture?.decisions?.[0]?.decision_id
      ).toBe('d001');
      expect(
        retrieved?.steps[0]?.specification?.testing?.test_cases?.[0]?.type
      ).toBe('happy');
    });

    it('should preserve steps without specification', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [
        createStep('Step without spec'),
        createStep('Step with spec', {
          specification: {
            design: {
              components: [{ component_id: 'c1', name: 'Button' }],
            },
          },
        }),
      ];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      expect(retrieved?.steps[0]?.specification).toBeUndefined();
      expect(retrieved?.steps[1]?.specification?.design?.components?.[0]?.name).toBe(
        'Button'
      );
    });

    it('should handle all specification domains', () => {
      const version = createPlanVersion(plan.plan_id, 'Goal');
      version.steps = [
        createStep('Full spec step', {
          specification: {
            architecture: {
              decisions: [{ decision_id: 'd1', decision: 'Use REST', rationale: 'Simple' }],
              api_contracts: [{ endpoint: '/api/test', method: 'GET' }],
              boundaries: [{ component_id: 'b1', name: 'API Layer' }],
            },
            design: {
              components: [{ component_id: 'c1', name: 'Card' }],
              views: [{ view_id: 'v1', name: 'Dashboard', route: '/dashboard' }],
              interactions: [{ trigger: 'click', action: 'navigate' }],
            },
            testing: {
              test_cases: [
                { case_id: 't1', type: 'edge', priority: 'high', description: 'Empty state' },
              ],
              coverage_notes: '80% target',
            },
            security: {
              requirements: [
                {
                  requirement_id: 'r1',
                  category: 'authentication',
                  description: 'Require auth',
                  priority: 'critical',
                },
              ],
              threats: [{ threat: 'SQL injection', likelihood: 'low', impact: 'high' }],
            },
          },
        }),
      ];
      storage.createVersion(version);

      const retrieved = storage.getVersion(plan.plan_id, 1);
      const spec = retrieved?.steps[0]?.specification;
      expect(spec?.architecture?.decisions).toHaveLength(1);
      expect(spec?.architecture?.api_contracts).toHaveLength(1);
      expect(spec?.design?.components).toHaveLength(1);
      expect(spec?.design?.views).toHaveLength(1);
      expect(spec?.testing?.test_cases).toHaveLength(1);
      expect(spec?.testing?.coverage_notes).toBe('80% target');
      expect(spec?.security?.requirements).toHaveLength(1);
      expect(spec?.security?.threats).toHaveLength(1);
    });
  });
});

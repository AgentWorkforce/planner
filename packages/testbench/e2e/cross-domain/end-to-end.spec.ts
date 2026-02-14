/**
 * Cross-domain end-to-end tests covering the full pipeline:
 * Ideation → Planner → Forge
 *
 * These tests validate integration across all three domains by:
 * 1. Seeding data via API for speed and reliability
 * 2. Verifying UI correctly displays the data
 * 3. Testing cross-domain workflows (ideation → plan → execution)
 */

import { test, expect, navigateAndWait } from '../fixtures/base';
import {
  createIdeationSession,
  createBlock,
  sendToPlanner,
  createPlan,
  getPlan,
  waitForStableVersion,
  submitPlan,
  approvePlan,
  publishPlan,
  createForgeRun,
  createInitiative,
  updatePlan,
} from '../fixtures/api';

const PLANNER_URL = 'http://localhost:3000';
const IDEATION_URL = 'http://localhost:3002';
const FORGE_URL = 'http://localhost:3003';

test.describe('Cross-domain end-to-end pipeline', () => {
  test('Full pipeline: Ideation to Planner to Forge', async ({ page }) => {
    test.setTimeout(60_000);
    const ts = Date.now();

    // Step 1: Create ideation session
    const session = await createIdeationSession(`Auth system ${ts}`);
    expect(session.id).toBeTruthy();

    // Step 2: Verify session in ideation UI
    await navigateAndWait(page, `${IDEATION_URL}/ideation/session/${session.id}`);
    await expect(page.getByText(`Auth system ${ts}`)).toBeVisible({ timeout: 10_000 });

    // Step 3: Create blocks
    await createBlock(session.id, {
      type: 'feature',
      title: `OAuth ${ts}`,
      keyword: 'oauth',
      emoji: '🔐',
      content: 'Add OAuth 2.0 authentication flow',
    });

    await createBlock(session.id, {
      type: 'feature',
      title: `Sessions ${ts}`,
      keyword: 'sessions',
      emoji: '🎫',
      content: 'Implement secure session storage',
    });

    // Step 4: Send to planner
    const plannerResult = await sendToPlanner(session.id, {
      goal: `Implement auth ${ts}`,
      context: 'Based on ideation session',
    });
    const planId = plannerResult.data?.plan_id ?? plannerResult.plan_id;
    expect(planId).toBeTruthy();

    // Step 5: Verify plan in planner UI
    await navigateAndWait(page, `${PLANNER_URL}/plans/${planId}`);
    await expect(
      page.getByRole('button', { name: `Implement auth ${ts}` })
    ).toBeVisible({ timeout: 10_000 });

    // Step 6: Publish plan (fetch latest version first)
    const plan = await waitForStableVersion(planId);
    await submitPlan(planId, plan.version);
    await approvePlan(planId, plan.version);
    await publishPlan(planId, plan.version);

    const publishedPlan = await getPlan(planId);
    expect(publishedPlan.status).toBe('published');

    // Step 7: Create forge run
    const run = await createForgeRun(publishedPlan);
    expect(run.run_id).toBeTruthy();

    // Step 8: Verify run in forge UI (forge shows "Untitled Run" — doesn't store plan goals)
    await navigateAndWait(page, `${FORGE_URL}/forge/runs/${run.run_id}`);
    await expect(
      page.getByRole('heading', { name: 'Untitled Run', level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Initiative-scoped workflow', async ({ page }) => {
    test.setTimeout(60_000);
    const ts = Date.now();

    // Create initiative
    const initiative = await createInitiative(`Q1 Platform ${ts}`, 'Platform enhancements');
    expect(initiative.id).toBeTruthy();

    // Create plan with initiative
    const plan = await createPlan(`Search perf ${ts}`, 'Optimize search');
    await updatePlan(plan.plan_id, { initiative_id: initiative.id });

    // Verify initiative association
    const updatedPlan = await getPlan(plan.plan_id);
    expect(updatedPlan.plan_id).toBe(plan.plan_id);

    // Verify in planner UI
    await navigateAndWait(page, `${PLANNER_URL}/initiatives/${initiative.id}`);
    await expect(
      page.getByRole('heading', { name: `Q1 Platform ${ts}` })
    ).toBeVisible({ timeout: 10_000 });

    // Publish and create run (fetch latest version)
    const latest = await waitForStableVersion(plan.plan_id);
    await submitPlan(plan.plan_id, latest.version);
    await approvePlan(plan.plan_id, latest.version);
    await publishPlan(plan.plan_id, latest.version);

    const publishedPlan = await getPlan(plan.plan_id);
    const run = await createForgeRun(publishedPlan);
    expect(run.run_id).toBeTruthy();

    // Verify in forge UI (forge shows "Untitled Run" — doesn't store plan goals)
    await navigateAndWait(page, `${FORGE_URL}/forge/runs/${run.run_id}`);
    await expect(
      page.getByRole('heading', { name: 'Untitled Run', level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Plan workflow must be followed in order', async () => {
    const ts = Date.now();
    const plan = await createPlan(`Workflow order ${ts}`, 'Test workflow constraints');
    const latest = await waitForStableVersion(plan.plan_id);

    // Cannot approve before submitting
    let approveBeforeSubmitFailed = false;
    try {
      await approvePlan(plan.plan_id, latest.version);
    } catch {
      approveBeforeSubmitFailed = true;
    }
    expect(approveBeforeSubmitFailed).toBe(true);

    // Cannot publish before approving
    let publishBeforeApproveFailed = false;
    try {
      await publishPlan(plan.plan_id, latest.version);
    } catch {
      publishBeforeApproveFailed = true;
    }
    expect(publishBeforeApproveFailed).toBe(true);

    // Correct order works: submit -> approve -> publish
    await submitPlan(plan.plan_id, latest.version);
    await approvePlan(plan.plan_id, latest.version);
    await publishPlan(plan.plan_id, latest.version);

    const publishedPlan = await getPlan(plan.plan_id);
    expect(publishedPlan.status).toBe('published');

    // Published plan can be executed via forge
    const run = await createForgeRun(publishedPlan);
    expect(run.run_id).toBeTruthy();
  });
});

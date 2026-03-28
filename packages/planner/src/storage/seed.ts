/**
 * Seed database with realistic sample plans organized by initiative and session.
 *
 * Creates three initiatives with plans that have proper source_session_id linkage,
 * demonstrating how ideation sessions produce one or more plans.
 *
 * Called automatically on first server startup (when no plans exist).
 */

import { createHash } from 'crypto';
import type Database from 'better-sqlite3';

// Namespace UUID for generating deterministic UUIDs (UUID v5 DNS namespace)
const NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate a deterministic UUID v5 from a name.
 * Using the same name always produces the same UUID, making the seed idempotent.
 */
function deterministicUUID(name: string): string {
  const hash = createHash('sha1');
  const namespaceBytes = NAMESPACE_UUID.replace(/-/g, '');
  const namespaceBuffer = Buffer.from(namespaceBytes, 'hex');
  hash.update(namespaceBuffer);
  hash.update(name);
  const hashBytes = hash.digest();
  hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
  hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;
  const hex = hashBytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// IDs — all deterministic so re-running the seed is a no-op
// ---------------------------------------------------------------------------

const INITIATIVE_CORE_PLATFORM = deterministicUUID('initiative-core-platform');
const INITIATIVE_USER_EXPERIENCE = deterministicUUID('initiative-user-experience');
const INITIATIVE_DEVOPS = deterministicUUID('initiative-devops-infrastructure');

const SESSION_OAUTH = deterministicUUID('session-oauth');
const SESSION_DB_PERF = deterministicUUID('session-db-perf');
const SESSION_ONBOARDING = deterministicUUID('session-onboarding');
const SESSION_DASHBOARD = deterministicUUID('session-dashboard');
const SESSION_CICD = deterministicUUID('session-cicd');
const SESSION_CONTAINERS = deterministicUUID('session-containers');

const PLAN_OAUTH = deterministicUUID('plan-oauth2-implementation');
const PLAN_SESSION_MGMT = deterministicUUID('plan-session-management');
const PLAN_QUERY_PERF = deterministicUUID('plan-query-performance');
const PLAN_ONBOARDING = deterministicUUID('plan-new-user-onboarding');
const PLAN_DASHBOARD = deterministicUUID('plan-dashboard-redesign');
const PLAN_GITHUB_ACTIONS = deterministicUUID('plan-github-actions-migration');
const PLAN_CONTAINERS = deterministicUUID('plan-container-orchestration');

// ---------------------------------------------------------------------------
// Seed entry point
// ---------------------------------------------------------------------------

/**
 * Seed the database with sample plans if it is empty.
 * Returns true if seeding was performed, false if skipped.
 */
export function seedIfEmpty(db: Database.Database, _projectRoot?: string): boolean {
  const planCount = db.prepare<[], { count: number }>(
    'SELECT COUNT(*) as count FROM plans'
  ).get();

  if (planCount && planCount.count > 0) {
    return false;
  }

  console.log('[seed] No plans found, seeding with sample data...');
  return seedDatabase(db);
}

/**
 * Seed the database with realistic scenario data.
 * All IDs are deterministic — safe to call multiple times.
 */
export function seedDatabase(db: Database.Database, _projectRoot?: string): boolean {
  const now = new Date().toISOString();
  // Slightly offset timestamps so the plans have a natural order
  const t = (offsetMinutes: number) =>
    new Date(Date.now() - offsetMinutes * 60_000).toISOString();

  // Resolve org
  const existingOrg = db
    .prepare<string, { org_id: string }>('SELECT org_id FROM organizations WHERE slug = ?')
    .get('default');

  if (!existingOrg) {
    console.log('[seed] Default organization not found — migrations may not have run yet');
    return false;
  }

  const orgId = existingOrg.org_id;

  // Prepared statements
  const insertInitiative = db.prepare(`
    INSERT OR REPLACE INTO initiatives
      (initiative_id, org_id, name, description, status, icon, color, display_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPlan = db.prepare(`
    INSERT OR REPLACE INTO plans
      (plan_id, org_id, initiative_id, source_session_id, source_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVersion = db.prepare(`
    INSERT OR REPLACE INTO versions
      (plan_id, version, status, summary_json, submitted_at, approval_info_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT OR REPLACE INTO steps (plan_id, version, step_id, step_order, step_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  const approvalInfo = JSON.stringify({ approver: 'Seed', approved_at: now });

  // Helper: insert a single version with its steps
  function insertVersionWithSteps(
    planId: string,
    version: number,
    status: 'draft' | 'approved' | 'published',
    summary: { goal: string; context?: string },
    steps: Array<{
      id: string;
      title: string;
      description?: string;
      scope?: string;
      owner_role?: string;
      dependencies?: string[];
      acceptance_criteria?: Array<{ id: string; description: string; type?: string }>;
    }>,
    createdAt: string
  ) {
    const isLocked = status === 'approved' || status === 'published';
    insertVersion.run(
      planId,
      version,
      status,
      JSON.stringify(summary),
      isLocked ? createdAt : null,
      isLocked ? approvalInfo : null,
      createdAt,
      createdAt
    );

    steps.forEach((step, idx) => {
      insertStep.run(
        planId,
        version,
        step.id,
        idx,
        JSON.stringify({
          step_id: step.id,
          title: step.title,
          description: step.description,
          scope: step.scope,
          owner_role: step.owner_role,
          dependencies: step.dependencies ?? [],
          acceptance_criteria: step.acceptance_criteria ?? [],
        })
      );
    });
  }

  const transaction = db.transaction(() => {
    // -----------------------------------------------------------------------
    // Initiative: Core Platform
    // -----------------------------------------------------------------------
    insertInitiative.run(
      INITIATIVE_CORE_PLATFORM,
      orgId,
      'Core Platform',
      'Foundational backend services — authentication, data access, and performance.',
      'active',
      '⚙️',
      '#3b82f6',
      0,
      t(5760), // ~4 days ago
      now
    );

    // Plan: OAuth2 Implementation  (session-oauth, version 1 approved)
    insertPlan.run(
      PLAN_OAUTH,
      orgId,
      INITIATIVE_CORE_PLATFORM,
      SESSION_OAUTH,
      JSON.stringify({ type: 'ideation', session_id: SESSION_OAUTH }),
      t(5760),
      now
    );
    insertVersionWithSteps(
      PLAN_OAUTH,
      1,
      'approved',
      {
        goal: 'Implement OAuth2 provider integration for third-party SSO',
        context:
          'Users need to authenticate via Google and GitHub. The current username/password ' +
          'flow has low adoption — SSO will reduce friction significantly.',
      },
      [
        {
          id: deterministicUUID('oauth-step-1'),
          title: 'Set up OAuth2 provider integration',
          description:
            'Register the application with Google and GitHub OAuth2 providers. ' +
            'Configure redirect URIs, client secrets, and scopes.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [],
          acceptance_criteria: [
            {
              id: deterministicUUID('oauth-ac-1-1'),
              description: 'Google OAuth2 flow completes successfully in staging',
              type: 'test',
            },
            {
              id: deterministicUUID('oauth-ac-1-2'),
              description: 'GitHub OAuth2 flow completes successfully in staging',
              type: 'test',
            },
          ],
        },
        {
          id: deterministicUUID('oauth-step-2'),
          title: 'Add authentication middleware',
          description:
            'Implement Express middleware that validates JWT tokens on protected routes. ' +
            'Attach the authenticated user to the request context.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [deterministicUUID('oauth-step-1')],
          acceptance_criteria: [
            {
              id: deterministicUUID('oauth-ac-2-1'),
              description: 'Requests with invalid tokens receive 401',
              type: 'test',
            },
            {
              id: deterministicUUID('oauth-ac-2-2'),
              description: 'Authenticated user is available as req.user on all protected routes',
              type: 'test',
            },
          ],
        },
        {
          id: deterministicUUID('oauth-step-3'),
          title: 'Implement token refresh flow',
          description:
            'Handle access token expiry gracefully by automatically refreshing using the ' +
            'stored refresh token. Expose a POST /auth/refresh endpoint.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [deterministicUUID('oauth-step-2')],
          acceptance_criteria: [
            {
              id: deterministicUUID('oauth-ac-3-1'),
              description: 'Expired access tokens are refreshed transparently client-side',
              type: 'test',
            },
            {
              id: deterministicUUID('oauth-ac-3-2'),
              description: 'Revoked refresh tokens return 401 and clear cookies',
              type: 'test',
            },
          ],
        },
      ],
      t(5760)
    );

    // Plan: Session Management  (same session-oauth, version 1 draft)
    insertPlan.run(
      PLAN_SESSION_MGMT,
      orgId,
      INITIATIVE_CORE_PLATFORM,
      SESSION_OAUTH,
      JSON.stringify({ type: 'ideation', session_id: SESSION_OAUTH }),
      t(5700),
      now
    );
    insertVersionWithSteps(
      PLAN_SESSION_MGMT,
      1,
      'draft',
      {
        goal: 'Design and implement server-side session storage and lifecycle management',
        context:
          'OAuth integration (see OAuth2 plan) produces sessions that must be persisted and ' +
          'eventually cleaned up. This plan covers the storage schema and cleanup job.',
      },
      [
        {
          id: deterministicUUID('session-mgmt-step-1'),
          title: 'Design session storage schema',
          description:
            'Define the sessions table: session_id, user_id, provider, access_token_hash, ' +
            'refresh_token_enc, expires_at, created_at. Consider encryption at rest for tokens.',
          scope: 'api-service',
          owner_role: 'backend:Architect',
          dependencies: [],
          acceptance_criteria: [
            {
              id: deterministicUUID('session-mgmt-ac-1-1'),
              description: 'Schema reviewed and approved by security lead',
              type: 'review',
            },
            {
              id: deterministicUUID('session-mgmt-ac-1-2'),
              description: 'Migration script is idempotent and tested',
              type: 'test',
            },
          ],
        },
        {
          id: deterministicUUID('session-mgmt-step-2'),
          title: 'Implement session cleanup cron',
          description:
            'Add a scheduled job (node-cron) that runs nightly to purge sessions ' +
            'that have been expired for more than 30 days.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [deterministicUUID('session-mgmt-step-1')],
          acceptance_criteria: [
            {
              id: deterministicUUID('session-mgmt-ac-2-1'),
              description: 'Cron job deletes sessions expired > 30 days, logs count',
              type: 'test',
            },
          ],
        },
      ],
      t(5700)
    );

    // Plan: Query Performance Optimization  (session-db-perf, version 1 draft)
    insertPlan.run(
      PLAN_QUERY_PERF,
      orgId,
      INITIATIVE_CORE_PLATFORM,
      SESSION_DB_PERF,
      JSON.stringify({ type: 'ideation', session_id: SESSION_DB_PERF }),
      t(2880), // ~2 days ago
      now
    );
    insertVersionWithSteps(
      PLAN_QUERY_PERF,
      1,
      'draft',
      {
        goal: 'Reduce p95 API latency by 40% through targeted query and caching improvements',
        context:
          'Recent profiling shows three slow endpoints (> 800ms p95). Root cause is ' +
          'missing composite indexes and repeated full-table scans.',
      },
      [
        {
          id: deterministicUUID('qperf-step-1'),
          title: 'Profile slow queries',
          description:
            'Run EXPLAIN QUERY PLAN on the three identified slow endpoints. ' +
            'Capture query plans and row estimates for baseline comparison.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [],
          acceptance_criteria: [
            {
              id: deterministicUUID('qperf-ac-1-1'),
              description: 'Query plans documented for all slow endpoints',
              type: 'review',
            },
          ],
        },
        {
          id: deterministicUUID('qperf-step-2'),
          title: 'Add composite indexes',
          description:
            'Create composite indexes for (org_id, status), (initiative_id, updated_at), ' +
            'and (plan_id, version) based on profiling results.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [deterministicUUID('qperf-step-1')],
          acceptance_criteria: [
            {
              id: deterministicUUID('qperf-ac-2-1'),
              description: 'EXPLAIN QUERY PLAN shows index usage for all three endpoints',
              type: 'test',
            },
            {
              id: deterministicUUID('qperf-ac-2-2'),
              description: 'p95 latency reduced by at least 20% vs baseline',
              type: 'metric',
            },
          ],
        },
        {
          id: deterministicUUID('qperf-step-3'),
          title: 'Implement query result caching',
          description:
            'Add an in-process LRU cache (lru-cache) for expensive read-only queries. ' +
            'Cache TTL: 30 seconds for list endpoints, invalidated on writes.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [deterministicUUID('qperf-step-2')],
          acceptance_criteria: [
            {
              id: deterministicUUID('qperf-ac-3-1'),
              description: 'Cache hit rate > 60% under realistic load',
              type: 'metric',
            },
            {
              id: deterministicUUID('qperf-ac-3-2'),
              description: 'Writes correctly invalidate related cache entries',
              type: 'test',
            },
          ],
        },
      ],
      t(2880)
    );

    // -----------------------------------------------------------------------
    // Initiative: User Experience
    // -----------------------------------------------------------------------
    insertInitiative.run(
      INITIATIVE_USER_EXPERIENCE,
      orgId,
      'User Experience',
      'Improving the product surface — onboarding, discoverability, and the core dashboard.',
      'active',
      '✨',
      '#8b5cf6',
      1,
      t(4320), // ~3 days ago
      now
    );

    // Plan: New User Onboarding  (session-onboarding, version 1 draft + version 2 submitted)
    insertPlan.run(
      PLAN_ONBOARDING,
      orgId,
      INITIATIVE_USER_EXPERIENCE,
      SESSION_ONBOARDING,
      JSON.stringify({ type: 'ideation', session_id: SESSION_ONBOARDING }),
      t(4320),
      now
    );
    // v1 — initial draft
    insertVersionWithSteps(
      PLAN_ONBOARDING,
      1,
      'draft',
      {
        goal: 'Build an onboarding wizard that activates new users within their first session',
        context: 'Drop-off analysis shows 65% of new signups never create their first plan.',
      },
      [
        {
          id: deterministicUUID('onboarding-step-1'),
          title: 'Design onboarding wizard UI',
          description:
            'Create wireframes and hi-fi designs for a 4-step wizard: welcome, goal input, ' +
            'first plan creation, and completion celebration.',
          scope: 'web-frontend',
          owner_role: 'frontend:Designer',
          dependencies: [],
        },
        {
          id: deterministicUUID('onboarding-step-2'),
          title: 'Implement progressive disclosure',
          description:
            'Show only the controls relevant to each wizard step. Use React state machine ' +
            '(XState) to model step transitions and guard conditions.',
          scope: 'web-frontend',
          owner_role: 'frontend:Coder',
          dependencies: [deterministicUUID('onboarding-step-1')],
        },
        {
          id: deterministicUUID('onboarding-step-3'),
          title: 'Add welcome tutorial',
          description:
            'Implement an interactive product tour using the Shepherd.js library that ' +
            'highlights key UI elements after the wizard completes.',
          scope: 'web-frontend',
          owner_role: 'frontend:Coder',
          dependencies: [deterministicUUID('onboarding-step-2')],
        },
        {
          id: deterministicUUID('onboarding-step-4'),
          title: 'Track onboarding completion metrics',
          description:
            'Emit analytics events at each wizard step. Create a Retool dashboard showing ' +
            'funnel conversion from signup → wizard_started → wizard_completed → first_plan_created.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [deterministicUUID('onboarding-step-3')],
          acceptance_criteria: [
            {
              id: deterministicUUID('onboarding-ac-4-1'),
              description: 'Events visible in analytics within 60 seconds of action',
              type: 'test',
            },
          ],
        },
      ],
      t(4320)
    );
    // v2 — submitted for review (same steps, context refined)
    insertVersionWithSteps(
      PLAN_ONBOARDING,
      2,
      'draft',
      {
        goal: 'Build an onboarding wizard that activates new users within their first session',
        context:
          'Drop-off analysis shows 65% of new signups never create their first plan. ' +
          'v2: Added analytics step and refined acceptance criteria after design review.',
      },
      [
        {
          id: deterministicUUID('onboarding-v2-step-1'),
          title: 'Design onboarding wizard UI',
          description:
            'Finalized hi-fi designs approved in Figma. ' +
            '4-step flow: welcome → goal input → first plan → celebration.',
          scope: 'web-frontend',
          owner_role: 'frontend:Designer',
          dependencies: [],
          acceptance_criteria: [
            {
              id: deterministicUUID('onboarding-v2-ac-1-1'),
              description: 'Designs reviewed by product lead and accessibility audited',
              type: 'review',
            },
          ],
        },
        {
          id: deterministicUUID('onboarding-v2-step-2'),
          title: 'Implement progressive disclosure',
          description:
            'XState wizard state machine covering all step transitions. ' +
            'Each step validates its own completion before advancing.',
          scope: 'web-frontend',
          owner_role: 'frontend:Coder',
          dependencies: [deterministicUUID('onboarding-v2-step-1')],
          acceptance_criteria: [
            {
              id: deterministicUUID('onboarding-v2-ac-2-1'),
              description: 'All state transitions covered by unit tests',
              type: 'test',
            },
          ],
        },
        {
          id: deterministicUUID('onboarding-v2-step-3'),
          title: 'Add welcome tutorial',
          description:
            'Shepherd.js tour highlighting key UI elements. ' +
            'Dismissable, non-blocking, and skippable from any step.',
          scope: 'web-frontend',
          owner_role: 'frontend:Coder',
          dependencies: [deterministicUUID('onboarding-v2-step-2')],
          acceptance_criteria: [
            {
              id: deterministicUUID('onboarding-v2-ac-3-1'),
              description: 'Tutorial is keyboard-navigable and screen-reader accessible',
              type: 'review',
            },
          ],
        },
        {
          id: deterministicUUID('onboarding-v2-step-4'),
          title: 'Track onboarding completion metrics',
          description:
            'Analytics event schema defined and reviewed. ' +
            'Retool funnel dashboard built and shared with growth team.',
          scope: 'api-service',
          owner_role: 'backend:Coder',
          dependencies: [deterministicUUID('onboarding-v2-step-3')],
          acceptance_criteria: [
            {
              id: deterministicUUID('onboarding-v2-ac-4-1'),
              description: 'Funnel dashboard shows data within 60 seconds of action',
              type: 'metric',
            },
            {
              id: deterministicUUID('onboarding-v2-ac-4-2'),
              description: 'Event schema peer-reviewed by data team',
              type: 'review',
            },
          ],
        },
      ],
      t(4200)
    );
    // Mark v2 as submitted
    db.prepare(`UPDATE versions SET submitted_at = ? WHERE plan_id = ? AND version = ?`).run(
      t(4100),
      PLAN_ONBOARDING,
      2
    );

    // Plan: Dashboard Redesign  (session-dashboard, version 1 draft)
    insertPlan.run(
      PLAN_DASHBOARD,
      orgId,
      INITIATIVE_USER_EXPERIENCE,
      SESSION_DASHBOARD,
      JSON.stringify({ type: 'ideation', session_id: SESSION_DASHBOARD }),
      t(1440), // ~1 day ago
      now
    );
    insertVersionWithSteps(
      PLAN_DASHBOARD,
      1,
      'draft',
      {
        goal: 'Redesign the main dashboard to surface actionable plans and team activity',
        context:
          'User research sessions revealed that the current dashboard is information-dense ' +
          'but not action-oriented. Users struggle to know what to work on next.',
      },
      [
        {
          id: deterministicUUID('dashboard-step-1'),
          title: 'Create new layout components',
          description:
            'Build a responsive grid layout with configurable column counts (1–3). ' +
            'Each panel is a self-contained widget with a consistent header/body/footer structure.',
          scope: 'web-frontend',
          owner_role: 'frontend:Coder',
          dependencies: [],
          acceptance_criteria: [
            {
              id: deterministicUUID('dashboard-ac-1-1'),
              description: 'Layout adapts correctly from 320px to 1920px viewport width',
              type: 'test',
            },
          ],
        },
        {
          id: deterministicUUID('dashboard-step-2'),
          title: 'Implement data visualization widgets',
          description:
            'Build plan status donut chart, team activity sparklines, and " needs attention" ' +
            'summary card using Recharts. All charts must be accessible with text alternatives.',
          scope: 'web-frontend',
          owner_role: 'frontend:Coder',
          dependencies: [deterministicUUID('dashboard-step-1')],
          acceptance_criteria: [
            {
              id: deterministicUUID('dashboard-ac-2-1'),
              description: 'All charts have aria-label and data-table fallback',
              type: 'review',
            },
          ],
        },
        {
          id: deterministicUUID('dashboard-step-3'),
          title: 'Add customizable dashboard panels',
          description:
            'Implement drag-and-drop panel reordering and show/hide toggles. ' +
            'Persist layout preferences to localStorage with a reset-to-default option.',
          scope: 'web-frontend',
          owner_role: 'frontend:Coder',
          dependencies: [deterministicUUID('dashboard-step-2')],
          acceptance_criteria: [
            {
              id: deterministicUUID('dashboard-ac-3-1'),
              description: 'Panel layout persists across page reloads',
              type: 'test',
            },
            {
              id: deterministicUUID('dashboard-ac-3-2'),
              description: 'Reset-to-default restores original panel configuration',
              type: 'test',
            },
          ],
        },
      ],
      t(1440)
    );

    // -----------------------------------------------------------------------
    // Initiative: DevOps & Infrastructure
    // -----------------------------------------------------------------------
    insertInitiative.run(
      INITIATIVE_DEVOPS,
      orgId,
      'DevOps & Infrastructure',
      'CI/CD pipelines, container infrastructure, and deployment reliability.',
      'active',
      '🔧',
      '#10b981',
      2,
      t(7200), // ~5 days ago
      now
    );

    // Plan: GitHub Actions Migration  (session-cicd, v1 approved + v2 published)
    insertPlan.run(
      PLAN_GITHUB_ACTIONS,
      orgId,
      INITIATIVE_DEVOPS,
      SESSION_CICD,
      JSON.stringify({ type: 'ideation', session_id: SESSION_CICD }),
      t(7200),
      now
    );
    insertVersionWithSteps(
      PLAN_GITHUB_ACTIONS,
      1,
      'approved',
      {
        goal: 'Migrate CI/CD from Jenkins to GitHub Actions',
        context: 'Jenkins is self-hosted, frequently out of date, and requires dedicated maintenance.',
      },
      [
        {
          id: deterministicUUID('cicd-step-1'),
          title: 'Migrate build pipeline from Jenkins',
          description:
            'Translate existing Jenkinsfiles to GitHub Actions workflows. ' +
            'Map all existing build steps, environment variables, and secret bindings.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [],
        },
        {
          id: deterministicUUID('cicd-step-2'),
          title: 'Set up test automation workflow',
          description:
            'Create a workflow triggered on PR open/push that runs unit tests, ' +
            'integration tests, and coverage reporting. Required status check before merge.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [deterministicUUID('cicd-step-1')],
        },
        {
          id: deterministicUUID('cicd-step-3'),
          title: 'Configure deployment pipeline',
          description:
            'Staging deploy on merge to main. Production deploy on tag push (vX.Y.Z). ' +
            'Include rollback workflow triggered by failed health check.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [deterministicUUID('cicd-step-2')],
        },
        {
          id: deterministicUUID('cicd-step-4'),
          title: 'Add monitoring and alerting',
          description:
            'Configure PagerDuty integration for deployment failures. ' +
            'Add Slack notification for deploy start/success/failure to #deployments channel.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [deterministicUUID('cicd-step-3')],
          acceptance_criteria: [
            {
              id: deterministicUUID('cicd-ac-4-1'),
              description: 'PagerDuty alert fires within 2 minutes of deploy failure',
              type: 'test',
            },
            {
              id: deterministicUUID('cicd-ac-4-2'),
              description: 'Slack notifications delivered to #deployments for all deploy events',
              type: 'test',
            },
          ],
        },
      ],
      t(7200)
    );
    // v2 — published (the approved plan that was released to orchestrator)
    insertVersionWithSteps(
      PLAN_GITHUB_ACTIONS,
      2,
      'published',
      {
        goal: 'Migrate CI/CD from Jenkins to GitHub Actions',
        context:
          'Jenkins is self-hosted, frequently out of date, and requires dedicated maintenance. ' +
          'v2: Acceptance criteria added across all steps after security review.',
      },
      [
        {
          id: deterministicUUID('cicd-v2-step-1'),
          title: 'Migrate build pipeline from Jenkins',
          description: 'All Jenkinsfiles translated to GitHub Actions workflows.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [],
          acceptance_criteria: [
            {
              id: deterministicUUID('cicd-v2-ac-1-1'),
              description: 'All existing Jenkins jobs have equivalent GHA workflows',
              type: 'review',
            },
          ],
        },
        {
          id: deterministicUUID('cicd-v2-step-2'),
          title: 'Set up test automation workflow',
          description: 'PR-triggered workflow: unit + integration tests + coverage.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [deterministicUUID('cicd-v2-step-1')],
          acceptance_criteria: [
            {
              id: deterministicUUID('cicd-v2-ac-2-1'),
              description: 'Test workflow is a required status check on main branch',
              type: 'review',
            },
          ],
        },
        {
          id: deterministicUUID('cicd-v2-step-3'),
          title: 'Configure deployment pipeline',
          description: 'Staging on merge to main; production on semver tag. Rollback included.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [deterministicUUID('cicd-v2-step-2')],
          acceptance_criteria: [
            {
              id: deterministicUUID('cicd-v2-ac-3-1'),
              description: 'Rollback completes within 5 minutes of trigger',
              type: 'metric',
            },
          ],
        },
        {
          id: deterministicUUID('cicd-v2-step-4'),
          title: 'Add monitoring and alerting',
          description: 'PagerDuty + Slack integration for all deploy lifecycle events.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [deterministicUUID('cicd-v2-step-3')],
          acceptance_criteria: [
            {
              id: deterministicUUID('cicd-v2-ac-4-1'),
              description: 'PagerDuty alert fires within 2 minutes of deploy failure',
              type: 'test',
            },
            {
              id: deterministicUUID('cicd-v2-ac-4-2'),
              description: 'Slack notifications delivered to #deployments for all deploy events',
              type: 'test',
            },
          ],
        },
      ],
      t(7000)
    );

    // Plan: Container Orchestration  (session-containers, version 1 draft)
    insertPlan.run(
      PLAN_CONTAINERS,
      orgId,
      INITIATIVE_DEVOPS,
      SESSION_CONTAINERS,
      JSON.stringify({ type: 'ideation', session_id: SESSION_CONTAINERS }),
      t(360), // ~6 hours ago
      now
    );
    insertVersionWithSteps(
      PLAN_CONTAINERS,
      1,
      'draft',
      {
        goal: 'Define container specifications and Kubernetes cluster configuration for production',
        context:
          'Current deployment uses bare EC2 instances. Containerising will improve ' +
          'reproducibility, resource utilisation, and horizontal scaling.',
      },
      [
        {
          id: deterministicUUID('containers-step-1'),
          title: 'Define Docker container specifications',
          description:
            'Write multi-stage Dockerfiles for all services. Pin base image versions. ' +
            'Optimise layer caching for fast CI builds. Add .dockerignore files.',
          scope: 'infrastructure',
          owner_role: 'devops:Engineer',
          dependencies: [],
          acceptance_criteria: [
            {
              id: deterministicUUID('containers-ac-1-1'),
              description: 'Final image sizes within approved budget (< 200 MB per service)',
              type: 'metric',
            },
            {
              id: deterministicUUID('containers-ac-1-2'),
              description: 'Images pass Trivy vulnerability scan with no critical findings',
              type: 'test',
            },
          ],
        },
        {
          id: deterministicUUID('containers-step-2'),
          title: 'Set up Kubernetes cluster configuration',
          description:
            'Create Helm charts for each service covering Deployment, Service, ' +
            'HorizontalPodAutoscaler, and ConfigMap resources. ' +
            'Target: EKS cluster with separate namespaces for staging and production.',
          scope: 'infrastructure',
          owner_role: 'devops:Architect',
          dependencies: [deterministicUUID('containers-step-1')],
          acceptance_criteria: [
            {
              id: deterministicUUID('containers-ac-2-1'),
              description: 'Staging environment deploys successfully via helm upgrade',
              type: 'test',
            },
            {
              id: deterministicUUID('containers-ac-2-2'),
              description: 'HPA scales pods under 70% CPU load within 90 seconds',
              type: 'metric',
            },
          ],
        },
      ],
      t(360)
    );
  });

  transaction();

  console.log('[seed] Created 3 initiatives with 7 plans across 6 ideation sessions');
  return true;
}

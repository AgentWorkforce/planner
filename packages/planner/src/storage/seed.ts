/**
 * Seed database with sample plans from docs/flow feature files.
 *
 * This seeds the "Planner v1" initiative - the actual plans used to build
 * the Planner itself. Great for exploring the UI and understanding plan structure.
 *
 * Called automatically on first server startup (when no plans exist).
 * Can also be run manually: npx tsx scripts/migrate-flow-to-db.ts
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type Database from 'better-sqlite3';

// Namespace UUID for generating deterministic UUIDs
const NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate a deterministic UUID v5 from a name.
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

const SAMPLE_INITIATIVE_ID = deterministicUUID('planner-v1-initiative');

interface FlowAcceptanceCriterion {
  id: string;
  description: string;
  type?: string;
}

interface FlowStep {
  step_id: string;
  title: string;
  scope?: string;
  description?: string;
  dependencies: string[];
  owner_role?: string;
  acceptance_criteria?: FlowAcceptanceCriterion[];
}

interface SubFeatureRef {
  feature_id: string;
  title: string;
  ref: string;
}

interface FlowFeature {
  feature_id: string;
  title: string;
  type: 'epic' | 'feature';
  status: string;
  priority?: string;
  dependencies?: string[];
  summary?: {
    goal: string;
    context?: string;
    acceptance_criteria?: FlowAcceptanceCriterion[];
  };
  sub_features?: SubFeatureRef[];
  plan_implementation?: {
    scopes: string[];
    steps: FlowStep[];
  };
}

function mapStatus(flowStatus: string): 'draft' | 'approved' | 'published' {
  if (flowStatus === 'published') return 'published';
  if (flowStatus === 'approved') return 'approved';
  return 'draft';
}

/**
 * Seed the database with sample plans if it's empty.
 * Returns true if seeding was performed, false if skipped.
 */
export function seedIfEmpty(db: Database.Database, projectRoot: string): boolean {
  // Check if any plans exist
  const planCount = db.prepare<[], { count: number }>(
    'SELECT COUNT(*) as count FROM plans'
  ).get();

  if (planCount && planCount.count > 0) {
    return false; // Already has data
  }

  console.log('[seed] No plans found, seeding with sample data...');
  return seedDatabase(db, projectRoot);
}

/**
 * Seed the database with sample plans from docs/flow.
 */
export function seedDatabase(db: Database.Database, projectRoot: string): boolean {
  const catalogPath = path.join(projectRoot, 'docs/flow/catalog.json');
  const featuresDir = path.join(projectRoot, 'docs/flow/features');

  // Check if flow files exist
  if (!fs.existsSync(catalogPath) || !fs.existsSync(featuresDir)) {
    console.log('[seed] No flow files found, skipping seed');
    return false;
  }

  // Load feature files
  const featureFiles = fs.readdirSync(featuresDir).filter((f) => f.endsWith('.json'));
  if (featureFiles.length === 0) {
    console.log('[seed] No feature files found, skipping seed');
    return false;
  }

  const allFeatures = new Map<string, FlowFeature>();
  for (const featureFile of featureFiles) {
    const featurePath = path.join(featuresDir, featureFile);
    const feature: FlowFeature = JSON.parse(fs.readFileSync(featurePath, 'utf-8'));
    allFeatures.set(feature.feature_id, feature);
  }

  const now = new Date().toISOString();

  // Get or create default org
  const existingOrg = db.prepare<string, { org_id: string }>(
    `SELECT org_id FROM organizations WHERE slug = ?`
  ).get('default');

  const defaultOrgId = existingOrg?.org_id ?? deterministicUUID('default-org');

  // Create initiative
  db.prepare(`
    INSERT OR REPLACE INTO initiatives (initiative_id, org_id, name, description, status, icon, color, display_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    SAMPLE_INITIATIVE_ID,
    defaultOrgId,
    'Planner v1',
    'The plans used to build the Planner itself - dogfooding our own tool!',
    'active',
    '🚀',
    '#00d9ff',
    0,
    now,
    now
  );

  // Prepare statements
  const insertPlan = db.prepare(`
    INSERT OR REPLACE INTO plans (plan_id, org_id, initiative_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertVersion = db.prepare(`
    INSERT OR REPLACE INTO versions (plan_id, version, status, summary_json, submitted_at, approval_info_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT OR REPLACE INTO steps (plan_id, version, step_id, step_order, step_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Generate deterministic UUIDs for all features
  const featureIdToPlanId = new Map<string, string>();
  for (const [featureId] of allFeatures) {
    featureIdToPlanId.set(featureId, deterministicUUID(featureId));
  }

  let importedCount = 0;

  // Import features
  const transaction = db.transaction(() => {
    for (const [featureId, feature] of allFeatures) {
      const planId = featureIdToPlanId.get(featureId)!;
      const status = mapStatus(feature.status);

      insertPlan.run(planId, defaultOrgId, SAMPLE_INITIATIVE_ID, now, now);

      const summary = {
        goal: feature.summary?.goal || feature.title,
        context: feature.summary?.context,
      };

      const approvalInfo =
        status === 'approved' || status === 'published'
          ? JSON.stringify({ approver: 'Seed Script', approved_at: now })
          : null;

      insertVersion.run(
        planId,
        1,
        status,
        JSON.stringify(summary),
        status !== 'draft' ? now : null,
        approvalInfo,
        now,
        now
      );

      // Create steps
      let stepsToInsert: Array<{
        step_id: string;
        title: string;
        scope?: string;
        description?: string;
        dependencies: string[];
        owner_role?: string;
        acceptance_criteria?: FlowAcceptanceCriterion[];
        sub_plan_id?: string;
      }> = [];

      if (feature.type === 'epic' && feature.sub_features && feature.sub_features.length > 0) {
        for (const subFeature of feature.sub_features) {
          const subPlanId = featureIdToPlanId.get(subFeature.feature_id);
          if (subPlanId) {
            const childFeature = allFeatures.get(subFeature.feature_id);
            stepsToInsert.push({
              step_id: subFeature.feature_id,
              title: subFeature.title,
              scope: childFeature?.plan_implementation?.scopes?.[0],
              description: childFeature?.summary?.goal,
              dependencies: [],
              sub_plan_id: subPlanId,
            });
          }
        }
      } else {
        const flowSteps = feature.plan_implementation?.steps || [];
        for (const flowStep of flowSteps) {
          stepsToInsert.push({
            step_id: flowStep.step_id,
            title: flowStep.title,
            scope: flowStep.scope,
            description: flowStep.description,
            dependencies: flowStep.dependencies || [],
            owner_role: flowStep.owner_role,
            acceptance_criteria: flowStep.acceptance_criteria,
          });
        }
      }

      let stepOrder = 0;
      for (const step of stepsToInsert) {
        insertStep.run(planId, 1, step.step_id, stepOrder++, JSON.stringify(step));
      }

      importedCount++;
    }
  });

  transaction();

  console.log(`[seed] Created "Planner v1" initiative with ${importedCount} plans`);
  return true;
}

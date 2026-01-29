/**
 * Migration script: Import flow feature files into the planner database
 *
 * Reads docs/flow/catalog.json and feature files, transforms them to
 * PlanVersion format, and inserts into SQLite database.
 *
 * Key behavior:
 * - Regular features: steps from plan_implementation.steps
 * - Epics (with sub_features): creates steps pointing to child plans via sub_plan_id
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

interface FlowCatalog {
  project_id: string;
  status: string;
  components: Array<{
    id: string;
    name: string;
    tech: string[];
    path: string;
    description: string;
  }>;
  features: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
  }>;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

function mapStatus(flowStatus: string): 'draft' | 'approved' | 'published' {
  // Map flow status to DB status
  if (flowStatus === 'published') return 'published';
  if (flowStatus === 'approved') return 'approved';
  return 'draft';
}

async function migrate() {
  console.log('Starting migration from flow files to database...\n');

  // Read catalog
  const catalogPath = path.join(ROOT, 'docs/flow/catalog.json');
  const catalog: FlowCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  console.log(`Found project: ${catalog.project_id}`);
  console.log(`Features in catalog: ${catalog.features.length}\n`);

  // Read all feature files
  const featuresDir = path.join(ROOT, 'docs/flow/features');
  const featureFiles = fs.readdirSync(featuresDir).filter((f) => f.endsWith('.json'));
  console.log(`Feature files found: ${featureFiles.length}\n`);

  // Load all features into memory first
  const allFeatures = new Map<string, FlowFeature>();
  for (const featureFile of featureFiles) {
    const featurePath = path.join(featuresDir, featureFile);
    const feature: FlowFeature = JSON.parse(fs.readFileSync(featurePath, 'utf-8'));
    allFeatures.set(feature.feature_id, feature);
  }

  // Initialize database
  const dbPath = path.join(ROOT, 'planner.db');
  const db = new Database(dbPath);

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      plan_id TEXT PRIMARY KEY NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS versions (
      plan_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'published')),
      summary_json TEXT NOT NULL,
      submitted_at TEXT,
      approval_info_json TEXT,
      change_request_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (plan_id, version),
      FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS steps (
      plan_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      step_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      step_json TEXT NOT NULL,
      PRIMARY KEY (plan_id, version, step_id),
      FOREIGN KEY (plan_id, version) REFERENCES versions(plan_id, version) ON DELETE CASCADE
    )
  `);

  // Prepare statements
  const insertPlan = db.prepare(`
    INSERT OR REPLACE INTO plans (plan_id, created_at, updated_at)
    VALUES (?, ?, ?)
  `);

  const insertVersion = db.prepare(`
    INSERT OR REPLACE INTO versions (plan_id, version, status, summary_json, submitted_at, approval_info_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT OR REPLACE INTO steps (plan_id, version, step_id, step_order, step_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Track feature_id -> plan_id mapping for consistent references
  const featureIdToPlanId = new Map<string, string>();

  // First pass: assign UUIDs to all features
  for (const [featureId] of allFeatures) {
    featureIdToPlanId.set(featureId, generateUUID());
  }

  const now = new Date().toISOString();
  let importedCount = 0;
  let stepsCount = 0;
  let epicsWithSubPlans = 0;

  // Second pass: import features
  const transaction = db.transaction(() => {
    for (const [featureId, feature] of allFeatures) {
      const planId = featureIdToPlanId.get(featureId)!;
      const status = mapStatus(feature.status);

      // Create plan
      insertPlan.run(planId, now, now);

      // Build summary
      const summary = {
        goal: feature.summary?.goal || feature.title,
        context: feature.summary?.context,
      };

      // For approved status, add approval info
      const approvalInfo =
        status === 'approved' || status === 'published'
          ? JSON.stringify({
              approver: 'Migration Script',
              approved_at: now,
            })
          : null;

      // Create version
      insertVersion.run(
        planId,
        1, // version
        status,
        JSON.stringify(summary),
        status !== 'draft' ? now : null, // submitted_at
        approvalInfo,
        now,
        now
      );

      // Determine what steps to create
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

      // If this is an epic with sub_features, create steps from sub_features
      if (feature.type === 'epic' && feature.sub_features && feature.sub_features.length > 0) {
        epicsWithSubPlans++;
        for (const subFeature of feature.sub_features) {
          const subPlanId = featureIdToPlanId.get(subFeature.feature_id);
          if (subPlanId) {
            // Look up the child feature to get its scope
            const childFeature = allFeatures.get(subFeature.feature_id);
            const scope = childFeature?.plan_implementation?.scopes?.[0];

            stepsToInsert.push({
              step_id: subFeature.feature_id, // Use feature_id as step_id for clarity
              title: subFeature.title,
              scope,
              description: childFeature?.summary?.goal,
              dependencies: [],
              sub_plan_id: subPlanId,
            });
          }
        }
      } else {
        // Regular feature: use plan_implementation.steps
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

      // Insert steps
      let stepOrder = 0;
      for (const step of stepsToInsert) {
        insertStep.run(planId, 1, step.step_id, stepOrder++, JSON.stringify(step));
        stepsCount++;
      }

      const stepInfo =
        feature.type === 'epic' && feature.sub_features?.length
          ? `${stepsToInsert.length} sub-plans`
          : `${stepsToInsert.length} steps`;

      console.log(
        `  Imported: ${feature.feature_id} (${feature.type}) -> ${planId.slice(0, 8)}... [${stepInfo}]`
      );
      importedCount++;
    }
  });

  transaction();

  console.log(`\nMigration complete!`);
  console.log(`  Plans imported: ${importedCount}`);
  console.log(`  Steps imported: ${stepsCount}`);
  console.log(`  Epics with sub-plans: ${epicsWithSubPlans}`);
  console.log(`  Database: ${dbPath}`);

  db.close();
}

migrate().catch(console.error);

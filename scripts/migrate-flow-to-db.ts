/**
 * Migration script: Import flow feature files into the planner database
 *
 * This script imports the plans that were used to build the Planner itself,
 * giving you sample content to explore the UI and understand plan structure.
 *
 * Reads docs/flow/catalog.json and feature files, transforms them to
 * PlanVersion format, and inserts into SQLite database.
 *
 * Key behavior:
 * - Idempotent: safe to re-run to pick up new features or changes
 * - Uses deterministic UUIDs: same feature_id always produces same plan_id
 * - Creates "Planner Development" org and "Planner v1" initiative
 * - Regular features: steps from plan_implementation.steps
 * - Epics (with sub_features): creates steps pointing to child plans via sub_plan_id
 *
 * Re-running will:
 * - Update existing plans with any changes
 * - Add new plans for new features
 * - Remove steps that no longer exist in the flow files
 *
 * Usage:
 *   npx tsx scripts/migrate-flow-to-db.ts
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Namespace UUID for generating deterministic UUIDs from feature_id
// This ensures the same feature_id always produces the same plan_id
const NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace (standard)

/**
 * Generate a deterministic UUID v5 from a name.
 * Uses SHA-1 hash of namespace + name, formatted as UUID.
 * This ensures the same name always produces the same UUID.
 */
function deterministicUUID(name: string): string {
  const hash = createHash('sha1');
  const namespaceBytes = NAMESPACE_UUID.replace(/-/g, '');
  const namespaceBuffer = Buffer.from(namespaceBytes, 'hex');
  hash.update(namespaceBuffer);
  hash.update(name);
  const hashBytes = hash.digest();
  // Format as UUID v5: Set version (5) in byte 6, variant (10xx) in byte 8
  hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
  hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;
  const hex = hashBytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Deterministic UUID for the sample initiative
// Stable across re-runs so data is updated, not duplicated
const SAMPLE_INITIATIVE_ID = deterministicUUID('planner-v1-initiative');

interface FlowAcceptanceCriterion {
  id: string;
  description: string;
  type?: string;
}

// Flow design_spec types
interface FlowViewElement {
  component: string;
  use?: string;
  props?: string;
}

interface FlowView {
  view_id: string;
  name: string;
  layout?: string;
  elements?: FlowViewElement[];
  states?: Record<string, string>;
}

interface FlowDesignSpec {
  location?: string;
  pattern?: string;
  views?: FlowView[];
  custom_needed?: string[];
}

// Flow plan_tests types
interface FlowTestCase {
  type: 'happy' | 'edge' | 'error';
  scope?: string;
  description: string;
}

interface FlowTestGroup {
  group: string;
  rationale?: string;
  tests: FlowTestCase[];
}

interface FlowPlanTests {
  coverage?: string;
  priority?: string;
  strategy?: string;
  notes?: string;
  cases?: (FlowTestCase | FlowTestGroup)[];
  data_requirements?: string[];
}

interface FlowStep {
  step_id: string;
  title: string;
  scope?: string;
  description?: string;
  dependencies: string[];
  owner_role?: string;
  acceptance_criteria?: FlowAcceptanceCriterion[];
  specification?: Record<string, unknown>; // Step-level specification (design, testing, etc.)
}

interface SubFeatureRef {
  feature_id: string;
  title: string;
  ref: string;
}

// Flow understanding types (agent observations during ideation)
interface FlowAgentObservations {
  observations?: string[];
  keywords?: string[];
  questions?: string[];
  concerns?: string[];
  references?: string[];
  confidence?: 'exploring' | 'forming' | 'confident';
  migrated_from?: string;
  updated_at?: string;
  updated_by?: string;
}

type FlowUnderstanding = Record<string, FlowAgentObservations>;

// Flow context types (agent decisions at plan level)
type FlowContext = Record<string, Record<string, unknown>>;

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
  design_spec?: FlowDesignSpec;
  plan_tests?: FlowPlanTests;
  understanding?: FlowUnderstanding;
  context?: FlowContext;
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

function mapStatus(flowStatus: string): 'draft' | 'approved' | 'published' {
  // Map flow status to DB status
  if (flowStatus === 'published') return 'published';
  if (flowStatus === 'approved') return 'approved';
  return 'draft';
}

/**
 * Map flow design_spec to Specification.design format
 */
function mapDesignSpec(flow: FlowDesignSpec): {
  components?: Array<{ component_id: string; name: string; description?: string }>;
  views?: Array<{
    view_id: string;
    name: string;
    description?: string;
    components?: string[];
    states?: Array<{ state: string; description?: string }>;
  }>;
} {
  const spec: ReturnType<typeof mapDesignSpec> = {};
  const componentSet = new Set<string>();
  const components: Array<{ component_id: string; name: string; description?: string }> = [];

  if (flow.views) {
    spec.views = flow.views.map((v) => {
      const viewComponents: string[] = [];

      if (v.elements) {
        for (const el of v.elements) {
          if (el.component) {
            componentSet.add(el.component);
            viewComponents.push(el.component);
          }
        }
      }

      const states: Array<{ state: string; description?: string }> = [];
      if (v.states) {
        for (const [state, description] of Object.entries(v.states)) {
          states.push({ state, description });
        }
      }

      return {
        view_id: v.view_id,
        name: v.name,
        description: v.layout,
        components: viewComponents.length > 0 ? viewComponents : undefined,
        states: states.length > 0 ? states : undefined,
      };
    });
  }

  // Build component specs from collected components
  for (const compName of componentSet) {
    if (compName) {
      components.push({
        component_id: compName.toLowerCase().replace(/\s+/g, '-'),
        name: compName,
      });
    }
  }

  // Add custom_needed as components with descriptions
  if (flow.custom_needed) {
    for (const custom of flow.custom_needed) {
      if (typeof custom !== 'string') continue; // Skip non-string entries
      const match = custom.match(/^([^-]+)\s*-\s*(.+)$/);
      if (match) {
        components.push({
          component_id: match[1].trim().toLowerCase().replace(/\s+/g, '-'),
          name: match[1].trim(),
          description: match[2].trim(),
        });
      } else {
        components.push({
          component_id: custom.toLowerCase().replace(/\s+/g, '-'),
          name: custom,
        });
      }
    }
  }

  if (components.length > 0) {
    spec.components = components;
  }

  // If only location/pattern, add as a view with description
  if (!flow.views && (flow.location || flow.pattern)) {
    spec.views = [
      {
        view_id: 'v001',
        name: 'Main View',
        description: [flow.location, flow.pattern ? `Pattern: ${flow.pattern}` : null]
          .filter(Boolean)
          .join('. '),
      },
    ];
  }

  return spec;
}

/**
 * Map flow plan_tests to Specification.testing format
 */
function mapPlanTests(
  flow: FlowPlanTests,
  featureId: string
): {
  test_cases?: Array<{
    case_id: string;
    type: 'happy' | 'edge' | 'error' | 'security' | 'performance';
    priority: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
  coverage_notes?: string;
} {
  const spec: ReturnType<typeof mapPlanTests> = {};
  const testCases: Array<{
    case_id: string;
    type: 'happy' | 'edge' | 'error' | 'security' | 'performance';
    priority: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }> = [];

  if (flow.cases) {
    let idx = 0;
    for (const c of flow.cases) {
      // Check if it's a grouped test structure
      if ('group' in c && 'tests' in c) {
        const group = c as FlowTestGroup;
        for (const test of group.tests) {
          idx++;
          testCases.push({
            case_id: `${featureId}-tc${String(idx).padStart(3, '0')}`,
            type: test.type as 'happy' | 'edge' | 'error',
            priority: (flow.priority as 'critical' | 'high' | 'medium' | 'low') || 'high',
            description: test.description,
          });
        }
      } else if ('type' in c && 'description' in c) {
        // Flat test case
        idx++;
        const test = c as FlowTestCase;
        testCases.push({
          case_id: `${featureId}-tc${String(idx).padStart(3, '0')}`,
          type: test.type as 'happy' | 'edge' | 'error',
          priority: (flow.priority as 'critical' | 'high' | 'medium' | 'low') || 'high',
          description: test.description,
        });
      }
    }
  }

  if (testCases.length > 0) {
    spec.test_cases = testCases;
  }

  // Build coverage notes from various fields
  const notes: string[] = [];
  if (flow.coverage) {
    notes.push(`Coverage: ${flow.coverage}`);
  }
  if (flow.strategy) {
    notes.push(`Strategy: ${flow.strategy}`);
  }
  if (flow.notes) {
    notes.push(`Notes: ${flow.notes}`);
  }
  if (flow.data_requirements && flow.data_requirements.length > 0) {
    notes.push(`Data requirements:\n- ${flow.data_requirements.join('\n- ')}`);
  }

  if (notes.length > 0) {
    spec.coverage_notes = notes.join('\n\n');
  }

  return spec;
}

/**
 * Build step specification from feature-level design_spec and plan_tests
 */
function buildStepSpecification(
  feature: FlowFeature
): { design?: ReturnType<typeof mapDesignSpec>; testing?: ReturnType<typeof mapPlanTests> } | undefined {
  const spec: { design?: ReturnType<typeof mapDesignSpec>; testing?: ReturnType<typeof mapPlanTests> } = {};
  let hasContent = false;

  if (feature.design_spec) {
    const design = mapDesignSpec(feature.design_spec);
    if (design.views || design.components) {
      spec.design = design;
      hasContent = true;
    }
  }

  if (feature.plan_tests) {
    const testing = mapPlanTests(feature.plan_tests, feature.feature_id);
    if (testing.test_cases || testing.coverage_notes) {
      spec.testing = testing;
      hasContent = true;
    }
  }

  return hasContent ? spec : undefined;
}

async function migrate() {
  console.log('Starting migration from flow files to database...\n');
  console.log(`Initiative ID: ${SAMPLE_INITIATIVE_ID}\n`);

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

  // Create organization table if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      org_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create initiatives table if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS initiatives (
      initiative_id TEXT PRIMARY KEY NOT NULL,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')),
      icon TEXT,
      color TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
    )
  `);

  // Create plans table with org_id and initiative_id
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      plan_id TEXT PRIMARY KEY NOT NULL,
      org_id TEXT NOT NULL,
      initiative_id TEXT,
      owner_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
      FOREIGN KEY (initiative_id) REFERENCES initiatives(initiative_id) ON DELETE SET NULL
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
      metadata_json TEXT,
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

  const now = new Date().toISOString();

  // Ensure default organization exists (matches the one created by storage/migration.ts)
  const existingOrg = db.prepare<string, { org_id: string }>(
    `SELECT org_id FROM organizations WHERE slug = ?`
  ).get('default');

  let defaultOrgId: string;
  if (existingOrg) {
    defaultOrgId = existingOrg.org_id;
    console.log(`Using existing organization: default (${defaultOrgId.slice(0, 8)}...)\n`);
  } else {
    // Create default org if running standalone (before server startup)
    defaultOrgId = deterministicUUID('default-org');
    db.prepare(`
      INSERT INTO organizations (org_id, name, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(defaultOrgId, 'Default', 'default', now, now);
    console.log(`Created organization: Default (${defaultOrgId.slice(0, 8)}...)\n`);
  }

  // Create or update the Planner v1 initiative under the default org
  const insertInitiative = db.prepare(`
    INSERT OR REPLACE INTO initiatives (initiative_id, org_id, name, description, status, icon, color, display_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertInitiative.run(
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
  console.log('Created initiative: Planner v1\n');

  // Prepare plan statements
  const insertPlan = db.prepare(`
    INSERT OR REPLACE INTO plans (plan_id, org_id, initiative_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertVersion = db.prepare(`
    INSERT OR REPLACE INTO versions (plan_id, version, status, summary_json, understanding_json, context_json, submitted_at, approval_info_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT OR REPLACE INTO steps (plan_id, version, step_id, step_order, step_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Delete existing steps for a plan/version (to handle removed steps on re-migration)
  const deleteSteps = db.prepare(`
    DELETE FROM steps WHERE plan_id = ? AND version = ?
  `);

  // Track feature_id -> plan_id mapping for consistent references
  // Uses deterministic UUIDs so re-running migration updates existing records
  const featureIdToPlanId = new Map<string, string>();

  // First pass: generate deterministic UUIDs for all features
  for (const [featureId] of allFeatures) {
    featureIdToPlanId.set(featureId, deterministicUUID(featureId));
  }

  let importedCount = 0;
  let stepsCount = 0;
  let epicsWithSubPlans = 0;
  let withUnderstanding = 0;
  let withContext = 0;

  // Second pass: import features
  const transaction = db.transaction(() => {
    for (const [featureId, feature] of allFeatures) {
      const planId = featureIdToPlanId.get(featureId)!;
      const status = mapStatus(feature.status);

      // Create plan
      insertPlan.run(planId, defaultOrgId, SAMPLE_INITIATIVE_ID, now, now);

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

      // Build understanding and context from flow feature
      const understandingJson = feature.understanding
        ? JSON.stringify(feature.understanding)
        : null;
      const contextJson = feature.context
        ? JSON.stringify(feature.context)
        : null;

      // Create version
      insertVersion.run(
        planId,
        1, // version
        status,
        JSON.stringify(summary),
        understandingJson,
        contextJson,
        status !== 'draft' ? now : null, // submitted_at
        approvalInfo,
        now,
        now
      );

      // Build specification from feature-level design_spec and plan_tests
      const featureSpecification = buildStepSpecification(feature);

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
        specification?: ReturnType<typeof buildStepSpecification>;
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
        for (let i = 0; i < flowSteps.length; i++) {
          const flowStep = flowSteps[i];

          // Build step specification:
          // - First step: merge feature-level spec with step-level spec
          // - Other steps: use step-level spec only
          let stepSpec: Record<string, unknown> | undefined;
          if (i === 0 && featureSpecification) {
            // First step gets feature-level spec, merged with any step-level spec
            stepSpec = flowStep.specification
              ? { ...featureSpecification, ...flowStep.specification }
              : featureSpecification;
          } else if (flowStep.specification) {
            // Other steps use their own specification if present
            stepSpec = flowStep.specification;
          }

          stepsToInsert.push({
            step_id: flowStep.step_id,
            title: flowStep.title,
            scope: flowStep.scope,
            description: flowStep.description,
            dependencies: flowStep.dependencies || [],
            owner_role: flowStep.owner_role,
            acceptance_criteria: flowStep.acceptance_criteria,
            specification: stepSpec,
          });
        }
      }

      // Delete existing steps and insert fresh (handles removed steps)
      deleteSteps.run(planId, 1);

      let stepOrder = 0;
      for (const step of stepsToInsert) {
        insertStep.run(planId, 1, step.step_id, stepOrder++, JSON.stringify(step));
        stepsCount++;
      }

      const stepInfo =
        feature.type === 'epic' && feature.sub_features?.length
          ? `${stepsToInsert.length} sub-plans`
          : `${stepsToInsert.length} steps`;

      // Track understanding and context
      if (feature.understanding && Object.keys(feature.understanding).length > 0) {
        withUnderstanding++;
      }
      if (feature.context && Object.keys(feature.context).length > 0) {
        withContext++;
      }

      const enrichmentInfo: string[] = [];
      if (feature.understanding) enrichmentInfo.push('U');
      if (feature.context) enrichmentInfo.push('C');
      const enrichmentStr = enrichmentInfo.length > 0 ? ` {${enrichmentInfo.join(',')}}` : '';

      console.log(
        `  Imported: ${feature.feature_id} (${feature.type}) -> ${planId.slice(0, 8)}... [${stepInfo}]${enrichmentStr}`
      );
      importedCount++;
    }
  });

  transaction();

  console.log(`\nMigration complete!`);
  console.log(`  Initiative: Planner v1`);
  console.log(`  Plans imported/updated: ${importedCount}`);
  console.log(`  Steps imported: ${stepsCount}`);
  console.log(`  Epics with sub-plans: ${epicsWithSubPlans}`);
  console.log(`  With understanding: ${withUnderstanding}`);
  console.log(`  With context: ${withContext}`);
  console.log(`  Database: ${dbPath}`);
  console.log(`\n  All plans are attached to the "Planner v1" initiative.`);
  console.log(`  Note: Uses deterministic UUIDs - safe to re-run for updates.`);

  db.close();
}

migrate().catch(console.error);

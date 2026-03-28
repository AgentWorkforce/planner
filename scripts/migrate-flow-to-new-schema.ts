#!/usr/bin/env npx tsx
/**
 * Migration script for flow feature files
 *
 * MOVES existing data to new schema sections:
 * - investigation → understanding.architect or understanding.designer
 * - design_spec.ux_improvements → understanding.designer.observations
 * - plan_tests.strategy → context.tester.strategy
 * - plan_tests.tools → context.tester (as individual fields)
 *
 * Does NOT add new content - only reorganizes existing data.
 *
 * Usage:
 *   npx tsx scripts/migrate-flow-to-new-schema.ts --dry-run   # Preview changes
 *   npx tsx scripts/migrate-flow-to-new-schema.ts             # Apply changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FEATURES_DIR = path.join(__dirname, '../docs/flow/features');

interface MigrationResult {
  featureId: string;
  changes: string[];
  hadExistingUnderstanding: boolean;
  hadExistingContext: boolean;
}

interface AgentObservations {
  observations?: string[];
  keywords?: string[];
  questions?: string[];
  concerns?: string[];
  references?: string[];
  confidence?: 'exploring' | 'forming' | 'confident';
  migrated_from?: string; // Track migration source
}

function migrateFeature(filePath: string, dryRun: boolean): MigrationResult | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const feature = JSON.parse(content);
  const changes: string[] = [];

  const result: MigrationResult = {
    featureId: feature.feature_id,
    changes: [],
    hadExistingUnderstanding: !!feature.understanding,
    hadExistingContext: !!feature.context,
  };

  // Initialize sections if needed
  if (!feature.understanding) {
    feature.understanding = {};
  }
  if (!feature.context) {
    feature.context = {};
  }

  // 1. Migrate investigation → understanding.architect
  if (feature.investigation) {
    const inv = feature.investigation;

    if (!feature.understanding.architect) {
      feature.understanding.architect = {};
    }
    const arch = feature.understanding.architect as AgentObservations;

    // root_cause.evidence → observations
    if (inv.root_cause?.evidence && Array.isArray(inv.root_cause.evidence)) {
      arch.observations = arch.observations || [];
      arch.observations.push(...inv.root_cause.evidence);
      changes.push(`investigation.root_cause.evidence → understanding.architect.observations (${inv.root_cause.evidence.length} items)`);
    }

    // root_cause.summary → observations (as single item)
    if (inv.root_cause?.summary) {
      arch.observations = arch.observations || [];
      arch.observations.unshift(`Root cause: ${inv.root_cause.summary}`);
      changes.push(`investigation.root_cause.summary → understanding.architect.observations`);
    }

    // issues_found → concerns
    if (inv.issues_found && Array.isArray(inv.issues_found)) {
      arch.concerns = arch.concerns || [];
      for (const issue of inv.issues_found) {
        if (issue.title) {
          arch.concerns.push(`[${issue.severity || 'unknown'}] ${issue.title}`);
        }
      }
      changes.push(`investigation.issues_found → understanding.architect.concerns (${inv.issues_found.length} items)`);
    }

    // Mark migration source
    arch.migrated_from = 'investigation';
    arch.confidence = 'confident'; // Investigation results are typically confirmed

    // Remove old field
    delete feature.investigation;
    changes.push(`Removed: investigation section (data moved)`);
  }

  // 2. Migrate design_spec.ux_improvements → understanding.designer.observations
  if (feature.design_spec?.ux_improvements && Array.isArray(feature.design_spec.ux_improvements)) {
    if (!feature.understanding.designer) {
      feature.understanding.designer = {};
    }
    const designer = feature.understanding.designer as AgentObservations;

    designer.observations = designer.observations || [];
    designer.observations.push(...feature.design_spec.ux_improvements);
    designer.migrated_from = 'design_spec.ux_improvements';

    changes.push(`design_spec.ux_improvements → understanding.designer.observations (${feature.design_spec.ux_improvements.length} items)`);

    // Remove from design_spec
    delete feature.design_spec.ux_improvements;
  }

  // 3. Migrate plan_tests fields → context.tester
  if (feature.plan_tests) {
    const pt = feature.plan_tests;

    // Fields to migrate to context.tester (decisions)
    const testerContextFields = ['strategy', 'notes', 'implementation_notes', 'focus',
      'rationale', 'skip_rationale', 'mock_patterns', 'test_file_structure',
      'test_suites', 'test_file'];

    const hasTesterFields = testerContextFields.some(f => pt[f] !== undefined) || pt.tools;

    if (hasTesterFields) {
      if (!feature.context.tester) {
        feature.context.tester = {};
      }
      const tester = feature.context.tester as Record<string, unknown>;

      // Migrate simple string/object fields
      for (const field of testerContextFields) {
        if (pt[field] !== undefined) {
          tester[field] = pt[field];
          changes.push(`plan_tests.${field} → context.tester.${field}`);
          delete feature.plan_tests[field];
        }
      }

      // Migrate tools object
      if (pt.tools) {
        if (pt.tools.test_runner) {
          tester.framework = pt.tools.test_runner;
          changes.push(`plan_tests.tools.test_runner → context.tester.framework`);
        }
        if (pt.tools.render) {
          tester.render_library = pt.tools.render;
          changes.push(`plan_tests.tools.render → context.tester.render_library`);
        }
        if (pt.tools.a11y) {
          tester.a11y_approach = pt.tools.a11y;
          changes.push(`plan_tests.tools.a11y → context.tester.a11y_approach`);
        }
        delete feature.plan_tests.tools;
      }

      tester.migrated_from = 'plan_tests';
    }
  }

  // 4. Migrate design_spec fields → context.designer and understanding.designer
  if (feature.design_spec) {
    const ds = feature.design_spec;

    // Fields to migrate to context.designer (decisions)
    const designerContextFields = ['approach', 'custom_needed', 'shadcn_components',
      'css_classes_needed', 'css_additions', 'css_variables', 'patterns',
      'animations', 'color_mapping', 'toolbar_pattern', 'toolbar', 'architecture',
      'data_flow', 'mcp_tools', 'spawn_flow'];

    const hasDesignerContextFields = designerContextFields.some(f => ds[f] !== undefined);

    if (hasDesignerContextFields) {
      if (!feature.context.designer) {
        feature.context.designer = {};
      }
      const designer = feature.context.designer as Record<string, unknown>;

      for (const field of designerContextFields) {
        if (ds[field] !== undefined) {
          // Rename custom_needed to custom_components
          const targetField = field === 'custom_needed' ? 'custom_components' : field;
          designer[targetField] = ds[field];
          changes.push(`design_spec.${field} → context.designer.${targetField}`);
          delete feature.design_spec[field];
        }
      }

      designer.migrated_from = 'design_spec';
    }

    // Migrate notes/interaction_notes to understanding.designer.observations
    const noteFields = ['notes', 'interaction_notes'];
    for (const field of noteFields) {
      if (ds[field]) {
        if (!feature.understanding.designer) {
          feature.understanding.designer = {};
        }
        const designerObs = feature.understanding.designer as AgentObservations;
        designerObs.observations = designerObs.observations || [];

        if (typeof ds[field] === 'string') {
          designerObs.observations.push(ds[field]);
        } else if (Array.isArray(ds[field])) {
          designerObs.observations.push(...ds[field]);
        }

        changes.push(`design_spec.${field} → understanding.designer.observations`);
        delete feature.design_spec[field];
      }
    }
  }

  // Clean up empty sections
  if (Object.keys(feature.understanding).length === 0) {
    delete feature.understanding;
  }
  if (Object.keys(feature.context).length === 0) {
    delete feature.context;
  }

  // Only proceed if we made changes
  if (changes.length === 0) {
    return null;
  }

  result.changes = changes;

  if (!dryRun) {
    // Write back with pretty formatting
    const output = JSON.stringify(feature, null, 2) + '\n';
    fs.writeFileSync(filePath, output);
  }

  return result;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n🔄 Flow Schema Migration ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(50));

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No files will be modified\n');
  }

  const files = fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(FEATURES_DIR, f));

  const results: MigrationResult[] = [];
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    const filename = path.basename(file);
    try {
      const result = migrateFeature(file, dryRun);
      if (result) {
        results.push(result);
        console.log(`\n✅ ${filename} (${result.featureId})`);
        for (const change of result.changes) {
          console.log(`   • ${change}`);
        }
        if (result.hadExistingUnderstanding) {
          console.log(`   ℹ️  Had existing understanding section (merged)`);
        }
        if (result.hadExistingContext) {
          console.log(`   ℹ️  Had existing context section (merged)`);
        }
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error(`\n❌ ${filename}: ${err}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Migrated: ${results.length}`);
  console.log(`   Skipped (no changes): ${skipped}`);
  console.log(`   Errors: ${errors}`);

  if (results.length > 0 && dryRun) {
    console.log(`\n💡 Run without --dry-run to apply changes`);
  }
}

main();

#!/usr/bin/env npx tsx
/**
 * Reorganize flow feature files - move implementation details from context to specification
 *
 * This script does NOT create new information - it only moves existing data:
 * - context.designer.custom_components → first step's specification.design.components
 * - context.designer.shadcn_components → first step's specification.design.components
 * - context.designer.css_variables → first step's specification.design.css_variables
 * - context.designer.color_mapping → first step's specification.design.color_mapping
 * - context.tester.test_suites → first step's specification.testing.test_suites
 * - context.tester.mock_patterns → first step's specification.testing.mock_patterns
 * - context.tester.test_file_structure → first step's specification.testing.test_file_structure
 * - context.tester.framework → stays (strategic choice)
 * - context.tester.strategy → stays (strategic choice)
 * - context.designer.approach → stays (strategic choice)
 *
 * Usage:
 *   npx tsx scripts/reorganize-flow-schema.ts --dry-run   # Preview changes
 *   npx tsx scripts/reorganize-flow-schema.ts             # Apply changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FEATURES_DIR = path.join(__dirname, '../docs/flow/features');

// Fields that are STRATEGIC DECISIONS (stay in context)
const CONTEXT_KEEPS = {
  designer: ['approach', 'philosophy', 'theme', 'migrated_from'],
  tester: ['strategy', 'framework', 'philosophy', 'migrated_from'],
  architect: ['approach', 'philosophy', 'tech_stack', 'migrated_from'],
  security: ['approach', 'philosophy', 'compliance', 'migrated_from'],
};

// Fields that are IMPLEMENTATION DETAILS (move to specification)
// The source role determines the target domain:
//   context.designer.* → specification.design.*
//   context.tester.* → specification.testing.*
//   context.architect.* → specification.architecture.*
const CONTEXT_MOVES: Record<string, string[]> = {
  designer: [
    'custom_components',
    'custom_needed',
    'shadcn_components',
    'css_variables',
    'css_classes_needed',
    'css_additions',
    'color_mapping',
    'patterns',
    'animations',
    'toolbar_pattern',
    'toolbar',
    'data_flow',
    'mcp_tools',
    'spawn_flow',
    'architecture',
  ],
  tester: [
    'test_suites',
    'mock_patterns',
    'test_file_structure',
    'test_file',
    'render_library',
    'a11y_approach',
    'implementation_notes',
    'focus',
    'rationale',
    'skip_rationale',
  ],
  architect: [
    'boundaries',
    'api_contracts',
    'entities',
    'relationships',
    'schemas',
  ],
};

// Map role to specification domain
const ROLE_TO_DOMAIN: Record<string, string> = {
  designer: 'design',
  tester: 'testing',
  architect: 'architecture',
  security: 'security',
};

interface ReorganizeResult {
  featureId: string;
  movedToSpec: string[];
  keptInContext: string[];
  noSteps: boolean;
}

function reorganizeFeature(filePath: string, dryRun: boolean): ReorganizeResult | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const feature = JSON.parse(content);
  const movedToSpec: string[] = [];
  const keptInContext: string[] = [];

  const result: ReorganizeResult = {
    featureId: feature.feature_id,
    movedToSpec: [],
    keptInContext: [],
    noSteps: false,
  };

  // Skip if no context section
  if (!feature.context || Object.keys(feature.context).length === 0) {
    return null;
  }

  // Check if there are steps to move data to
  const steps = feature.plan_implementation?.steps;
  if (!steps || steps.length === 0) {
    // For epics without steps, we can't move to specification
    // Just report what would be moved
    for (const [role, roleContext] of Object.entries(feature.context)) {
      if (typeof roleContext !== 'object' || !roleContext) continue;
      const movableFields = CONTEXT_MOVES[role as keyof typeof CONTEXT_MOVES] || [];
      for (const field of Object.keys(roleContext as Record<string, unknown>)) {
        if (movableFields.includes(field)) {
          movedToSpec.push(`context.${role}.${field} (no steps to move to)`);
        }
      }
    }
    if (movedToSpec.length > 0) {
      result.movedToSpec = movedToSpec;
      result.noSteps = true;
      return result;
    }
    return null;
  }

  // Get first step - this is where feature-level specs go
  const firstStep = steps[0];
  if (!firstStep.specification) {
    firstStep.specification = {};
  }

  let hasChanges = false;

  // Process each role in context
  for (const [role, roleContext] of Object.entries(feature.context)) {
    if (typeof roleContext !== 'object' || !roleContext) continue;

    const ctx = roleContext as Record<string, unknown>;
    const keepFields = CONTEXT_KEEPS[role as keyof typeof CONTEXT_KEEPS] || [];
    const moveFields = CONTEXT_MOVES[role as keyof typeof CONTEXT_MOVES] || [];

    // Map role to specification domain
    const specDomain = ROLE_TO_DOMAIN[role] || role;

    // Initialize spec domain if needed
    if (!firstStep.specification[specDomain]) {
      firstStep.specification[specDomain] = {};
    }

    const fieldsToRemove: string[] = [];

    for (const [field, value] of Object.entries(ctx)) {
      if (moveFields.includes(field)) {
        // Move to specification
        (firstStep.specification[specDomain] as Record<string, unknown>)[field] = value;
        movedToSpec.push(`context.${role}.${field} → step[0].specification.${specDomain}.${field}`);
        fieldsToRemove.push(field);
        hasChanges = true;
      } else if (keepFields.includes(field)) {
        keptInContext.push(`context.${role}.${field}`);
      } else {
        // Unknown field - decide based on heuristics
        if (isImplementationDetail(field, value)) {
          (firstStep.specification[specDomain] as Record<string, unknown>)[field] = value;
          movedToSpec.push(`context.${role}.${field} → step[0].specification.${specDomain}.${field} (inferred)`);
          fieldsToRemove.push(field);
          hasChanges = true;
        } else {
          keptInContext.push(`context.${role}.${field} (kept)`);
        }
      }
    }

    // Remove moved fields from context
    for (const field of fieldsToRemove) {
      delete ctx[field];
    }

    // If context role is now empty (except migrated_from), remove it
    const remainingKeys = Object.keys(ctx).filter((k) => k !== 'migrated_from');
    if (remainingKeys.length === 0) {
      delete feature.context[role];
    }
  }

  // Clean up empty context
  if (Object.keys(feature.context).length === 0) {
    delete feature.context;
  }

  // Clean up empty specification domains
  for (const step of steps) {
    if (step.specification) {
      for (const [domain, domainSpec] of Object.entries(step.specification)) {
        if (typeof domainSpec === 'object' && domainSpec && Object.keys(domainSpec).length === 0) {
          delete step.specification[domain];
        }
      }
      if (Object.keys(step.specification).length === 0) {
        delete step.specification;
      }
    }
  }

  if (!hasChanges) {
    return null;
  }

  result.movedToSpec = movedToSpec;
  result.keptInContext = keptInContext;

  if (!dryRun) {
    const output = JSON.stringify(feature, null, 2) + '\n';
    fs.writeFileSync(filePath, output);
  }

  return result;
}

/**
 * Heuristic to determine if a value is an implementation detail
 */
function isImplementationDetail(field: string, value: unknown): boolean {
  // Arrays of component names, test cases, etc. are implementation details
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'string') {
      // Check if it looks like component names, file paths, etc.
      const firstItem = value[0] as string;
      if (
        firstItem.includes('Icon') ||
        firstItem.includes('Component') ||
        firstItem.includes('.ts') ||
        firstItem.includes('.tsx') ||
        firstItem.includes('test') ||
        firstItem.includes('mock')
      ) {
        return true;
      }
    }
    // Objects in arrays (like test_suites, mock_patterns) are implementation details
    if (value.length > 0 && typeof value[0] === 'object') {
      return true;
    }
  }

  // Objects with specific keys are likely implementation details
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    // CSS variables, color mappings, etc.
    if (keys.some((k) => k.startsWith('--') || k.includes('color') || k.includes('width'))) {
      return true;
    }
  }

  // Field names that suggest implementation
  const implFieldPatterns = [
    'component',
    'element',
    'class',
    'css',
    'color',
    'icon',
    'test',
    'mock',
    'file',
    'path',
    'endpoint',
    'api',
    'schema',
    'validation',
  ];

  return implFieldPatterns.some((p) => field.toLowerCase().includes(p));
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n🔄 Reorganize Flow Schema: Context → Specification ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No files will be modified\n');
  }

  console.log('Moving implementation details from context to step specification...\n');

  const files = fs
    .readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => path.join(FEATURES_DIR, f));

  const results: ReorganizeResult[] = [];
  let skipped = 0;
  let errors = 0;
  let noStepsCount = 0;

  for (const file of files) {
    const filename = path.basename(file);
    try {
      const result = reorganizeFeature(file, dryRun);
      if (result) {
        results.push(result);
        if (result.noSteps) {
          noStepsCount++;
          console.log(`\n⚠️  ${filename} (${result.featureId}) - NO STEPS (epic)`);
          for (const moved of result.movedToSpec) {
            console.log(`   ⏸️  ${moved}`);
          }
        } else {
          console.log(`\n✅ ${filename} (${result.featureId})`);
          for (const moved of result.movedToSpec) {
            console.log(`   → ${moved}`);
          }
          if (result.keptInContext.length > 0) {
            console.log(`   Kept in context: ${result.keptInContext.length} fields`);
          }
        }
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error(`\n❌ ${filename}: ${err}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Reorganized: ${results.length - noStepsCount}`);
  console.log(`   Epics (no steps): ${noStepsCount}`);
  console.log(`   Skipped (no changes): ${skipped}`);
  console.log(`   Errors: ${errors}`);

  if (results.length > 0 && dryRun) {
    console.log(`\n💡 Run without --dry-run to apply changes`);
  }
}

main();

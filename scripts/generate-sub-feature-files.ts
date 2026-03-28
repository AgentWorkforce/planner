/**
 * Generate individual feature files for inline sub_features in epics.
 *
 * The flow schema allows sub_features to be defined inline in epic files
 * (for low-complexity features) or as separate files via "ref" (for complex ones).
 * The migration script only reads individual files, so this script materializes
 * inline sub_features into their own JSON files — preserving ALL data including
 * plan_implementation, understanding, context, etc.
 *
 * Reads: docs/flow/features/*.json (epics with sub_features)
 * Reads: docs/flow/catalog.json (for status, dependencies, priority metadata)
 * Writes: docs/flow/features/{sub_feature_id}.json (for each missing file)
 *
 * Idempotent: skips sub_features that already have files.
 *
 * Usage:
 *   npx tsx scripts/generate-sub-feature-files.ts
 *   npx tsx scripts/generate-sub-feature-files.ts --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'docs/flow/features');
const CATALOG_PATH = path.join(ROOT, 'docs/flow/catalog.json');

const dryRun = process.argv.includes('--dry-run');

interface CatalogFeature {
  id: string;
  title: string;
  type: string;
  status: string;
  priority?: string;
  dependencies?: string[];
  parent?: string;
  component?: string;
  note?: string;
}

// Sub-features can have any fields a normal feature has
type SubFeature = Record<string, unknown> & {
  id?: string;
  feature_id?: string;
  title?: string;
  ref?: string;
};

interface EpicFeature {
  feature_id: string;
  title: string;
  type: string;
  status: string;
  priority?: string;
  component?: string;
  sub_features?: SubFeature[];
}

function run() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== Generating sub-feature files ===');
  console.log('');

  // Load catalog for metadata enrichment
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  const catalogMap = new Map<string, CatalogFeature>();
  for (const f of catalog.features) {
    catalogMap.set(f.id, f);
  }

  // Find existing feature files
  const existingFiles = new Set(
    fs.readdirSync(FEATURES_DIR)
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => f.replace('.json', ''))
  );

  // Scan all epic files for inline sub_features
  let generated = 0;
  let skipped = 0;
  let totalSteps = 0;

  for (const file of fs.readdirSync(FEATURES_DIR).filter((f: string) => f.endsWith('.json')).sort()) {
    const epicPath = path.join(FEATURES_DIR, file);
    const epic: EpicFeature = JSON.parse(fs.readFileSync(epicPath, 'utf-8'));

    if (!epic.sub_features || !Array.isArray(epic.sub_features) || epic.sub_features.length === 0) continue;

    const missing: SubFeature[] = [];
    for (const sf of epic.sub_features) {
      const sfId = (typeof sf === 'string') ? sf : (sf.id || sf.feature_id);
      if (!sfId) continue;

      // Skip if it has a ref (points to existing file) or file already exists
      if (typeof sf !== 'string' && sf.ref) continue;
      if (existingFiles.has(sfId)) {
        skipped++;
        continue;
      }

      missing.push(typeof sf === 'string' ? { id: sf } : sf);
    }

    if (missing.length === 0) continue;

    console.log(`${epic.feature_id} (${epic.type}): ${missing.length} sub-features to generate`);

    for (const sf of missing) {
      const sfId = (sf.id || sf.feature_id) as string;
      const catalogEntry = catalogMap.get(sfId);

      // Start with ALL inline data from the sub_feature (plan_implementation, understanding, etc.)
      const feature: Record<string, unknown> = { ...sf };

      // Normalize the id field to feature_id (the standard field name)
      feature.feature_id = sfId;
      delete feature.id;
      delete feature.ref;

      // Set standard fields, preferring catalog > inline > epic defaults
      feature.title = sf.title || catalogEntry?.title || sfId;
      feature.type = catalogEntry?.type || 'feature';
      feature.status = catalogEntry?.status || epic.status;
      feature.priority = catalogEntry?.priority || epic.priority || 'medium';
      feature.parent = epic.feature_id;

      // Component from catalog or inherit from epic
      if (catalogEntry?.component) {
        feature.component = catalogEntry.component;
      } else if (!feature.component && epic.component) {
        feature.component = epic.component;
      }

      // Dependencies from catalog (if not already present in inline data)
      if (!feature.dependencies && catalogEntry?.dependencies && catalogEntry.dependencies.length > 0) {
        feature.dependencies = catalogEntry.dependencies;
      }

      // If no summary exists at all, build one from catalog note or title
      if (!feature.summary) {
        if (catalogEntry?.note) {
          feature.summary = { goal: catalogEntry.note };
        } else {
          feature.summary = { goal: sf.title || catalogEntry?.title || sfId };
        }
      }

      // Count steps for reporting
      const planImpl = feature.plan_implementation as { steps?: unknown[] } | undefined;
      const stepCount = planImpl?.steps?.length || 0;
      totalSteps += stepCount;

      // Write feature file
      const outPath = path.join(FEATURES_DIR, `${sfId}.json`);
      const content = JSON.stringify(feature, null, 2) + '\n';

      if (dryRun) {
        console.log(`  [dry-run] Would create: ${sfId}.json (${stepCount} steps)`);
      } else {
        fs.writeFileSync(outPath, content);
        console.log(`  Created: ${sfId}.json (${stepCount} steps)`);
        existingFiles.add(sfId);
      }
      generated++;
    }
  }

  console.log('');
  console.log(`Generated: ${generated} feature files (${totalSteps} total steps)`);
  console.log(`Skipped (already exist): ${skipped}`);
  if (dryRun) {
    console.log('\nRe-run without --dry-run to create files.');
  }
}

run();

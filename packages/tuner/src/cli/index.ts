#!/usr/bin/env node
/**
 * Tuner CLI
 *
 * Command-line interface for operators to inspect and manage Tuner state.
 */

import { Command } from 'commander';
import { createTunerServices } from '../services/factory.js';

const program = new Command();

// Default DB path
const DB_PATH = process.env.TUNER_DB_PATH || '.data/tuner.db';

program
  .name('tuner')
  .description('Tuner CLI - Adaptive learning loop management')
  .version('0.1.0');

// ============================================================================
// tuner status
// ============================================================================

program
  .command('status')
  .description('Show current baselines and active drift alerts')
  .action(() => {
    const services = createTunerServices(DB_PATH);

    try {
      // Baselines summary
      const baselines = services.baseline.listBaselines();
      console.log('\n📊 Task Baselines');
      console.log('─'.repeat(80));

      if (baselines.length === 0) {
        console.log('  No baselines yet (need outcome data)');
      } else {
        console.log('  Pattern                        │ Samples │ Duration (s) │ Tokens   │ Success');
        console.log('  ─'.repeat(40));
        for (const b of baselines.slice(0, 10)) {
          const pattern = b.pattern.padEnd(30).slice(0, 30);
          const samples = String(b.sample_count).padStart(7);
          const duration = `${b.mean_duration_seconds.toFixed(1)}±${b.stddev_duration_seconds.toFixed(1)}`.padStart(12);
          const tokens = `${Math.round(b.mean_tokens)}`.padStart(8);
          const success = `${(b.success_rate * 100).toFixed(0)}%`.padStart(7);
          console.log(`  ${pattern} │ ${samples} │ ${duration} │ ${tokens} │ ${success}`);
        }
        if (baselines.length > 10) {
          console.log(`  ... and ${baselines.length - 10} more`);
        }
      }

      // Active drift alerts
      const alerts = services.drift.getActiveAlerts();
      console.log('\n⚠️  Active Drift Alerts');
      console.log('─'.repeat(80));

      if (alerts.length === 0) {
        console.log('  No active alerts');
      } else {
        for (const alert of alerts) {
          const severity = alert.severity === 'critical' ? '🔴 CRITICAL' : '🟡 WARNING';
          const deviation = `${alert.deviation_sigmas.toFixed(1)}σ`;
          console.log(`  ${severity} [${alert.type}] ${alert.pattern}`);
          console.log(`    Current: ${alert.current_value.toFixed(2)}, Baseline: ${alert.baseline_value.toFixed(2)} (${deviation})`);
        }
      }

      // Model performance summary
      const modelBaselines = services.selector.getModelBaselines();
      console.log('\n🤖 Model Performance');
      console.log('─'.repeat(80));

      if (modelBaselines.length === 0) {
        console.log('  No model data yet');
      } else {
        const byModel = new Map<string, { total: number; successes: number }>();
        for (const b of modelBaselines) {
          const current = byModel.get(b.model) || { total: 0, successes: 0 };
          current.total += b.total_attempts;
          current.successes += Math.round(b.success_rate * b.total_attempts);
          byModel.set(b.model, current);
        }

        for (const [model, stats] of byModel) {
          const rate = stats.total > 0 ? ((stats.successes / stats.total) * 100).toFixed(0) : '0';
          console.log(`  ${model.padEnd(20)} ${stats.total} attempts, ${rate}% success`);
        }
      }

      console.log();
    } finally {
      services.storage.close();
    }
  });

// ============================================================================
// tuner config show
// ============================================================================

program
  .command('config')
  .description('Show current configuration')
  .option('-f, --format <format>', 'Output format (json|yaml)', 'yaml')
  .action((options) => {
    const services = createTunerServices(DB_PATH);

    try {
      const config = services.config.getCurrentForgeConfig();

      if (options.format === 'json') {
        console.log(JSON.stringify(config, null, 2));
      } else {
        // Simple YAML-like output
        console.log('\n# ForgeExecutionConfig');
        console.log(`version: ${config.version}`);
        console.log(`updated_at: ${config.updated_at}`);
        console.log('\nmodel_selection:');
        console.log(`  default_model: ${config.model_selection.default_model}`);
        console.log(`  exploration_rate: ${config.model_selection.exploration_rate}`);
        console.log(`  rules:`);
        for (const rule of config.model_selection.rules) {
          console.log(`    - condition: ${JSON.stringify(rule.condition)}`);
          console.log(`      model: ${rule.model}`);
        }
        console.log('\nbudgets:');
        console.log(`  per_task_time_seconds: ${config.budgets.per_task_time_seconds}`);
        console.log(`  per_task_token_limit: ${config.budgets.per_task_token_limit}`);
        console.log(`  per_run_cost_limit_usd: ${config.budgets.per_run_cost_limit_usd}`);
        console.log('\nretry:');
        console.log(`  max_retries_per_task: ${config.retry.max_retries_per_task}`);
        console.log(`  backoff: ${config.retry.backoff}`);
        console.log();
      }
    } finally {
      services.storage.close();
    }
  });

// ============================================================================
// tuner history
// ============================================================================

program
  .command('history')
  .description('Show config version history')
  .option('-n, --limit <n>', 'Number of versions to show', '10')
  .action((options) => {
    const services = createTunerServices(DB_PATH);

    try {
      const limit = parseInt(options.limit, 10) || 10;
      const versions = services.config.listConfigVersions(limit);

      console.log('\n📜 Config Version History');
      console.log('─'.repeat(60));

      if (versions.length === 0) {
        console.log('  No config versions yet');
      } else {
        for (const v of versions) {
          const notes = v.notes ? ` - ${v.notes}` : '';
          console.log(`  v${v.version} (${v.generated_at})${notes}`);
        }
      }
      console.log();
    } finally {
      services.storage.close();
    }
  });

// ============================================================================
// tuner drift list
// ============================================================================

program
  .command('drift')
  .description('List drift alerts')
  .option('-s, --severity <level>', 'Filter by severity (warning|critical)')
  .option('-a, --all', 'Include acknowledged alerts')
  .action((options) => {
    const services = createTunerServices(DB_PATH);

    try {
      const filter: { severity?: 'warning' | 'critical'; acknowledged?: boolean } = {};

      if (options.severity === 'warning' || options.severity === 'critical') {
        filter.severity = options.severity;
      }

      if (!options.all) {
        filter.acknowledged = false;
      }

      const alerts = services.drift.getAlerts(filter);

      console.log('\n⚠️  Drift Alerts');
      console.log('─'.repeat(80));

      if (alerts.length === 0) {
        console.log('  No alerts match criteria');
      } else {
        for (const alert of alerts) {
          const severity = alert.severity === 'critical' ? '🔴' : '🟡';
          const ack = alert.acknowledged ? ' [ACK]' : '';
          console.log(`  ${severity} ${alert.id}${ack}`);
          console.log(`     Type: ${alert.type}, Pattern: ${alert.pattern}`);
          console.log(`     Deviation: ${alert.deviation_sigmas.toFixed(1)}σ (current: ${alert.current_value.toFixed(2)}, baseline: ${alert.baseline_value.toFixed(2)})`);
        }
      }
      console.log();
    } finally {
      services.storage.close();
    }
  });

// ============================================================================
// tuner drift ack <id>
// ============================================================================

program
  .command('ack <id>')
  .description('Acknowledge a drift alert')
  .action((id) => {
    const services = createTunerServices(DB_PATH);

    try {
      const success = services.drift.acknowledgeAlert(id, 'cli-user');

      if (success) {
        console.log(`✅ Alert ${id} acknowledged`);
      } else {
        console.log(`❌ Alert ${id} not found or already acknowledged`);
        process.exit(1);
      }
    } finally {
      services.storage.close();
    }
  });

// Parse and execute
program.parse();

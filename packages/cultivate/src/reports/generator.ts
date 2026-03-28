/**
 * Synthesis Report Generator
 *
 * Aggregates multi-cluster data into structured markdown reports.
 * Supports AI-powered executive summary with template fallback.
 */

import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { CultivateStorage } from '../storage/interface.js';
import type { SynthesisReport } from '../domain/report-types.js';
import type { Cluster, Signal, Sentiment } from '../domain/types.js';
import { computeDemandScore, type DemandScore } from '../scoring/demand.js';

export interface GenerateReportOptions {
  greenhouse_id: string;
  title?: string;
  report_type?: 'weekly' | 'monthly' | 'custom';
  /** If provided, only include these clusters in the report */
  cluster_ids?: string[];
}

/** Aggregated data for a single cluster used during report generation */
interface ClusterReportData {
  cluster: Cluster;
  signals: Signal[];
  demand: DemandScore;
  sentimentCounts: Record<Sentiment, number>;
  questions: string[];
  quotes: string[];
}

const SENTIMENT_KEYS: Sentiment[] = [
  'frustrated',
  'disappointed',
  'neutral',
  'hopeful',
  'enthusiastic',
];

/**
 * Generate a synthesis report for a greenhouse.
 *
 * 1. Loads greenhouse and clusters
 * 2. For each cluster: loads signals, computes demand, aggregates extraction data
 * 3. Builds structured markdown (template)
 * 4. Optionally prepends AI executive summary if API key provided
 * 5. Stores and returns the report
 */
export async function generateReport(
  storage: CultivateStorage,
  options: GenerateReportOptions,
  anthropicApiKey?: string,
): Promise<SynthesisReport> {
  const { greenhouse_id, report_type = 'custom' } = options;

  // 1. Load greenhouse
  const greenhouse = await storage.getGreenhouseById(greenhouse_id);
  const greenhouseName = greenhouse?.name ?? 'Unknown Greenhouse';

  // 2. Load clusters (optionally filtered)
  let clusters = await storage.listClustersByGreenhouse(greenhouse_id);
  if (options.cluster_ids !== undefined) {
    const idSet = new Set(options.cluster_ids);
    clusters = clusters.filter((c) => idSet.has(c.id));
  }

  // 3. For each cluster, load signals and aggregate extraction data
  const clusterData = await Promise.all(
    clusters.map(async (cluster): Promise<ClusterReportData> => {
      const signals = await storage.listSignals({
        cluster_id: cluster.id,
        limit: 100,
        offset: 0,
      });
      const demand = computeDemandScore(signals, cluster);

      const sentimentCounts: Record<Sentiment, number> = {
        frustrated: 0,
        disappointed: 0,
        neutral: 0,
        hopeful: 0,
        enthusiastic: 0,
      };
      const questions: string[] = [];
      const quotes: string[] = [];

      for (const sig of signals) {
        const ext = await storage.getExtractionBySignalId(sig.id);
        if (ext) {
          const sentiment = ext.sentiment ?? 'neutral';
          if (sentiment in sentimentCounts) {
            sentimentCounts[sentiment]++;
          }
          if (ext.questions) {
            for (const q of ext.questions) {
              questions.push(q.text);
            }
          }
          if (ext.quotes) {
            quotes.push(...ext.quotes.slice(0, 2));
          }
        }
      }

      return {
        cluster,
        signals,
        demand,
        sentimentCounts,
        questions: [...new Set(questions)].slice(0, 5),
        quotes: quotes.slice(0, 3),
      };
    }),
  );

  // Sort by demand score descending
  clusterData.sort((a, b) => b.demand.score - a.demand.score);

  // 4. Build markdown content
  const title = options.title ?? `${greenhouseName} — Synthesis Report`;
  let markdown = buildTemplateReport(title, greenhouseName, clusterData);

  // 5. Optionally prepend AI executive summary
  if (anthropicApiKey && clusterData.length > 0) {
    try {
      const summary = await generateAISummary(
        clusterData,
        greenhouseName,
        anthropicApiKey,
      );
      if (summary) {
        markdown = `## Executive Summary\n\n${summary}\n\n---\n\n${markdown}`;
      }
    } catch {
      // AI summary failed — template report is still valid
    }
  }

  // 6. Store report
  const report = await storage.createReport({
    id: randomUUID(),
    greenhouse_id,
    title,
    report_type,
    cluster_ids: clusterData.map((c) => c.cluster.id),
    markdown_content: markdown,
    metadata: {
      cluster_count: clusterData.length,
      total_signals: clusterData.reduce(
        (sum, c) => sum + c.signals.length,
        0,
      ),
    },
    generated_at: new Date().toISOString(),
  });

  return report;
}

// ---------------------------------------------------------------------------
// Template report builder
// ---------------------------------------------------------------------------

/**
 * Build a structured markdown report from cluster data without AI.
 */
function buildTemplateReport(
  title: string,
  greenhouseName: string,
  clusterData: ClusterReportData[],
): string {
  const totalSignals = clusterData.reduce(
    (sum, c) => sum + c.signals.length,
    0,
  );

  const sections: string[] = [];

  // Title
  sections.push(`# ${title}\n`);
  sections.push(`*Greenhouse: ${greenhouseName}*\n`);

  // Signal Overview
  sections.push(`## Signal Overview\n`);
  sections.push(`- **Total signals**: ${totalSignals}`);
  sections.push(`- **Clusters analyzed**: ${clusterData.length}`);
  sections.push(
    `- **Report generated**: ${new Date().toISOString().split('T')[0]}\n`,
  );

  // Top Themes (top 5 by demand score)
  if (clusterData.length > 0) {
    sections.push(`## Top Themes\n`);
    const topClusters = clusterData.slice(0, 5);
    for (const { cluster, signals, demand } of topClusters) {
      sections.push(`### ${cluster.label}\n`);
      sections.push(`${cluster.summary}\n`);
      sections.push(
        `- **Demand**: ${demand.label} (score: ${demand.score})`
      );
      sections.push(`- **Signals**: ${signals.length}`);
      sections.push(`- **Trend**: ${cluster.trend}`);
      sections.push(
        `- **Velocity**: ${cluster.velocity_weekly}/week, ${cluster.velocity_monthly}/month\n`,
      );
    }
  }

  // Key Questions (aggregated across all clusters)
  const allQuestions = clusterData.flatMap((c) => c.questions);
  const uniqueQuestions = [...new Set(allQuestions)].slice(0, 10);
  if (uniqueQuestions.length > 0) {
    sections.push(`## Key Questions\n`);
    for (const q of uniqueQuestions) {
      sections.push(`- ${q}`);
    }
    sections.push('');
  }

  // Sentiment Overview (aggregate across all clusters)
  const aggregateSentiment: Record<Sentiment, number> = {
    frustrated: 0,
    disappointed: 0,
    neutral: 0,
    hopeful: 0,
    enthusiastic: 0,
  };
  for (const cd of clusterData) {
    for (const key of SENTIMENT_KEYS) {
      aggregateSentiment[key] += cd.sentimentCounts[key];
    }
  }
  const totalSentiment = SENTIMENT_KEYS.reduce(
    (sum, k) => sum + aggregateSentiment[k],
    0,
  );
  if (totalSentiment > 0) {
    sections.push(`## Sentiment Overview\n`);
    sections.push('| Sentiment | Count | Share |');
    sections.push('|-----------|-------|-------|');
    for (const key of SENTIMENT_KEYS) {
      const count = aggregateSentiment[key];
      if (count > 0) {
        const pct = ((count / totalSentiment) * 100).toFixed(0);
        sections.push(`| ${key} | ${count} | ${pct}% |`);
      }
    }
    sections.push('');
  }

  // Notable Quotes
  const allQuotes = clusterData.flatMap((c) => c.quotes);
  if (allQuotes.length > 0) {
    sections.push(`## Notable Quotes\n`);
    for (const quote of allQuotes.slice(0, 5)) {
      sections.push(`> "${quote}"\n`);
    }
  }

  // Recommendations (high-demand clusters that need attention)
  const highDemand = clusterData.filter((c) => c.demand.label === 'high');
  const mediumDemand = clusterData.filter((c) => c.demand.label === 'medium');
  if (highDemand.length > 0 || mediumDemand.length > 0) {
    sections.push(`## Recommendations\n`);
    if (highDemand.length > 0) {
      sections.push(`### High Priority\n`);
      for (const { cluster, demand } of highDemand) {
        sections.push(
          `- **${cluster.label}** — demand score ${demand.score}, trend ${cluster.trend}`,
        );
      }
      sections.push('');
    }
    if (mediumDemand.length > 0) {
      sections.push(`### Worth Investigating\n`);
      for (const { cluster, demand } of mediumDemand) {
        sections.push(
          `- **${cluster.label}** — demand score ${demand.score}, trend ${cluster.trend}`,
        );
      }
      sections.push('');
    }
  }

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// AI executive summary
// ---------------------------------------------------------------------------

/**
 * Generate a concise AI executive summary from cluster data.
 * Returns null if generation fails or produces no content.
 */
async function generateAISummary(
  clusterData: ClusterReportData[],
  greenhouseName: string,
  apiKey: string,
): Promise<string | null> {
  const client = new Anthropic({ apiKey });

  // Build concise context for the LLM
  const clusterSummaries = clusterData.slice(0, 10).map((cd) => ({
    label: cd.cluster.label,
    demand_score: cd.demand.score,
    demand_level: cd.demand.label,
    signal_count: cd.signals.length,
    trend: cd.cluster.trend,
    top_questions: cd.questions.slice(0, 2),
    dominant_sentiment: getDominantSentiment(cd.sentimentCounts),
  }));

  const prompt = `You are a product analyst. Given the following cluster data for "${greenhouseName}", write a 3-5 sentence executive summary highlighting:
- The most significant themes and their demand levels
- Key sentiment patterns
- Actionable insights

Cluster data:
${JSON.stringify(clusterSummaries, null, 2)}

Write ONLY the summary text. No headings, no bullet points, no markdown formatting.`;

  const response = await client.messages.create({
    model: process.env.CULTIVATE_REPORT_MODEL ?? 'claude-sonnet-4-latest',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : null;

  return text?.trim() || null;
}

/**
 * Determine the dominant sentiment from counts.
 */
function getDominantSentiment(
  counts: Record<Sentiment, number>,
): Sentiment {
  let max = 0;
  let dominant: Sentiment = 'neutral';
  for (const key of SENTIMENT_KEYS) {
    if (counts[key] > max) {
      max = counts[key];
      dominant = key;
    }
  }
  return dominant;
}

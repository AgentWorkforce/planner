/**
 * PRD Generation handlers
 * Generates structured PRD markdown from cluster signals and extractions.
 */

import type { RequestHandler } from 'express';
import { notFound } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import type { Cluster, Signal, ExtractionResult } from '../../domain/types.js';
import { GeneratePrdSchema } from '../schemas.js';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Create PRD generation handlers with storage and API key dependency injection
 */
export function createPrdHandlers(
  storage: CultivateStorage,
  anthropicApiKey?: string
) {
  /**
   * POST /prd/generate
   * Generate a PRD markdown document from a cluster's signals and extractions
   */
  const generate: RequestHandler = async (req, res, next) => {
    try {
      const body = GeneratePrdSchema.parse(req.body);

      // Load the cluster and verify it exists
      const cluster = await storage.getClusterByIdAndGreenhouse(
        body.cluster_id,
        body.greenhouse_id
      );

      if (!cluster) {
        throw notFound('Cluster');
      }

      // Load top 10 signals for the cluster
      const signals = await storage.listSignals({
        cluster_id: body.cluster_id,
        limit: 10,
        offset: 0,
      });

      // Load extractions for each signal
      const extractions = new Map<string, ExtractionResult>();
      for (const signal of signals) {
        const extraction = await storage.getExtractionBySignalId(signal.id);
        if (extraction) {
          extractions.set(signal.id, extraction);
        }
      }

      let markdown: string;

      if (anthropicApiKey) {
        markdown = await generateWithAI(
          anthropicApiKey,
          cluster,
          signals,
          extractions
        );
      } else {
        markdown = generateTemplate(cluster, signals, extractions);
      }

      res.json({
        data: {
          markdown,
          cluster_id: body.cluster_id,
          signal_count: signals.length,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  return {
    generate,
  };
}

/**
 * Generate PRD using Claude AI
 */
async function generateWithAI(
  apiKey: string,
  cluster: Cluster,
  signals: Signal[],
  extractions: Map<string, ExtractionResult>
): Promise<string> {
  const client = new Anthropic({ apiKey });

  // Build context from signals and extractions
  let signalContext = '';
  for (const signal of signals) {
    const extraction = extractions.get(signal.id);
    signalContext += `Signal: "${signal.title}" (score: ${signal.score.toFixed(2)}, source: ${signal.source_type})\n`;
    if (extraction) {
      signalContext += `  Summary: ${extraction.summary}\n`;
      if (extraction.quotes.length > 0) {
        signalContext += `  Quotes:\n`;
        for (const quote of extraction.quotes) {
          signalContext += `    - "${quote}"\n`;
        }
      }
      signalContext += `  Keywords: ${extraction.keywords.join(', ')}\n`;
      signalContext += `  Aspects: ${extraction.aspects.join(', ')}\n`;
    }
    signalContext += '\n';
  }

  const prompt = `You are a product manager generating a PRD (Product Requirements Document) from user signal data.

Cluster: "${cluster.label}"
Cluster Summary: ${cluster.summary}
Signal Count: ${cluster.signal_count}
Trend: ${cluster.trend}

Signals and Extractions:
${signalContext}

Generate a structured PRD in markdown with these exact sections:

## Problem Statement
(Describe the core problem based on the cluster theme and signals)

## User Impact
(Describe how users are affected, include real quotes from the extractions above)

## Proposed Solution
(Suggest a solution approach based on the signals)

## Success Criteria
(Define measurable success criteria)

## Evidence Summary
(Summarize the evidence: number of signals, trend direction, key themes)

Output ONLY the markdown content, starting with the first ## heading. Do not wrap in code blocks.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '';

  // Prepend a title heading
  return `# PRD: ${cluster.label}\n\n${text}`;
}

/**
 * Generate a template PRD with placeholders filled from cluster data (no AI)
 */
function generateTemplate(
  cluster: Cluster,
  signals: Signal[],
  extractions: Map<string, ExtractionResult>
): string {
  // Collect all quotes from extractions
  const allQuotes: string[] = [];
  const allKeywords = new Set<string>();

  for (const signal of signals) {
    const extraction = extractions.get(signal.id);
    if (extraction) {
      for (const quote of extraction.quotes) {
        allQuotes.push(quote);
      }
      for (const keyword of extraction.keywords) {
        allKeywords.add(keyword);
      }
    }
  }

  const quotesSection =
    allQuotes.length > 0
      ? allQuotes.map((q) => `> "${q}"`).join('\n\n')
      : '> _No user quotes available_';

  const keywordsList =
    allKeywords.size > 0
      ? Array.from(allKeywords).join(', ')
      : '_No keywords extracted_';

  return `# PRD: ${cluster.label}

## Problem Statement

${cluster.summary}

This cluster contains ${cluster.signal_count} signals with a **${cluster.trend}** trend.

## User Impact

${quotesSection}

## Proposed Solution

_[To be defined based on the evidence above]_

## Success Criteria

- [ ] Address the core issue identified in ${signals.length} signals
- [ ] Reduce related signal volume by measurable amount
- [ ] Positive user feedback on resolution

## Evidence Summary

- **Signals analyzed**: ${signals.length}
- **Total in cluster**: ${cluster.signal_count}
- **Trend**: ${cluster.trend}
- **Velocity**: ${cluster.velocity_weekly} signals/week, ${cluster.velocity_monthly} signals/month
- **Key themes**: ${keywordsList}
`;
}

import { spawn, type ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';
import type {
  NuggetSynthesizer,
  PreExtract,
  MullConfig,
  SynthesisResult,
  Nugget,
  NuggetCategory,
  PipelineError,
  TopicSummaryMap,
} from '../domain/types.js';
import { extractTrailDecisions } from '../pipeline/extract-trail-decisions.js';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 30_000;
const VALID_CATEGORIES = new Set<NuggetCategory>(['Decisions', 'Constraints', 'Patterns', 'Gotchas', 'Context']);

export interface LlmSynthesizerOptions {
  model?: string;
  cli?: string;        // path to claude CLI, defaults to 'claude'
  timeoutMs?: number;
}

export class LlmSynthesizer implements NuggetSynthesizer {
  private model: string;
  private cli: string;
  private timeoutMs: number;

  constructor(opts: LlmSynthesizerOptions = {}) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.cli = opts.cli ?? 'claude';
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async synthesize(preExtract: PreExtract, _config: MullConfig): Promise<SynthesisResult> {
    const errors: PipelineError[] = [];

    // 1. Extract trail decisions first (deterministic, no LLM cost)
    const trailNuggets = extractTrailDecisions(preExtract);

    // 2. If no filtered transcript content, skip LLM entirely
    if (preExtract.filteredTranscript.length === 0) {
      return { nuggets: trailNuggets, errors: [] };
    }

    // 3. Build synthesis prompt
    const prompt = buildSynthesisPrompt(preExtract, trailNuggets);

    // 4. Call claude -p via subprocess
    let llmNuggets: Nugget[] = [];
    let topicSummaries: TopicSummaryMap | undefined;
    try {
      const result = await this.runCli(prompt);
      const parsed = parseSynthesisResponse(result, preExtract);
      llmNuggets = filterHollowNuggets(parsed.nuggets);
      topicSummaries = parsed.topicSummaries;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        stage: 'synthesize',
        message: `LLM synthesis failed: ${message}`,
        recoverable: true,
      });
      // Fall back to trail decisions only
    }

    return { nuggets: [...trailNuggets, ...llmNuggets], errors, topicSummaries };
  }

  private async runCli(prompt: string): Promise<string> {
    const args = ['-p', '--model', this.model, '--output-format', 'json'];

    // Clean environment (same pattern as forge-core AnalysisTool)
    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE') || key.startsWith('CLAUDE_AGENT')) continue;
      if (key.startsWith('npm_')) continue;
      cleanEnv[key] = value;
    }

    return new Promise<string>((resolve, reject) => {
      const proc: ChildProcess = spawn(this.cli, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: cleanEnv,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        fn();
      };

      proc.on('error', (err: Error) => {
        settle(() => reject(err));
      });

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code: number | null) => {
        settle(() => {
          if (code !== 0) {
            reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 500)}`));
            return;
          }
          resolve(stdout.trim());
        });
      });

      timeoutHandle = setTimeout(() => {
        settle(() => {
          proc.kill('SIGKILL');
          reject(new Error(`LLM synthesis timed out after ${this.timeoutMs}ms`));
        });
      }, this.timeoutMs);

      proc.stdin?.write(prompt);
      proc.stdin?.end();
    });
  }
}

// Post-synthesis safety net: reject nuggets the LLM should not have produced.
const COMPLETION_PATTERNS = /\b(all \d+ tests? pass|fully implemented|verified (and )?(all )?working|all (acceptance )?criteria met|implementation complete|schema (is )?complete|verified correct|confirmed working)\b/i;
const HOLLOW_WHY_PATTERNS = /^(transcript (confirms?|shows?|verifies?|indicates?)|session (confirms?|shows?)|observed in|as (seen|noted) in)/i;

function filterHollowNuggets(nuggets: Nugget[]): Nugget[] {
  return nuggets.filter(n => {
    if (COMPLETION_PATTERNS.test(n.content)) return false;
    if (n.why && HOLLOW_WHY_PATTERNS.test(n.why)) return false;
    return true;
  });
}

function buildSynthesisPrompt(preExtract: PreExtract, trailNuggets: Nugget[]): string {
  const lines: string[] = [];

  lines.push(`Given these pre-extracted facts from session ${preExtract.sessionRef.id}:`);
  lines.push('');

  // Entities
  const topEntities = preExtract.entities.slice(0, 30);
  if (topEntities.length > 0) {
    lines.push(`ENTITIES: ${topEntities.map(e => `${e.type}: ${e.text} (×${e.count})`).join(', ')}`);
  }

  // Tool calls from facts
  const toolCalls = preExtract.facts.filter(f => f.type === 'tool_call');
  if (toolCalls.length > 0) {
    lines.push(`TOOL CALLS: ${toolCalls.slice(0, 10).map(f => f.description).join(', ')}`);
  }

  // Files modified from facts
  const filesModified = preExtract.facts.filter(f => f.type === 'file_modified');
  if (filesModified.length > 0) {
    lines.push(`FILES MODIFIED: ${filesModified.slice(0, 10).map(f => f.description).join(', ')}`);
  }

  // Key events
  const keyEvents = preExtract.facts.filter(f => f.type === 'decision' || f.type === 'error');
  if (keyEvents.length > 0) {
    lines.push(`KEY EVENTS: ${keyEvents.slice(0, 10).map(f => `${f.description}${f.timestamp ? ` at ${f.timestamp}` : ''}`).join(', ')}`);
  }

  // Existing topics
  if (preExtract.existingTopics.length > 0) {
    lines.push(`EXISTING TOPICS: ${preExtract.existingTopics.join(', ')}`);
  }

  // Trail decisions already extracted (dedup signal)
  if (trailNuggets.length > 0) {
    lines.push('');
    lines.push('DECISIONS ALREADY EXTRACTED (DO NOT DUPLICATE):');
    for (const n of trailNuggets) {
      lines.push(`- ${n.slug}: ${n.content}`);
    }
  }

  // Retrospective summary
  if (preExtract.retrospective) {
    lines.push('');
    lines.push(`RETROSPECTIVE SUMMARY: ${preExtract.retrospective.summary}`);
    if (preExtract.retrospective.challenges?.length) {
      lines.push(`CHALLENGES: ${preExtract.retrospective.challenges.join('; ')}`);
    }
  }

  // Filtered transcript excerpts
  if (preExtract.filteredTranscript.length > 0) {
    lines.push('');
    lines.push('TRANSCRIPT EXCERPTS (key exchanges only):');
    // Cap transcript to ~2000 chars to keep prompt bounded
    let charBudget = 2000;
    for (const excerpt of preExtract.filteredTranscript) {
      const text = excerpt.content.slice(0, 300);
      if (charBudget <= 0) break;
      lines.push(`[${excerpt.reason}] ${text}`);
      charBudget -= text.length + 20;
    }
  }

  lines.push('');
  lines.push(`The test: would a NEW agent working on this codebase find this useful? Code shows WHAT exists. You extract WHY it exists that way.

Categories:
DECISIONS — A choice between alternatives. What was chosen, what was rejected, and the reasoning. Only extract if alternatives were actually considered.
CONSTRAINTS — Limitations discovered through failure or experience. Things that SHOULD work but DON'T, or boundaries that aren't obvious from code.
PATTERNS — Conventions this team follows that aren't enforced by linters or type systems. Implicit rules a newcomer would violate.
GOTCHAS — Non-obvious traps. If someone would waste hours on this without prior warning, it belongs here.
CONTEXT — Why something is shaped the way it is. Background that code alone cannot convey.

Rules:
- Return [] if nothing is worth extracting. Most sessions have 0-3 real nuggets.
- "why" must contain REASONING, not attribution. Bad: "Transcript confirms X." Good: "Unbounded retries exhaust resources and mask connectivity issues."
- Topic slugs name the DOMAIN AREA (e.g., "relay-infrastructure", "orchestration", "storage-layer"), not the task being performed.
- Maximum 3 tags per nugget.
- If one nugget caused another, link via "caused": ["slug-of-related"].
- Do NOT duplicate decisions already extracted above.

NEVER extract:
- Task completion ("implemented X", "Y tests passed", "all criteria met", "verified working")
- What code does (read the code for that)
- Process narration ("first we did X, then Y")

Output ONLY a valid JSON object (no markdown, no explanation):
{
  "nuggets": [{
    "slug": "example-slug",
    "category": "Decisions",
    "content": "Chose X over Y for Z reason.",
    "topic": "domain-area-slug",
    "confidence": 0.9,
    "why": "The actual reasoning — not 'transcript shows'.",
    "caused": ["related-slug"],
    "when": "2026-02-08",
    "tags": ["tag1", "tag2"]
  }],
  "topic_summaries": {
    "domain-area-slug": {
      "abstract": "One sentence — what this topic area is about.",
      "overview": "One paragraph (~3-5 sentences). Summarize the key decisions, constraints, and patterns in this topic area. Written for an agent that needs working context, not full detail."
    }
  }
}

The "topic_summaries" field is REQUIRED. For each unique topic slug in your nuggets, provide an abstract (1 sentence, max 150 chars) and overview (1 paragraph, max 500 chars). If updating existing topics, write summaries that incorporate both old and new knowledge.`);

  return lines.join('\n');
}

interface ParsedSynthesis {
  nuggets: Nugget[];
  topicSummaries?: TopicSummaryMap;
}

function parseSynthesisResponse(output: string, preExtract: PreExtract): ParsedSynthesis {
  // Multi-layer parsing: envelope → wrapper object → bare array (backward compat)
  let rawObj: Record<string, unknown> | null = null;

  // Layer 1: Try claude --output-format json envelope
  const unwrapped = unwrapEnvelope(output);

  // Layer 2: Try parsing as wrapper object { nuggets: [...], topic_summaries: {...} }
  rawObj = tryParseWrapperObject(unwrapped);

  if (rawObj) {
    const nuggets = convertRawNuggets(
      Array.isArray(rawObj.nuggets) ? rawObj.nuggets : [],
      preExtract,
    );
    const topicSummaries = parseTopicSummaries(rawObj.topic_summaries);
    return { nuggets, topicSummaries };
  }

  // Layer 3: Backward compat — bare array of nuggets (no topic summaries)
  const rawArray = tryParseJsonArray(unwrapped);
  if (rawArray && rawArray.length > 0) {
    return { nuggets: convertRawNuggets(rawArray, preExtract) };
  }

  return { nuggets: [] };
}

/** Unwrap claude CLI --output-format json envelope if present. */
function unwrapEnvelope(output: string): string {
  try {
    const envelope = JSON.parse(output);
    if (envelope && typeof envelope === 'object' && 'result' in envelope) {
      return typeof envelope.result === 'string' ? envelope.result : JSON.stringify(envelope.result);
    }
  } catch {
    // Not an envelope
  }
  return output;
}

/** Try parsing as wrapper object with nuggets + topic_summaries fields. */
function tryParseWrapperObject(str: string): Record<string, unknown> | null {
  // Direct parse
  const parsed = tryParseJson(str);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'nuggets' in parsed) {
    return parsed as Record<string, unknown>;
  }

  // Extract from code blocks
  const codeBlockMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    const inner = tryParseJson(codeBlockMatch[1].trim());
    if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'nuggets' in inner) {
      return inner as Record<string, unknown>;
    }
  }

  // Find first { ... } at top level
  const braceStart = str.indexOf('{');
  const braceEnd = str.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    const inner = tryParseJson(str.slice(braceStart, braceEnd + 1));
    if (inner && typeof inner === 'object' && !Array.isArray(inner) && 'nuggets' in inner) {
      return inner as Record<string, unknown>;
    }
  }

  return null;
}

function tryParseJson(str: string): unknown | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/** Extract validated TopicSummaryMap from raw topic_summaries field. */
function parseTopicSummaries(raw: unknown): TopicSummaryMap | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const result: TopicSummaryMap = {};
  let hasEntries = false;

  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const v = value as Record<string, unknown>;
      if (typeof v.abstract === 'string' && typeof v.overview === 'string') {
        result[slug] = {
          abstract: v.abstract.slice(0, 200),
          overview: v.overview.slice(0, 600),
        };
        hasEntries = true;
      }
    }
  }

  return hasEntries ? result : undefined;
}

/** Convert raw JSON items to typed Nugget array. */
function convertRawNuggets(items: unknown[], preExtract: PreExtract): Nugget[] {
  return items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(item => ({
      id: crypto.randomUUID(),
      slug: typeof item.slug === 'string' ? item.slug : undefined,
      category: normalizeCategory(item.category),
      content: typeof item.content === 'string' ? item.content : String(item.content ?? ''),
      topic: typeof item.topic === 'string' ? item.topic : 'general',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
      why: typeof item.why === 'string' ? item.why : undefined,
      caused: Array.isArray(item.caused) ? item.caused.map(String) : undefined,
      when: typeof item.when === 'string' ? item.when : undefined,
      tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined,
      source: { sessionRef: preExtract.sessionRef, messageIds: [] },
    }))
    .filter(n => n.content.length > 0);
}

function tryParseJsonArray(str: string): unknown[] | null {
  // Direct parse
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through */ }

  // Extract from markdown code blocks
  const codeBlockMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }

  // Find first [ ... ]
  const bracketStart = str.indexOf('[');
  const bracketEnd = str.lastIndexOf(']');
  if (bracketStart !== -1 && bracketEnd > bracketStart) {
    try {
      const parsed = JSON.parse(str.slice(bracketStart, bracketEnd + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }

  return null;
}

function normalizeCategory(raw: unknown): NuggetCategory | undefined {
  if (typeof raw !== 'string') return undefined;
  // Title-case the first letter of each word
  const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  // Map common variations
  const categoryMap: Record<string, NuggetCategory> = {
    'Decisions': 'Decisions',
    'Decision': 'Decisions',
    'Constraints': 'Constraints',
    'Constraint': 'Constraints',
    'Patterns': 'Patterns',
    'Pattern': 'Patterns',
    'Gotchas': 'Gotchas',
    'Gotcha': 'Gotchas',
    'Context': 'Context',
  };
  return categoryMap[normalized] ?? (VALID_CATEGORIES.has(raw as NuggetCategory) ? raw as NuggetCategory : 'Context');
}

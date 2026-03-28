/**
 * Document push adapter with content chunking
 *
 * Accepts document uploads and splits them into chunks based on
 * configurable strategy (headings, paragraphs, sentences, speaker).
 */

import type { SourceAdapter, AdapterEvent, ReceiveRequest, SourceHealth } from './adapter.js';
import type { SourceConfig } from '../domain/types.js';

/**
 * Chunking strategy type
 */
type ChunkingStrategy = 'headings' | 'paragraphs' | 'sentences' | 'speaker';

/**
 * Extract a field value from an object using dot-notation path
 */
function extractField(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Push adapter - receives documents and chunks them
 */
export class PushAdapter implements SourceAdapter {
  private config: SourceConfig | null = null;
  private consecutiveFailures = 0;
  private lastError: string | undefined;

  /**
   * Initialize the adapter with configuration
   */
  async initialize(config: SourceConfig): Promise<void> {
    this.config = config;
  }

  /**
   * Not implemented for push adapters
   */
  async fetch(): Promise<AdapterEvent[]> {
    throw new Error('PushAdapter does not support fetch()');
  }

  /**
   * Receive and process document push
   *
   * Steps:
   * 1. Parse the incoming document
   * 2. Chunk the content based on strategy
   * 3. Add chunk metadata (index, total, parent_document_id)
   * 4. Map each chunk to AdapterEvent
   * 5. Return events
   */
  async receive(request: ReceiveRequest): Promise<AdapterEvent[]> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    try {
      // Parse payload
      const payload = typeof request.payload === 'string'
        ? JSON.parse(request.payload)
        : request.payload;

      // Extract document fields
      const documentId = extractField(payload, 'document_id') || extractField(payload, 'id');
      const title = extractField(payload, 'title') || 'Untitled Document';
      const content = extractField(payload, 'content') || extractField(payload, 'body');
      const author = extractField(payload, 'author') || 'Unknown';
      const url = extractField(payload, 'url');

      if (!content) {
        throw new Error('Document content is required');
      }

      // Get chunking strategy
      const strategy = ((this.config as any)?.chunking_strategy || 'paragraphs') as ChunkingStrategy;

      // Chunk the content
      const chunks = this.chunkContent(content, strategy);

      // Map each chunk to AdapterEvent
      const events: AdapterEvent[] = chunks.map((chunk, index) => ({
        externalId: documentId ? `${documentId}:chunk:${index}` : `chunk:${Date.now()}:${index}`,
        title: `${title} (${index + 1}/${chunks.length})`,
        body: chunk,
        author: String(author),
        occurredAt: request.receivedAt,
        url,
        rawPayload: {
          ...payload,
          chunk_metadata: {
            chunk_index: index,
            total_chunks: chunks.length,
            parent_document_id: documentId,
          },
        },
      }));

      // Record success
      this.consecutiveFailures = 0;
      this.lastError = undefined;

      return events;
    } catch (error) {
      // Record failure
      this.consecutiveFailures++;
      this.lastError = error instanceof Error ? error.message : String(error);

      throw error;
    }
  }

  /**
   * Get current health status
   */
  getHealth(): SourceHealth {
    let status: 'healthy' | 'warn' | 'unhealthy' | 'disabled' = 'healthy';

    if (this.consecutiveFailures >= 10) {
      status = 'disabled';
    } else if (this.consecutiveFailures >= 3) {
      status = 'unhealthy';
    } else if (this.consecutiveFailures >= 1) {
      status = 'warn';
    }

    return {
      status,
      consecutive_failures: this.consecutiveFailures,
      last_error: this.lastError,
    };
  }

  /**
   * Chunk content based on strategy
   */
  private chunkContent(content: string, strategy: ChunkingStrategy): string[] {
    switch (strategy) {
      case 'headings':
        return this.chunkByHeadings(content);
      case 'paragraphs':
        return this.chunkByParagraphs(content);
      case 'sentences':
        return this.chunkBySentences(content);
      case 'speaker':
        return this.chunkBySpeaker(content);
      default:
        return this.chunkByParagraphs(content);
    }
  }

  /**
   * Chunk by markdown headings (##, ###, ####)
   */
  private chunkByHeadings(content: string): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      // Check if line is a heading (##, ###, ####)
      if (/^#{2,4}\s/.test(line)) {
        // Save previous chunk if not empty
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        // Start new chunk with heading
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }

    // Save last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content];
  }

  /**
   * Chunk by paragraphs (double newlines)
   */
  private chunkByParagraphs(content: string): string[] {
    const chunks = content
      .split(/\n\s*\n/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);

    return chunks.length > 0 ? chunks : [content];
  }

  /**
   * Chunk by sentences (. ? ! followed by space/newline)
   */
  private chunkBySentences(content: string): string[] {
    // Split on sentence boundaries
    const chunks = content
      .split(/([.?!])\s+/)
      .reduce((acc: string[], part, i, arr) => {
        // Combine sentence with punctuation
        if (i % 2 === 0) {
          const sentence = part + (arr[i + 1] || '');
          if (sentence.trim()) {
            acc.push(sentence.trim());
          }
        }
        return acc;
      }, []);

    return chunks.length > 0 ? chunks : [content];
  }

  /**
   * Chunk by speaker labels (Name: or [Name])
   *
   * Useful for interview transcripts
   */
  private chunkBySpeaker(content: string): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let currentSpeaker = '';

    for (const line of lines) {
      // Check if line starts with speaker label
      const speakerMatch = line.match(/^([A-Z][a-z]+):\s*(.*)$/) ||
                          line.match(/^\[([A-Z][a-z]+)\]\s*(.*)$/);

      if (speakerMatch) {
        const [, speaker] = speakerMatch;

        // Save previous speaker's chunk if different speaker
        if (currentSpeaker && currentSpeaker !== speaker && currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        currentSpeaker = speaker;
        currentChunk += line + '\n';
      } else {
        // Continue current speaker's text
        currentChunk += line + '\n';
      }
    }

    // Save last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content];
  }
}

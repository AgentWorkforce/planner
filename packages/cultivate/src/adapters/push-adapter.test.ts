/**
 * Tests for PushAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PushAdapter } from './push-adapter.js';
import type { SourceConfig, AdapterType } from '../domain/types.js';
import type { ReceiveRequest } from './adapter.js';

describe('PushAdapter', () => {
  let adapter: PushAdapter;

  beforeEach(() => {
    adapter = new PushAdapter();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Push',
        adapter_type: 'push' as AdapterType,
        poll_interval_ms: 0,
      };

      await expect(adapter.initialize(config as SourceConfig)).resolves.not.toThrow();
    });
  });

  describe('chunking strategies', () => {
    describe('heading-based chunking', () => {
      beforeEach(async () => {
        const config: any = {
          id: 'source-1',
          name: 'Test Push',
          adapter_type: 'push' as AdapterType,
          poll_interval_ms: 0,
          chunking_strategy: 'headings',
        };

        await adapter.initialize(config);
      });

      it('should chunk by markdown headings', async () => {
        const content = `## Introduction
This is the intro.

## Chapter 1
First chapter content.

### Section 1.1
Subsection content.

## Chapter 2
Second chapter content.`;

        const payload = {
          document_id: 'doc-1',
          title: 'Test Document',
          content,
          author: 'Test Author',
        };

        const request: ReceiveRequest = {
          payload,
          receivedAt: '2024-01-01T00:00:00Z',
        };

        const events = await adapter.receive(request);

        expect(events).toHaveLength(4);
        expect(events[0].body).toContain('## Introduction');
        expect(events[1].body).toContain('## Chapter 1');
        expect(events[2].body).toContain('### Section 1.1');
        expect(events[3].body).toContain('## Chapter 2');
      });
    });

    describe('paragraph-based chunking', () => {
      beforeEach(async () => {
        const config: any = {
          id: 'source-1',
          name: 'Test Push',
          adapter_type: 'push' as AdapterType,
          poll_interval_ms: 0,
          chunking_strategy: 'paragraphs',
        };

        await adapter.initialize(config);
      });

      it('should chunk by double newlines', async () => {
        const content = `First paragraph.

Second paragraph.

Third paragraph.`;

        const payload = {
          document_id: 'doc-1',
          title: 'Test Document',
          content,
          author: 'Test Author',
        };

        const request: ReceiveRequest = {
          payload,
          receivedAt: '2024-01-01T00:00:00Z',
        };

        const events = await adapter.receive(request);

        expect(events).toHaveLength(3);
        expect(events[0].body).toBe('First paragraph.');
        expect(events[1].body).toBe('Second paragraph.');
        expect(events[2].body).toBe('Third paragraph.');
      });

      it('should default to paragraphs if strategy not specified', async () => {
        const config: any = {
          id: 'source-1',
          name: 'Test Push',
          adapter_type: 'push' as AdapterType,
          poll_interval_ms: 0,
          // No chunking_strategy specified
        };

        await adapter.initialize(config);

        const content = `First paragraph.

Second paragraph.`;

        const payload = {
          document_id: 'doc-1',
          title: 'Test Document',
          content,
          author: 'Test Author',
        };

        const request: ReceiveRequest = {
          payload,
          receivedAt: '2024-01-01T00:00:00Z',
        };

        const events = await adapter.receive(request);

        expect(events).toHaveLength(2);
      });
    });

    describe('sentence-based chunking', () => {
      beforeEach(async () => {
        const config: any = {
          id: 'source-1',
          name: 'Test Push',
          adapter_type: 'push' as AdapterType,
          poll_interval_ms: 0,
          chunking_strategy: 'sentences',
        };

        await adapter.initialize(config);
      });

      it('should chunk by sentence boundaries', async () => {
        const content = 'First sentence. Second sentence? Third sentence!';

        const payload = {
          document_id: 'doc-1',
          title: 'Test Document',
          content,
          author: 'Test Author',
        };

        const request: ReceiveRequest = {
          payload,
          receivedAt: '2024-01-01T00:00:00Z',
        };

        const events = await adapter.receive(request);

        expect(events).toHaveLength(3);
        expect(events[0].body).toBe('First sentence.');
        expect(events[1].body).toBe('Second sentence?');
        expect(events[2].body).toBe('Third sentence!');
      });
    });

    describe('speaker-based chunking', () => {
      beforeEach(async () => {
        const config: any = {
          id: 'source-1',
          name: 'Test Push',
          adapter_type: 'push' as AdapterType,
          poll_interval_ms: 0,
          chunking_strategy: 'speaker',
        };

        await adapter.initialize(config);
      });

      it('should chunk by speaker labels (colon format)', async () => {
        const content = `Alice: Hello, how are you?
I'm doing great.

Bob: I'm doing well, thanks!
How about you?

Alice: Excellent, thanks for asking.`;

        const payload = {
          document_id: 'doc-1',
          title: 'Interview Transcript',
          content,
          author: 'Interviewer',
        };

        const request: ReceiveRequest = {
          payload,
          receivedAt: '2024-01-01T00:00:00Z',
        };

        const events = await adapter.receive(request);

        expect(events).toHaveLength(3);
        expect(events[0].body).toContain('Alice:');
        expect(events[1].body).toContain('Bob:');
        expect(events[2].body).toContain('Alice:');
      });

      it('should chunk by speaker labels (bracket format)', async () => {
        const content = `[Alice] Hello there.

[Bob] Hi Alice!

[Alice] Good to see you.`;

        const payload = {
          document_id: 'doc-1',
          title: 'Interview Transcript',
          content,
          author: 'Interviewer',
        };

        const request: ReceiveRequest = {
          payload,
          receivedAt: '2024-01-01T00:00:00Z',
        };

        const events = await adapter.receive(request);

        expect(events).toHaveLength(3);
        expect(events[0].body).toContain('[Alice]');
        expect(events[1].body).toContain('[Bob]');
        expect(events[2].body).toContain('[Alice]');
      });
    });
  });

  describe('chunk metadata', () => {
    beforeEach(async () => {
      const config: any = {
        id: 'source-1',
        name: 'Test Push',
        adapter_type: 'push' as AdapterType,
        poll_interval_ms: 0,
        chunking_strategy: 'paragraphs',
      };

      await adapter.initialize(config);
    });

    it('should add chunk index and total to each event', async () => {
      const content = `Para 1.

Para 2.

Para 3.`;

      const payload = {
        document_id: 'doc-123',
        title: 'Test Document',
        content,
        author: 'Test Author',
      };

      const request: ReceiveRequest = {
        payload,
        receivedAt: '2024-01-01T00:00:00Z',
      };

      const events = await adapter.receive(request);

      expect(events).toHaveLength(3);

      // Check titles
      expect(events[0].title).toBe('Test Document (1/3)');
      expect(events[1].title).toBe('Test Document (2/3)');
      expect(events[2].title).toBe('Test Document (3/3)');

      // Check metadata in rawPayload
      expect((events[0].rawPayload as any).chunk_metadata).toEqual({
        chunk_index: 0,
        total_chunks: 3,
        parent_document_id: 'doc-123',
      });

      expect((events[2].rawPayload as any).chunk_metadata).toEqual({
        chunk_index: 2,
        total_chunks: 3,
        parent_document_id: 'doc-123',
      });
    });

    it('should generate chunk IDs with document_id', async () => {
      const content = `Para 1.

Para 2.`;

      const payload = {
        document_id: 'doc-456',
        title: 'Test Document',
        content,
        author: 'Test Author',
      };

      const request: ReceiveRequest = {
        payload,
        receivedAt: '2024-01-01T00:00:00Z',
      };

      const events = await adapter.receive(request);

      expect(events[0].externalId).toBe('doc-456:chunk:0');
      expect(events[1].externalId).toBe('doc-456:chunk:1');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Push',
        adapter_type: 'push' as AdapterType,
        poll_interval_ms: 0,
      };

      await adapter.initialize(config as SourceConfig);
    });

    it('should throw if content is missing', async () => {
      const payload = {
        document_id: 'doc-1',
        title: 'Test Document',
        // content missing
        author: 'Test Author',
      };

      const request: ReceiveRequest = {
        payload,
        receivedAt: '2024-01-01T00:00:00Z',
      };

      await expect(adapter.receive(request)).rejects.toThrow('Document content is required');
    });
  });

  describe('getHealth', () => {
    beforeEach(async () => {
      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Push',
        adapter_type: 'push' as AdapterType,
        poll_interval_ms: 0,
      };

      await adapter.initialize(config as SourceConfig);
    });

    it('should return healthy status initially', () => {
      const health = adapter.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.consecutive_failures).toBe(0);
    });

    it('should update health after failures', async () => {
      const request: ReceiveRequest = {
        payload: { invalid: 'data' },
        receivedAt: '2024-01-01T00:00:00Z',
      };

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        try {
          await adapter.receive(request);
        } catch {
          // Expected
        }
      }

      const health = adapter.getHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.consecutive_failures).toBe(5);
    });
  });

  describe('fetch', () => {
    it('should throw error (not supported for push adapter)', async () => {
      await expect(adapter.fetch()).rejects.toThrow('does not support fetch()');
    });
  });
});

/**
 * Tests for WebhookAdapter
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { WebhookAdapter } from './webhook-adapter.js';
import type { SourceConfig, AdapterType } from '../domain/types.js';
import type { ReceiveRequest } from './adapter.js';
import { CredentialManager } from '../auth/credential-manager.js';
import { initEncryption, _clearCachedKey } from '../auth/encryption.js';
import type { EncryptedCredential } from '../auth/encryption.js';

describe('WebhookAdapter', () => {
  let adapter: WebhookAdapter;

  beforeAll(() => {
    // Set up encryption for tests
    process.env.CULTIVATE_SECRET = 'test-secret-for-webhook-adapter-tests';
    initEncryption();
  });

  afterAll(() => {
    _clearCachedKey();
    delete process.env.CULTIVATE_SECRET;
  });

  beforeEach(() => {
    adapter = new WebhookAdapter();
  });

  describe('initialization', () => {
    it('should initialize without credentials', async () => {
      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Webhook',
        adapter_type: 'webhook' as AdapterType,
        poll_interval_ms: 0,
      };

      await expect(adapter.initialize(config as SourceConfig)).resolves.not.toThrow();
    });

    it('should decrypt credentials if present', async () => {
      const credentialManager = new CredentialManager();
      const encrypted = credentialManager.encryptCredentials({
        webhook_secret: 'test-secret',
      });

      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Webhook',
        adapter_type: 'webhook' as AdapterType,
        poll_interval_ms: 0,
        auth: {
          type: 'hmac',
          encrypted_credentials: encrypted,
        },
      };

      await expect(adapter.initialize(config as SourceConfig)).resolves.not.toThrow();
    });
  });

  describe('receive', () => {
    beforeEach(async () => {
      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Webhook',
        adapter_type: 'webhook' as AdapterType,
        poll_interval_ms: 0,
      };

      await adapter.initialize(config as SourceConfig);
    });

    it('should map payload to event using field_mapping', async () => {
      const payload = {
        id: 'event-123',
        title: 'Test Event',
        body: 'Event body',
        author: 'user@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      const request: ReceiveRequest = {
        payload,
        receivedAt: '2024-01-01T00:00:00Z',
      };

      const events = await adapter.receive(request);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        externalId: 'event-123',
        title: 'Test Event',
        body: 'Event body',
        author: 'user@example.com',
        occurredAt: '2024-01-01T00:00:00Z',
        url: undefined,
        rawPayload: payload,
      });
    });

    it('should use receivedAt if occurred_at not present', async () => {
      const payload = {
        id: 'event-123',
        title: 'Test Event',
        body: 'Event body',
        author: 'user@example.com',
      };

      const request: ReceiveRequest = {
        payload,
        receivedAt: '2024-01-01T12:00:00Z',
      };

      const events = await adapter.receive(request);

      expect(events[0].occurredAt).toBe('2024-01-01T12:00:00Z');
    });

    it('should return empty array if required fields missing', async () => {
      const payload = {
        id: 'event-123',
        // Missing title, body, author
      };

      const request: ReceiveRequest = {
        payload,
        receivedAt: '2024-01-01T00:00:00Z',
      };

      const events = await adapter.receive(request);

      expect(events).toHaveLength(0);
    });
  });

  describe('HMAC signature verification', () => {
    const webhookSecret = 'test-secret-key';

    beforeEach(async () => {
      const credentialManager = new CredentialManager();
      const encrypted = credentialManager.encryptCredentials({
        webhook_secret: webhookSecret,
        signature_header: 'X-Hub-Signature-256',
      });

      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Webhook',
        adapter_type: 'webhook' as AdapterType,
        poll_interval_ms: 0,
        auth: {
          type: 'hmac',
          encrypted_credentials: encrypted,
        },
      };

      await adapter.initialize(config as SourceConfig);
    });

    it('should verify valid HMAC signature', async () => {
      const payload = {
        id: 'event-123',
        title: 'Test Event',
        body: 'Event body',
        author: 'user@example.com',
      };

      const payloadString = JSON.stringify(payload);
      const signature = createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      const request: ReceiveRequest = {
        payload: payloadString,
        headers: {
          'X-Hub-Signature-256': `sha256=${signature}`,
        },
        receivedAt: '2024-01-01T00:00:00Z',
      };

      const events = await adapter.receive(request);

      expect(events).toHaveLength(1);
    });

    it('should reject invalid HMAC signature', async () => {
      const payload = {
        id: 'event-123',
        title: 'Test Event',
        body: 'Event body',
        author: 'user@example.com',
      };

      const payloadString = JSON.stringify(payload);
      const invalidSignature = 'invalid-signature-value';

      const request: ReceiveRequest = {
        payload: payloadString,
        headers: {
          'X-Hub-Signature-256': `sha256=${invalidSignature}`,
        },
        receivedAt: '2024-01-01T00:00:00Z',
      };

      await expect(adapter.receive(request)).rejects.toThrow('Signature verification failed');
    });

    it('should reject tampered payload with timing-safe comparison', async () => {
      const originalPayload = {
        id: 'event-123',
        title: 'Test Event',
        body: 'Event body',
        author: 'user@example.com',
      };

      const originalString = JSON.stringify(originalPayload);
      const signature = createHmac('sha256', webhookSecret)
        .update(originalString)
        .digest('hex');

      // Tamper with payload
      const tamperedPayload = { ...originalPayload, body: 'Tampered body' };

      const request: ReceiveRequest = {
        payload: JSON.stringify(tamperedPayload),
        headers: {
          'X-Hub-Signature-256': `sha256=${signature}`,
        },
        receivedAt: '2024-01-01T00:00:00Z',
      };

      await expect(adapter.receive(request)).rejects.toThrow('Signature verification failed');
    });

    it('should reject missing signature header', async () => {
      const payload = {
        id: 'event-123',
        title: 'Test Event',
        body: 'Event body',
        author: 'user@example.com',
      };

      const request: ReceiveRequest = {
        payload: JSON.stringify(payload),
        headers: {},
        receivedAt: '2024-01-01T00:00:00Z',
      };

      await expect(adapter.receive(request)).rejects.toThrow('Missing signature header');
    });
  });

  describe('getHealth', () => {
    beforeEach(async () => {
      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Webhook',
        adapter_type: 'webhook' as AdapterType,
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
      // Initialize with webhook secret to trigger signature verification failure
      const credentialManager = new CredentialManager();
      const encrypted = credentialManager.encryptCredentials({
        webhook_secret: 'test-secret',
      });

      const config: Partial<SourceConfig> = {
        id: 'source-1',
        name: 'Test Webhook',
        adapter_type: 'webhook' as AdapterType,
        poll_interval_ms: 0,
        auth: {
          type: 'hmac',
          encrypted_credentials: encrypted,
        },
      };

      await adapter.initialize(config as SourceConfig);

      const request: ReceiveRequest = {
        payload: JSON.stringify({ test: 'data' }),
        headers: {}, // Missing signature header - will cause failure
        receivedAt: '2024-01-01T00:00:00Z',
      };

      // Trigger 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await adapter.receive(request);
        } catch {
          // Expected
        }
      }

      const health = adapter.getHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.consecutive_failures).toBe(3);
    });
  });

  describe('fetch', () => {
    it('should throw error (not supported for webhook adapter)', async () => {
      await expect(adapter.fetch()).rejects.toThrow('does not support fetch()');
    });
  });
});

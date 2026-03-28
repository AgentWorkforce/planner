/**
 * Webhook receiver adapter with HMAC signature verification
 *
 * Receives webhooks from external services, verifies signatures,
 * and normalizes payload to AdapterEvents.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SourceAdapter, AdapterEvent, ReceiveRequest, SourceHealth } from './adapter.js';
import type { SourceConfig } from '../domain/types.js';
import { CredentialManager } from '../auth/credential-manager.js';
import type { EncryptedCredential } from '../auth/encryption.js';

/**
 * Extract a field value from an object using dot-notation path
 *
 * @param obj - The object to extract from
 * @param path - Dot-notation path (e.g., 'data.event', 'payload.message')
 * @returns The value at the path, or undefined if not found
 */
function extractField(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Webhook adapter - receives and verifies webhook payloads
 */
export class WebhookAdapter implements SourceAdapter {
  private config: SourceConfig | null = null;
  private credentials: Record<string, string> | null = null;
  private credentialManager = new CredentialManager();
  private consecutiveFailures = 0;
  private lastError: string | undefined;

  /**
   * Initialize the adapter with configuration
   * Decrypts webhook secret if present
   */
  async initialize(config: SourceConfig): Promise<void> {
    this.config = config;

    // Decrypt credentials if present
    if (config.auth?.encrypted_credentials) {
      try {
        this.credentials = this.credentialManager.decryptCredentials(
          config.auth.encrypted_credentials as EncryptedCredential
        );
      } catch (error) {
        throw new Error(
          `Failed to decrypt credentials for source ${config.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Not implemented for webhook adapters
   */
  async fetch(): Promise<AdapterEvent[]> {
    throw new Error('WebhookAdapter does not support fetch()');
  }

  /**
   * Receive and process webhook payload
   *
   * Steps:
   * 1. Verify HMAC signature if webhook_secret is configured
   * 2. Parse body as JSON
   * 3. Map fields to AdapterEvent using field_mapping
   * 4. Return events
   */
  async receive(request: ReceiveRequest): Promise<AdapterEvent[]> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    try {
      // Verify HMAC signature if configured
      if (this.credentials?.webhook_secret) {
        this.verifySignature(request);
      }

      // Parse payload (should already be parsed by Express, but handle both cases)
      const payload = typeof request.payload === 'string'
        ? JSON.parse(request.payload)
        : request.payload;

      // Map payload to event
      const event = this.mapToEvent(payload, request.receivedAt);

      if (!event) {
        console.warn('[WebhookAdapter] Failed to map payload to event');
        return [];
      }

      // Record success
      this.consecutiveFailures = 0;
      this.lastError = undefined;

      return [event];
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
   * Verify HMAC signature from webhook request
   *
   * Uses timing-safe comparison to prevent timing attacks
   *
   * @throws Error if signature verification fails
   */
  private verifySignature(request: ReceiveRequest): void {
    if (!this.credentials?.webhook_secret) {
      return;
    }

    // Get signature header name (default: X-Hub-Signature-256)
    const signatureHeaderName = this.credentials.signature_header || 'X-Hub-Signature-256';
    const signatureHeader = request.headers?.[signatureHeaderName];

    if (!signatureHeader) {
      throw new Error(`Missing signature header: ${signatureHeaderName}`);
    }

    // Compute expected signature
    const bodyString = typeof request.payload === 'string'
      ? request.payload
      : JSON.stringify(request.payload);

    const expectedSignature = createHmac('sha256', this.credentials.webhook_secret)
      .update(bodyString)
      .digest('hex');

    // Extract signature from header (may be prefixed with algorithm, e.g., "sha256=...")
    let receivedSignature = signatureHeader;
    if (receivedSignature.includes('=')) {
      receivedSignature = receivedSignature.split('=')[1];
    }

    // Timing-safe comparison
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');

    if (expectedBuffer.length !== receivedBuffer.length) {
      throw new Error('Signature verification failed: length mismatch');
    }

    if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new Error('Signature verification failed: invalid signature');
    }
  }

  /**
   * Map webhook payload to AdapterEvent using field_mapping
   */
  private mapToEvent(payload: any, receivedAt: string): AdapterEvent | null {
    const fieldMapping = (this.config as any)?.field_mapping || {};

    try {
      // Extract required fields using field mapping
      const externalId = extractField(payload, fieldMapping.external_id || 'id');
      const title = extractField(payload, fieldMapping.title || 'title');
      const body = extractField(payload, fieldMapping.body || 'body');
      const author = extractField(payload, fieldMapping.author || 'author');
      const occurredAt = extractField(payload, fieldMapping.occurred_at || 'created_at');
      const url = extractField(payload, fieldMapping.url || 'url');

      // Validate required fields
      if (!externalId || !title || !body || !author) {
        console.warn('[WebhookAdapter] Missing required fields in payload:', {
          externalId,
          title,
          body,
          author,
        });
        return null;
      }

      return {
        externalId: String(externalId),
        title: String(title),
        body: String(body),
        author: String(author),
        occurredAt: occurredAt ? String(occurredAt) : receivedAt,
        url: url ? String(url) : undefined,
        rawPayload: payload,
      };
    } catch (error) {
      console.error('[WebhookAdapter] Error mapping payload to event:', error);
      return null;
    }
  }
}

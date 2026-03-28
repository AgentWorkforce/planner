/**
 * HTTP polling adapter for REST APIs
 *
 * Polls external APIs at configured intervals, handles pagination,
 * and normalizes responses to AdapterEvents.
 */

import type { SourceAdapter, AdapterEvent, SourceHealth } from './adapter.js';
import type { SourceConfig } from '../domain/types.js';
import { CredentialManager } from '../auth/credential-manager.js';
import type { EncryptedCredential } from '../auth/encryption.js';

/**
 * Extract a field value from an object using dot-notation path
 *
 * @param obj - The object to extract from
 * @param path - Dot-notation path (e.g., 'data.items', 'response.results')
 * @returns The value at the path, or undefined if not found
 */
function extractField(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Poll API adapter - fetches data from REST APIs with pagination support
 */
export class PollApiAdapter implements SourceAdapter {
  private config: SourceConfig | null = null;
  private credentials: Record<string, string> | null = null;
  private credentialManager = new CredentialManager();
  private consecutiveFailures = 0;
  private lastError: string | undefined;

  /**
   * Initialize the adapter with configuration
   * Decrypts credentials if present
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
   * Fetch events from the API
   *
   * Steps:
   * 1. Build URL from config.endpoint_template with variable substitution
   * 2. Set auth headers based on credential type
   * 3. Call fetch() with timeout
   * 4. Parse JSON response
   * 5. Extract items from response using response_path
   * 6. Map each item to AdapterEvent using field_mapping
   * 7. Handle pagination if present
   */
  async fetch(): Promise<AdapterEvent[]> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    const allEvents: AdapterEvent[] = [];
    let cursor: string | null = null;
    let page = 1;
    const maxPages = 10; // Safety limit to prevent infinite pagination

    try {
      do {
        // Build URL with variable substitution
        const url = this.buildUrl(cursor, page);

        // Set up request headers
        const headers = this.buildHeaders();

        // Fetch with timeout (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        let response: Response;
        try {
          response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Parse JSON response
        const data = await response.json();

        // Extract items from response using response_path
        const items = this.extractItems(data);

        // Map each item to AdapterEvent
        for (const item of items) {
          const event = this.mapToEvent(item);
          if (event) {
            allEvents.push(event);
          }
        }

        // Check for pagination
        cursor = this.extractNextCursor(data);
        page++;

        // Safety check: don't paginate forever
        if (page > maxPages) {
          console.warn(`[PollApiAdapter] Reached max pages (${maxPages}) for ${this.config.name}`);
          break;
        }
      } while (cursor !== null);

      // Record success
      this.consecutiveFailures = 0;
      this.lastError = undefined;

      return allEvents;
    } catch (error) {
      // Record failure
      this.consecutiveFailures++;
      this.lastError = error instanceof Error ? error.message : String(error);

      throw error;
    }
  }

  /**
   * Not implemented for poll adapters
   */
  async receive(): Promise<AdapterEvent[]> {
    throw new Error('PollApiAdapter does not support receive()');
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
   * Build URL with variable substitution
   *
   * Replaces {cursor}, {since}, {page} with actual values
   */
  private buildUrl(cursor: string | null, page: number): string {
    if (!this.config?.endpoint_template) {
      throw new Error('No endpoint_template configured');
    }

    let url = this.config.endpoint_template;

    // Replace variables
    url = url.replace('{cursor}', cursor || '');
    url = url.replace('{page}', String(page));
    url = url.replace('{since}', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24h default

    return url;
  }

  /**
   * Build request headers with authentication
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Cultivate/1.0',
    };

    if (!this.config?.auth || !this.credentials) {
      return headers;
    }

    const authType = this.config.auth.type;

    switch (authType) {
      case 'bearer':
        if (this.credentials.token) {
          headers['Authorization'] = `Bearer ${this.credentials.token}`;
        }
        break;

      case 'api_key':
        if (this.credentials.api_key) {
          // Check if there's a custom header name
          const headerName = this.credentials.header_name || 'X-API-Key';
          headers[headerName] = this.credentials.api_key;
        }
        break;

      case 'basic':
        if (this.credentials.username && this.credentials.password) {
          const encoded = Buffer.from(
            `${this.credentials.username}:${this.credentials.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;

      case 'oauth2':
        if (this.credentials.access_token) {
          headers['Authorization'] = `Bearer ${this.credentials.access_token}`;
        }
        break;

      default:
        console.warn(`[PollApiAdapter] Unsupported auth type: ${authType}`);
    }

    return headers;
  }

  /**
   * Extract items array from response using configured path
   */
  private extractItems(data: any): any[] {
    // Default path if not configured
    const responsePath = (this.config as any)?.response_path || 'data';

    const items = extractField(data, responsePath);

    if (!Array.isArray(items)) {
      console.warn(`[PollApiAdapter] Response path ${responsePath} did not return an array`);
      return [];
    }

    return items;
  }

  /**
   * Extract next cursor/page from response for pagination
   */
  private extractNextCursor(data: any): string | null {
    // Check common pagination fields
    const paginationPath = (this.config as any)?.pagination_path;

    if (paginationPath) {
      const cursor = extractField(data, paginationPath);
      return cursor ? String(cursor) : null;
    }

    // Try common pagination patterns
    const nextCursor = data.next_cursor || data.nextCursor || data.pagination?.next_cursor;
    if (nextCursor) {
      return String(nextCursor);
    }

    const nextPage = data.next_page || data.nextPage || data.pagination?.next_page;
    if (nextPage) {
      return String(nextPage);
    }

    // No pagination found
    return null;
  }

  /**
   * Map a single item to AdapterEvent using field_mapping
   */
  private mapToEvent(item: any): AdapterEvent | null {
    const fieldMapping = (this.config as any)?.field_mapping || {};

    try {
      // Extract required fields using field mapping
      const externalId = extractField(item, fieldMapping.external_id || 'id');
      const title = extractField(item, fieldMapping.title || 'title');
      const body = extractField(item, fieldMapping.body || 'body');
      const author = extractField(item, fieldMapping.author || 'author');
      const occurredAt = extractField(item, fieldMapping.occurred_at || 'created_at');
      const url = extractField(item, fieldMapping.url || 'url');

      // Validate required fields
      if (!externalId || !title || !body || !author) {
        console.warn('[PollApiAdapter] Missing required fields in item:', {
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
        occurredAt: occurredAt ? String(occurredAt) : new Date().toISOString(),
        url: url ? String(url) : undefined,
        rawPayload: item,
      };
    } catch (error) {
      console.error('[PollApiAdapter] Error mapping item to event:', error);
      return null;
    }
  }
}

/**
 * Structured data pull adapter
 *
 * Similar to PollApiAdapter but with enhanced support for:
 * - Query templates with variable substitution
 * - JSONPath-like extraction from nested responses
 * - Cursor-based pagination via response fields
 * - Complex nested data structures
 */

import type { SourceAdapter, AdapterEvent, SourceHealth } from './adapter.js';
import type { SourceConfig } from '../domain/types.js';
import { CredentialManager } from '../auth/credential-manager.js';
import type { EncryptedCredential } from '../auth/encryption.js';

/**
 * Extract a field value from an object using dot-notation path
 */
function extractField(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Structured pull adapter - fetches structured data with advanced extraction
 */
export class StructuredPullAdapter implements SourceAdapter {
  private config: SourceConfig | null = null;
  private credentials: Record<string, string> | null = null;
  private credentialManager = new CredentialManager();
  private consecutiveFailures = 0;
  private lastError: string | undefined;

  /**
   * Initialize the adapter with configuration
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
   * Fetch structured data from the source
   *
   * Similar to PollApiAdapter but with:
   * - Query templates with variable substitution
   * - JSONPath-like extraction
   * - Cursor-based pagination
   * - Nested data structure handling
   */
  async fetch(): Promise<AdapterEvent[]> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    const allEvents: AdapterEvent[] = [];
    let cursor: string | null = null;
    let page = 1;
    const maxPages = 20; // Higher limit for structured data sources

    try {
      do {
        // Build URL/query with variable substitution
        const url = this.buildUrl(cursor, page);

        // Set up request headers
        const headers = this.buildHeaders();

        // Build request body if needed (for GraphQL, etc.)
        const body = this.buildRequestBody(cursor, page);

        // Determine HTTP method
        const method = body ? 'POST' : 'GET';

        // Fetch with timeout (60 seconds for complex queries)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let response: Response;
        try {
          response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
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

        // Extract items using JSONPath-like selectors
        const items = this.extractItems(data);

        // Map each item to AdapterEvent
        for (const item of items) {
          const event = this.mapToEvent(item);
          if (event) {
            allEvents.push(event);
          }
        }

        // Check for pagination cursor
        cursor = this.extractNextCursor(data);
        page++;

        // Safety check
        if (page > maxPages) {
          console.warn(`[StructuredPullAdapter] Reached max pages (${maxPages}) for ${this.config.name}`);
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
   * Not implemented for structured pull adapters
   */
  async receive(): Promise<AdapterEvent[]> {
    throw new Error('StructuredPullAdapter does not support receive()');
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
   */
  private buildUrl(cursor: string | null, page: number): string {
    if (!this.config?.endpoint_template) {
      throw new Error('No endpoint_template configured');
    }

    let url = this.config.endpoint_template;

    // Get variable values from config
    const variables = (this.config as any)?.query_variables || {};

    // Replace template variables
    url = url.replace(/{(\w+)}/g, (match, varName) => {
      if (varName === 'cursor') {
        return cursor || '';
      }
      if (varName === 'page') {
        return String(page);
      }
      if (varName === 'since') {
        return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      }
      // Use configured variable value
      return variables[varName] || match;
    });

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
    }

    return headers;
  }

  /**
   * Build request body for POST requests (e.g., GraphQL)
   */
  private buildRequestBody(cursor: string | null, page: number): any | null {
    const queryTemplate = (this.config as any)?.query_template;

    if (!queryTemplate) {
      return null;
    }

    // Variable substitution in query template
    const variables = (this.config as any)?.query_variables || {};
    const queryVariables = {
      ...variables,
      cursor: cursor || undefined,
      page,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    };

    // For GraphQL queries
    if (typeof queryTemplate === 'string') {
      return {
        query: queryTemplate,
        variables: queryVariables,
      };
    }

    // For other structured queries
    return queryTemplate;
  }

  /**
   * Extract items from response using JSONPath-like selectors
   */
  private extractItems(data: any): any[] {
    const responsePath = (this.config as any)?.response_path || 'data';

    // Support array notation in path (e.g., 'data.items[*]')
    let items = extractField(data, responsePath.replace(/\[\*\]/, ''));

    if (!Array.isArray(items)) {
      console.warn(`[StructuredPullAdapter] Response path ${responsePath} did not return an array`);
      return [];
    }

    return items;
  }

  /**
   * Extract pagination cursor from response
   */
  private extractNextCursor(data: any): string | null {
    const paginationPath = (this.config as any)?.pagination_path;

    if (paginationPath) {
      const cursor = extractField(data, paginationPath);
      return cursor ? String(cursor) : null;
    }

    // Try common pagination patterns
    const nextCursor = extractField(data, 'pageInfo.endCursor') ||
                      extractField(data, 'pagination.next_cursor') ||
                      extractField(data, 'next_cursor') ||
                      extractField(data, 'nextCursor');

    if (nextCursor) {
      return String(nextCursor);
    }

    // Check for "has more" flag
    const hasMore = extractField(data, 'pageInfo.hasNextPage') ||
                   extractField(data, 'pagination.has_more') ||
                   extractField(data, 'has_more');

    if (hasMore === false) {
      return null;
    }

    return null;
  }

  /**
   * Map item to AdapterEvent using field mapping
   */
  private mapToEvent(item: any): AdapterEvent | null {
    const fieldMapping = (this.config as any)?.field_mapping || {};

    try {
      // Extract fields using mapping
      const externalId = extractField(item, fieldMapping.external_id || 'id');
      const title = extractField(item, fieldMapping.title || 'title');
      const body = extractField(item, fieldMapping.body || 'body');
      const author = extractField(item, fieldMapping.author || 'author');
      const occurredAt = extractField(item, fieldMapping.occurred_at || 'createdAt');
      const url = extractField(item, fieldMapping.url || 'url');

      // Validate required fields
      if (!externalId || !title || !body || !author) {
        console.warn('[StructuredPullAdapter] Missing required fields in item:', {
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
      console.error('[StructuredPullAdapter] Error mapping item to event:', error);
      return null;
    }
  }
}

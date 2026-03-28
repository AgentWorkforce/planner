/**
 * Credential Manager for Source Config Encryption
 *
 * This module provides a high-level interface for encrypting and decrypting
 * source configuration credentials (API keys, client secrets, tokens, etc.)
 * as a single encrypted blob.
 */

import { encrypt, decrypt, type EncryptedCredential } from './encryption.js';

/**
 * CredentialManager handles encryption/decryption of source config credentials
 *
 * Source configs typically have multiple credential fields (api_key, client_id,
 * client_secret, etc.) that need to be stored securely. This class wraps the
 * lower-level encrypt/decrypt functions to handle the common case of storing
 * these as a single encrypted blob.
 */
export class CredentialManager {
  /**
   * Encrypt a credentials object into a single encrypted string
   *
   * Takes a key-value object of credentials and serializes it to JSON,
   * then encrypts the JSON string using AES-256-GCM.
   *
   * @param credentials - Key-value pairs of credential fields
   * @returns Encrypted credential string (base64-encoded)
   *
   * @example
   * ```typescript
   * const manager = new CredentialManager();
   * const encrypted = manager.encryptCredentials({
   *   api_key: 'sk_live_123',
   *   client_id: 'client_abc',
   *   client_secret: 'secret_xyz'
   * });
   * ```
   */
  encryptCredentials(credentials: Record<string, string>): EncryptedCredential {
    // Serialize credentials to JSON
    const json = JSON.stringify(credentials);

    // Encrypt the JSON string
    return encrypt(json);
  }

  /**
   * Decrypt an encrypted credential string back to the original object
   *
   * Decrypts the encrypted string using AES-256-GCM, then parses the
   * JSON to restore the original key-value credential object.
   *
   * @param encrypted - Base64-encoded encrypted credential string
   * @returns The original credentials object
   * @throws {Error} If decryption fails or JSON parsing fails
   *
   * @example
   * ```typescript
   * const manager = new CredentialManager();
   * const decrypted = manager.decryptCredentials(encrypted);
   * // decrypted = { api_key: 'sk_live_123', client_id: 'client_abc', ... }
   * ```
   */
  decryptCredentials(encrypted: EncryptedCredential): Record<string, string> {
    // Decrypt to JSON string
    const json = decrypt(encrypted);

    // Parse JSON back to object
    const credentials = JSON.parse(json);

    // Type guard: ensure we got an object with string values
    if (typeof credentials !== 'object' || credentials === null || Array.isArray(credentials)) {
      throw new Error('Invalid decrypted credentials: expected object');
    }

    // Validate all values are strings
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value !== 'string') {
        throw new Error(`Invalid credential value for key "${key}": expected string, got ${typeof value}`);
      }
    }

    return credentials as Record<string, string>;
  }
}

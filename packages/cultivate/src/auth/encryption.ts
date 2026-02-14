/**
 * Credential encryption using CULTIVATE_SECRET
 *
 * This module provides key derivation from CULTIVATE_SECRET for encrypting
 * third-party credentials (GitHub tokens, API keys) before storage.
 */

import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { CultivateStartupError } from '../errors.js';

/**
 * Branded type for encrypted credential strings
 * Prevents accidental use of plaintext where encrypted text is expected
 * This is a TypeScript-only type with no runtime overhead
 */
export type EncryptedCredential = string & { readonly __brand: 'EncryptedCredential' };

/**
 * Type guard to check if a value is a valid EncryptedCredential
 * Validates base64 format and minimum length (IV + authTag = 28 bytes)
 *
 * @param value - The value to check
 * @returns true if the value is a valid EncryptedCredential format
 */
export function isEncryptedCredential(value: unknown): value is EncryptedCredential {
  if (typeof value !== 'string') {
    return false;
  }

  // Check if it's valid base64
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    return false;
  }

  // Decode and check minimum length (IV: 12 bytes + authTag: 16 bytes = 28 bytes minimum)
  try {
    const buffer = Buffer.from(value, 'base64');
    return buffer.length >= 28;
  } catch {
    return false;
  }
}

/**
 * Fixed application salt for PBKDF2
 * This is acceptable because CULTIVATE_SECRET is the variable input
 */
const APP_SALT = 'cultivate-credential-encryption-v1';

/**
 * PBKDF2 parameters
 */
const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256-bit key
const HASH_ALGORITHM = 'sha512';

/**
 * Cached derived key (module scope)
 * Avoids re-deriving on every encryption/decryption call
 */
let cachedKey: Buffer | null = null;

/**
 * Derive a 256-bit encryption key from the secret using PBKDF2
 *
 * @param secret - The CULTIVATE_SECRET value
 * @returns 32-byte Buffer suitable for AES-256 encryption
 */
export function deriveKey(secret: string): Buffer {
  // Return cached key if already derived
  if (cachedKey) {
    return cachedKey;
  }

  // Derive key using PBKDF2
  const key = pbkdf2Sync(
    secret,
    APP_SALT,
    ITERATIONS,
    KEY_LENGTH,
    HASH_ALGORITHM
  );

  // Cache for future calls
  cachedKey = key;

  return key;
}

/**
 * Initialize encryption by deriving key from CULTIVATE_SECRET
 *
 * Must be called during startup before any encryption/decryption operations.
 * Throws CultivateStartupError if CULTIVATE_SECRET is missing or empty.
 *
 * @throws {CultivateStartupError} When CULTIVATE_SECRET is not set
 */
export function initEncryption(): void {
  const secret = process.env.CULTIVATE_SECRET;

  if (!secret || secret.trim() === '') {
    throw CultivateStartupError.missingCultivateSecret();
  }

  // Derive and cache the key
  deriveKey(secret);
}

/**
 * Clear the cached key (useful for testing)
 * @internal
 */
export function _clearCachedKey(): void {
  cachedKey = null;
}

/**
 * Validate that encryption has been initialized
 *
 * Must be called before any encryption/decryption operations or before
 * accessing source config credentials. Throws CultivateStartupError if
 * initEncryption() has not been called yet.
 *
 * @throws {CultivateStartupError} When encryption has not been initialized
 */
export function validateEncryptionReady(): void {
  if (!cachedKey) {
    throw CultivateStartupError.missingCultivateSecret();
  }
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * Uses the derived key to encrypt data with authenticated encryption.
 * Each call generates a fresh random IV for security.
 *
 * Format: IV (12 bytes) + authTag (16 bytes) + ciphertext → base64
 *
 * @param plaintext - The text to encrypt
 * @returns Base64-encoded encrypted data as EncryptedCredential
 * @throws {Error} If key has not been initialized via initEncryption()
 */
export function encrypt(plaintext: string): EncryptedCredential {
  if (!cachedKey) {
    throw new Error('Encryption key not initialized. Call initEncryption() first.');
  }

  // Generate random 12-byte IV for GCM
  const iv = randomBytes(12);

  // Create cipher with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', cachedKey, iv);

  // Encrypt the plaintext
  let ciphertext = cipher.update(plaintext, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  // Get the 16-byte authentication tag
  const authTag = cipher.getAuthTag();

  // Concatenate: IV (12) + authTag (16) + ciphertext
  const encrypted = Buffer.concat([iv, authTag, ciphertext]);

  // Return as base64 (safe to cast - format is guaranteed by encrypt process)
  return encrypted.toString('base64') as EncryptedCredential;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * Decodes the base64 string, extracts IV and auth tag, and decrypts.
 * GCM authentication failure throws an error, detecting tampering.
 *
 * @param encrypted - Base64-encoded encrypted data from encrypt() (must be EncryptedCredential)
 * @returns The original plaintext
 * @throws {Error} If key not initialized, data tampered, or invalid format
 */
export function decrypt(encrypted: EncryptedCredential): string {
  if (!cachedKey) {
    throw new Error('Encryption key not initialized. Call initEncryption() first.');
  }

  // Decode base64
  const buffer = Buffer.from(encrypted, 'base64');

  // Minimum size check: 12 (IV) + 16 (authTag) = 28 bytes
  if (buffer.length < 28) {
    throw new Error('Invalid encrypted data: too short');
  }

  // Split into components
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);

  // Create decipher
  const decipher = createDecipheriv('aes-256-gcm', cachedKey, iv);

  // Set the auth tag for verification
  decipher.setAuthTag(authTag);

  // Decrypt (throws if auth tag verification fails)
  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);

  return plaintext.toString('utf8');
}
